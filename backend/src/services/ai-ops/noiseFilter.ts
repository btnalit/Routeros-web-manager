/**
 * NoiseFilter 垃圾告警过滤服务
 * 基于规则和 AI 过滤无意义的告警
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8
 * - 5.1: 维护窗口期间的告警抑制
 * - 5.2: 已知问题模式匹配和抑制
 * - 5.3: 瞬态抖动检测（30秒内多次状态变化）
 * - 5.4: 规则无法判断时调用 AI 智能过滤
 * - 5.5: AI 过滤时记录推理原因用于审计
 * - 5.6: 用户反馈记录（过滤的告警实际重要时）
 * - 5.7: 维护窗口配置（开始时间、结束时间、受影响资源）
 * - 5.8: 已知问题配置（描述、过期时间）
 */

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  UnifiedEvent,
  MaintenanceWindow,
  KnownIssue,
  FilterResult,
  FilterFeedback,
  FilterFeedbackStats,
  INoiseFilter,
  CreateMaintenanceWindowInput,
  UpdateMaintenanceWindowInput,
  CreateKnownIssueInput,
  UpdateKnownIssueInput,
} from '../../types/ai-ops';
import { logger } from '../../utils/logger';
import { aiAnalyzer } from './aiAnalyzer';

const DATA_DIR = path.join(process.cwd(), 'data', 'ai-ops');
const FILTERS_DIR = path.join(DATA_DIR, 'filters');
const MAINTENANCE_FILE = path.join(FILTERS_DIR, 'maintenance.json');
const KNOWN_ISSUES_FILE = path.join(FILTERS_DIR, 'known-issues.json');
const FEEDBACK_DIR = path.join(FILTERS_DIR, 'feedback');

/**
 * 获取日期字符串 (YYYY-MM-DD)
 */
function getDateString(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toISOString().split('T')[0];
}

/**
 * 获取反馈文件路径
 */
function getFeedbackFilePath(dateStr: string): string {
  return path.join(FEEDBACK_DIR, `${dateStr}.json`);
}

/**
 * 接口状态变化跟踪（用于瞬态抖动检测）
 */
interface InterfaceStateChange {
  timestamp: number;
  state: 'up' | 'down';
  eventId: string;
}

/**
 * 接口状态跟踪器
 */
interface InterfaceFlappingTracker {
  interfaceName: string;
  stateChanges: InterfaceStateChange[];
}


export class NoiseFilter implements INoiseFilter {
  private maintenanceWindows: MaintenanceWindow[] = [];
  private knownIssues: KnownIssue[] = [];
  private initialized = false;

  // 接口状态跟踪器（用于瞬态抖动检测）
  private flappingTrackers: Map<string, InterfaceFlappingTracker> = new Map();

  // 反馈统计缓存
  private feedbackStats: FilterFeedbackStats = {
    total: 0,
    falsePositives: 0,
    falseNegatives: 0,
  };

  // 清理定时器
  private cleanupTimer: NodeJS.Timeout | null = null;

  // 瞬态抖动检测配置
  private readonly FLAPPING_WINDOW_MS = 30000; // 30 seconds
  private readonly FLAPPING_THRESHOLD = 3; // 3+ state changes = flapping

  constructor() {
    // Start cleanup timer for flapping trackers
    this.cleanupTimer = setInterval(() => this.cleanupFlappingTrackers(), 10000);
    logger.info('NoiseFilter initialized');
  }

  /**
   * 停止清理定时器
   */
  stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      logger.debug('NoiseFilter cleanup timer stopped');
    }
  }

  /**
   * 确保数据目录存在
   */
  private async ensureDataDir(): Promise<void> {
    try {
      await fs.mkdir(FILTERS_DIR, { recursive: true });
      await fs.mkdir(FEEDBACK_DIR, { recursive: true });
    } catch (error) {
      logger.error('Failed to create filters directories:', error);
    }
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.ensureDataDir();
    await this.loadMaintenanceWindows();
    await this.loadKnownIssues();
    await this.loadFeedbackStats();
    this.initialized = true;
    logger.info('NoiseFilter data loaded');
  }

  // ==================== 维护窗口管理 ====================

  /**
   * 加载维护窗口配置
   */
  private async loadMaintenanceWindows(): Promise<void> {
    try {
      const data = await fs.readFile(MAINTENANCE_FILE, 'utf-8');
      this.maintenanceWindows = JSON.parse(data) as MaintenanceWindow[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.maintenanceWindows = [];
        await this.saveMaintenanceWindows();
      } else {
        logger.error('Failed to load maintenance windows:', error);
        this.maintenanceWindows = [];
      }
    }
  }

  /**
   * 保存维护窗口配置
   */
  private async saveMaintenanceWindows(): Promise<void> {
    await this.ensureDataDir();
    await fs.writeFile(MAINTENANCE_FILE, JSON.stringify(this.maintenanceWindows, null, 2), 'utf-8');
  }

  /**
   * 添加维护窗口
   * Requirements: 5.7
   */
  addMaintenanceWindow(window: MaintenanceWindow): void {
    // Check for duplicate ID
    const existingIndex = this.maintenanceWindows.findIndex((w) => w.id === window.id);
    if (existingIndex >= 0) {
      this.maintenanceWindows[existingIndex] = window;
      logger.info(`Maintenance window updated: ${window.name}`);
    } else {
      this.maintenanceWindows.push(window);
      logger.info(`Maintenance window added: ${window.name}`);
    }
    this.saveMaintenanceWindows().catch((err) => logger.error('Failed to save maintenance windows:', err));
  }

  /**
   * 创建维护窗口
   */
  async createMaintenanceWindow(input: CreateMaintenanceWindowInput): Promise<MaintenanceWindow> {
    await this.initialize();

    const now = Date.now();
    const window: MaintenanceWindow = {
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      ...input,
    };

    this.maintenanceWindows.push(window);
    await this.saveMaintenanceWindows();

    logger.info(`Created maintenance window: ${window.name} (${window.id})`);
    return window;
  }

  /**
   * 更新维护窗口
   */
  async updateMaintenanceWindow(id: string, updates: UpdateMaintenanceWindowInput): Promise<MaintenanceWindow> {
    await this.initialize();

    const index = this.maintenanceWindows.findIndex((w) => w.id === id);
    if (index === -1) {
      throw new Error(`Maintenance window not found: ${id}`);
    }

    const window = this.maintenanceWindows[index];
    const updatedWindow: MaintenanceWindow = {
      ...window,
      ...updates,
      updatedAt: Date.now(),
    };

    this.maintenanceWindows[index] = updatedWindow;
    await this.saveMaintenanceWindows();

    logger.info(`Updated maintenance window: ${updatedWindow.name} (${id})`);
    return updatedWindow;
  }

  /**
   * 移除维护窗口
   */
  removeMaintenanceWindow(id: string): void {
    const index = this.maintenanceWindows.findIndex((w) => w.id === id);
    if (index >= 0) {
      const window = this.maintenanceWindows[index];
      this.maintenanceWindows.splice(index, 1);
      this.saveMaintenanceWindows().catch((err) => logger.error('Failed to save maintenance windows:', err));
      logger.info(`Maintenance window removed: ${window.name}`);
    }
  }

  /**
   * 获取所有维护窗口
   */
  getMaintenanceWindows(): MaintenanceWindow[] {
    return [...this.maintenanceWindows];
  }

  /**
   * 检查事件是否在维护窗口内
   * Requirements: 5.1
   */
  isInMaintenanceWindow(event: UnifiedEvent): boolean {
    const now = event.timestamp || Date.now();

    for (const window of this.maintenanceWindows) {
      // Check if current time is within the window
      if (!this.isTimeInWindow(now, window)) {
        continue;
      }

      // Check if event's resource is affected
      if (this.isResourceAffected(event, window)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 检查时间是否在维护窗口内
   */
  private isTimeInWindow(timestamp: number, window: MaintenanceWindow): boolean {
    // Check basic time range
    if (timestamp >= window.startTime && timestamp <= window.endTime) {
      return true;
    }

    // Check recurring schedule
    if (window.recurring) {
      return this.isTimeInRecurringWindow(timestamp, window);
    }

    return false;
  }

  /**
   * 检查时间是否在周期性维护窗口内
   */
  private isTimeInRecurringWindow(timestamp: number, window: MaintenanceWindow): boolean {
    if (!window.recurring) return false;

    const date = new Date(timestamp);
    const startDate = new Date(window.startTime);
    const endDate = new Date(window.endTime);

    // Get time of day from original window
    const startHour = startDate.getHours();
    const startMinute = startDate.getMinutes();
    const endHour = endDate.getHours();
    const endMinute = endDate.getMinutes();

    const currentHour = date.getHours();
    const currentMinute = date.getMinutes();

    // Check if current time of day is within window
    const currentTimeMinutes = currentHour * 60 + currentMinute;
    const startTimeMinutes = startHour * 60 + startMinute;
    const endTimeMinutes = endHour * 60 + endMinute;

    const isInTimeRange = currentTimeMinutes >= startTimeMinutes && currentTimeMinutes <= endTimeMinutes;
    if (!isInTimeRange) return false;

    // Check recurring type
    switch (window.recurring.type) {
      case 'daily':
        return true;

      case 'weekly':
        if (window.recurring.dayOfWeek) {
          const dayOfWeek = date.getDay();
          return window.recurring.dayOfWeek.includes(dayOfWeek);
        }
        return false;

      case 'monthly':
        if (window.recurring.dayOfMonth) {
          const dayOfMonth = date.getDate();
          return window.recurring.dayOfMonth.includes(dayOfMonth);
        }
        return false;

      default:
        return false;
    }
  }

  /**
   * 检查事件的资源是否受维护窗口影响
   */
  private isResourceAffected(event: UnifiedEvent, window: MaintenanceWindow): boolean {
    // If no resources specified, window affects all
    if (!window.resources || window.resources.length === 0) {
      return true;
    }

    // Extract resource identifiers from event
    const eventResources = this.extractEventResources(event);

    // Check if any event resource matches window resources
    for (const eventResource of eventResources) {
      for (const windowResource of window.resources) {
        if (this.resourceMatches(eventResource, windowResource)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 从事件中提取资源标识符
   */
  private extractEventResources(event: UnifiedEvent): string[] {
    const resources: string[] = [];

    // Add category as resource
    if (event.category) {
      resources.push(event.category);
    }

    // Extract interface name from metadata
    if (event.metadata?.interfaceName) {
      resources.push(event.metadata.interfaceName as string);
    }

    // Extract from alertRuleInfo
    if (event.alertRuleInfo?.metric) {
      resources.push(event.alertRuleInfo.metric);
    }

    // Extract from device info
    if (event.deviceInfo?.hostname) {
      resources.push(event.deviceInfo.hostname);
    }
    if (event.deviceInfo?.ip) {
      resources.push(event.deviceInfo.ip);
    }

    // Try to extract from message
    const interfaceMatch = event.message.match(/interface[:\s]+(\S+)/i);
    if (interfaceMatch) {
      resources.push(interfaceMatch[1]);
    }

    return resources;
  }

  /**
   * 检查资源是否匹配（支持通配符）
   */
  private resourceMatches(eventResource: string, windowResource: string): boolean {
    // Exact match
    if (eventResource.toLowerCase() === windowResource.toLowerCase()) {
      return true;
    }

    // Wildcard match (e.g., "ether*" matches "ether1", "ether2")
    if (windowResource.includes('*')) {
      const regex = new RegExp('^' + windowResource.replace(/\*/g, '.*') + '$', 'i');
      return regex.test(eventResource);
    }

    return false;
  }


  // ==================== 已知问题管理 ====================

  /**
   * 加载已知问题配置
   */
  private async loadKnownIssues(): Promise<void> {
    try {
      const data = await fs.readFile(KNOWN_ISSUES_FILE, 'utf-8');
      this.knownIssues = JSON.parse(data) as KnownIssue[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.knownIssues = [];
        await this.saveKnownIssues();
      } else {
        logger.error('Failed to load known issues:', error);
        this.knownIssues = [];
      }
    }
  }

  /**
   * 保存已知问题配置
   */
  private async saveKnownIssues(): Promise<void> {
    await this.ensureDataDir();
    await fs.writeFile(KNOWN_ISSUES_FILE, JSON.stringify(this.knownIssues, null, 2), 'utf-8');
  }

  /**
   * 添加已知问题
   * Requirements: 5.8
   */
  addKnownIssue(issue: KnownIssue): void {
    // Check for duplicate ID
    const existingIndex = this.knownIssues.findIndex((i) => i.id === issue.id);
    if (existingIndex >= 0) {
      this.knownIssues[existingIndex] = issue;
      logger.info(`Known issue updated: ${issue.description}`);
    } else {
      this.knownIssues.push(issue);
      logger.info(`Known issue added: ${issue.description}`);
    }
    this.saveKnownIssues().catch((err) => logger.error('Failed to save known issues:', err));
  }

  /**
   * 创建已知问题
   */
  async createKnownIssue(input: CreateKnownIssueInput): Promise<KnownIssue> {
    await this.initialize();

    const now = Date.now();
    const issue: KnownIssue = {
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      ...input,
    };

    this.knownIssues.push(issue);
    await this.saveKnownIssues();

    logger.info(`Created known issue: ${issue.description} (${issue.id})`);
    return issue;
  }

  /**
   * 更新已知问题
   */
  async updateKnownIssue(id: string, updates: UpdateKnownIssueInput): Promise<KnownIssue> {
    await this.initialize();

    const index = this.knownIssues.findIndex((i) => i.id === id);
    if (index === -1) {
      throw new Error(`Known issue not found: ${id}`);
    }

    const issue = this.knownIssues[index];
    const updatedIssue: KnownIssue = {
      ...issue,
      ...updates,
      updatedAt: Date.now(),
    };

    this.knownIssues[index] = updatedIssue;
    await this.saveKnownIssues();

    logger.info(`Updated known issue: ${updatedIssue.description} (${id})`);
    return updatedIssue;
  }

  /**
   * 移除已知问题
   */
  removeKnownIssue(id: string): void {
    const index = this.knownIssues.findIndex((i) => i.id === id);
    if (index >= 0) {
      const issue = this.knownIssues[index];
      this.knownIssues.splice(index, 1);
      this.saveKnownIssues().catch((err) => logger.error('Failed to save known issues:', err));
      logger.info(`Known issue removed: ${issue.description}`);
    }
  }

  /**
   * 获取所有已知问题
   */
  getKnownIssues(): KnownIssue[] {
    return [...this.knownIssues];
  }

  /**
   * 检查事件是否匹配已知问题
   * Requirements: 5.2
   */
  matchesKnownIssue(event: UnifiedEvent): KnownIssue | null {
    const now = Date.now();

    for (const issue of this.knownIssues) {
      // Check if issue has expired
      if (issue.expiresAt && issue.expiresAt < now) {
        continue;
      }

      // Try to match pattern against event message
      try {
        const regex = new RegExp(issue.pattern, 'i');
        if (regex.test(event.message)) {
          return issue;
        }

        // Also try matching against category
        if (regex.test(event.category)) {
          return issue;
        }
      } catch (error) {
        // Invalid regex pattern, try exact match
        if (event.message.toLowerCase().includes(issue.pattern.toLowerCase())) {
          return issue;
        }
      }
    }

    return null;
  }

  // ==================== 瞬态抖动检测 ====================

  /**
   * 检查事件是否为瞬态抖动
   * Requirements: 5.3
   */
  private checkTransientFlapping(event: UnifiedEvent): FilterResult | null {
    // Only check interface-related events
    if (event.category !== 'interface') {
      return null;
    }

    // Extract interface name
    const interfaceName = this.extractInterfaceName(event);
    if (!interfaceName) {
      return null;
    }

    // Get or create tracker
    let tracker = this.flappingTrackers.get(interfaceName);
    if (!tracker) {
      tracker = {
        interfaceName,
        stateChanges: [],
      };
      this.flappingTrackers.set(interfaceName, tracker);
    }

    // Extract state from event
    const state = this.extractInterfaceState(event);
    if (!state) {
      return null;
    }

    // Add state change
    tracker.stateChanges.push({
      timestamp: event.timestamp,
      state,
      eventId: event.id,
    });

    // Clean up old state changes (older than 30 seconds)
    const cutoffTime = Date.now() - this.FLAPPING_WINDOW_MS;
    tracker.stateChanges = tracker.stateChanges.filter((sc) => sc.timestamp >= cutoffTime);

    // Check for flapping (3+ state changes in 30 seconds)
    if (tracker.stateChanges.length >= this.FLAPPING_THRESHOLD) {
      logger.info(
        `Transient flapping detected for interface ${interfaceName}: ${tracker.stateChanges.length} state changes in 30s`
      );

      return {
        filtered: true,
        reason: 'transient',
        details: `Interface ${interfaceName} is flapping: ${tracker.stateChanges.length} state changes in 30 seconds`,
      };
    }

    return null;
  }

  /**
   * 从事件中提取接口名称
   */
  private extractInterfaceName(event: UnifiedEvent): string | null {
    // Check metadata first
    if (event.metadata?.interfaceName) {
      return event.metadata.interfaceName as string;
    }

    // Try to extract from message
    const patterns = [
      /interface[:\s]+(\S+)/i,
      /link[:\s]+(\S+)/i,
      /(\S+)\s+(?:is\s+)?(?:up|down)/i,
    ];

    for (const pattern of patterns) {
      const match = event.message.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * 从事件中提取接口状态
   */
  private extractInterfaceState(event: UnifiedEvent): 'up' | 'down' | null {
    const message = event.message.toLowerCase();

    if (message.includes('down') || message.includes('断开') || message.includes('disconnected')) {
      return 'down';
    }
    if (message.includes('up') || message.includes('连接') || message.includes('connected')) {
      return 'up';
    }

    // Check metadata
    if (event.metadata?.currentValue !== undefined) {
      return event.metadata.currentValue === 1 ? 'up' : 'down';
    }

    return null;
  }

  /**
   * 清理过期的抖动跟踪器
   */
  private cleanupFlappingTrackers(): void {
    const now = Date.now();
    const cutoffTime = now - this.FLAPPING_WINDOW_MS;

    for (const [interfaceName, tracker] of this.flappingTrackers) {
      tracker.stateChanges = tracker.stateChanges.filter((sc) => sc.timestamp >= cutoffTime);

      if (tracker.stateChanges.length === 0) {
        this.flappingTrackers.delete(interfaceName);
      }
    }
  }


  // ==================== AI 智能过滤 ====================

  /**
   * 调用 AI 进行智能过滤
   * Requirements: 5.4, 5.5
   */
  private async aiFilter(event: UnifiedEvent): Promise<FilterResult> {
    try {
      // Build context for AI analysis
      const context = {
        eventId: event.id,
        source: event.source,
        timestamp: event.timestamp,
        severity: event.severity,
        category: event.category,
        message: event.message,
        metadata: event.metadata,
        deviceInfo: event.deviceInfo,
      };

      // Call AI analyzer for noise detection
      const analysisResult = await aiAnalyzer.analyze({
        type: 'alert',
        context: {
          alertEvent: {
            id: event.id,
            ruleId: event.alertRuleInfo?.ruleId || 'unknown',
            ruleName: event.alertRuleInfo?.ruleName || event.category,
            severity: event.severity,
            metric: event.alertRuleInfo?.metric || event.category,
            currentValue: event.alertRuleInfo?.currentValue || 0,
            threshold: event.alertRuleInfo?.threshold || 0,
            message: event.message,
            status: 'active',
            triggeredAt: event.timestamp,
          },
          systemMetrics: {
            cpu: { usage: 0 },
            memory: { total: 0, used: 0, free: 0, usage: 0 },
            disk: { total: 0, used: 0, free: 0, usage: 0 },
            uptime: 0,
          },
          filterContext: {
            purpose: 'noise_detection',
            question: 'Is this alert likely to be noise or a false positive?',
          },
        },
      });

      // Determine if AI thinks this is noise based on analysis
      const isNoise = this.interpretAINoiseResult(analysisResult.summary, analysisResult.riskLevel);

      if (isNoise) {
        logger.info(`AI filtered alert as noise: ${event.id}, reasoning: ${analysisResult.summary}`);
        return {
          filtered: true,
          reason: 'ai_filtered',
          details: analysisResult.summary,
          confidence: analysisResult.confidence || 0.7,
        };
      }

      return {
        filtered: false,
      };
    } catch (error) {
      logger.warn('AI noise filter failed, defaulting to not filter:', error);
      // Default to not filtering when AI fails (prefer false positives over missing real alerts)
      return {
        filtered: false,
      };
    }
  }

  /**
   * 解释 AI 分析结果判断是否为噪音
   */
  private interpretAINoiseResult(summary: string, riskLevel?: string): boolean {
    const lowerSummary = summary.toLowerCase();

    // If risk level is low and summary suggests noise
    if (riskLevel === 'low') {
      const noiseIndicators = [
        '噪音', 'noise', '误报', 'false positive',
        '正常', 'normal', '无需关注', 'no action',
        '暂时', 'temporary', '瞬态', 'transient',
        '可忽略', 'ignorable', '不重要', 'not important',
      ];

      for (const indicator of noiseIndicators) {
        if (lowerSummary.includes(indicator)) {
          return true;
        }
      }
    }

    return false;
  }

  // ==================== 主过滤逻辑 ====================

  /**
   * 过滤告警
   * Requirements: 5.1, 5.2, 5.3, 5.4
   */
  async filter(event: UnifiedEvent): Promise<FilterResult> {
    await this.initialize();

    // Step 1: Check maintenance window
    // Requirements: 5.1
    if (this.isInMaintenanceWindow(event)) {
      logger.info(`Alert filtered by maintenance window: ${event.id}`);
      return {
        filtered: true,
        reason: 'maintenance',
        details: 'Alert occurred during a configured maintenance window',
      };
    }

    // Step 2: Check known issues
    // Requirements: 5.2
    const knownIssue = this.matchesKnownIssue(event);
    if (knownIssue) {
      logger.info(`Alert filtered by known issue: ${event.id}, issue: ${knownIssue.description}`);
      return {
        filtered: true,
        reason: 'known_issue',
        details: `Matches known issue: ${knownIssue.description}`,
      };
    }

    // Step 3: Check transient flapping
    // Requirements: 5.3
    const flappingResult = this.checkTransientFlapping(event);
    if (flappingResult) {
      return flappingResult;
    }

    // Step 4: AI intelligent filtering (when rules can't determine)
    // Requirements: 5.4, 5.5
    // Only use AI for low severity events or when explicitly enabled
    if (event.severity === 'info') {
      const aiResult = await this.aiFilter(event);
      if (aiResult.filtered) {
        return aiResult;
      }
    }

    // Not filtered
    return {
      filtered: false,
    };
  }

  // ==================== 反馈管理 ====================

  /**
   * 加载反馈统计
   */
  private async loadFeedbackStats(): Promise<void> {
    // Calculate stats from recent feedback files
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    let total = 0;
    let falsePositives = 0;
    let falseNegatives = 0;

    const dates = this.getDateRange(sevenDaysAgo, now);
    for (const dateStr of dates) {
      try {
        const feedbacks = await this.readFeedbackFile(dateStr);
        for (const feedback of feedbacks) {
          total++;
          if (feedback.userFeedback === 'false_positive') {
            falsePositives++;
          } else if (feedback.userFeedback === 'false_negative') {
            falseNegatives++;
          }
        }
      } catch {
        // File doesn't exist, skip
      }
    }

    this.feedbackStats = { total, falsePositives, falseNegatives };
  }

  /**
   * 获取日期范围
   */
  private getDateRange(from: number, to: number): string[] {
    const dates: string[] = [];
    const fromDate = new Date(from);
    const toDate = new Date(to);

    const currentDate = new Date(Date.UTC(
      fromDate.getUTCFullYear(),
      fromDate.getUTCMonth(),
      fromDate.getUTCDate()
    ));

    const endDate = new Date(Date.UTC(
      toDate.getUTCFullYear(),
      toDate.getUTCMonth(),
      toDate.getUTCDate(),
      23, 59, 59, 999
    ));

    while (currentDate <= endDate) {
      dates.push(getDateString(currentDate.getTime()));
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    return dates;
  }

  /**
   * 读取反馈文件
   */
  private async readFeedbackFile(dateStr: string): Promise<FilterFeedback[]> {
    const filePath = getFeedbackFilePath(dateStr);
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) as FilterFeedback[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * 写入反馈文件
   */
  private async writeFeedbackFile(dateStr: string, feedbacks: FilterFeedback[]): Promise<void> {
    await this.ensureDataDir();
    const filePath = getFeedbackFilePath(dateStr);
    await fs.writeFile(filePath, JSON.stringify(feedbacks, null, 2), 'utf-8');
  }

  /**
   * 记录过滤反馈
   * Requirements: 5.6
   */
  recordFeedback(feedback: Omit<FilterFeedback, 'id' | 'timestamp'>): void {
    const now = Date.now();
    const fullFeedback: FilterFeedback = {
      id: uuidv4(),
      timestamp: now,
      ...feedback,
    };

    // Update stats
    this.feedbackStats.total++;
    if (feedback.userFeedback === 'false_positive') {
      this.feedbackStats.falsePositives++;
    } else if (feedback.userFeedback === 'false_negative') {
      this.feedbackStats.falseNegatives++;
    }

    // Save to file asynchronously
    const dateStr = getDateString(now);
    this.readFeedbackFile(dateStr)
      .then((feedbacks) => {
        feedbacks.push(fullFeedback);
        return this.writeFeedbackFile(dateStr, feedbacks);
      })
      .then(() => {
        logger.info(`Filter feedback recorded: ${fullFeedback.id}, type: ${feedback.userFeedback}`);
      })
      .catch((err) => {
        logger.error('Failed to save filter feedback:', err);
      });
  }

  /**
   * 获取反馈统计
   */
  getFeedbackStats(): FilterFeedbackStats {
    return { ...this.feedbackStats };
  }

  // ==================== 工具方法 ====================

  /**
   * 获取统计信息
   */
  getStats(): {
    maintenanceWindowsCount: number;
    knownIssuesCount: number;
    flappingTrackersCount: number;
    feedbackStats: FilterFeedbackStats;
  } {
    return {
      maintenanceWindowsCount: this.maintenanceWindows.length,
      knownIssuesCount: this.knownIssues.length,
      flappingTrackersCount: this.flappingTrackers.size,
      feedbackStats: this.feedbackStats,
    };
  }

  /**
   * 清空所有数据（用于测试）
   */
  async clearAll(): Promise<void> {
    this.maintenanceWindows = [];
    this.knownIssues = [];
    this.flappingTrackers.clear();
    this.feedbackStats = { total: 0, falsePositives: 0, falseNegatives: 0 };

    await this.saveMaintenanceWindows();
    await this.saveKnownIssues();

    logger.info('NoiseFilter data cleared');
  }

  /**
   * 重新加载数据
   */
  async reload(): Promise<void> {
    this.initialized = false;
    await this.initialize();
    logger.info('NoiseFilter data reloaded');
  }
}

// 导出单例实例
export const noiseFilter = new NoiseFilter();

/**
 * AlertEngine 告警引擎
 * 负责告警规则管理、告警评估、告警触发和自动响应
 *
 * Requirements: 2.1-2.8, 3.1-3.12
 * - 2.1: 支持创建、编辑、删除和启用/禁用告警规则
 * - 2.2: 要求指定规则名称、指标类型、条件运算符和阈值
 * - 2.3: 支持条件运算符：gt, lt, eq, ne, gte, lte
 * - 2.4: 支持配置告警持续时间阈值
 * - 2.5: 支持配置告警冷却时间
 * - 2.6: 支持配置多个通知渠道
 * - 2.7: 支持配置告警严重级别
 * - 2.8: 显示规则状态和最近触发时间
 * - 3.1: 指标满足条件时触发告警
 * - 3.2: 调用 AI 服务分析异常原因
 * - 3.3: 告警通知中包含 AI 分析结果
 * - 3.4: 通过配置的通知渠道发送告警
 * - 3.5-3.7: 支持 Web Push、Webhook、邮件通知
 * - 3.8: 支持自动响应脚本执行
 * - 3.9-3.10: 记录执行前后状态到审计日志
 * - 3.11: 执行失败时发送通知
 * - 3.12: 告警恢复时发送恢复通知
 */

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  AlertRule,
  AlertEvent,
  CreateAlertRuleInput,
  UpdateAlertRuleInput,
  IAlertEngine,
  SystemMetrics,
  InterfaceMetrics,
  AlertOperator,
  MetricType,
  AlertSeverity,
  InterfaceStatusTarget,
} from '../../types/ai-ops';
import { logger } from '../../utils/logger';
import { auditLogger } from './auditLogger';
import { notificationService } from './notificationService';
import { routerosClient } from '../routerosClient';
import { metricsCollector } from './metricsCollector';

const DATA_DIR = path.join(process.cwd(), 'data', 'ai-ops');
const ALERTS_DIR = path.join(DATA_DIR, 'alerts');
const RULES_FILE = path.join(ALERTS_DIR, 'rules.json');
const EVENTS_DIR = path.join(ALERTS_DIR, 'events');

/**
 * 获取日期字符串 (YYYY-MM-DD)
 */
function getDateString(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toISOString().split('T')[0];
}

/**
 * 获取告警事件文件路径
 */
function getEventsFilePath(dateStr: string): string {
  return path.join(EVENTS_DIR, `${dateStr}.json`);
}

/**
 * 规则触发状态跟踪（用于持续时间阈值检测）
 */
interface RuleTriggerState {
  ruleId: string;
  consecutiveCount: number;
  lastEvaluatedAt: number;
}

export class AlertEngine implements IAlertEngine {
  private rules: AlertRule[] = [];
  private initialized = false;
  
  // 规则触发状态跟踪（内存中）
  private triggerStates: Map<string, RuleTriggerState> = new Map();
  
  // 活跃告警缓存（内存中）
  private activeAlerts: Map<string, AlertEvent> = new Map();

  /**
   * 确保数据目录存在
   */
  private async ensureDataDir(): Promise<void> {
    try {
      await fs.mkdir(ALERTS_DIR, { recursive: true });
      await fs.mkdir(EVENTS_DIR, { recursive: true });
    } catch (error) {
      logger.error('Failed to create alerts directories:', error);
    }
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.ensureDataDir();
    await this.loadRules();
    await this.loadActiveAlerts();
    this.initialized = true;
    logger.info('AlertEngine initialized');
  }

  /**
   * 加载告警规则
   */
  private async loadRules(): Promise<void> {
    try {
      const data = await fs.readFile(RULES_FILE, 'utf-8');
      this.rules = JSON.parse(data) as AlertRule[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.rules = [];
        await this.saveRules();
      } else {
        logger.error('Failed to load alert rules:', error);
        this.rules = [];
      }
    }
  }

  /**
   * 保存告警规则
   */
  private async saveRules(): Promise<void> {
    await this.ensureDataDir();
    await fs.writeFile(RULES_FILE, JSON.stringify(this.rules, null, 2), 'utf-8');
  }


  /**
   * 读取指定日期的告警事件文件
   */
  private async readEventsFile(dateStr: string): Promise<AlertEvent[]> {
    const filePath = getEventsFilePath(dateStr);
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) as AlertEvent[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      logger.error(`Failed to read alert events file ${dateStr}:`, error);
      return [];
    }
  }

  /**
   * 写入告警事件文件
   */
  private async writeEventsFile(dateStr: string, events: AlertEvent[]): Promise<void> {
    await this.ensureDataDir();
    const filePath = getEventsFilePath(dateStr);
    await fs.writeFile(filePath, JSON.stringify(events, null, 2), 'utf-8');
  }

  /**
   * 保存告警事件
   */
  private async saveEvent(event: AlertEvent): Promise<void> {
    const dateStr = getDateString(event.triggeredAt);
    const events = await this.readEventsFile(dateStr);
    
    const existingIndex = events.findIndex((e) => e.id === event.id);
    if (existingIndex >= 0) {
      events[existingIndex] = event;
    } else {
      events.push(event);
    }
    
    await this.writeEventsFile(dateStr, events);
  }

  /**
   * 加载活跃告警到内存
   */
  private async loadActiveAlerts(): Promise<void> {
    // 查询最近 7 天的告警事件，找出活跃的
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    
    const dates = this.getDateRange(sevenDaysAgo, now);
    
    for (const dateStr of dates) {
      const events = await this.readEventsFile(dateStr);
      for (const event of events) {
        if (event.status === 'active') {
          this.activeAlerts.set(event.id, event);
        }
      }
    }
    
    logger.info(`Loaded ${this.activeAlerts.size} active alerts`);
  }

  /**
   * 获取日期范围内的所有日期字符串 (使用 UTC 时间)
   */
  private getDateRange(from: number, to: number): string[] {
    const dates: string[] = [];
    
    // 使用 UTC 时间计算日期范围
    const fromDate = new Date(from);
    const toDate = new Date(to);
    
    // 获取 UTC 日期的开始
    const currentDate = new Date(Date.UTC(
      fromDate.getUTCFullYear(),
      fromDate.getUTCMonth(),
      fromDate.getUTCDate()
    ));
    
    // 获取 UTC 日期的结束
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

  // ==================== 规则管理 ====================

  /**
   * 创建告警规则
   */
  async createRule(input: CreateAlertRuleInput): Promise<AlertRule> {
    await this.initialize();

    const now = Date.now();
    const rule: AlertRule = {
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      ...input,
    };

    this.rules.push(rule);
    await this.saveRules();

    logger.info(`Created alert rule: ${rule.name} (${rule.id})`);
    return rule;
  }

  /**
   * 更新告警规则
   */
  async updateRule(id: string, updates: UpdateAlertRuleInput): Promise<AlertRule> {
    await this.initialize();

    const index = this.rules.findIndex((r) => r.id === id);
    if (index === -1) {
      throw new Error(`Alert rule not found: ${id}`);
    }

    const rule = this.rules[index];
    const updatedRule: AlertRule = {
      ...rule,
      ...updates,
      updatedAt: Date.now(),
    };

    this.rules[index] = updatedRule;
    await this.saveRules();

    logger.info(`Updated alert rule: ${updatedRule.name} (${id})`);
    return updatedRule;
  }

  /**
   * 删除告警规则
   */
  async deleteRule(id: string): Promise<void> {
    await this.initialize();

    const index = this.rules.findIndex((r) => r.id === id);
    if (index === -1) {
      throw new Error(`Alert rule not found: ${id}`);
    }

    const rule = this.rules[index];
    this.rules.splice(index, 1);
    await this.saveRules();

    // 清理触发状态
    this.triggerStates.delete(id);

    logger.info(`Deleted alert rule: ${rule.name} (${id})`);
  }

  /**
   * 获取所有告警规则
   */
  async getRules(): Promise<AlertRule[]> {
    await this.initialize();
    return [...this.rules];
  }

  /**
   * 根据 ID 获取告警规则
   */
  async getRuleById(id: string): Promise<AlertRule | null> {
    await this.initialize();
    return this.rules.find((r) => r.id === id) || null;
  }

  /**
   * 启用告警规则
   */
  async enableRule(id: string): Promise<void> {
    await this.updateRule(id, { enabled: true });
    logger.info(`Enabled alert rule: ${id}`);
  }

  /**
   * 禁用告警规则
   */
  async disableRule(id: string): Promise<void> {
    await this.updateRule(id, { enabled: false });
    // 清理触发状态
    this.triggerStates.delete(id);
    
    // 自动解决该规则的所有活跃告警
    await this.resolveAlertsForRule(id, 'rule_disabled');
    
    logger.info(`Disabled alert rule: ${id}`);
  }

  /**
   * 解决指定规则的所有活跃告警
   * @param ruleId 规则 ID
   * @param reason 解决原因
   */
  private async resolveAlertsForRule(ruleId: string, reason: string): Promise<void> {
    const now = Date.now();
    const alertsToResolve: AlertEvent[] = [];

    // 找出该规则的所有活跃告警
    for (const [eventId, event] of this.activeAlerts) {
      if (event.ruleId === ruleId && event.status === 'active') {
        alertsToResolve.push(event);
      }
    }

    // 解决这些告警
    for (const event of alertsToResolve) {
      event.status = 'resolved';
      event.resolvedAt = now;

      await this.saveEvent(event);
      this.activeAlerts.delete(event.id);

      // 记录审计日志
      await auditLogger.log({
        action: 'alert_resolve',
        actor: 'system',
        details: {
          trigger: reason,
          metadata: {
            eventId: event.id,
            ruleId: event.ruleId,
            ruleName: event.ruleName,
          },
        },
      });

      logger.info(`Alert auto-resolved due to ${reason}: ${event.ruleName} (${event.id})`);
    }

    if (alertsToResolve.length > 0) {
      logger.info(`Resolved ${alertsToResolve.length} active alerts for rule ${ruleId} (reason: ${reason})`);
    }
  }


  // ==================== 告警评估 ====================

  /**
   * 评估条件运算符
   */
  evaluateCondition(value: number, operator: AlertOperator, threshold: number): boolean {
    switch (operator) {
      case 'gt':
        return value > threshold;
      case 'lt':
        return value < threshold;
      case 'eq':
        return value === threshold;
      case 'ne':
        return value !== threshold;
      case 'gte':
        return value >= threshold;
      case 'lte':
        return value <= threshold;
      default:
        logger.warn(`Unknown operator: ${operator}`);
        return false;
    }
  }

  /**
   * 从指标数据中获取指定指标的值
   */
  private getMetricValue(
    metrics: { system: SystemMetrics; interfaces: InterfaceMetrics[] },
    metricType: MetricType,
    metricLabel?: string
  ): number | null {
    switch (metricType) {
      case 'cpu':
        return metrics.system.cpu.usage;
      case 'memory':
        return metrics.system.memory.usage;
      case 'disk':
        return metrics.system.disk.usage;
      case 'interface_status': {
        if (!metricLabel) return null;
        const iface = metrics.interfaces.find((i) => i.name === metricLabel);
        if (!iface) return null;
        // 返回 1 表示 up，0 表示 down
        return iface.status === 'up' ? 1 : 0;
      }
      case 'interface_traffic': {
        if (!metricLabel) {
          logger.warn('[interface_traffic] metricLabel is required but not provided');
          return null;
        }
        // 获取最近的流量速率数据（最近 30 秒的平均值）
        const trafficHistory = metricsCollector.getTrafficHistory(metricLabel, 30000);
        if (trafficHistory.length === 0) {
          // 如果没有速率数据，尝试获取更长时间范围的数据
          const extendedHistory = metricsCollector.getTrafficHistory(metricLabel, 120000); // 2分钟
          if (extendedHistory.length === 0) {
            // 检查接口是否存在于可用列表中
            const availableInterfaces = metricsCollector.getAvailableTrafficInterfaces();
            if (!availableInterfaces.includes(metricLabel)) {
              logger.warn(`[interface_traffic] Interface "${metricLabel}" not found in available interfaces: [${availableInterfaces.join(', ')}]`);
            } else {
              logger.debug(`[interface_traffic] No traffic rate data yet for interface ${metricLabel}, waiting for data collection`);
            }
            return null;
          }
          // 使用扩展时间范围的数据
          const avgRate = extendedHistory.reduce((sum, p) => sum + p.rxRate + p.txRate, 0) / extendedHistory.length;
          return avgRate / 1024;
        }
        // 计算平均速率（rx + tx，单位：bytes/s）
        const avgRate = trafficHistory.reduce((sum, p) => sum + p.rxRate + p.txRate, 0) / trafficHistory.length;
        // 转换为 KB/s 以便更合理的阈值设置
        return avgRate / 1024;
      }
      default:
        return null;
    }
  }

  /**
   * 获取接口状态字符串
   */
  private getInterfaceStatus(
    metrics: { system: SystemMetrics; interfaces: InterfaceMetrics[] },
    metricLabel?: string
  ): InterfaceStatusTarget | null {
    if (!metricLabel) return null;
    const iface = metrics.interfaces.find((i) => i.name === metricLabel);
    if (!iface) return null;
    return iface.status as InterfaceStatusTarget;
  }

  /**
   * 评估接口状态条件
   * 当接口当前状态等于目标状态时返回 true（触发告警）
   * 
   * 逻辑说明：
   * - targetStatus: 'down' 表示"当接口断开时触发告警"
   * - targetStatus: 'up' 表示"当接口连接时触发告警"（较少使用）
   * - 所以当 currentStatus === targetStatus 时应该触发告警
   */
  private evaluateInterfaceStatus(
    currentStatus: InterfaceStatusTarget,
    targetStatus: InterfaceStatusTarget
  ): boolean {
    // 当前状态等于目标状态时触发告警
    // 例如：targetStatus='down' 且 currentStatus='down' 时触发
    return currentStatus === targetStatus;
  }

  /**
   * 检查规则是否在冷却期内
   */
  private isInCooldown(rule: AlertRule): boolean {
    if (!rule.lastTriggeredAt || rule.cooldownMs <= 0) {
      return false;
    }
    const elapsed = Date.now() - rule.lastTriggeredAt;
    return elapsed < rule.cooldownMs;
  }

  /**
   * 更新规则触发状态
   */
  private updateTriggerState(ruleId: string, triggered: boolean): RuleTriggerState {
    const now = Date.now();
    const existing = this.triggerStates.get(ruleId);

    if (triggered) {
      const state: RuleTriggerState = {
        ruleId,
        consecutiveCount: (existing?.consecutiveCount || 0) + 1,
        lastEvaluatedAt: now,
      };
      this.triggerStates.set(ruleId, state);
      return state;
    } else {
      // 条件不满足，重置计数
      const state: RuleTriggerState = {
        ruleId,
        consecutiveCount: 0,
        lastEvaluatedAt: now,
      };
      this.triggerStates.set(ruleId, state);
      return state;
    }
  }

  /**
   * 评估所有告警规则
   */
  async evaluate(
    metrics: { system: SystemMetrics; interfaces: InterfaceMetrics[] }
  ): Promise<AlertEvent[]> {
    await this.initialize();

    const triggeredEvents: AlertEvent[] = [];
    const now = Date.now();

    // 添加调试日志：显示当前评估的规则数量
    logger.info(`Alert evaluation started: ${this.rules.length} rules to evaluate`);

    // 检查告警恢复
    await this.checkAlertRecovery(metrics);

    // 评估每个启用的规则
    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      // 检查冷却期
      if (this.isInCooldown(rule)) {
        logger.debug(`Rule ${rule.name} is in cooldown period`);
        continue;
      }

      let conditionMet = false;
      let currentValue = 0;

      // 根据指标类型选择不同的评估逻辑
      if (rule.metric === 'interface_status') {
        // 接口状态类型：使用状态匹配而非数值比较
        const currentStatus = this.getInterfaceStatus(metrics, rule.metricLabel);
        if (currentStatus === null) {
          logger.warn(`[interface_status] Rule ${rule.name}: Could not get interface status for ${rule.metricLabel}`);
          continue;
        }
        
        // 如果没有配置 targetStatus，默认为 'down'（即当接口 down 时触发告警）
        const targetStatus = rule.targetStatus || 'down';
        conditionMet = this.evaluateInterfaceStatus(currentStatus, targetStatus);
        // 用于告警事件记录：1 表示 up，0 表示 down
        currentValue = currentStatus === 'up' ? 1 : 0;
        
        // 添加详细日志
        logger.info(`[interface_status] Rule ${rule.name}: interface=${rule.metricLabel}, currentStatus=${currentStatus}, targetStatus=${targetStatus}, conditionMet=${conditionMet}`);
      } else if (rule.metric === 'interface_traffic') {
        // 接口流量类型：添加详细日志
        const value = this.getMetricValue(metrics, rule.metric, rule.metricLabel);
        if (value === null) {
          logger.warn(`[interface_traffic] Rule ${rule.name}: Could not get traffic value for ${rule.metricLabel}`);
          continue;
        }
        currentValue = value;
        conditionMet = this.evaluateCondition(value, rule.operator, rule.threshold);
        logger.info(`[interface_traffic] Rule ${rule.name}: interface=${rule.metricLabel}, currentValue=${value.toFixed(2)} KB/s, threshold=${rule.threshold}, conditionMet=${conditionMet}`);
      } else {
        // 数值型指标：使用数值比较
        const value = this.getMetricValue(metrics, rule.metric, rule.metricLabel);
        if (value === null) {
          logger.debug(`Could not get metric value for rule ${rule.name}`);
          continue;
        }
        currentValue = value;
        conditionMet = this.evaluateCondition(value, rule.operator, rule.threshold);
      }
      
      // 更新触发状态
      const state = this.updateTriggerState(rule.id, conditionMet);

      // 检查是否达到持续时间阈值
      if (conditionMet && state.consecutiveCount >= rule.duration) {
        // 检查是否已有该规则的活跃告警
        const existingAlert = Array.from(this.activeAlerts.values()).find(
          (a) => a.ruleId === rule.id && a.status === 'active'
        );

        if (!existingAlert) {
          // 创建新告警
          const event = await this.createAlertEvent(rule, currentValue, metrics.system);
          triggeredEvents.push(event);

          // 更新规则最后触发时间
          await this.updateRule(rule.id, { lastTriggeredAt: now });

          // 重置触发计数
          this.triggerStates.set(rule.id, {
            ruleId: rule.id,
            consecutiveCount: 0,
            lastEvaluatedAt: now,
          });
        }
      }
    }

    return triggeredEvents;
  }


  // ==================== 告警触发和通知 ====================

  /**
   * 创建告警事件
   */
  private async createAlertEvent(
    rule: AlertRule,
    currentValue: number,
    systemMetrics: SystemMetrics
  ): Promise<AlertEvent> {
    const now = Date.now();

    // 构建告警消息
    const message = this.buildAlertMessage(rule, currentValue);

    // 创建告警事件
    const event: AlertEvent = {
      id: uuidv4(),
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      metric: rule.metric,
      currentValue,
      threshold: rule.threshold,
      message,
      status: 'active',
      triggeredAt: now,
    };

    // 尝试获取 AI 分析（如果可用）
    try {
      const aiAnalysis = await this.getAIAnalysis(event, systemMetrics);
      if (aiAnalysis) {
        event.aiAnalysis = aiAnalysis;
      }
    } catch (error) {
      logger.warn('Failed to get AI analysis for alert:', error);
    }

    // 保存告警事件
    await this.saveEvent(event);
    this.activeAlerts.set(event.id, event);

    // 记录审计日志
    await auditLogger.log({
      action: 'alert_trigger',
      actor: 'system',
      details: {
        trigger: rule.name,
        metadata: {
          eventId: event.id,
          ruleId: rule.id,
          metric: rule.metric,
          currentValue,
          threshold: rule.threshold,
          severity: rule.severity,
        },
      },
    });

    // 发送通知
    await this.sendAlertNotification(event, rule);

    // 执行自动响应（如果配置）
    if (rule.autoResponse?.enabled && rule.autoResponse.script) {
      await this.executeAutoResponse(event, rule);
    }

    logger.info(`Alert triggered: ${rule.name} (${event.id})`);
    return event;
  }

  /**
   * 构建告警消息
   */
  private buildAlertMessage(rule: AlertRule, currentValue: number): string {
    const operatorText: Record<AlertOperator, string> = {
      gt: '大于',
      lt: '小于',
      eq: '等于',
      ne: '不等于',
      gte: '大于等于',
      lte: '小于等于',
    };

    const metricText: Record<MetricType, string> = {
      cpu: 'CPU 使用率',
      memory: '内存使用率',
      disk: '磁盘使用率',
      interface_status: '接口状态',
      interface_traffic: '接口流量',
    };

    const metric = metricText[rule.metric] || rule.metric;
    const label = rule.metricLabel ? ` (${rule.metricLabel})` : '';

    // 接口状态类型使用不同的消息格式
    if (rule.metric === 'interface_status') {
      const currentStatus = currentValue === 1 ? 'up' : 'down';
      const targetStatus = rule.targetStatus || 'up';
      const targetStatusText = targetStatus === 'up' ? '连接' : '断开';
      const currentStatusText = currentStatus === 'up' ? '连接' : '断开';
      return `${metric}${label} 当前状态为 ${currentStatusText}，期望状态为 ${targetStatusText}`;
    }

    const operator = operatorText[rule.operator] || rule.operator;
    return `${metric}${label} 当前值 ${currentValue} ${operator} 阈值 ${rule.threshold}`;
  }

  /**
   * 获取 AI 分析（占位实现，后续集成 AIAnalyzer）
   */
  private async getAIAnalysis(
    event: AlertEvent,
    systemMetrics: SystemMetrics
  ): Promise<string | undefined> {
    // TODO: 集成 AIAnalyzer 服务
    // 目前返回基础分析
    const severityText: Record<AlertSeverity, string> = {
      info: '信息',
      warning: '警告',
      critical: '严重',
      emergency: '紧急',
    };

    return `[${severityText[event.severity]}] ${event.message}。建议检查相关配置和系统状态。`;
  }

  /**
   * 发送告警通知
   */
  private async sendAlertNotification(event: AlertEvent, rule: AlertRule): Promise<void> {
    if (!rule.channels || rule.channels.length === 0) {
      logger.debug(`No notification channels configured for rule: ${rule.name}`);
      return;
    }

    const severityText: Record<AlertSeverity, string> = {
      info: '📢 信息',
      warning: '⚠️ 警告',
      critical: '🔴 严重',
      emergency: '🚨 紧急',
    };

    try {
      await notificationService.send(rule.channels, {
        type: 'alert',
        title: `${severityText[event.severity]} - ${rule.name}`,
        body: event.message + (event.aiAnalysis ? `\n\nAI 分析: ${event.aiAnalysis}` : ''),
        data: {
          eventId: event.id,
          ruleId: rule.id,
          severity: event.severity,
          metric: event.metric,
          currentValue: event.currentValue,
          threshold: event.threshold,
        },
      });
      logger.info(`Alert notification sent for: ${rule.name}`);
    } catch (error) {
      logger.error(`Failed to send alert notification for ${rule.name}:`, error);
    }
  }


  // ==================== 告警恢复 ====================

  /**
   * 检查告警恢复
   */
  private async checkAlertRecovery(
    metrics: { system: SystemMetrics; interfaces: InterfaceMetrics[] }
  ): Promise<void> {
    const now = Date.now();

    for (const [eventId, event] of this.activeAlerts) {
      if (event.status !== 'active') continue;

      // 获取对应的规则
      const rule = this.rules.find((r) => r.id === event.ruleId);
      if (!rule) {
        // 规则已删除，自动解决告警
        await this.resolveAlert(eventId);
        continue;
      }

      // 如果规则已禁用，自动解决告警（不发送恢复通知）
      if (!rule.enabled) {
        event.status = 'resolved';
        event.resolvedAt = now;

        await this.saveEvent(event);
        this.activeAlerts.delete(eventId);

        // 记录审计日志
        await auditLogger.log({
          action: 'alert_resolve',
          actor: 'system',
          details: {
            trigger: 'rule_disabled',
            metadata: {
              eventId: event.id,
              ruleId: rule.id,
              ruleName: rule.name,
            },
          },
        });

        logger.info(`Alert auto-resolved (rule disabled): ${rule.name} (${eventId})`);
        continue;
      }

      let conditionMet = false;

      // 根据指标类型选择不同的评估逻辑
      if (rule.metric === 'interface_status') {
        // 接口状态类型：使用状态匹配
        const currentStatus = this.getInterfaceStatus(metrics, rule.metricLabel);
        if (currentStatus === null) {
          logger.debug(`[recovery] Could not get interface status for ${rule.metricLabel}, skipping recovery check`);
          continue;
        }
        
        // 重要：恢复检查时使用与触发时相同的 targetStatus 默认值 'down'
        // 这样当接口从 down 恢复到 up 时，conditionMet 会变为 false，触发恢复
        const targetStatus = rule.targetStatus || 'down';
        conditionMet = this.evaluateInterfaceStatus(currentStatus, targetStatus);
        
        logger.debug(`[recovery] Rule ${rule.name}: interface=${rule.metricLabel}, currentStatus=${currentStatus}, targetStatus=${targetStatus}, conditionMet=${conditionMet}`);
      } else if (rule.metric === 'interface_traffic') {
        // 接口流量类型：使用数值比较
        const currentValue = this.getMetricValue(metrics, rule.metric, rule.metricLabel);
        if (currentValue === null) {
          logger.debug(`[recovery] Could not get traffic value for ${rule.metricLabel}, skipping recovery check`);
          continue;
        }
        
        conditionMet = this.evaluateCondition(currentValue, rule.operator, rule.threshold);
        logger.debug(`[recovery] Rule ${rule.name}: interface=${rule.metricLabel}, currentValue=${currentValue.toFixed(2)} KB/s, threshold=${rule.threshold}, conditionMet=${conditionMet}`);
      } else {
        // 数值型指标：使用数值比较
        const currentValue = this.getMetricValue(metrics, rule.metric, rule.metricLabel);
        if (currentValue === null) continue;
        
        conditionMet = this.evaluateCondition(currentValue, rule.operator, rule.threshold);
      }

      if (!conditionMet) {
        // 条件不再满足，告警恢复
        event.status = 'resolved';
        event.resolvedAt = now;

        await this.saveEvent(event);
        this.activeAlerts.delete(eventId);

        // 记录审计日志
        await auditLogger.log({
          action: 'alert_resolve',
          actor: 'system',
          details: {
            trigger: 'auto_recovery',
            metadata: {
              eventId: event.id,
              ruleId: rule.id,
              ruleName: rule.name,
            },
          },
        });

        // 发送恢复通知
        await this.sendRecoveryNotification(event, rule);

        logger.info(`Alert recovered: ${rule.name} (${eventId})`);
      }
    }
  }

  /**
   * 发送恢复通知
   */
  private async sendRecoveryNotification(event: AlertEvent, rule: AlertRule): Promise<void> {
    if (!rule.channels || rule.channels.length === 0) {
      return;
    }

    try {
      await notificationService.send(rule.channels, {
        type: 'recovery',
        title: `✅ 已恢复 - ${rule.name}`,
        body: `告警已恢复: ${event.message}`,
        data: {
          eventId: event.id,
          ruleId: rule.id,
          severity: event.severity,
          resolvedAt: event.resolvedAt,
        },
      });
      logger.info(`Recovery notification sent for: ${rule.name}`);
    } catch (error) {
      logger.error(`Failed to send recovery notification for ${rule.name}:`, error);
    }
  }

  // ==================== 自动响应 ====================

  /**
   * 执行自动响应脚本
   */
  private async executeAutoResponse(event: AlertEvent, rule: AlertRule): Promise<void> {
    if (!rule.autoResponse?.script) return;

    const script = rule.autoResponse.script;

    // 记录执行意图到审计日志
    await auditLogger.log({
      action: 'script_execute',
      actor: 'system',
      details: {
        trigger: `auto_response:${rule.name}`,
        script,
        metadata: {
          eventId: event.id,
          ruleId: rule.id,
        },
      },
    });

    try {
      // 检查 RouterOS 连接
      if (!routerosClient.isConnected()) {
        throw new Error('RouterOS not connected');
      }

      // 执行脚本
      const output = await this.executeScript(script);

      // 更新告警事件
      event.autoResponseResult = {
        executed: true,
        success: true,
        output,
      };
      await this.saveEvent(event);

      // 记录执行结果到审计日志
      await auditLogger.log({
        action: 'script_execute',
        actor: 'system',
        details: {
          trigger: `auto_response:${rule.name}`,
          result: 'success',
          metadata: {
            eventId: event.id,
            ruleId: rule.id,
            output,
          },
        },
      });

      logger.info(`Auto-response executed successfully for: ${rule.name}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // 更新告警事件
      event.autoResponseResult = {
        executed: true,
        success: false,
        error: errorMessage,
      };
      await this.saveEvent(event);

      // 记录执行失败到审计日志
      await auditLogger.log({
        action: 'script_execute',
        actor: 'system',
        details: {
          trigger: `auto_response:${rule.name}`,
          result: 'failed',
          error: errorMessage,
          metadata: {
            eventId: event.id,
            ruleId: rule.id,
          },
        },
      });

      // 发送执行失败通知
      await this.sendAutoResponseFailureNotification(event, rule, errorMessage);

      logger.error(`Auto-response failed for ${rule.name}:`, error);
    }
  }

  /**
   * 执行 RouterOS 脚本
   */
  private async executeScript(script: string): Promise<string> {
    const lines = script
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));

    const outputs: string[] = [];

    for (const line of lines) {
      try {
        const { apiCommand, params } = this.convertToApiFormat(line);
        const response = await routerosClient.executeRaw(apiCommand, params);

        if (response !== null && response !== undefined) {
          if (Array.isArray(response) && response.length > 0) {
            outputs.push(JSON.stringify(response, null, 2));
          } else if (typeof response === 'object') {
            outputs.push(JSON.stringify(response, null, 2));
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`命令 "${line}" 执行失败: ${errorMessage}`);
      }
    }

    return outputs.join('\n') || '命令执行成功';
  }

  /**
   * 将 CLI 格式命令转换为 API 格式
   */
  private convertToApiFormat(command: string): { apiCommand: string; params: string[] } {
    const trimmed = command.trim();
    const parts = trimmed.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];

    const pathParts: string[] = [];
    const params: string[] = [];

    let inWhere = false;
    let foundFirstParam = false;

    for (const part of parts) {
      if (part.toLowerCase() === 'where') {
        inWhere = true;
        continue;
      }

      if (inWhere) {
        if (part.includes('=')) {
          params.push(`?${part}`);
        }
        continue;
      }

      if (part.includes('=')) {
        foundFirstParam = true;
        params.push(`=${part}`);
      } else if (!foundFirstParam && (part.startsWith('/') || /^[a-z0-9\-]+$/i.test(part))) {
        pathParts.push(part);
      }
    }

    let apiCommand = '';
    for (const part of pathParts) {
      if (part.startsWith('/')) {
        apiCommand += part;
      } else {
        apiCommand += '/' + part;
      }
    }
    apiCommand = apiCommand.replace(/\/+/g, '/');

    return { apiCommand, params };
  }

  /**
   * 发送自动响应失败通知
   */
  private async sendAutoResponseFailureNotification(
    event: AlertEvent,
    rule: AlertRule,
    error: string
  ): Promise<void> {
    if (!rule.channels || rule.channels.length === 0) {
      return;
    }

    try {
      await notificationService.send(rule.channels, {
        type: 'alert',
        title: `❌ 自动响应失败 - ${rule.name}`,
        body: `自动响应脚本执行失败: ${error}\n\n原始告警: ${event.message}`,
        data: {
          eventId: event.id,
          ruleId: rule.id,
          error,
        },
      });
    } catch (notifyError) {
      logger.error(`Failed to send auto-response failure notification:`, notifyError);
    }
  }


  // ==================== 告警事件管理 ====================

  /**
   * 获取活跃告警
   */
  async getActiveAlerts(): Promise<AlertEvent[]> {
    await this.initialize();
    return Array.from(this.activeAlerts.values());
  }

  /**
   * 获取告警历史
   */
  async getAlertHistory(from: number, to: number): Promise<AlertEvent[]> {
    await this.initialize();

    const dates = this.getDateRange(from, to);
    let allEvents: AlertEvent[] = [];

    for (const dateStr of dates) {
      const events = await this.readEventsFile(dateStr);
      allEvents = allEvents.concat(events);
    }

    // 过滤时间范围
    allEvents = allEvents.filter(
      (e) => e.triggeredAt >= from && e.triggeredAt <= to
    );

    // 按时间降序排序
    allEvents.sort((a, b) => b.triggeredAt - a.triggeredAt);

    return allEvents;
  }

  /**
   * 手动解决告警
   */
  async resolveAlert(id: string): Promise<void> {
    await this.initialize();

    const event = this.activeAlerts.get(id);
    if (!event) {
      // 尝试从文件中查找
      const now = Date.now();
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
      const dates = this.getDateRange(sevenDaysAgo, now);

      for (const dateStr of dates) {
        const events = await this.readEventsFile(dateStr);
        const found = events.find((e) => e.id === id);
        if (found) {
          if (found.status === 'resolved') {
            throw new Error(`Alert already resolved: ${id}`);
          }
          found.status = 'resolved';
          found.resolvedAt = now;
          await this.writeEventsFile(dateStr, events);

          // 记录审计日志
          await auditLogger.log({
            action: 'alert_resolve',
            actor: 'user',
            details: {
              trigger: 'manual',
              metadata: {
                eventId: id,
                ruleId: found.ruleId,
              },
            },
          });

          logger.info(`Alert manually resolved: ${id}`);
          return;
        }
      }

      throw new Error(`Alert not found: ${id}`);
    }

    // 更新活跃告警
    event.status = 'resolved';
    event.resolvedAt = Date.now();

    await this.saveEvent(event);
    this.activeAlerts.delete(id);

    // 记录审计日志
    await auditLogger.log({
      action: 'alert_resolve',
      actor: 'user',
      details: {
        trigger: 'manual',
        metadata: {
          eventId: id,
          ruleId: event.ruleId,
          ruleName: event.ruleName,
        },
      },
    });

    // 获取规则并发送恢复通知
    const rule = this.rules.find((r) => r.id === event.ruleId);
    if (rule) {
      await this.sendRecoveryNotification(event, rule);
    }

    logger.info(`Alert manually resolved: ${id}`);
  }

  /**
   * 根据 ID 获取告警事件
   */
  async getAlertEventById(id: string): Promise<AlertEvent | null> {
    await this.initialize();

    // 先检查活跃告警
    const activeEvent = this.activeAlerts.get(id);
    if (activeEvent) {
      return activeEvent;
    }

    // 从文件中查找
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const dates = this.getDateRange(thirtyDaysAgo, now);

    for (const dateStr of dates) {
      const events = await this.readEventsFile(dateStr);
      const found = events.find((e) => e.id === id);
      if (found) {
        return found;
      }
    }

    return null;
  }

  /**
   * 获取规则的告警统计
   */
  async getRuleAlertStats(
    ruleId: string,
    from: number,
    to: number
  ): Promise<{ total: number; active: number; resolved: number }> {
    const events = await this.getAlertHistory(from, to);
    const ruleEvents = events.filter((e) => e.ruleId === ruleId);

    return {
      total: ruleEvents.length,
      active: ruleEvents.filter((e) => e.status === 'active').length,
      resolved: ruleEvents.filter((e) => e.status === 'resolved').length,
    };
  }
}

// 导出单例实例
export const alertEngine = new AlertEngine();

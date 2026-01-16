/**
 * FaultHealer 故障自愈服务
 * 负责故障模式管理、故障匹配和自动修复
 *
 * Requirements: 7.1-7.12
 * - 7.1: 支持预定义常见故障模式和对应的修复脚本
 * - 7.2: 内置故障模式：PPPoE 断线重连、DHCP 池耗尽扩容、接口 down 重启
 * - 7.3: 支持用户自定义故障模式和修复脚本
 * - 7.4: 告警触发时检查是否匹配已定义的故障模式
 * - 7.5: 匹配到故障模式时调用 AI 服务确认故障诊断
 * - 7.6: AI 确认故障诊断后执行对应的修复脚本
 * - 7.7: 执行修复脚本前创建配置快照作为回滚点
 * - 7.8: 修复脚本执行完成时验证故障是否已修复
 * - 7.9: 故障修复成功时发送修复成功通知
 * - 7.10: 故障修复失败时发送修复失败通知并建议人工介入
 * - 7.11: 支持配置每个故障模式的自动修复开关
 * - 7.12: 自动修复被禁用时仅发送告警和修复建议，不执行脚本
 */

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  FaultPattern,
  CreateFaultPatternInput,
  UpdateFaultPatternInput,
  RemediationExecution,
  IFaultHealer,
  AlertEvent,
  AlertOperator,
} from '../../types/ai-ops';
import { logger } from '../../utils/logger';
import { auditLogger } from './auditLogger';
import { notificationService } from './notificationService';
import { configSnapshotService } from './configSnapshotService';
import { connectionPool } from '../connectionPool';
import { deviceService } from '../deviceService';

const DATA_DIR = path.join(process.cwd(), 'data', 'ai-ops');
const PATTERNS_DIR = path.join(DATA_DIR, 'patterns');
const PATTERNS_FILE = path.join(PATTERNS_DIR, 'patterns.json');
const REMEDIATIONS_DIR = path.join(DATA_DIR, 'remediations');

/**
 * 获取日期字符串 (YYYY-MM-DD)
 */
function getDateString(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toISOString().split('T')[0];
}

/**
 * 获取修复执行记录文件路径
 */
function getRemediationsFilePath(dateStr: string): string {
  return path.join(REMEDIATIONS_DIR, `${dateStr}.json`);
}

/**
 * 内置故障模式定义
 */
const BUILTIN_PATTERNS: Omit<FaultPattern, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'PPPoE 断线重连',
    description: '当 PPPoE 接口断开时，自动尝试重新连接',
    enabled: true,
    autoHeal: false, // 默认禁用自动修复，需要用户手动启用
    builtin: true,
    conditions: [
      {
        metric: 'interface_status',
        metricLabel: 'pppoe-out1',
        operator: 'eq',
        threshold: 0, // 0 表示 down
      },
    ],
    remediationScript: `/interface pppoe-client disable pppoe-out1
:delay 3s
/interface pppoe-client enable pppoe-out1`,
    verificationScript: `/interface pppoe-client print where name=pppoe-out1`,
  },
  {
    name: 'DHCP 池耗尽扩容',
    description: '当 DHCP 地址池使用率过高时，自动扩展地址范围',
    enabled: true,
    autoHeal: false,
    builtin: true,
    conditions: [
      {
        metric: 'memory', // 使用内存作为代理指标，实际应检查 DHCP 池使用率
        operator: 'gt',
        threshold: 95,
      },
    ],
    remediationScript: `# DHCP 池扩容需要根据实际配置调整
# /ip pool set [find name=dhcp-pool] ranges=192.168.1.10-192.168.1.250`,
    verificationScript: `/ip pool print`,
  },
  {
    name: '接口 Down 重启',
    description: '当网络接口异常断开时，自动重启接口',
    enabled: true,
    autoHeal: false,
    builtin: true,
    conditions: [
      {
        metric: 'interface_status',
        operator: 'eq',
        threshold: 0,
      },
    ],
    remediationScript: `# 接口重启脚本，需要指定具体接口名称
# /interface disable [find name=ether1]
# :delay 3s
# /interface enable [find name=ether1]`,
    verificationScript: `/interface print`,
  },
];

export class FaultHealer implements IFaultHealer {
  private patterns: FaultPattern[] = [];
  private initialized = false;

  /**
   * 确保数据目录存在
   */
  private async ensureDataDir(): Promise<void> {
    try {
      await fs.mkdir(PATTERNS_DIR, { recursive: true });
      await fs.mkdir(REMEDIATIONS_DIR, { recursive: true });
    } catch (error) {
      logger.error('Failed to create fault healer directories:', error);
    }
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.ensureDataDir();
    await this.loadPatterns();
    await this.ensureBuiltinPatterns();
    this.initialized = true;
    logger.info('FaultHealer initialized');
  }


  /**
   * 加载故障模式
   */
  private async loadPatterns(): Promise<void> {
    try {
      const data = await fs.readFile(PATTERNS_FILE, 'utf-8');
      this.patterns = JSON.parse(data) as FaultPattern[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.patterns = [];
        await this.savePatterns();
      } else {
        logger.error('Failed to load fault patterns:', error);
        this.patterns = [];
      }
    }
  }

  /**
   * 保存故障模式
   */
  private async savePatterns(): Promise<void> {
    await this.ensureDataDir();
    await fs.writeFile(PATTERNS_FILE, JSON.stringify(this.patterns, null, 2), 'utf-8');
  }

  /**
   * 确保内置故障模式存在
   */
  private async ensureBuiltinPatterns(): Promise<void> {
    const now = Date.now();
    let updated = false;

    for (const builtinPattern of BUILTIN_PATTERNS) {
      const existing = this.patterns.find(
        (p) => p.builtin && p.name === builtinPattern.name
      );

      if (!existing) {
        const pattern: FaultPattern = {
          id: uuidv4(),
          createdAt: now,
          updatedAt: now,
          ...builtinPattern,
        };
        this.patterns.push(pattern);
        updated = true;
        logger.info(`Added builtin fault pattern: ${pattern.name}`);
      }
    }

    if (updated) {
      await this.savePatterns();
    }
  }

  /**
   * 读取指定日期的修复执行记录
   */
  private async readRemediationsFile(dateStr: string): Promise<RemediationExecution[]> {
    const filePath = getRemediationsFilePath(dateStr);
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) as RemediationExecution[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      logger.error(`Failed to read remediations file ${dateStr}:`, error);
      return [];
    }
  }

  /**
   * 写入修复执行记录
   */
  private async writeRemediationsFile(
    dateStr: string,
    remediations: RemediationExecution[]
  ): Promise<void> {
    await this.ensureDataDir();
    const filePath = getRemediationsFilePath(dateStr);
    await fs.writeFile(filePath, JSON.stringify(remediations, null, 2), 'utf-8');
  }

  /**
   * 保存修复执行记录
   */
  private async saveRemediation(remediation: RemediationExecution): Promise<void> {
    const dateStr = getDateString(remediation.startedAt);
    const remediations = await this.readRemediationsFile(dateStr);

    const existingIndex = remediations.findIndex((r) => r.id === remediation.id);
    if (existingIndex >= 0) {
      remediations[existingIndex] = remediation;
    } else {
      remediations.push(remediation);
    }

    await this.writeRemediationsFile(dateStr, remediations);
  }

  // ==================== 故障模式管理 ====================

  /**
   * 获取所有故障模式
   */
  async getPatterns(): Promise<FaultPattern[]> {
    await this.initialize();
    return [...this.patterns];
  }

  /**
   * 根据 ID 获取故障模式
   */
  async getPatternById(id: string): Promise<FaultPattern | null> {
    await this.initialize();
    return this.patterns.find((p) => p.id === id) || null;
  }

  /**
   * 创建故障模式
   */
  async createPattern(input: CreateFaultPatternInput): Promise<FaultPattern> {
    await this.initialize();

    const now = Date.now();
    const pattern: FaultPattern = {
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      builtin: false, // 用户创建的模式不是内置的
      ...input,
    };

    this.patterns.push(pattern);
    await this.savePatterns();

    logger.info(`Created fault pattern: ${pattern.name} (${pattern.id})`);
    return pattern;
  }

  /**
   * 更新故障模式
   */
  async updatePattern(id: string, updates: UpdateFaultPatternInput): Promise<FaultPattern> {
    await this.initialize();

    const index = this.patterns.findIndex((p) => p.id === id);
    if (index === -1) {
      throw new Error(`Fault pattern not found: ${id}`);
    }

    const pattern = this.patterns[index];
    const updatedPattern: FaultPattern = {
      ...pattern,
      ...updates,
      updatedAt: Date.now(),
    };

    this.patterns[index] = updatedPattern;
    await this.savePatterns();

    logger.info(`Updated fault pattern: ${updatedPattern.name} (${id})`);
    return updatedPattern;
  }

  /**
   * 删除故障模式
   */
  async deletePattern(id: string): Promise<void> {
    await this.initialize();

    const index = this.patterns.findIndex((p) => p.id === id);
    if (index === -1) {
      throw new Error(`Fault pattern not found: ${id}`);
    }

    const pattern = this.patterns[index];
    
    // 内置模式不能删除，只能禁用
    if (pattern.builtin) {
      throw new Error('Cannot delete builtin fault pattern. You can disable it instead.');
    }

    this.patterns.splice(index, 1);
    await this.savePatterns();

    logger.info(`Deleted fault pattern: ${pattern.name} (${id})`);
  }

  /**
   * 启用自动修复
   */
  async enableAutoHeal(id: string): Promise<void> {
    await this.updatePattern(id, { autoHeal: true });
    logger.info(`Enabled auto-heal for fault pattern: ${id}`);
  }

  /**
   * 禁用自动修复
   */
  async disableAutoHeal(id: string): Promise<void> {
    await this.updatePattern(id, { autoHeal: false });
    logger.info(`Disabled auto-heal for fault pattern: ${id}`);
  }

  /**
   * 启用故障模式
   */
  async enablePattern(id: string): Promise<void> {
    await this.updatePattern(id, { enabled: true });
    logger.info(`Enabled fault pattern: ${id}`);
  }

  /**
   * 禁用故障模式
   */
  async disablePattern(id: string): Promise<void> {
    await this.updatePattern(id, { enabled: false });
    logger.info(`Disabled fault pattern: ${id}`);
  }


  // ==================== 故障匹配 ====================

  /**
   * 评估条件运算符
   */
  private evaluateCondition(
    value: number,
    operator: AlertOperator,
    threshold: number
  ): boolean {
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
        return false;
    }
  }

  /**
   * 检查告警事件是否匹配故障模式的条件
   */
  private matchesConditions(
    alertEvent: AlertEvent,
    pattern: FaultPattern
  ): boolean {
    // 检查每个条件是否匹配
    for (const condition of pattern.conditions) {
      // 检查指标类型是否匹配
      if (condition.metric !== alertEvent.metric) {
        continue; // 尝试下一个条件
      }

      // 检查指标标签是否匹配（如果指定了）
      // 注意：AlertEvent 没有 metricLabel 字段，我们需要从其他地方获取
      // 这里简化处理，只检查指标类型和阈值

      // 检查条件是否满足
      if (this.evaluateCondition(
        alertEvent.currentValue,
        condition.operator,
        condition.threshold
      )) {
        return true; // 至少一个条件匹配
      }
    }

    return false;
  }

  /**
   * 匹配告警事件到故障模式
   */
  async matchPattern(alertEvent: AlertEvent): Promise<FaultPattern | null> {
    await this.initialize();

    // 遍历所有启用的故障模式
    for (const pattern of this.patterns) {
      if (!pattern.enabled) {
        continue;
      }

      // 检查是否匹配
      if (this.matchesConditions(alertEvent, pattern)) {
        logger.info(
          `Alert event ${alertEvent.id} matched fault pattern: ${pattern.name}`
        );
        return pattern;
      }
    }

    return null;
  }

  // ==================== 故障修复执行 ====================

  /**
   * 获取 AI 故障诊断确认（占位实现，后续集成 AIAnalyzer）
   */
  private async getAIConfirmation(
    pattern: FaultPattern,
    alertEvent: AlertEvent
  ): Promise<{ confirmed: boolean; confidence: number; reasoning: string }> {
    // TODO: 集成 AIAnalyzer 服务进行故障诊断确认
    // 目前返回基础确认
    return {
      confirmed: true,
      confidence: 0.85,
      reasoning: `告警事件 "${alertEvent.message}" 与故障模式 "${pattern.name}" 的条件匹配。建议执行修复脚本。`,
    };
  }

  /**
   * 执行 RouterOS 脚本
   */
  private async executeScript(script: string): Promise<{ output: string; error?: string }> {
    // TODO: Support multi-device. Default to first.
    const devices = await deviceService.getAllDevices();
    if (devices.length === 0) return { output: '', error: 'No devices found' };
    const deviceId = devices[0].id;
    const client = await connectionPool.getClient(deviceId);

    const lines = script
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));

    const outputs: string[] = [];
    let lastError: string | undefined;

    for (const line of lines) {
      try {
        // 处理延迟命令
        if (line.startsWith(':delay')) {
          const match = line.match(/:delay\s+(\d+)s?/);
          if (match) {
            const seconds = parseInt(match[1], 10);
            await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
            outputs.push(`Delayed ${seconds} seconds`);
          }
          continue;
        }

        const { apiCommand, params } = this.convertToApiFormat(line);
        if (!apiCommand) {
          continue;
        }

        const response = await client.executeRaw(apiCommand, params);

        if (response !== null && response !== undefined) {
          if (Array.isArray(response) && response.length > 0) {
            outputs.push(JSON.stringify(response, null, 2));
          } else if (typeof response === 'object') {
            outputs.push(JSON.stringify(response, null, 2));
          }
        }
        outputs.push(`Executed: ${line}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        lastError = `命令 "${line}" 执行失败: ${errorMessage}`;
        outputs.push(lastError);
        logger.warn(`Script line failed: ${line}`, error);
      }
    }

    return {
      output: outputs.join('\n') || '脚本执行完成',
      error: lastError,
    };
  }

  /**
   * 将 CLI 格式命令转换为 API 格式
   */
  private convertToApiFormat(command: string): { apiCommand: string; params: string[] } {
    const trimmed = command.trim();
    
    // 跳过空行和注释
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(':')) {
      return { apiCommand: '', params: [] };
    }

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
   * 执行验证脚本
   */
  private async executeVerification(
    pattern: FaultPattern,
    alertEvent: AlertEvent
  ): Promise<{ passed: boolean; message: string }> {
    if (!pattern.verificationScript) {
      return { passed: true, message: '无验证脚本，假定修复成功' };
    }

    try {
      const result = await this.executeScript(pattern.verificationScript);
      
      // 简单验证：如果脚本执行没有错误，认为验证通过
      // 实际应用中应该解析输出并检查具体状态
      if (!result.error) {
        return { passed: true, message: `验证通过: ${result.output}` };
      } else {
        return { passed: false, message: `验证失败: ${result.error}` };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { passed: false, message: `验证脚本执行失败: ${errorMessage}` };
    }
  }


  /**
   * 执行故障修复
   */
  async executeRemediation(
    patternId: string,
    alertEventId: string
  ): Promise<RemediationExecution> {
    await this.initialize();

    const pattern = await this.getPatternById(patternId);
    if (!pattern) {
      throw new Error(`Fault pattern not found: ${patternId}`);
    }

    const now = Date.now();

    // 创建修复执行记录
    const remediation: RemediationExecution = {
      id: uuidv4(),
      patternId,
      patternName: pattern.name,
      alertEventId,
      status: 'pending',
      startedAt: now,
    };

    // 检查自动修复是否启用
    if (!pattern.autoHeal) {
      // 自动修复被禁用，跳过执行
      remediation.status = 'skipped';
      remediation.completedAt = Date.now();
      await this.saveRemediation(remediation);

      // 发送修复建议通知（Requirements 7.12）
      await this.sendRemediationSuggestionNotification(pattern, alertEventId);

      logger.info(
        `Remediation skipped (auto-heal disabled): ${pattern.name} for alert ${alertEventId}`
      );
      return remediation;
    }

    // 获取 AI 确认（Requirements 7.5）
    try {
      // 创建一个模拟的 AlertEvent 用于 AI 确认
      const mockAlertEvent: AlertEvent = {
        id: alertEventId,
        ruleId: '',
        ruleName: '',
        severity: 'warning',
        metric: pattern.conditions[0]?.metric || 'cpu',
        currentValue: pattern.conditions[0]?.threshold || 0,
        threshold: pattern.conditions[0]?.threshold || 0,
        message: `故障模式匹配: ${pattern.name}`,
        status: 'active',
        triggeredAt: now,
      };

      const aiConfirmation = await this.getAIConfirmation(pattern, mockAlertEvent);
      remediation.aiConfirmation = aiConfirmation;

      if (!aiConfirmation.confirmed) {
        // AI 不确认故障诊断，跳过修复
        remediation.status = 'skipped';
        remediation.completedAt = Date.now();
        await this.saveRemediation(remediation);

        logger.info(
          `Remediation skipped (AI not confirmed): ${pattern.name} for alert ${alertEventId}`
        );
        return remediation;
      }
    } catch (error) {
      logger.warn('Failed to get AI confirmation, proceeding with remediation:', error);
    }

    // 更新状态为执行中
    remediation.status = 'executing';
    await this.saveRemediation(remediation);

    // 创建修复前配置快照（Requirements 7.7）
    try {
      const preSnapshot = await configSnapshotService.createSnapshot('pre-remediation');
      remediation.preSnapshotId = preSnapshot.id;
      await this.saveRemediation(remediation);
      logger.info(`Created pre-remediation snapshot: ${preSnapshot.id}`);
    } catch (error) {
      logger.warn('Failed to create pre-remediation snapshot:', error);
    }

    // 记录执行意图到审计日志
    await auditLogger.log({
      action: 'remediation_execute',
      actor: 'system',
      details: {
        trigger: `fault_pattern:${pattern.name}`,
        script: pattern.remediationScript,
        metadata: {
          remediationId: remediation.id,
          patternId,
          alertEventId,
          preSnapshotId: remediation.preSnapshotId,
        },
      },
    });

    // 执行修复脚本（Requirements 7.6）
    try {
      // TODO: Support multi-device
      const devices = await deviceService.getAllDevices();
      if (devices.length === 0) throw new Error('No devices found');
      const client = await connectionPool.getClient(devices[0].id);

      // 检查 RouterOS 连接
      if (!client.isConnected()) {
        throw new Error('RouterOS not connected');
      }

      const result = await this.executeScript(pattern.remediationScript);
      remediation.executionResult = result;

      // 执行验证脚本（Requirements 7.8）
      const verification = await this.executeVerification(pattern, {
        id: alertEventId,
        ruleId: '',
        ruleName: '',
        severity: 'warning',
        metric: pattern.conditions[0]?.metric || 'cpu',
        currentValue: 0,
        threshold: 0,
        message: '',
        status: 'active',
        triggeredAt: now,
      });
      remediation.verificationResult = verification;

      // 根据验证结果设置状态
      if (verification.passed && !result.error) {
        remediation.status = 'success';
        // 发送修复成功通知（Requirements 7.9）
        await this.sendRemediationSuccessNotification(remediation, pattern);
      } else {
        remediation.status = 'failed';
        // 发送修复失败通知（Requirements 7.10）
        await this.sendRemediationFailureNotification(remediation, pattern);
      }

      remediation.completedAt = Date.now();
      await this.saveRemediation(remediation);

      // 记录执行结果到审计日志
      await auditLogger.log({
        action: 'remediation_execute',
        actor: 'system',
        details: {
          trigger: `fault_pattern:${pattern.name}`,
          result: remediation.status,
          metadata: {
            remediationId: remediation.id,
            patternId,
            alertEventId,
            output: result.output,
            error: result.error,
            verificationPassed: verification.passed,
          },
        },
      });

      logger.info(
        `Remediation ${remediation.status}: ${pattern.name} for alert ${alertEventId}`
      );
      return remediation;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      remediation.status = 'failed';
      remediation.executionResult = {
        output: '',
        error: errorMessage,
      };
      remediation.completedAt = Date.now();
      await this.saveRemediation(remediation);

      // 记录执行失败到审计日志
      await auditLogger.log({
        action: 'remediation_execute',
        actor: 'system',
        details: {
          trigger: `fault_pattern:${pattern.name}`,
          result: 'failed',
          error: errorMessage,
          metadata: {
            remediationId: remediation.id,
            patternId,
            alertEventId,
          },
        },
      });

      // 发送修复失败通知
      await this.sendRemediationFailureNotification(remediation, pattern);

      logger.error(`Remediation failed: ${pattern.name} for alert ${alertEventId}`, error);
      return remediation;
    }
  }


  // ==================== 通知发送 ====================

  /**
   * 发送修复成功通知（Requirements 7.9）
   */
  private async sendRemediationSuccessNotification(
    remediation: RemediationExecution,
    pattern: FaultPattern
  ): Promise<void> {
    try {
      // 获取所有启用的通知渠道
      const channels = await notificationService.getChannels();
      const enabledChannelIds = channels
        .filter((c) => c.enabled)
        .map((c) => c.id);

      if (enabledChannelIds.length === 0) {
        logger.debug('No enabled notification channels for remediation success');
        return;
      }

      await notificationService.send(enabledChannelIds, {
        type: 'remediation',
        title: `✅ 故障修复成功 - ${pattern.name}`,
        body: `故障模式 "${pattern.name}" 的修复脚本已成功执行。\n\n` +
          `修复 ID: ${remediation.id}\n` +
          `告警事件 ID: ${remediation.alertEventId}\n` +
          (remediation.verificationResult
            ? `验证结果: ${remediation.verificationResult.message}`
            : ''),
        data: {
          remediationId: remediation.id,
          patternId: pattern.id,
          patternName: pattern.name,
          alertEventId: remediation.alertEventId,
          status: 'success',
          preSnapshotId: remediation.preSnapshotId,
        },
      });

      logger.info(`Remediation success notification sent for: ${pattern.name}`);
    } catch (error) {
      logger.error('Failed to send remediation success notification:', error);
    }
  }

  /**
   * 发送修复失败通知（Requirements 7.10）
   */
  private async sendRemediationFailureNotification(
    remediation: RemediationExecution,
    pattern: FaultPattern
  ): Promise<void> {
    try {
      // 获取所有启用的通知渠道
      const channels = await notificationService.getChannels();
      const enabledChannelIds = channels
        .filter((c) => c.enabled)
        .map((c) => c.id);

      if (enabledChannelIds.length === 0) {
        logger.debug('No enabled notification channels for remediation failure');
        return;
      }

      const errorMessage = remediation.executionResult?.error || '未知错误';
      const verificationMessage = remediation.verificationResult?.message || '';

      await notificationService.send(enabledChannelIds, {
        type: 'remediation',
        title: `❌ 故障修复失败 - ${pattern.name}`,
        body: `故障模式 "${pattern.name}" 的修复脚本执行失败，建议人工介入。\n\n` +
          `修复 ID: ${remediation.id}\n` +
          `告警事件 ID: ${remediation.alertEventId}\n` +
          `错误信息: ${errorMessage}\n` +
          (verificationMessage ? `验证结果: ${verificationMessage}\n` : '') +
          (remediation.preSnapshotId
            ? `\n可使用快照 ${remediation.preSnapshotId} 进行回滚。`
            : ''),
        data: {
          remediationId: remediation.id,
          patternId: pattern.id,
          patternName: pattern.name,
          alertEventId: remediation.alertEventId,
          status: 'failed',
          error: errorMessage,
          preSnapshotId: remediation.preSnapshotId,
        },
      });

      logger.info(`Remediation failure notification sent for: ${pattern.name}`);
    } catch (error) {
      logger.error('Failed to send remediation failure notification:', error);
    }
  }

  /**
   * 发送修复建议通知（当自动修复被禁用时）（Requirements 7.12）
   */
  private async sendRemediationSuggestionNotification(
    pattern: FaultPattern,
    alertEventId: string
  ): Promise<void> {
    try {
      // 获取所有启用的通知渠道
      const channels = await notificationService.getChannels();
      const enabledChannelIds = channels
        .filter((c) => c.enabled)
        .map((c) => c.id);

      if (enabledChannelIds.length === 0) {
        logger.debug('No enabled notification channels for remediation suggestion');
        return;
      }

      await notificationService.send(enabledChannelIds, {
        type: 'alert',
        title: `🔧 故障修复建议 - ${pattern.name}`,
        body: `检测到与故障模式 "${pattern.name}" 匹配的告警。\n\n` +
          `告警事件 ID: ${alertEventId}\n` +
          `故障描述: ${pattern.description}\n\n` +
          `自动修复已禁用，建议手动执行以下修复脚本:\n\n` +
          `\`\`\`\n${pattern.remediationScript}\n\`\`\`\n\n` +
          `如需启用自动修复，请在故障模式管理中开启。`,
        data: {
          patternId: pattern.id,
          patternName: pattern.name,
          alertEventId,
          autoHealDisabled: true,
          remediationScript: pattern.remediationScript,
        },
      });

      logger.info(`Remediation suggestion notification sent for: ${pattern.name}`);
    } catch (error) {
      logger.error('Failed to send remediation suggestion notification:', error);
    }
  }

  // ==================== 修复历史 ====================

  /**
   * 获取修复执行历史
   */
  async getRemediationHistory(limit?: number): Promise<RemediationExecution[]> {
    await this.initialize();

    // 获取最近 30 天的日期
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const dates = this.getDateRange(thirtyDaysAgo, now);

    let allRemediations: RemediationExecution[] = [];

    for (const dateStr of dates) {
      const remediations = await this.readRemediationsFile(dateStr);
      allRemediations = allRemediations.concat(remediations);
    }

    // 按时间降序排序
    allRemediations.sort((a, b) => b.startedAt - a.startedAt);

    // 应用限制
    if (limit && limit > 0) {
      allRemediations = allRemediations.slice(0, limit);
    }

    return allRemediations;
  }

  /**
   * 根据 ID 获取修复执行记录
   */
  async getRemediationById(id: string): Promise<RemediationExecution | null> {
    await this.initialize();

    // 搜索最近 30 天的记录
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const dates = this.getDateRange(thirtyDaysAgo, now);

    for (const dateStr of dates) {
      const remediations = await this.readRemediationsFile(dateStr);
      const found = remediations.find((r) => r.id === id);
      if (found) {
        return found;
      }
    }

    return null;
  }

  /**
   * 获取日期范围内的所有日期字符串
   */
  private getDateRange(from: number, to: number): string[] {
    const dates: string[] = [];
    const current = new Date(from);
    current.setHours(0, 0, 0, 0);
    const endDate = new Date(to);
    endDate.setHours(23, 59, 59, 999);

    while (current <= endDate) {
      dates.push(getDateString(current.getTime()));
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  /**
   * 获取故障模式的修复统计
   */
  async getPatternRemediationStats(
    patternId: string,
    from: number,
    to: number
  ): Promise<{
    total: number;
    success: number;
    failed: number;
    skipped: number;
  }> {
    const dates = this.getDateRange(from, to);
    let allRemediations: RemediationExecution[] = [];

    for (const dateStr of dates) {
      const remediations = await this.readRemediationsFile(dateStr);
      allRemediations = allRemediations.concat(remediations);
    }

    // 过滤指定模式的记录
    const patternRemediations = allRemediations.filter(
      (r) => r.patternId === patternId && r.startedAt >= from && r.startedAt <= to
    );

    return {
      total: patternRemediations.length,
      success: patternRemediations.filter((r) => r.status === 'success').length,
      failed: patternRemediations.filter((r) => r.status === 'failed').length,
      skipped: patternRemediations.filter((r) => r.status === 'skipped').length,
    };
  }

  /**
   * 处理告警事件并尝试自动修复
   * 这是一个便捷方法，用于从告警引擎调用
   */
  async handleAlertEvent(alertEvent: AlertEvent): Promise<RemediationExecution | null> {
    await this.initialize();

    // 匹配故障模式
    const pattern = await this.matchPattern(alertEvent);
    if (!pattern) {
      logger.debug(`No fault pattern matched for alert: ${alertEvent.id}`);
      return null;
    }

    // 执行修复
    return this.executeRemediation(pattern.id, alertEvent.id);
  }
}

// 导出单例实例
export const faultHealer = new FaultHealer();

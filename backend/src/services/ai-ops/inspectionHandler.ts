/**
 * InspectionHandler 巡检处理器
 * 负责执行自动巡检任务，采集系统状态并生成报告
 *
 * Requirements: 5.1, 5.2, 5.3
 * - 5.1: 巡检任务执行时调用已注册的巡检处理器
 * - 5.2: 巡检任务完成后生成可查看的巡检报告
 * - 5.3: 巡检发现问题时产生相应的告警事件
 */

import { ScheduledTask, AlertSeverity } from '../../types/ai-ops';
import { logger } from '../../utils/logger';
import { metricsCollector } from './metricsCollector';
import { alertEngine } from './alertEngine';
import { scheduler } from './scheduler';
import { healthReportService } from './healthReportService';
import { notificationService } from './notificationService';

/**
 * 巡检问题
 */
export interface InspectionIssue {
  severity: AlertSeverity;
  message: string;
  metric?: string;
  value?: number;
  threshold?: number;
}

/**
 * 巡检结果
 */
export interface InspectionResult {
  timestamp: number;
  systemHealth: {
    cpu: number;
    memory: number;
    disk: number;
    uptime: number;
  };
  interfaces: Array<{
    name: string;
    status: 'up' | 'down';
    rxBytes: number;
    txBytes: number;
  }>;
  issues: InspectionIssue[];
  summary: {
    totalInterfaces: number;
    upInterfaces: number;
    downInterfaces: number;
    issueCount: number;
    overallStatus: 'healthy' | 'warning' | 'critical';
  };
  reportId?: string;
}

/**
 * 巡检配置
 */
interface InspectionConfig {
  cpuWarningThreshold?: number;
  cpuCriticalThreshold?: number;
  memoryWarningThreshold?: number;
  memoryCriticalThreshold?: number;
  diskWarningThreshold?: number;
  diskCriticalThreshold?: number;
  periodHours?: number;
  channelIds?: string[];
  generateReport?: boolean;
}

const DEFAULT_CONFIG: Required<Omit<InspectionConfig, 'channelIds'>> & { channelIds: string[] } = {
  cpuWarningThreshold: 80,
  cpuCriticalThreshold: 95,
  memoryWarningThreshold: 80,
  memoryCriticalThreshold: 95,
  diskWarningThreshold: 80,
  diskCriticalThreshold: 95,
  periodHours: 24,
  channelIds: [],
  generateReport: true,
};

/**
 * 执行巡检任务
 */
export async function executeInspection(task: ScheduledTask): Promise<InspectionResult> {
  logger.info(`Executing inspection task: ${task.name} (${task.id})`);

  const taskConfig = task.config as InspectionConfig || {};
  const config = {
    ...DEFAULT_CONFIG,
    ...taskConfig,
  };

  // 采集系统状态
  const metrics = await collectSystemStatus();
  
  // 分析问题
  const issues = analyzeIssues(metrics, config);

  // 计算摘要
  const upInterfaces = metrics.interfaces.filter(i => i.status === 'up').length;
  const downInterfaces = metrics.interfaces.filter(i => i.status === 'down').length;
  
  // 确定整体状态
  let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
  if (issues.some(i => i.severity === 'critical' || i.severity === 'emergency')) {
    overallStatus = 'critical';
  } else if (issues.some(i => i.severity === 'warning')) {
    overallStatus = 'warning';
  }

  const result: InspectionResult = {
    timestamp: Date.now(),
    systemHealth: {
      cpu: metrics.system.cpu.usage,
      memory: metrics.system.memory.usage,
      disk: metrics.system.disk.usage,
      uptime: metrics.system.uptime,
    },
    interfaces: metrics.interfaces.map(i => ({
      name: i.name,
      status: i.status,
      rxBytes: i.rxBytes,
      txBytes: i.txBytes,
    })),
    issues,
    summary: {
      totalInterfaces: metrics.interfaces.length,
      upInterfaces,
      downInterfaces,
      issueCount: issues.length,
      overallStatus,
    },
  };

  // 如果发现问题，触发告警评估
  if (issues.length > 0) {
    await triggerInspectionAlerts(metrics);
  }

  // 生成健康报告（如果配置启用）
  if (config.generateReport) {
    try {
      const periodHours = config.periodHours || 24;
      const to = Date.now();
      const from = to - periodHours * 60 * 60 * 1000;
      
      const report = await healthReportService.generateReport(from, to);
      result.reportId = report.id;
      
      // 如果配置了通知渠道，发送报告
      if (config.channelIds && config.channelIds.length > 0) {
        await healthReportService.sendReportNotification(report, config.channelIds);
      }
      
      logger.info(`Health report generated: ${report.id}`);
    } catch (error) {
      logger.error('Failed to generate health report:', error);
    }
  }

  // 如果发现严重问题且配置了通知渠道，发送巡检告警通知
  if (issues.length > 0 && config.channelIds && config.channelIds.length > 0) {
    await sendInspectionNotification(result, config.channelIds);
  }

  logger.info(`Inspection completed: ${issues.length} issues found, status: ${overallStatus}`);
  return result;
}

/**
 * 采集系统状态
 */
async function collectSystemStatus() {
  try {
    // 尝试立即采集最新数据
    return await metricsCollector.collectNow();
  } catch (error) {
    logger.warn('Failed to collect fresh metrics, trying cached data:', error);
    
    // 如果采集失败，尝试获取缓存的最新数据
    const cached = await metricsCollector.getLatest();
    if (cached) {
      return cached;
    }
    
    // 如果没有缓存数据，抛出错误
    throw new Error('无法采集系统状态：RouterOS 连接失败且无缓存数据');
  }
}

/**
 * 分析问题
 */
export function analyzeIssues(
  metrics: { system: { cpu: { usage: number }; memory: { usage: number }; disk: { usage: number }; uptime: number }; interfaces: Array<{ name: string; status: 'up' | 'down'; rxBytes: number; txBytes: number; rxPackets: number; txPackets: number; rxErrors: number; txErrors: number }> },
  config: {
    cpuWarningThreshold: number;
    cpuCriticalThreshold: number;
    memoryWarningThreshold: number;
    memoryCriticalThreshold: number;
    diskWarningThreshold: number;
    diskCriticalThreshold: number;
  }
): InspectionIssue[] {
  const issues: InspectionIssue[] = [];

  // 检查 CPU 使用率
  if (metrics.system.cpu.usage >= config.cpuCriticalThreshold) {
    issues.push({
      severity: 'critical',
      message: `CPU 使用率过高: ${metrics.system.cpu.usage}%`,
      metric: 'cpu',
      value: metrics.system.cpu.usage,
      threshold: config.cpuCriticalThreshold,
    });
  } else if (metrics.system.cpu.usage >= config.cpuWarningThreshold) {
    issues.push({
      severity: 'warning',
      message: `CPU 使用率较高: ${metrics.system.cpu.usage}%`,
      metric: 'cpu',
      value: metrics.system.cpu.usage,
      threshold: config.cpuWarningThreshold,
    });
  }

  // 检查内存使用率
  if (metrics.system.memory.usage >= config.memoryCriticalThreshold) {
    issues.push({
      severity: 'critical',
      message: `内存使用率过高: ${metrics.system.memory.usage}%`,
      metric: 'memory',
      value: metrics.system.memory.usage,
      threshold: config.memoryCriticalThreshold,
    });
  } else if (metrics.system.memory.usage >= config.memoryWarningThreshold) {
    issues.push({
      severity: 'warning',
      message: `内存使用率较高: ${metrics.system.memory.usage}%`,
      metric: 'memory',
      value: metrics.system.memory.usage,
      threshold: config.memoryWarningThreshold,
    });
  }

  // 检查磁盘使用率
  if (metrics.system.disk.usage >= config.diskCriticalThreshold) {
    issues.push({
      severity: 'critical',
      message: `磁盘使用率过高: ${metrics.system.disk.usage}%`,
      metric: 'disk',
      value: metrics.system.disk.usage,
      threshold: config.diskCriticalThreshold,
    });
  } else if (metrics.system.disk.usage >= config.diskWarningThreshold) {
    issues.push({
      severity: 'warning',
      message: `磁盘空间不足: ${metrics.system.disk.usage}%`,
      metric: 'disk',
      value: metrics.system.disk.usage,
      threshold: config.diskWarningThreshold,
    });
  }

  // 检查接口状态
  for (const iface of metrics.interfaces) {
    if (iface.status === 'down') {
      issues.push({
        severity: 'warning',
        message: `接口 ${iface.name} 处于断开状态`,
        metric: 'interface_status',
      });
    }

    // 检查接口错误
    if (iface.rxErrors > 0 || iface.txErrors > 0) {
      issues.push({
        severity: 'info',
        message: `接口 ${iface.name} 存在错误: RX=${iface.rxErrors}, TX=${iface.txErrors}`,
        metric: 'interface_errors',
      });
    }
  }

  return issues;
}

/**
 * 触发巡检告警
 * 通过告警引擎评估当前指标，触发相应的告警
 */
async function triggerInspectionAlerts(
  metrics: { system: { cpu: { usage: number }; memory: { total: number; used: number; free: number; usage: number }; disk: { total: number; used: number; free: number; usage: number }; uptime: number }; interfaces: Array<{ name: string; status: 'up' | 'down'; rxBytes: number; txBytes: number; rxPackets: number; txPackets: number; rxErrors: number; txErrors: number }> }
): Promise<void> {
  try {
    // 使用告警引擎评估当前指标
    const triggeredAlerts = await alertEngine.evaluate(metrics);
    
    if (triggeredAlerts.length > 0) {
      logger.info(`Inspection triggered ${triggeredAlerts.length} alerts`);
    }
  } catch (error) {
    logger.error('Failed to trigger inspection alerts:', error);
  }
}

/**
 * 注册巡检处理器到调度器
 */
export function registerInspectionHandler(): void {
  scheduler.registerHandler('inspection', executeInspection);
  logger.info('Inspection handler registered to scheduler');
}

/**
 * 初始化巡检处理器
 * 在服务启动时调用
 */
export function initializeInspectionHandler(): void {
  registerInspectionHandler();
}

/**
 * 发送巡检通知
 */
async function sendInspectionNotification(
  result: InspectionResult,
  channelIds: string[]
): Promise<void> {
  if (channelIds.length === 0) return;

  const statusEmoji: Record<string, string> = {
    healthy: '✅',
    warning: '⚠️',
    critical: '🔴',
  };

  const title = `${statusEmoji[result.summary.overallStatus]} 巡检报告 - ${result.summary.overallStatus.toUpperCase()}`;
  
  let body = `巡检时间: ${new Date(result.timestamp).toLocaleString('zh-CN')}\n\n`;
  body += `系统状态:\n`;
  body += `- CPU: ${result.systemHealth.cpu}%\n`;
  body += `- 内存: ${result.systemHealth.memory}%\n`;
  body += `- 磁盘: ${result.systemHealth.disk}%\n\n`;
  body += `接口状态: ${result.summary.upInterfaces}/${result.summary.totalInterfaces} 在线\n`;
  
  if (result.issues.length > 0) {
    body += `\n发现问题 (${result.issues.length}):\n`;
    for (const issue of result.issues.slice(0, 5)) {
      const severityEmoji: Record<AlertSeverity, string> = {
        info: 'ℹ️',
        warning: '⚠️',
        critical: '🔴',
        emergency: '🚨',
      };
      body += `${severityEmoji[issue.severity]} ${issue.message}\n`;
    }
    if (result.issues.length > 5) {
      body += `... 还有 ${result.issues.length - 5} 个问题\n`;
    }
  }

  try {
    await notificationService.send(channelIds, {
      type: 'report',
      title,
      body,
      data: {
        timestamp: result.timestamp,
        status: result.summary.overallStatus,
        issueCount: result.summary.issueCount,
        reportId: result.reportId,
      },
    });
    logger.info('Inspection notification sent');
  } catch (error) {
    logger.error('Failed to send inspection notification:', error);
  }
}

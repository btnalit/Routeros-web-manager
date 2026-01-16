/**
 * AI-Ops Controller
 * 处理 AI-Ops 智能运维相关的 API 请求
 *
 * 功能：
 * - 指标采集管理
 * - 告警规则和事件管理
 * - 调度器任务管理
 * - 配置快照管理
 * - 健康报告管理
 * - 故障模式管理
 * - 通知渠道管理
 * - 审计日志查询
 * - 运维仪表盘数据
 *
 * Requirements: 1.1-10.6
 */

import { Request, Response } from 'express';
import {
  metricsCollector,
  alertEngine,
  scheduler,
  configSnapshotService,
  healthReportService,
  faultHealer,
  notificationService,
  auditLogger,
} from '../services/ai-ops';
import { AuditAction } from '../types/ai-ops';
import { logger } from '../utils/logger';

// ==================== 指标相关 ====================

/**
 * 获取最新指标
 * GET /api/ai-ops/metrics/latest
 */
export async function getLatestMetrics(_req: Request, res: Response): Promise<void> {
  try {
    const metrics = await metricsCollector.getLatest();
    res.json({ success: true, data: metrics });
  } catch (error) {
    logger.error('Failed to get latest metrics:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取最新指标失败',
    });
  }
}

/**
 * 获取历史指标
 * GET /api/ai-ops/metrics/history
 */
export async function getMetricsHistory(req: Request, res: Response): Promise<void> {
  try {
    const { metric, from, to } = req.query;

    if (!metric || !from || !to) {
      res.status(400).json({
        success: false,
        error: '缺少必填参数：metric, from, to',
      });
      return;
    }

    const history = await metricsCollector.getHistory(
      metric as string,
      parseInt(from as string, 10),
      parseInt(to as string, 10)
    );
    res.json({ success: true, data: history });
  } catch (error) {
    logger.error('Failed to get metrics history:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取历史指标失败',
    });
  }
}

/**
 * 获取接口流量历史
 * GET /api/ai-ops/metrics/traffic
 */
export async function getTrafficHistory(req: Request, res: Response): Promise<void> {
  try {
    const { interface: interfaceName, duration } = req.query;
    const durationMs = duration ? parseInt(duration as string, 10) : 3600000; // 默认 1 小时

    if (interfaceName) {
      // 获取单个接口的流量历史
      const history = metricsCollector.getTrafficHistory(interfaceName as string, durationMs);
      res.json({ success: true, data: history });
    } else {
      // 获取所有接口的流量历史
      const history = metricsCollector.getAllTrafficHistory(durationMs);
      res.json({ success: true, data: history });
    }
  } catch (error) {
    logger.error('Failed to get traffic history:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取流量历史失败',
    });
  }
}

/**
 * 获取可用的流量接口列表
 * GET /api/ai-ops/metrics/traffic/interfaces
 */
export async function getTrafficInterfaces(_req: Request, res: Response): Promise<void> {
  try {
    const interfaces = metricsCollector.getAvailableTrafficInterfaces();
    res.json({ success: true, data: interfaces });
  } catch (error) {
    logger.error('Failed to get traffic interfaces:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取流量接口列表失败',
    });
  }
}

/**
 * 获取采集配置
 * GET /api/ai-ops/metrics/config
 */
export async function getMetricsConfig(_req: Request, res: Response): Promise<void> {
  try {
    const config = metricsCollector.getConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    logger.error('Failed to get metrics config:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取采集配置失败',
    });
  }
}

/**
 * 更新采集配置
 * PUT /api/ai-ops/metrics/config
 */
export async function updateMetricsConfig(req: Request, res: Response): Promise<void> {
  try {
    const config = await metricsCollector.saveConfig(req.body);
    res.json({ success: true, data: config });
  } catch (error) {
    logger.error('Failed to update metrics config:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '更新采集配置失败',
    });
  }
}

/**
 * 立即采集指标
 * POST /api/ai-ops/metrics/collect
 */
export async function collectMetricsNow(_req: Request, res: Response): Promise<void> {
  try {
    const metrics = await metricsCollector.collectNow();
    res.json({ success: true, data: metrics });
  } catch (error) {
    logger.error('Failed to collect metrics:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '采集指标失败',
    });
  }
}


// ==================== 告警规则相关 ====================

/**
 * 获取告警规则列表
 * GET /api/ai-ops/alerts/rules
 */
export async function getAlertRules(_req: Request, res: Response): Promise<void> {
  try {
    const rules = await alertEngine.getRules();
    res.json({ success: true, data: rules });
  } catch (error) {
    logger.error('Failed to get alert rules:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取告警规则失败',
    });
  }
}

/**
 * 获取单个告警规则
 * GET /api/ai-ops/alerts/rules/:id
 */
export async function getAlertRuleById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const rule = await alertEngine.getRuleById(id);

    if (!rule) {
      res.status(404).json({ success: false, error: '告警规则不存在' });
      return;
    }

    res.json({ success: true, data: rule });
  } catch (error) {
    logger.error('Failed to get alert rule:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取告警规则失败',
    });
  }
}

/**
 * 创建告警规则
 * POST /api/ai-ops/alerts/rules
 */
export async function createAlertRule(req: Request, res: Response): Promise<void> {
  try {
    const rule = await alertEngine.createRule(req.body);
    res.status(201).json({ success: true, data: rule });
  } catch (error) {
    logger.error('Failed to create alert rule:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '创建告警规则失败',
    });
  }
}

/**
 * 更新告警规则
 * PUT /api/ai-ops/alerts/rules/:id
 */
export async function updateAlertRule(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const rule = await alertEngine.updateRule(id, req.body);
    res.json({ success: true, data: rule });
  } catch (error) {
    logger.error('Failed to update alert rule:', error);
    const status = (error as Error).message.includes('not found') ? 404 : 500;
    res.status(status).json({
      success: false,
      error: error instanceof Error ? error.message : '更新告警规则失败',
    });
  }
}

/**
 * 删除告警规则
 * DELETE /api/ai-ops/alerts/rules/:id
 */
export async function deleteAlertRule(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    await alertEngine.deleteRule(id);
    res.json({ success: true, message: '告警规则已删除' });
  } catch (error) {
    logger.error('Failed to delete alert rule:', error);
    const status = (error as Error).message.includes('not found') ? 404 : 500;
    res.status(status).json({
      success: false,
      error: error instanceof Error ? error.message : '删除告警规则失败',
    });
  }
}

/**
 * 启用告警规则
 * POST /api/ai-ops/alerts/rules/:id/enable
 */
export async function enableAlertRule(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    await alertEngine.enableRule(id);
    res.json({ success: true, message: '告警规则已启用' });
  } catch (error) {
    logger.error('Failed to enable alert rule:', error);
    const status = (error as Error).message.includes('not found') ? 404 : 500;
    res.status(status).json({
      success: false,
      error: error instanceof Error ? error.message : '启用告警规则失败',
    });
  }
}

/**
 * 禁用告警规则
 * POST /api/ai-ops/alerts/rules/:id/disable
 */
export async function disableAlertRule(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    await alertEngine.disableRule(id);
    res.json({ success: true, message: '告警规则已禁用' });
  } catch (error) {
    logger.error('Failed to disable alert rule:', error);
    const status = (error as Error).message.includes('not found') ? 404 : 500;
    res.status(status).json({
      success: false,
      error: error instanceof Error ? error.message : '禁用告警规则失败',
    });
  }
}


// ==================== 告警事件相关 ====================

/**
 * 获取告警事件列表
 * GET /api/ai-ops/alerts/events
 */
export async function getAlertEvents(req: Request, res: Response): Promise<void> {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      res.status(400).json({
        success: false,
        error: '缺少必填参数：from, to',
      });
      return;
    }

    const events = await alertEngine.getAlertHistory(
      parseInt(from as string, 10),
      parseInt(to as string, 10)
    );
    res.json({ success: true, data: events });
  } catch (error) {
    logger.error('Failed to get alert events:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取告警事件失败',
    });
  }
}

/**
 * 获取活跃告警
 * GET /api/ai-ops/alerts/events/active
 */
export async function getActiveAlerts(_req: Request, res: Response): Promise<void> {
  try {
    const events = await alertEngine.getActiveAlerts();
    res.json({ success: true, data: events });
  } catch (error) {
    logger.error('Failed to get active alerts:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取活跃告警失败',
    });
  }
}

/**
 * 获取单个告警事件
 * GET /api/ai-ops/alerts/events/:id
 */
export async function getAlertEventById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const event = await alertEngine.getAlertEventById(id);

    if (!event) {
      res.status(404).json({ success: false, error: '告警事件不存在' });
      return;
    }

    res.json({ success: true, data: event });
  } catch (error) {
    logger.error('Failed to get alert event:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取告警事件失败',
    });
  }
}

/**
 * 解决告警
 * POST /api/ai-ops/alerts/events/:id/resolve
 */
export async function resolveAlertEvent(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    await alertEngine.resolveAlert(id);
    res.json({ success: true, message: '告警已解决' });
  } catch (error) {
    logger.error('Failed to resolve alert:', error);
    const status = (error as Error).message.includes('not found') ? 404 : 500;
    res.status(status).json({
      success: false,
      error: error instanceof Error ? error.message : '解决告警失败',
    });
  }
}

// ==================== 调度器相关 ====================

/**
 * 获取任务列表
 * GET /api/ai-ops/scheduler/tasks
 */
export async function getSchedulerTasks(_req: Request, res: Response): Promise<void> {
  try {
    const tasks = await scheduler.getTasks();
    res.json({ success: true, data: tasks });
  } catch (error) {
    logger.error('Failed to get scheduler tasks:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取任务列表失败',
    });
  }
}

/**
 * 获取单个任务
 * GET /api/ai-ops/scheduler/tasks/:id
 */
export async function getSchedulerTaskById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const task = await scheduler.getTaskById(id);

    if (!task) {
      res.status(404).json({ success: false, error: '任务不存在' });
      return;
    }

    res.json({ success: true, data: task });
  } catch (error) {
    logger.error('Failed to get scheduler task:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取任务失败',
    });
  }
}

/**
 * 创建任务
 * POST /api/ai-ops/scheduler/tasks
 */
export async function createSchedulerTask(req: Request, res: Response): Promise<void> {
  try {
    const task = await scheduler.createTask(req.body);
    res.status(201).json({ success: true, data: task });
  } catch (error) {
    logger.error('Failed to create scheduler task:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '创建任务失败',
    });
  }
}

/**
 * 更新任务
 * PUT /api/ai-ops/scheduler/tasks/:id
 */
export async function updateSchedulerTask(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const task = await scheduler.updateTask(id, req.body);
    res.json({ success: true, data: task });
  } catch (error) {
    logger.error('Failed to update scheduler task:', error);
    const status = (error as Error).message.includes('not found') ? 404 : 500;
    res.status(status).json({
      success: false,
      error: error instanceof Error ? error.message : '更新任务失败',
    });
  }
}

/**
 * 删除任务
 * DELETE /api/ai-ops/scheduler/tasks/:id
 */
export async function deleteSchedulerTask(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    await scheduler.deleteTask(id);
    res.json({ success: true, message: '任务已删除' });
  } catch (error) {
    logger.error('Failed to delete scheduler task:', error);
    const status = (error as Error).message.includes('not found') ? 404 : 500;
    res.status(status).json({
      success: false,
      error: error instanceof Error ? error.message : '删除任务失败',
    });
  }
}

/**
 * 立即执行任务
 * POST /api/ai-ops/scheduler/tasks/:id/run
 */
export async function runSchedulerTaskNow(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const execution = await scheduler.runTaskNow(id);
    res.json({ success: true, data: execution });
  } catch (error) {
    logger.error('Failed to run scheduler task:', error);
    const status = (error as Error).message.includes('not found') ? 404 : 500;
    res.status(status).json({
      success: false,
      error: error instanceof Error ? error.message : '执行任务失败',
    });
  }
}

/**
 * 获取执行历史
 * GET /api/ai-ops/scheduler/executions
 */
export async function getSchedulerExecutions(req: Request, res: Response): Promise<void> {
  try {
    const { taskId, limit } = req.query;
    const executions = await scheduler.getExecutions(
      taskId as string | undefined,
      limit ? parseInt(limit as string, 10) : undefined
    );
    res.json({ success: true, data: executions });
  } catch (error) {
    logger.error('Failed to get scheduler executions:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取执行历史失败',
    });
  }
}


// ==================== 配置快照相关 ====================

/**
 * 获取快照列表
 * GET /api/ai-ops/snapshots
 */
export async function getSnapshots(req: Request, res: Response): Promise<void> {
  try {
    const { limit } = req.query;
    const snapshots = await configSnapshotService.getSnapshots(
      limit ? parseInt(limit as string, 10) : undefined
    );
    res.json({ success: true, data: snapshots });
  } catch (error) {
    logger.error('Failed to get snapshots:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取快照列表失败',
    });
  }
}

/**
 * 获取单个快照
 * GET /api/ai-ops/snapshots/:id
 */
export async function getSnapshotById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const snapshot = await configSnapshotService.getSnapshotById(id);

    if (!snapshot) {
      res.status(404).json({ success: false, error: '快照不存在' });
      return;
    }

    res.json({ success: true, data: snapshot });
  } catch (error) {
    logger.error('Failed to get snapshot:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取快照失败',
    });
  }
}

/**
 * 创建快照
 * POST /api/ai-ops/snapshots
 */
export async function createSnapshot(_req: Request, res: Response): Promise<void> {
  try {
    const snapshot = await configSnapshotService.createSnapshot('manual');
    res.status(201).json({ success: true, data: snapshot });
  } catch (error) {
    logger.error('Failed to create snapshot:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '创建快照失败',
    });
  }
}

/**
 * 删除快照
 * DELETE /api/ai-ops/snapshots/:id
 */
export async function deleteSnapshot(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    await configSnapshotService.deleteSnapshot(id);
    res.json({ success: true, message: '快照已删除' });
  } catch (error) {
    logger.error('Failed to delete snapshot:', error);
    const status = (error as Error).message.includes('not found') ? 404 : 500;
    res.status(status).json({
      success: false,
      error: error instanceof Error ? error.message : '删除快照失败',
    });
  }
}

/**
 * 下载快照
 * GET /api/ai-ops/snapshots/:id/download
 */
export async function downloadSnapshot(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const content = await configSnapshotService.downloadSnapshot(id);
    const snapshot = await configSnapshotService.getSnapshotById(id);

    const filename = snapshot
      ? `config_${new Date(snapshot.timestamp).toISOString().replace(/[:.]/g, '-')}.rsc`
      : `config_${id}.rsc`;

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  } catch (error) {
    logger.error('Failed to download snapshot:', error);
    const status = (error as Error).message.includes('not found') ? 404 : 500;
    res.status(status).json({
      success: false,
      error: error instanceof Error ? error.message : '下载快照失败',
    });
  }
}

/**
 * 恢复快照
 * POST /api/ai-ops/snapshots/:id/restore
 */
export async function restoreSnapshot(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const result = await configSnapshotService.restoreSnapshot(id);
    res.json({ success: result.success, message: result.message });
  } catch (error) {
    logger.error('Failed to restore snapshot:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '恢复快照失败',
    });
  }
}

/**
 * 对比快照
 * GET /api/ai-ops/snapshots/diff
 */
export async function compareSnapshots(req: Request, res: Response): Promise<void> {
  try {
    const { idA, idB } = req.query;

    if (!idA || !idB) {
      res.status(400).json({
        success: false,
        error: '缺少必填参数：idA, idB',
      });
      return;
    }

    const diff = await configSnapshotService.compareSnapshots(
      idA as string,
      idB as string
    );
    const analyzedDiff = await configSnapshotService.analyzeConfigDiff(diff);
    res.json({ success: true, data: analyzedDiff });
  } catch (error) {
    logger.error('Failed to compare snapshots:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '对比快照失败',
    });
  }
}

/**
 * 获取最新差异
 * GET /api/ai-ops/snapshots/diff/latest
 */
export async function getLatestDiff(_req: Request, res: Response): Promise<void> {
  try {
    const diff = await configSnapshotService.getLatestDiff();
    if (diff) {
      const analyzedDiff = await configSnapshotService.analyzeConfigDiff(diff);
      res.json({ success: true, data: analyzedDiff });
    } else {
      res.json({ success: true, data: null });
    }
  } catch (error) {
    logger.error('Failed to get latest diff:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取最新差异失败',
    });
  }
}

/**
 * 获取变更时间线
 * GET /api/ai-ops/snapshots/timeline
 */
export async function getChangeTimeline(req: Request, res: Response): Promise<void> {
  try {
    const { limit } = req.query;
    const timeline = await configSnapshotService.getChangeTimeline(
      limit ? parseInt(limit as string, 10) : undefined
    );
    res.json({ success: true, data: timeline });
  } catch (error) {
    logger.error('Failed to get change timeline:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取变更时间线失败',
    });
  }
}


// ==================== 健康报告相关 ====================

/**
 * 获取报告列表
 * GET /api/ai-ops/reports
 */
export async function getReports(req: Request, res: Response): Promise<void> {
  try {
    const { limit } = req.query;
    const reports = await healthReportService.getReports(
      limit ? parseInt(limit as string, 10) : undefined
    );
    res.json({ success: true, data: reports });
  } catch (error) {
    logger.error('Failed to get reports:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取报告列表失败',
    });
  }
}

/**
 * 获取单个报告
 * GET /api/ai-ops/reports/:id
 */
export async function getReportById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const report = await healthReportService.getReportById(id);

    if (!report) {
      res.status(404).json({ success: false, error: '报告不存在' });
      return;
    }

    res.json({ success: true, data: report });
  } catch (error) {
    logger.error('Failed to get report:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取报告失败',
    });
  }
}

/**
 * 生成报告
 * POST /api/ai-ops/reports/generate
 */
export async function generateReport(req: Request, res: Response): Promise<void> {
  try {
    const { from, to, channelIds } = req.body;

    if (!from || !to) {
      res.status(400).json({
        success: false,
        error: '缺少必填参数：from, to',
      });
      return;
    }

    let report;
    if (channelIds && channelIds.length > 0) {
      report = await healthReportService.generateAndSendReport(from, to, channelIds);
    } else {
      report = await healthReportService.generateReport(from, to);
    }

    res.status(201).json({ success: true, data: report });
  } catch (error) {
    logger.error('Failed to generate report:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '生成报告失败',
    });
  }
}

/**
 * 导出报告
 * GET /api/ai-ops/reports/:id/export
 */
export async function exportReport(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { format } = req.query;

    const report = await healthReportService.getReportById(id);
    if (!report) {
      res.status(404).json({ success: false, error: '报告不存在' });
      return;
    }

    if (format === 'pdf') {
      const pdf = await healthReportService.exportAsPdf(id);
      const filename = `health_report_${new Date(report.generatedAt).toISOString().split('T')[0]}.txt`;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(pdf);
    } else {
      // 默认 Markdown 格式
      const markdown = await healthReportService.exportAsMarkdown(id);
      const filename = `health_report_${new Date(report.generatedAt).toISOString().split('T')[0]}.md`;
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(markdown);
    }
  } catch (error) {
    logger.error('Failed to export report:', error);
    const status = (error as Error).message.includes('not found') ? 404 : 500;
    res.status(status).json({
      success: false,
      error: error instanceof Error ? error.message : '导出报告失败',
    });
  }
}

/**
 * 删除报告
 * DELETE /api/ai-ops/reports/:id
 */
export async function deleteReport(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    await healthReportService.deleteReport(id);
    res.json({ success: true, message: '报告已删除' });
  } catch (error) {
    logger.error('Failed to delete report:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '删除报告失败',
    });
  }
}


// ==================== 故障模式相关 ====================

/**
 * 获取故障模式列表
 * GET /api/ai-ops/patterns
 */
export async function getFaultPatterns(_req: Request, res: Response): Promise<void> {
  try {
    const patterns = await faultHealer.getPatterns();
    res.json({ success: true, data: patterns });
  } catch (error) {
    logger.error('Failed to get fault patterns:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取故障模式失败',
    });
  }
}

/**
 * 获取单个故障模式
 * GET /api/ai-ops/patterns/:id
 */
export async function getFaultPatternById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const pattern = await faultHealer.getPatternById(id);

    if (!pattern) {
      res.status(404).json({ success: false, error: '故障模式不存在' });
      return;
    }

    res.json({ success: true, data: pattern });
  } catch (error) {
    logger.error('Failed to get fault pattern:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取故障模式失败',
    });
  }
}

/**
 * 创建故障模式
 * POST /api/ai-ops/patterns
 */
export async function createFaultPattern(req: Request, res: Response): Promise<void> {
  try {
    const pattern = await faultHealer.createPattern(req.body);
    res.status(201).json({ success: true, data: pattern });
  } catch (error) {
    logger.error('Failed to create fault pattern:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '创建故障模式失败',
    });
  }
}

/**
 * 更新故障模式
 * PUT /api/ai-ops/patterns/:id
 */
export async function updateFaultPattern(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const pattern = await faultHealer.updatePattern(id, req.body);
    res.json({ success: true, data: pattern });
  } catch (error) {
    logger.error('Failed to update fault pattern:', error);
    const status = (error as Error).message.includes('not found') ? 404 : 500;
    res.status(status).json({
      success: false,
      error: error instanceof Error ? error.message : '更新故障模式失败',
    });
  }
}

/**
 * 删除故障模式
 * DELETE /api/ai-ops/patterns/:id
 */
export async function deleteFaultPattern(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    await faultHealer.deletePattern(id);
    res.json({ success: true, message: '故障模式已删除' });
  } catch (error) {
    logger.error('Failed to delete fault pattern:', error);
    const status = (error as Error).message.includes('not found') ||
                   (error as Error).message.includes('builtin') ? 400 : 500;
    res.status(status).json({
      success: false,
      error: error instanceof Error ? error.message : '删除故障模式失败',
    });
  }
}

/**
 * 启用自动修复
 * POST /api/ai-ops/patterns/:id/enable-auto-heal
 */
export async function enableAutoHeal(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    await faultHealer.enableAutoHeal(id);
    res.json({ success: true, message: '自动修复已启用' });
  } catch (error) {
    logger.error('Failed to enable auto-heal:', error);
    const status = (error as Error).message.includes('not found') ? 404 : 500;
    res.status(status).json({
      success: false,
      error: error instanceof Error ? error.message : '启用自动修复失败',
    });
  }
}

/**
 * 禁用自动修复
 * POST /api/ai-ops/patterns/:id/disable-auto-heal
 */
export async function disableAutoHeal(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    await faultHealer.disableAutoHeal(id);
    res.json({ success: true, message: '自动修复已禁用' });
  } catch (error) {
    logger.error('Failed to disable auto-heal:', error);
    const status = (error as Error).message.includes('not found') ? 404 : 500;
    res.status(status).json({
      success: false,
      error: error instanceof Error ? error.message : '禁用自动修复失败',
    });
  }
}

/**
 * 获取修复历史
 * GET /api/ai-ops/remediations
 */
export async function getRemediations(req: Request, res: Response): Promise<void> {
  try {
    const { limit } = req.query;
    const remediations = await faultHealer.getRemediationHistory(
      limit ? parseInt(limit as string, 10) : undefined
    );
    res.json({ success: true, data: remediations });
  } catch (error) {
    logger.error('Failed to get remediations:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取修复历史失败',
    });
  }
}

/**
 * 获取单个修复记录
 * GET /api/ai-ops/remediations/:id
 */
export async function getRemediationById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const remediation = await faultHealer.getRemediationById(id);

    if (!remediation) {
      res.status(404).json({ success: false, error: '修复记录不存在' });
      return;
    }

    res.json({ success: true, data: remediation });
  } catch (error) {
    logger.error('Failed to get remediation:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取修复记录失败',
    });
  }
}

/**
 * 手动执行修复
 * POST /api/ai-ops/patterns/:id/execute
 */
export async function executeFaultRemediation(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { alertEventId } = req.body;

    if (!alertEventId) {
      res.status(400).json({
        success: false,
        error: '缺少必填参数：alertEventId',
      });
      return;
    }

    const remediation = await faultHealer.executeRemediation(id, alertEventId);
    res.json({ success: true, data: remediation });
  } catch (error) {
    logger.error('Failed to execute remediation:', error);
    const status = (error as Error).message.includes('not found') ? 404 : 500;
    res.status(status).json({
      success: false,
      error: error instanceof Error ? error.message : '执行修复失败',
    });
  }
}


// ==================== 通知渠道相关 ====================

/**
 * 获取渠道列表
 * GET /api/ai-ops/channels
 */
export async function getNotificationChannels(_req: Request, res: Response): Promise<void> {
  try {
    const channels = await notificationService.getChannels();
    res.json({ success: true, data: channels });
  } catch (error) {
    logger.error('Failed to get notification channels:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取通知渠道失败',
    });
  }
}

/**
 * 获取单个渠道
 * GET /api/ai-ops/channels/:id
 */
export async function getNotificationChannelById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const channel = await notificationService.getChannelById(id);

    if (!channel) {
      res.status(404).json({ success: false, error: '通知渠道不存在' });
      return;
    }

    res.json({ success: true, data: channel });
  } catch (error) {
    logger.error('Failed to get notification channel:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取通知渠道失败',
    });
  }
}

/**
 * 创建渠道
 * POST /api/ai-ops/channels
 */
export async function createNotificationChannel(req: Request, res: Response): Promise<void> {
  try {
    const channel = await notificationService.createChannel(req.body);
    res.status(201).json({ success: true, data: channel });
  } catch (error) {
    logger.error('Failed to create notification channel:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '创建通知渠道失败',
    });
  }
}

/**
 * 更新渠道
 * PUT /api/ai-ops/channels/:id
 */
export async function updateNotificationChannel(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const channel = await notificationService.updateChannel(id, req.body);
    res.json({ success: true, data: channel });
  } catch (error) {
    logger.error('Failed to update notification channel:', error);
    const status = (error as Error).message.includes('not found') ? 404 : 500;
    res.status(status).json({
      success: false,
      error: error instanceof Error ? error.message : '更新通知渠道失败',
    });
  }
}

/**
 * 删除渠道
 * DELETE /api/ai-ops/channels/:id
 */
export async function deleteNotificationChannel(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    await notificationService.deleteChannel(id);
    res.json({ success: true, message: '通知渠道已删除' });
  } catch (error) {
    logger.error('Failed to delete notification channel:', error);
    const status = (error as Error).message.includes('not found') ? 404 : 500;
    res.status(status).json({
      success: false,
      error: error instanceof Error ? error.message : '删除通知渠道失败',
    });
  }
}

/**
 * 测试渠道
 * POST /api/ai-ops/channels/:id/test
 */
export async function testNotificationChannel(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const result = await notificationService.testChannel(id);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Failed to test notification channel:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '测试通知渠道失败',
    });
  }
}

/**
 * 获取 Web Push 待推送通知
 * GET /api/ai-ops/channels/:id/pending
 */
export async function getPendingNotifications(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const notifications = await notificationService.getPendingWebPushNotifications(id);
    res.json({ success: true, data: notifications });
  } catch (error) {
    logger.error('Failed to get pending notifications:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取待推送通知失败',
    });
  }
}

/**
 * 获取通知历史
 * GET /api/ai-ops/notifications/history
 */
export async function getNotificationHistory(req: Request, res: Response): Promise<void> {
  try {
    const { limit } = req.query;
    const history = await notificationService.getNotificationHistory(
      limit ? parseInt(limit as string, 10) : undefined
    );
    res.json({ success: true, data: history });
  } catch (error) {
    logger.error('Failed to get notification history:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取通知历史失败',
    });
  }
}


// ==================== 审计日志相关 ====================

/**
 * 查询审计日志
 * GET /api/ai-ops/audit
 */
export async function getAuditLogs(req: Request, res: Response): Promise<void> {
  try {
    const { action, module, from, to, limit } = req.query;

    const logs = await auditLogger.query({
      action: action as AuditAction | undefined,
      from: from ? parseInt(from as string, 10) : undefined,
      to: to ? parseInt(to as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });

    res.json({ success: true, data: logs });
  } catch (error) {
    logger.error('Failed to get audit logs:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取审计日志失败',
    });
  }
}


// ==================== 仪表盘数据 ====================

/**
 * 获取运维仪表盘数据
 * GET /api/ai-ops/dashboard
 */
export async function getDashboardData(_req: Request, res: Response): Promise<void> {
  try {
    // 并行获取各项数据
    const [
      latestMetrics,
      activeAlerts,
      recentRemediations,
      recentReports,
      schedulerTasks,
    ] = await Promise.all([
      metricsCollector.getLatest().catch(() => null),
      alertEngine.getActiveAlerts().catch(() => []),
      faultHealer.getRemediationHistory(5).catch(() => []),
      healthReportService.getReports(5).catch(() => []),
      scheduler.getTasks().catch(() => []),
    ]);

    // 计算统计数据
    const enabledTasks = schedulerTasks.filter((t: { enabled: boolean }) => t.enabled).length;
    const successfulRemediations = recentRemediations.filter(
      (r: { status: string }) => r.status === 'success'
    ).length;

    const dashboard = {
      metrics: latestMetrics,
      alerts: {
        active: activeAlerts.length,
        critical: activeAlerts.filter((a: { severity: string }) => a.severity === 'critical').length,
        warning: activeAlerts.filter((a: { severity: string }) => a.severity === 'warning').length,
        info: activeAlerts.filter((a: { severity: string }) => a.severity === 'info').length,
        list: activeAlerts.slice(0, 10),
      },
      remediations: {
        recent: recentRemediations.length,
        successful: successfulRemediations,
        list: recentRemediations,
      },
      reports: {
        recent: recentReports.length,
        list: recentReports,
      },
      scheduler: {
        total: schedulerTasks.length,
        enabled: enabledTasks,
      },
      timestamp: Date.now(),
    };

    res.json({ success: true, data: dashboard });
  } catch (error) {
    logger.error('Failed to get dashboard data:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取仪表盘数据失败',
    });
  }
}


// ==================== AI-Ops Enhancement: Syslog 相关 ====================
// Requirements: 1.1, 1.7

import {
  syslogReceiver,
  fingerprintCache,
  analysisCache,
  noiseFilter,
  rootCauseAnalyzer,
  remediationAdvisor,
  decisionEngine,
  feedbackService,
} from '../services/ai-ops';

/**
 * 获取 Syslog 配置
 * GET /api/ai-ops/syslog/config
 * Requirements: 1.7
 */
export async function getSyslogConfig(_req: Request, res: Response): Promise<void> {
  try {
    const config = syslogReceiver.getConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    logger.error('Failed to get syslog config:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取 Syslog 配置失败',
    });
  }
}

/**
 * 更新 Syslog 配置
 * PUT /api/ai-ops/syslog/config
 * Requirements: 1.7
 */
export async function updateSyslogConfig(req: Request, res: Response): Promise<void> {
  try {
    await syslogReceiver.updateConfig(req.body);
    const config = syslogReceiver.getConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    logger.error('Failed to update syslog config:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '更新 Syslog 配置失败',
    });
  }
}

/**
 * 获取 Syslog 服务状态
 * GET /api/ai-ops/syslog/status
 * Requirements: 1.1
 */
export async function getSyslogStatus(_req: Request, res: Response): Promise<void> {
  try {
    const status = syslogReceiver.getStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    logger.error('Failed to get syslog status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取 Syslog 状态失败',
    });
  }
}

/**
 * 获取 Syslog 事件历史
 * GET /api/ai-ops/syslog/events
 * Requirements: 1.1
 */
export async function getSyslogEvents(req: Request, res: Response): Promise<void> {
  try {
    const { from, to, limit } = req.query;
    const events = await syslogReceiver.getEvents(
      from ? parseInt(from as string, 10) : undefined,
      to ? parseInt(to as string, 10) : undefined,
      limit ? parseInt(limit as string, 10) : undefined
    );
    res.json({ success: true, data: events });
  } catch (error) {
    logger.error('Failed to get syslog events:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取 Syslog 事件失败',
    });
  }
}


// ==================== AI-Ops Enhancement: 过滤器相关 ====================
// Requirements: 5.7, 5.8

/**
 * 获取维护窗口列表
 * GET /api/ai-ops/filters/maintenance
 * Requirements: 5.7
 */
export async function getMaintenanceWindows(_req: Request, res: Response): Promise<void> {
  try {
    await noiseFilter.initialize();
    const windows = noiseFilter.getMaintenanceWindows();
    res.json({ success: true, data: windows });
  } catch (error) {
    logger.error('Failed to get maintenance windows:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取维护窗口失败',
    });
  }
}

/**
 * 创建维护窗口
 * POST /api/ai-ops/filters/maintenance
 * Requirements: 5.7
 */
export async function createMaintenanceWindow(req: Request, res: Response): Promise<void> {
  try {
    const window = await noiseFilter.createMaintenanceWindow(req.body);
    res.status(201).json({ success: true, data: window });
  } catch (error) {
    logger.error('Failed to create maintenance window:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '创建维护窗口失败',
    });
  }
}

/**
 * 更新维护窗口
 * PUT /api/ai-ops/filters/maintenance/:id
 * Requirements: 5.7
 */
export async function updateMaintenanceWindow(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const window = await noiseFilter.updateMaintenanceWindow(id, req.body);
    res.json({ success: true, data: window });
  } catch (error) {
    logger.error('Failed to update maintenance window:', error);
    const status = (error as Error).message.includes('not found') ? 404 : 500;
    res.status(status).json({
      success: false,
      error: error instanceof Error ? error.message : '更新维护窗口失败',
    });
  }
}

/**
 * 删除维护窗口
 * DELETE /api/ai-ops/filters/maintenance/:id
 * Requirements: 5.7
 */
export async function deleteMaintenanceWindow(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    noiseFilter.removeMaintenanceWindow(id);
    res.json({ success: true, message: '维护窗口已删除' });
  } catch (error) {
    logger.error('Failed to delete maintenance window:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '删除维护窗口失败',
    });
  }
}

/**
 * 获取已知问题列表
 * GET /api/ai-ops/filters/known-issues
 * Requirements: 5.8
 */
export async function getKnownIssues(_req: Request, res: Response): Promise<void> {
  try {
    await noiseFilter.initialize();
    const issues = noiseFilter.getKnownIssues();
    res.json({ success: true, data: issues });
  } catch (error) {
    logger.error('Failed to get known issues:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取已知问题失败',
    });
  }
}

/**
 * 创建已知问题
 * POST /api/ai-ops/filters/known-issues
 * Requirements: 5.8
 */
export async function createKnownIssue(req: Request, res: Response): Promise<void> {
  try {
    const issue = await noiseFilter.createKnownIssue(req.body);
    res.status(201).json({ success: true, data: issue });
  } catch (error) {
    logger.error('Failed to create known issue:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '创建已知问题失败',
    });
  }
}

/**
 * 更新已知问题
 * PUT /api/ai-ops/filters/known-issues/:id
 * Requirements: 5.8
 */
export async function updateKnownIssue(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const issue = await noiseFilter.updateKnownIssue(id, req.body);
    res.json({ success: true, data: issue });
  } catch (error) {
    logger.error('Failed to update known issue:', error);
    const status = (error as Error).message.includes('not found') ? 404 : 500;
    res.status(status).json({
      success: false,
      error: error instanceof Error ? error.message : '更新已知问题失败',
    });
  }
}

/**
 * 删除已知问题
 * DELETE /api/ai-ops/filters/known-issues/:id
 * Requirements: 5.8
 */
export async function deleteKnownIssue(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    noiseFilter.removeKnownIssue(id);
    res.json({ success: true, message: '已知问题已删除' });
  } catch (error) {
    logger.error('Failed to delete known issue:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '删除已知问题失败',
    });
  }
}


// ==================== AI-Ops Enhancement: 分析相关 ====================
// Requirements: 6.1, 6.2, 6.4

/**
 * 获取告警的根因分析
 * GET /api/ai-ops/analysis/:alertId
 * Requirements: 6.1
 * 
 * 优化：先检查缓存，如果已有分析结果则直接返回，避免重复调用 AI
 */
export async function getAlertAnalysis(req: Request, res: Response): Promise<void> {
  try {
    const { alertId } = req.params;
    
    // 首先检查是否已有缓存的分析结果
    const cachedAnalysis = await rootCauseAnalyzer.getAnalysisByAlertId(alertId);
    if (cachedAnalysis) {
      logger.info(`Returning cached analysis for alert: ${alertId}`);
      res.json({ success: true, data: cachedAnalysis });
      return;
    }
    
    // 获取告警事件
    const alertEvent = await alertEngine.getAlertEventById(alertId);
    if (!alertEvent) {
      res.status(404).json({ success: false, error: '告警事件不存在' });
      return;
    }

    // 转换为 UnifiedEvent 格式进行分析
    const unifiedEvent = {
      id: alertEvent.id,
      source: 'metrics' as const,
      timestamp: alertEvent.triggeredAt,
      severity: alertEvent.severity,
      category: alertEvent.metric,
      message: alertEvent.message,
      rawData: alertEvent,
      metadata: {
        ruleId: alertEvent.ruleId,
        currentValue: alertEvent.currentValue,
        threshold: alertEvent.threshold,
      },
      alertRuleInfo: {
        ruleId: alertEvent.ruleId,
        ruleName: alertEvent.ruleName,
        metric: alertEvent.metric,
        threshold: alertEvent.threshold,
        currentValue: alertEvent.currentValue,
      },
    };

    const analysis = await rootCauseAnalyzer.analyzeSingle(unifiedEvent);
    res.json({ success: true, data: analysis });
  } catch (error) {
    logger.error('Failed to get alert analysis:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取告警分析失败',
    });
  }
}

/**
 * 重新分析告警
 * POST /api/ai-ops/analysis/:alertId/refresh
 * Requirements: 6.1
 */
export async function refreshAlertAnalysis(req: Request, res: Response): Promise<void> {
  try {
    const { alertId } = req.params;
    
    const alertEvent = await alertEngine.getAlertEventById(alertId);
    if (!alertEvent) {
      res.status(404).json({ success: false, error: '告警事件不存在' });
      return;
    }

    const unifiedEvent = {
      id: alertEvent.id,
      source: 'metrics' as const,
      timestamp: alertEvent.triggeredAt,
      severity: alertEvent.severity,
      category: alertEvent.metric,
      message: alertEvent.message,
      rawData: alertEvent,
      metadata: {
        ruleId: alertEvent.ruleId,
        currentValue: alertEvent.currentValue,
        threshold: alertEvent.threshold,
      },
      alertRuleInfo: {
        ruleId: alertEvent.ruleId,
        ruleName: alertEvent.ruleName,
        metric: alertEvent.metric,
        threshold: alertEvent.threshold,
        currentValue: alertEvent.currentValue,
      },
    };

    // 强制重新分析
    const analysis = await rootCauseAnalyzer.analyzeSingle(unifiedEvent);
    res.json({ success: true, data: analysis });
  } catch (error) {
    logger.error('Failed to refresh alert analysis:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '重新分析告警失败',
    });
  }
}

/**
 * 获取事件时间线
 * GET /api/ai-ops/analysis/:alertId/timeline
 * Requirements: 6.4
 */
export async function getAlertTimeline(req: Request, res: Response): Promise<void> {
  try {
    const { alertId } = req.params;
    
    const alertEvent = await alertEngine.getAlertEventById(alertId);
    if (!alertEvent) {
      res.status(404).json({ success: false, error: '告警事件不存在' });
      return;
    }

    const unifiedEvent = {
      id: alertEvent.id,
      source: 'metrics' as const,
      timestamp: alertEvent.triggeredAt,
      severity: alertEvent.severity,
      category: alertEvent.metric,
      message: alertEvent.message,
      rawData: alertEvent,
      metadata: {},
    };

    const timeline = rootCauseAnalyzer.generateTimeline([unifiedEvent]);
    res.json({ success: true, data: timeline });
  } catch (error) {
    logger.error('Failed to get alert timeline:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取事件时间线失败',
    });
  }
}

/**
 * 获取关联告警
 * GET /api/ai-ops/analysis/:alertId/related
 * Requirements: 6.2
 */
export async function getRelatedAlerts(req: Request, res: Response): Promise<void> {
  try {
    const { alertId } = req.params;
    const { windowMs } = req.query;
    
    const alertEvent = await alertEngine.getAlertEventById(alertId);
    if (!alertEvent) {
      res.status(404).json({ success: false, error: '告警事件不存在' });
      return;
    }

    // 获取时间窗口内的其他告警
    const window = windowMs ? parseInt(windowMs as string, 10) : 5 * 60 * 1000;
    const from = alertEvent.triggeredAt - window;
    const to = alertEvent.triggeredAt + window;
    
    const allAlerts = await alertEngine.getAlertHistory(from, to);
    const relatedAlerts = allAlerts.filter(a => a.id !== alertId);

    res.json({ success: true, data: relatedAlerts });
  } catch (error) {
    logger.error('Failed to get related alerts:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取关联告警失败',
    });
  }
}


// ==================== AI-Ops Enhancement: 修复方案相关 ====================
// Requirements: 7.1, 7.4

/**
 * 获取修复方案
 * GET /api/ai-ops/remediation/:alertId
 * Requirements: 7.1
 */
export async function getRemediationPlan(req: Request, res: Response): Promise<void> {
  try {
    const { alertId } = req.params;
    
    // 尝试获取已有的修复方案
    const plans = await remediationAdvisor.getPlansByAlertId(alertId);
    
    if (plans.length > 0) {
      // 返回最新的方案
      res.json({ success: true, data: plans[0] });
    } else {
      res.json({ success: true, data: null, message: '暂无修复方案' });
    }
  } catch (error) {
    logger.error('Failed to get remediation plan:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取修复方案失败',
    });
  }
}

/**
 * 生成修复方案
 * POST /api/ai-ops/remediation/:alertId
 * Requirements: 7.1
 */
export async function generateRemediationPlan(req: Request, res: Response): Promise<void> {
  try {
    const { alertId } = req.params;
    
    const alertEvent = await alertEngine.getAlertEventById(alertId);
    if (!alertEvent) {
      res.status(404).json({ success: false, error: '告警事件不存在' });
      return;
    }

    // 先进行根因分析
    const unifiedEvent = {
      id: alertEvent.id,
      source: 'metrics' as const,
      timestamp: alertEvent.triggeredAt,
      severity: alertEvent.severity,
      category: alertEvent.metric,
      message: alertEvent.message,
      rawData: alertEvent,
      metadata: {},
      alertRuleInfo: {
        ruleId: alertEvent.ruleId,
        ruleName: alertEvent.ruleName,
        metric: alertEvent.metric,
        threshold: alertEvent.threshold,
        currentValue: alertEvent.currentValue,
      },
    };

    const analysis = await rootCauseAnalyzer.analyzeSingle(unifiedEvent);
    
    // 生成修复方案
    const plan = await remediationAdvisor.generatePlan(analysis);
    res.status(201).json({ success: true, data: plan });
  } catch (error) {
    logger.error('Failed to generate remediation plan:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '生成修复方案失败',
    });
  }
}

/**
 * 执行修复方案
 * POST /api/ai-ops/remediation/:planId/execute
 * Requirements: 7.1
 */
export async function executeRemediationPlan(req: Request, res: Response): Promise<void> {
  try {
    const { planId } = req.params;
    const { stepOrder } = req.body;
    
    if (stepOrder !== undefined) {
      // 执行单个步骤
      const result = await remediationAdvisor.executeStep(planId, stepOrder);
      res.json({ success: true, data: result });
    } else {
      // 执行所有自动步骤
      const results = await remediationAdvisor.executeAutoSteps(planId);
      res.json({ success: true, data: results });
    }
  } catch (error) {
    logger.error('Failed to execute remediation plan:', error);
    const status = (error as Error).message.includes('not found') ? 404 : 500;
    res.status(status).json({
      success: false,
      error: error instanceof Error ? error.message : '执行修复方案失败',
    });
  }
}

/**
 * 执行回滚
 * POST /api/ai-ops/remediation/:planId/rollback
 * Requirements: 7.4
 */
export async function executeRemediationRollback(req: Request, res: Response): Promise<void> {
  try {
    const { planId } = req.params;
    const results = await remediationAdvisor.executeRollback(planId);
    res.json({ success: true, data: results });
  } catch (error) {
    logger.error('Failed to execute rollback:', error);
    const status = (error as Error).message.includes('not found') ? 404 : 500;
    res.status(status).json({
      success: false,
      error: error instanceof Error ? error.message : '执行回滚失败',
    });
  }
}


// ==================== AI-Ops Enhancement: 决策相关 ====================
// Requirements: 8.8

/**
 * 获取决策规则列表
 * GET /api/ai-ops/decisions/rules
 * Requirements: 8.8
 */
export async function getDecisionRules(_req: Request, res: Response): Promise<void> {
  try {
    await decisionEngine.initialize();
    const rules = decisionEngine.getRules();
    res.json({ success: true, data: rules });
  } catch (error) {
    logger.error('Failed to get decision rules:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取决策规则失败',
    });
  }
}

/**
 * 获取单个决策规则
 * GET /api/ai-ops/decisions/rules/:id
 * Requirements: 8.8
 */
export async function getDecisionRuleById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const rule = await decisionEngine.getRuleById(id);
    
    if (!rule) {
      res.status(404).json({ success: false, error: '决策规则不存在' });
      return;
    }
    
    res.json({ success: true, data: rule });
  } catch (error) {
    logger.error('Failed to get decision rule:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取决策规则失败',
    });
  }
}

/**
 * 创建决策规则
 * POST /api/ai-ops/decisions/rules
 * Requirements: 8.8
 */
export async function createDecisionRule(req: Request, res: Response): Promise<void> {
  try {
    const rule = await decisionEngine.createRule(req.body);
    res.status(201).json({ success: true, data: rule });
  } catch (error) {
    logger.error('Failed to create decision rule:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '创建决策规则失败',
    });
  }
}

/**
 * 更新决策规则
 * PUT /api/ai-ops/decisions/rules/:id
 * Requirements: 8.8
 */
export async function updateDecisionRule(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const rule = await decisionEngine.updateRuleAsync(id, req.body);
    res.json({ success: true, data: rule });
  } catch (error) {
    logger.error('Failed to update decision rule:', error);
    const status = (error as Error).message.includes('not found') ? 404 : 500;
    res.status(status).json({
      success: false,
      error: error instanceof Error ? error.message : '更新决策规则失败',
    });
  }
}

/**
 * 删除决策规则
 * DELETE /api/ai-ops/decisions/rules/:id
 * Requirements: 8.8
 */
export async function deleteDecisionRule(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    await decisionEngine.deleteRule(id);
    res.json({ success: true, message: '决策规则已删除' });
  } catch (error) {
    logger.error('Failed to delete decision rule:', error);
    const status = (error as Error).message.includes('not found') ? 404 : 500;
    res.status(status).json({
      success: false,
      error: error instanceof Error ? error.message : '删除决策规则失败',
    });
  }
}

/**
 * 获取决策历史
 * GET /api/ai-ops/decisions/history
 * Requirements: 8.8
 */
export async function getDecisionHistory(req: Request, res: Response): Promise<void> {
  try {
    const { alertId, limit } = req.query;
    const history = await decisionEngine.getDecisionHistory(
      alertId as string | undefined,
      limit ? parseInt(limit as string, 10) : undefined
    );
    res.json({ success: true, data: history });
  } catch (error) {
    logger.error('Failed to get decision history:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取决策历史失败',
    });
  }
}


// ==================== AI-Ops Enhancement: 反馈相关 ====================
// Requirements: 10.1, 10.4, 10.5, 10.6

/**
 * 提交反馈
 * POST /api/ai-ops/feedback
 * Requirements: 10.1
 */
export async function submitFeedback(req: Request, res: Response): Promise<void> {
  try {
    const feedback = await feedbackService.recordFeedback(req.body);
    res.status(201).json({ success: true, data: feedback });
  } catch (error) {
    logger.error('Failed to submit feedback:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '提交反馈失败',
    });
  }
}

/**
 * 获取反馈统计
 * GET /api/ai-ops/feedback/stats
 * Requirements: 10.4, 10.6
 */
export async function getFeedbackStats(req: Request, res: Response): Promise<void> {
  try {
    const { ruleId } = req.query;
    
    if (ruleId) {
      const stats = await feedbackService.getRuleStats(ruleId as string);
      res.json({ success: true, data: stats });
    } else {
      const stats = await feedbackService.getAllRuleStats();
      res.json({ success: true, data: stats });
    }
  } catch (error) {
    logger.error('Failed to get feedback stats:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取反馈统计失败',
    });
  }
}

/**
 * 获取需要审查的规则
 * GET /api/ai-ops/feedback/review
 * Requirements: 10.5, 10.6
 */
export async function getRulesNeedingReview(req: Request, res: Response): Promise<void> {
  try {
    const { threshold } = req.query;
    const rules = await feedbackService.getRulesNeedingReview(
      threshold ? parseFloat(threshold as string) : undefined
    );
    res.json({ success: true, data: rules });
  } catch (error) {
    logger.error('Failed to get rules needing review:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取需审查规则失败',
    });
  }
}


// ==================== AI-Ops Enhancement: 缓存管理相关 ====================
// Requirements: 2.5, 3.5

/**
 * 获取指纹缓存统计
 * GET /api/ai-ops/cache/fingerprint/stats
 * Requirements: 2.5
 */
export async function getFingerprintCacheStats(_req: Request, res: Response): Promise<void> {
  try {
    const stats = fingerprintCache.getStats();
    const config = fingerprintCache.getConfig();
    res.json({ success: true, data: { ...stats, config } });
  } catch (error) {
    logger.error('Failed to get fingerprint cache stats:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取指纹缓存统计失败',
    });
  }
}

/**
 * 清空指纹缓存
 * POST /api/ai-ops/cache/fingerprint/clear
 * Requirements: 2.5
 */
export async function clearFingerprintCache(_req: Request, res: Response): Promise<void> {
  try {
    fingerprintCache.clear();
    res.json({ success: true, message: '指纹缓存已清空' });
  } catch (error) {
    logger.error('Failed to clear fingerprint cache:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '清空指纹缓存失败',
    });
  }
}

/**
 * 获取分析缓存统计
 * GET /api/ai-ops/cache/analysis/stats
 * Requirements: 3.5
 */
export async function getAnalysisCacheStats(_req: Request, res: Response): Promise<void> {
  try {
    const stats = analysisCache.getStats();
    const config = analysisCache.getConfig();
    res.json({ success: true, data: { ...stats, config } });
  } catch (error) {
    logger.error('Failed to get analysis cache stats:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取分析缓存统计失败',
    });
  }
}

/**
 * 清空分析缓存
 * POST /api/ai-ops/cache/analysis/clear
 * Requirements: 3.5
 */
export async function clearAnalysisCache(_req: Request, res: Response): Promise<void> {
  try {
    analysisCache.clear();
    res.json({ success: true, message: '分析缓存已清空' });
  } catch (error) {
    logger.error('Failed to clear analysis cache:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '清空分析缓存失败',
    });
  }
}

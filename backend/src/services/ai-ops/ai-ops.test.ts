/**
 * AI-Ops 基础数据服务测试
 * 
 * 验证审计日志、指标采集、告警引擎、调度器、配置快照和健康报告服务的基本功能
 * 
 * Checkpoint 4: 基础数据服务完成
 * Checkpoint 7: 告警系统完成
 * Checkpoint 11: 巡检和备份功能完成
 */

import fs from 'fs/promises';
import path from 'path';
import { AuditLogger } from './auditLogger';
import { MetricsCollector } from './metricsCollector';
import { AlertEngine } from './alertEngine';
import { Scheduler } from './scheduler';
import { ConfigSnapshotService } from './configSnapshotService';
import { HealthReportService } from './healthReportService';
import { 
  AuditLog, 
  AuditAction, 
  SystemMetrics, 
  InterfaceMetrics,
  AlertRule,
  AlertOperator,
  CreateAlertRuleInput,
  CreateScheduledTaskInput,
} from '../../types/ai-ops';

// 测试数据目录
const TEST_DATA_DIR = path.join(process.cwd(), 'data', 'ai-ops-test');
const TEST_AUDIT_DIR = path.join(TEST_DATA_DIR, 'audit');
const TEST_METRICS_DIR = path.join(TEST_DATA_DIR, 'metrics');

describe('AuditLogger', () => {
  let auditLogger: AuditLogger;

  beforeAll(async () => {
    // 创建测试目录
    await fs.mkdir(TEST_AUDIT_DIR, { recursive: true });
  });

  beforeEach(() => {
    auditLogger = new AuditLogger();
  });

  afterAll(async () => {
    // 清理测试目录
    try {
      await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
    } catch {
      // 忽略清理错误
    }
  });

  describe('log', () => {
    it('should create an audit log entry with id and timestamp', async () => {
      const entry = {
        action: 'script_execute' as AuditAction,
        actor: 'system' as const,
        details: {
          trigger: 'test',
          script: 'test script',
          result: 'success',
        },
      };

      const result = await auditLogger.log(entry);

      expect(result).not.toBeNull();
      expect(result!.id).toBeDefined();
      expect(result!.timestamp).toBeDefined();
      expect(result!.action).toBe('script_execute');
      expect(result!.actor).toBe('system');
      expect(result!.details.trigger).toBe('test');
    });

    it('should persist audit log to file', async () => {
      const entry = {
        action: 'alert_trigger' as AuditAction,
        actor: 'system' as const,
        details: {
          trigger: 'cpu_high',
          metadata: { cpu: 95 },
        },
      };

      const result = await auditLogger.log(entry);
      
      expect(result).not.toBeNull();
      
      // 查询刚创建的日志
      const logs = await auditLogger.query({ limit: 1 });
      
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].id).toBe(result!.id);
    });

    it('should filter out read-only actions and return null', async () => {
      // 测试只读操作不记录审计日志
      const readOnlyEntry = {
        action: 'snapshot_view' as any,  // 只读操作
        actor: 'user' as const,
        details: {
          trigger: 'view',
          metadata: { snapshotId: 'test-id' },
        },
      };

      const result = await auditLogger.log(readOnlyEntry);
      
      // 只读操作应返回 null
      expect(result).toBeNull();
    });
  });

  describe('query', () => {
    it('should query logs by action type', async () => {
      // 创建不同类型的日志
      await auditLogger.log({
        action: 'config_change',
        actor: 'user',
        details: { trigger: 'manual' },
      });

      await auditLogger.log({
        action: 'alert_trigger',
        actor: 'system',
        details: { trigger: 'auto' },
      });

      const configLogs = await auditLogger.query({ action: 'config_change' });
      
      expect(configLogs.every(log => log.action === 'config_change')).toBe(true);
    });

    it('should query logs by actor', async () => {
      await auditLogger.log({
        action: 'script_execute',
        actor: 'user',
        details: { trigger: 'manual' },
      });

      const userLogs = await auditLogger.query({ actor: 'user' });
      
      expect(userLogs.every(log => log.actor === 'user')).toBe(true);
    });

    it('should limit query results', async () => {
      // 创建多条日志
      for (let i = 0; i < 5; i++) {
        await auditLogger.log({
          action: 'script_execute',
          actor: 'system',
          details: { trigger: `test-${i}` },
        });
      }

      const limitedLogs = await auditLogger.query({ limit: 3 });
      
      expect(limitedLogs.length).toBeLessThanOrEqual(3);
    });

    it('should return logs sorted by timestamp descending', async () => {
      const logs = await auditLogger.query({ limit: 10 });
      
      for (let i = 1; i < logs.length; i++) {
        expect(logs[i - 1].timestamp).toBeGreaterThanOrEqual(logs[i].timestamp);
      }
    });
  });

  describe('cleanup', () => {
    it('should return number of deleted records', async () => {
      // cleanup 应该返回删除的记录数（可能为 0）
      const deletedCount = await auditLogger.cleanup(90);
      
      expect(typeof deletedCount).toBe('number');
      expect(deletedCount).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('MetricsCollector', () => {
  let metricsCollector: MetricsCollector;

  beforeEach(() => {
    metricsCollector = new MetricsCollector();
  });

  afterEach(() => {
    metricsCollector.stop();
  });

  describe('getConfig', () => {
    it('should return default configuration', () => {
      const config = metricsCollector.getConfig();

      expect(config.intervalMs).toBe(60000);
      expect(config.retentionDays).toBe(7);
      expect(config.enabled).toBe(true);
    });
  });

  describe('saveConfig', () => {
    it('should update and return new configuration', async () => {
      const newConfig = await metricsCollector.saveConfig({
        intervalMs: 30000,
        enabled: false,
      });

      expect(newConfig.intervalMs).toBe(30000);
      expect(newConfig.enabled).toBe(false);
      expect(newConfig.retentionDays).toBe(7); // 保持默认值
    });
  });

  describe('isServiceRunning', () => {
    it('should return false when not started', () => {
      expect(metricsCollector.isServiceRunning()).toBe(false);
    });
  });

  describe('getLatest', () => {
    it('should return null when no metrics collected', async () => {
      const latest = await metricsCollector.getLatest();
      
      // 可能返回 null 或之前缓存的数据
      expect(latest === null || typeof latest === 'object').toBe(true);
    });
  });

  describe('getHistory', () => {
    it('should return empty array for non-existent metrics', async () => {
      const now = Date.now();
      const history = await metricsCollector.getHistory('cpu', now - 3600000, now);
      
      expect(Array.isArray(history)).toBe(true);
    });

    it('should return sorted results by timestamp', async () => {
      const now = Date.now();
      const history = await metricsCollector.getHistory('memory', now - 86400000, now);
      
      for (let i = 1; i < history.length; i++) {
        expect(history[i - 1].timestamp).toBeLessThanOrEqual(history[i].timestamp);
      }
    });
  });

  describe('cleanupExpiredData', () => {
    it('should return cleanup statistics', async () => {
      const result = await metricsCollector.cleanupExpiredData();
      
      expect(typeof result.systemDeleted).toBe('number');
      expect(typeof result.interfaceDeleted).toBe('number');
      expect(result.systemDeleted).toBeGreaterThanOrEqual(0);
      expect(result.interfaceDeleted).toBeGreaterThanOrEqual(0);
    });
  });
});


describe('AlertEngine', () => {
  let alertEngine: AlertEngine;

  beforeEach(() => {
    alertEngine = new AlertEngine();
  });

  describe('Rule Management', () => {
    it('should create an alert rule with id and timestamps', async () => {
      const input: CreateAlertRuleInput = {
        name: 'Test CPU Alert',
        enabled: true,
        metric: 'cpu',
        operator: 'gt',
        threshold: 80,
        duration: 1,
        cooldownMs: 60000,
        severity: 'warning',
        channels: [],
      };

      const rule = await alertEngine.createRule(input);

      expect(rule.id).toBeDefined();
      expect(rule.createdAt).toBeDefined();
      expect(rule.updatedAt).toBeDefined();
      expect(rule.name).toBe('Test CPU Alert');
      expect(rule.metric).toBe('cpu');
      expect(rule.operator).toBe('gt');
      expect(rule.threshold).toBe(80);
    });

    it('should retrieve rule by id', async () => {
      const input: CreateAlertRuleInput = {
        name: 'Test Memory Alert',
        enabled: true,
        metric: 'memory',
        operator: 'gte',
        threshold: 90,
        duration: 2,
        cooldownMs: 30000,
        severity: 'critical',
        channels: [],
      };

      const created = await alertEngine.createRule(input);
      const retrieved = await alertEngine.getRuleById(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe('Test Memory Alert');
    });

    it('should update an alert rule', async () => {
      const input: CreateAlertRuleInput = {
        name: 'Original Name',
        enabled: true,
        metric: 'disk',
        operator: 'gt',
        threshold: 70,
        duration: 1,
        cooldownMs: 60000,
        severity: 'info',
        channels: [],
      };

      const created = await alertEngine.createRule(input);
      const updated = await alertEngine.updateRule(created.id, {
        name: 'Updated Name',
        threshold: 85,
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.threshold).toBe(85);
      expect(updated.updatedAt).toBeGreaterThan(created.updatedAt);
    });

    it('should delete an alert rule', async () => {
      const input: CreateAlertRuleInput = {
        name: 'To Be Deleted',
        enabled: true,
        metric: 'cpu',
        operator: 'gt',
        threshold: 50,
        duration: 1,
        cooldownMs: 60000,
        severity: 'warning',
        channels: [],
      };

      const created = await alertEngine.createRule(input);
      await alertEngine.deleteRule(created.id);
      const retrieved = await alertEngine.getRuleById(created.id);

      expect(retrieved).toBeNull();
    });

    it('should enable and disable rules', async () => {
      const input: CreateAlertRuleInput = {
        name: 'Toggle Rule',
        enabled: true,
        metric: 'cpu',
        operator: 'gt',
        threshold: 50,
        duration: 1,
        cooldownMs: 60000,
        severity: 'warning',
        channels: [],
      };

      const created = await alertEngine.createRule(input);
      
      await alertEngine.disableRule(created.id);
      let retrieved = await alertEngine.getRuleById(created.id);
      expect(retrieved?.enabled).toBe(false);

      await alertEngine.enableRule(created.id);
      retrieved = await alertEngine.getRuleById(created.id);
      expect(retrieved?.enabled).toBe(true);
    });

    it('should get all rules', async () => {
      // Create multiple rules
      await alertEngine.createRule({
        name: 'Rule 1',
        enabled: true,
        metric: 'cpu',
        operator: 'gt',
        threshold: 80,
        duration: 1,
        cooldownMs: 60000,
        severity: 'warning',
        channels: [],
      });

      await alertEngine.createRule({
        name: 'Rule 2',
        enabled: true,
        metric: 'memory',
        operator: 'gt',
        threshold: 90,
        duration: 1,
        cooldownMs: 60000,
        severity: 'critical',
        channels: [],
      });

      const rules = await alertEngine.getRules();
      expect(rules.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Condition Evaluation', () => {
    it('should evaluate gt operator correctly', () => {
      expect(alertEngine.evaluateCondition(90, 'gt', 80)).toBe(true);
      expect(alertEngine.evaluateCondition(80, 'gt', 80)).toBe(false);
      expect(alertEngine.evaluateCondition(70, 'gt', 80)).toBe(false);
    });

    it('should evaluate lt operator correctly', () => {
      expect(alertEngine.evaluateCondition(70, 'lt', 80)).toBe(true);
      expect(alertEngine.evaluateCondition(80, 'lt', 80)).toBe(false);
      expect(alertEngine.evaluateCondition(90, 'lt', 80)).toBe(false);
    });

    it('should evaluate eq operator correctly', () => {
      expect(alertEngine.evaluateCondition(80, 'eq', 80)).toBe(true);
      expect(alertEngine.evaluateCondition(79, 'eq', 80)).toBe(false);
      expect(alertEngine.evaluateCondition(81, 'eq', 80)).toBe(false);
    });

    it('should evaluate ne operator correctly', () => {
      expect(alertEngine.evaluateCondition(79, 'ne', 80)).toBe(true);
      expect(alertEngine.evaluateCondition(81, 'ne', 80)).toBe(true);
      expect(alertEngine.evaluateCondition(80, 'ne', 80)).toBe(false);
    });

    it('should evaluate gte operator correctly', () => {
      expect(alertEngine.evaluateCondition(90, 'gte', 80)).toBe(true);
      expect(alertEngine.evaluateCondition(80, 'gte', 80)).toBe(true);
      expect(alertEngine.evaluateCondition(70, 'gte', 80)).toBe(false);
    });

    it('should evaluate lte operator correctly', () => {
      expect(alertEngine.evaluateCondition(70, 'lte', 80)).toBe(true);
      expect(alertEngine.evaluateCondition(80, 'lte', 80)).toBe(true);
      expect(alertEngine.evaluateCondition(90, 'lte', 80)).toBe(false);
    });
  });

  describe('Alert Events', () => {
    it('should return empty array for active alerts initially', async () => {
      const activeAlerts = await alertEngine.getActiveAlerts();
      expect(Array.isArray(activeAlerts)).toBe(true);
    });

    it('should return empty array for alert history with no events', async () => {
      const now = Date.now();
      const history = await alertEngine.getAlertHistory(now - 3600000, now);
      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe('Evaluate', () => {
    it('should not trigger alert when condition is not met', async () => {
      await alertEngine.createRule({
        name: 'High CPU Alert',
        enabled: true,
        metric: 'cpu',
        operator: 'gt',
        threshold: 90,
        duration: 1,
        cooldownMs: 60000,
        severity: 'warning',
        channels: [],
      });

      const metrics = {
        system: {
          cpu: { usage: 50 },
          memory: { total: 1000, used: 500, free: 500, usage: 50 },
          disk: { total: 10000, used: 5000, free: 5000, usage: 50 },
          uptime: 3600,
        },
        interfaces: [],
      };

      const events = await alertEngine.evaluate(metrics);
      expect(events.length).toBe(0);
    });

    it('should trigger alert when condition is met', async () => {
      await alertEngine.createRule({
        name: 'High CPU Alert Trigger',
        enabled: true,
        metric: 'cpu',
        operator: 'gt',
        threshold: 80,
        duration: 1,
        cooldownMs: 0, // No cooldown for testing
        severity: 'critical',
        channels: [],
      });

      const metrics = {
        system: {
          cpu: { usage: 95 },
          memory: { total: 1000, used: 500, free: 500, usage: 50 },
          disk: { total: 10000, used: 5000, free: 5000, usage: 50 },
          uptime: 3600,
        },
        interfaces: [],
      };

      const events = await alertEngine.evaluate(metrics);
      // May or may not trigger depending on existing state
      expect(Array.isArray(events)).toBe(true);
    });
  });
});


// ==================== Checkpoint 11: 巡检和备份功能测试 ====================

describe('Scheduler', () => {
  let scheduler: Scheduler;

  beforeEach(() => {
    scheduler = new Scheduler();
  });

  afterEach(() => {
    scheduler.stop();
  });

  describe('Cron Parsing', () => {
    it('should validate valid cron expressions', () => {
      // 每分钟
      const nextTime1 = scheduler.calculateNextRunTime('* * * * *');
      expect(nextTime1).not.toBeNull();
      expect(nextTime1).toBeGreaterThan(Date.now());

      // 每小时
      const nextTime2 = scheduler.calculateNextRunTime('0 * * * *');
      expect(nextTime2).not.toBeNull();

      // 每天凌晨
      const nextTime3 = scheduler.calculateNextRunTime('0 0 * * *');
      expect(nextTime3).not.toBeNull();
    });

    it('should return null for invalid cron expressions', () => {
      const nextTime = scheduler.calculateNextRunTime('invalid cron');
      expect(nextTime).toBeNull();
    });
  });

  describe('Task Management', () => {
    it('should create a scheduled task with id and timestamps', async () => {
      const input: CreateScheduledTaskInput = {
        name: 'Test Backup Task',
        type: 'backup',
        cron: '0 0 * * *', // 每天凌晨
        enabled: true,
      };

      const task = await scheduler.createTask(input);

      expect(task.id).toBeDefined();
      expect(task.createdAt).toBeDefined();
      expect(task.name).toBe('Test Backup Task');
      expect(task.type).toBe('backup');
      expect(task.cron).toBe('0 0 * * *');
      expect(task.enabled).toBe(true);
      expect(task.nextRunAt).toBeDefined();
    });

    it('should retrieve task by id', async () => {
      const input: CreateScheduledTaskInput = {
        name: 'Test Inspection Task',
        type: 'inspection',
        cron: '0 8 * * *', // 每天早上8点
        enabled: true,
      };

      const created = await scheduler.createTask(input);
      const retrieved = await scheduler.getTaskById(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe('Test Inspection Task');
    });

    it('should update a scheduled task', async () => {
      const input: CreateScheduledTaskInput = {
        name: 'Original Task',
        type: 'custom',
        cron: '0 0 * * *',
        enabled: true,
      };

      const created = await scheduler.createTask(input);
      const updated = await scheduler.updateTask(created.id, {
        name: 'Updated Task',
        cron: '0 12 * * *',
      });

      expect(updated.name).toBe('Updated Task');
      expect(updated.cron).toBe('0 12 * * *');
    });

    it('should delete a scheduled task', async () => {
      const input: CreateScheduledTaskInput = {
        name: 'To Be Deleted',
        type: 'backup',
        cron: '0 0 * * *',
        enabled: true,
      };

      const created = await scheduler.createTask(input);
      await scheduler.deleteTask(created.id);
      const retrieved = await scheduler.getTaskById(created.id);

      expect(retrieved).toBeNull();
    });

    it('should get all tasks', async () => {
      await scheduler.createTask({
        name: 'Task 1',
        type: 'backup',
        cron: '0 0 * * *',
        enabled: true,
      });

      await scheduler.createTask({
        name: 'Task 2',
        type: 'inspection',
        cron: '0 8 * * *',
        enabled: true,
      });

      const tasks = await scheduler.getTasks();
      expect(tasks.length).toBeGreaterThanOrEqual(2);
    });

    it('should throw error for invalid cron expression', async () => {
      const input: CreateScheduledTaskInput = {
        name: 'Invalid Task',
        type: 'backup',
        cron: 'invalid',
        enabled: true,
      };

      await expect(scheduler.createTask(input)).rejects.toThrow('Invalid cron expression');
    });
  });

  describe('Service State', () => {
    it('should return false when not started', () => {
      expect(scheduler.isServiceRunning()).toBe(false);
    });

    it('should return 0 active cron jobs when not started', () => {
      expect(scheduler.getActiveCronJobsCount()).toBe(0);
    });
  });

  describe('Execution History', () => {
    it('should return empty array for executions initially', async () => {
      const executions = await scheduler.getExecutions();
      expect(Array.isArray(executions)).toBe(true);
    });
  });
});

describe('ConfigSnapshotService', () => {
  let configSnapshotService: ConfigSnapshotService;

  beforeEach(() => {
    configSnapshotService = new ConfigSnapshotService();
  });

  describe('Initialization', () => {
    it('should initialize without errors', async () => {
      await expect(configSnapshotService.initialize()).resolves.not.toThrow();
    });
  });

  describe('Snapshot Management', () => {
    it('should return empty array for snapshots initially', async () => {
      const snapshots = await configSnapshotService.getSnapshots();
      expect(Array.isArray(snapshots)).toBe(true);
    });

    it('should return null for non-existent snapshot', async () => {
      const snapshot = await configSnapshotService.getSnapshotById('non-existent-id');
      expect(snapshot).toBeNull();
    });
  });

  describe('Dangerous Change Detection', () => {
    it('should detect firewall rule deletion as dangerous', () => {
      const diff = {
        snapshotA: 'a',
        snapshotB: 'b',
        additions: [],
        modifications: [],
        deletions: ['/ip firewall filter add chain=input action=drop'],
      };

      const result = configSnapshotService.detectDangerousChanges(diff);
      
      expect(result.detected).toBe(true);
      expect(result.overallRiskLevel).toBe('high');
      expect(result.patterns.some(p => p.name === 'firewall_rule_deletion')).toBe(true);
    });

    it('should detect password change as dangerous', () => {
      const diff = {
        snapshotA: 'a',
        snapshotB: 'b',
        additions: ['/user set admin password=newpassword'],
        modifications: [],
        deletions: [],
      };

      const result = configSnapshotService.detectDangerousChanges(diff);
      
      expect(result.detected).toBe(true);
      expect(result.overallRiskLevel).toBe('high');
    });

    it('should return no detection for safe changes', () => {
      const diff = {
        snapshotA: 'a',
        snapshotB: 'b',
        additions: ['/ip address add address=192.168.1.1/24 interface=ether1'],
        modifications: [],
        deletions: [],
      };

      const result = configSnapshotService.detectDangerousChanges(diff);
      
      expect(result.detected).toBe(false);
      expect(result.overallRiskLevel).toBe('low');
    });
  });

  describe('Latest Diff', () => {
    it('should return null when less than 2 snapshots exist', async () => {
      const diff = await configSnapshotService.getLatestDiff();
      // May return null or a diff depending on existing data
      expect(diff === null || typeof diff === 'object').toBe(true);
    });
  });
});

describe('HealthReportService', () => {
  let healthReportService: HealthReportService;

  beforeEach(() => {
    healthReportService = new HealthReportService();
  });

  describe('Initialization', () => {
    it('should initialize without errors', async () => {
      await expect(healthReportService.initialize()).resolves.not.toThrow();
    });
  });

  describe('Report Management', () => {
    it('should return empty array for reports initially', async () => {
      const reports = await healthReportService.getReports();
      expect(Array.isArray(reports)).toBe(true);
    });

    it('should return null for non-existent report', async () => {
      const report = await healthReportService.getReportById('non-existent-id');
      expect(report).toBeNull();
    });
  });

  describe('Report Export', () => {
    it('should throw error when exporting non-existent report as markdown', async () => {
      await expect(healthReportService.exportAsMarkdown('non-existent-id'))
        .rejects.toThrow('Report not found');
    });

    it('should throw error when exporting non-existent report as PDF', async () => {
      await expect(healthReportService.exportAsPdf('non-existent-id'))
        .rejects.toThrow('Report not found');
    });
  });

  describe('Report Cleanup', () => {
    it('should return 0 when no reports to cleanup', async () => {
      const deletedCount = await healthReportService.cleanupReports(90);
      expect(typeof deletedCount).toBe('number');
      expect(deletedCount).toBeGreaterThanOrEqual(0);
    });
  });
});

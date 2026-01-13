/**
 * AI-Ops 智能运维类型定义
 * 定义智能运维模块所需的所有接口类型
 */

// ==================== 通用类型 ====================

/**
 * 告警运算符
 */
export type AlertOperator = 'gt' | 'lt' | 'eq' | 'ne' | 'gte' | 'lte';

/**
 * 告警严重级别
 */
export type AlertSeverity = 'info' | 'warning' | 'critical' | 'emergency';

/**
 * 指标类型
 */
export type MetricType = 'cpu' | 'memory' | 'disk' | 'interface_status' | 'interface_traffic';

/**
 * 通知渠道类型
 */
export type ChannelType = 'web_push' | 'webhook' | 'email';

/**
 * 审计操作类型
 */
export type AuditAction =
  | 'script_execute'
  | 'config_change'
  | 'alert_trigger'
  | 'alert_resolve'
  | 'remediation_execute'
  | 'config_restore'
  | 'snapshot_create';

// ==================== 指标采集类型 ====================

/**
 * 指标数据点
 */
export interface MetricPoint {
  timestamp: number;
  value: number;
  labels?: Record<string, string>;
}

/**
 * 系统指标
 */
export interface SystemMetrics {
  cpu: { usage: number };
  memory: { total: number; used: number; free: number; usage: number };
  disk: { total: number; used: number; free: number; usage: number };
  uptime: number;
}

/**
 * 接口指标
 */
export interface InterfaceMetrics {
  name: string;
  status: 'up' | 'down';
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
  rxErrors: number;
  txErrors: number;
}


/**
 * 指标采集配置
 */
export interface MetricsCollectorConfig {
  intervalMs: number;        // 采集间隔，默认 60000 (1分钟)
  retentionDays: number;     // 数据保留天数，默认 7
  enabled: boolean;
}

// ==================== 告警类型 ====================

/**
 * 告警规则
 */
export interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  metric: MetricType;
  metricLabel?: string;       // 如接口名称
  operator: AlertOperator;
  threshold: number;
  duration: number;           // 持续触发次数
  cooldownMs: number;         // 冷却时间
  severity: AlertSeverity;
  channels: string[];         // 通知渠道 ID 列表
  autoResponse?: {
    enabled: boolean;
    script: string;           // RouterOS 脚本
  };
  createdAt: number;
  updatedAt: number;
  lastTriggeredAt?: number;
}

/**
 * 创建告警规则输入
 */
export type CreateAlertRuleInput = Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * 更新告警规则输入
 */
export type UpdateAlertRuleInput = Partial<Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>>;

/**
 * 告警事件
 */
export interface AlertEvent {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: AlertSeverity;
  metric: MetricType;
  currentValue: number;
  threshold: number;
  message: string;
  aiAnalysis?: string;
  status: 'active' | 'resolved';
  triggeredAt: number;
  resolvedAt?: number;
  autoResponseResult?: {
    executed: boolean;
    success: boolean;
    output?: string;
    error?: string;
  };
}

// ==================== 调度器类型 ====================

/**
 * 定时任务类型
 */
export type ScheduledTaskType = 'inspection' | 'backup' | 'custom';

/**
 * 定时任务
 */
export interface ScheduledTask {
  id: string;
  name: string;
  type: ScheduledTaskType;
  cron: string;              // cron 表达式
  enabled: boolean;
  lastRunAt?: number;
  nextRunAt?: number;
  config?: Record<string, unknown>;
  createdAt: number;
}

/**
 * 创建定时任务输入
 */
export type CreateScheduledTaskInput = Omit<ScheduledTask, 'id' | 'createdAt' | 'nextRunAt'>;

/**
 * 更新定时任务输入
 */
export type UpdateScheduledTaskInput = Partial<Omit<ScheduledTask, 'id' | 'createdAt' | 'nextRunAt'>>;

/**
 * 任务执行状态
 */
export type TaskExecutionStatus = 'running' | 'success' | 'failed';

/**
 * 任务执行记录
 */
export interface TaskExecution {
  id: string;
  taskId: string;
  taskName: string;
  type: string;
  status: TaskExecutionStatus;
  startedAt: number;
  completedAt?: number;
  result?: unknown;
  error?: string;
}


// ==================== 配置快照类型 ====================

/**
 * 快照触发方式
 */
export type SnapshotTrigger = 'auto' | 'manual' | 'pre-remediation';

/**
 * 配置快照
 */
export interface ConfigSnapshot {
  id: string;
  timestamp: number;
  trigger: SnapshotTrigger;
  size: number;
  checksum: string;
  metadata?: {
    routerVersion?: string;
    routerModel?: string;
  };
}

/**
 * 风险级别
 */
export type RiskLevel = 'low' | 'medium' | 'high';

/**
 * 快照差异
 */
export interface SnapshotDiff {
  snapshotA: string;
  snapshotB: string;
  additions: string[];
  modifications: Array<{ path: string; oldValue: string; newValue: string }>;
  deletions: string[];
  aiAnalysis?: {
    riskLevel: RiskLevel;
    summary: string;
    recommendations: string[];
  };
}

// ==================== 健康报告类型 ====================

/**
 * 健康状态
 */
export type HealthStatus = 'healthy' | 'warning' | 'critical';

/**
 * 健康报告
 */
export interface HealthReport {
  id: string;
  generatedAt: number;
  period: { from: number; to: number };
  summary: {
    overallHealth: HealthStatus;
    score: number;  // 0-100
  };
  metrics: {
    cpu: { avg: number; max: number; min: number };
    memory: { avg: number; max: number; min: number };
    disk: { avg: number; max: number; min: number };
  };
  interfaces: Array<{
    name: string;
    avgRxRate: number;
    avgTxRate: number;
    downtime: number;
  }>;
  alerts: {
    total: number;
    bySeverity: Record<AlertSeverity, number>;
    topRules: Array<{ ruleName: string; count: number }>;
  };
  configChanges: number;
  aiAnalysis: {
    risks: string[];
    recommendations: string[];
    trends: string[];
  };
}

// ==================== 故障自愈类型 ====================

/**
 * 故障模式条件
 */
export interface FaultCondition {
  metric: MetricType;
  metricLabel?: string;
  operator: AlertOperator;
  threshold: number;
}

/**
 * 故障模式
 */
export interface FaultPattern {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  autoHeal: boolean;         // 是否自动修复
  builtin: boolean;          // 是否内置模式
  conditions: FaultCondition[];
  remediationScript: string;  // RouterOS 修复脚本
  verificationScript?: string; // 验证脚本
  createdAt: number;
  updatedAt: number;
}

/**
 * 创建故障模式输入
 */
export type CreateFaultPatternInput = Omit<FaultPattern, 'id' | 'builtin' | 'createdAt' | 'updatedAt'>;

/**
 * 更新故障模式输入
 */
export type UpdateFaultPatternInput = Partial<Omit<FaultPattern, 'id' | 'builtin' | 'createdAt' | 'updatedAt'>>;


/**
 * 修复执行状态
 */
export type RemediationStatus = 'pending' | 'executing' | 'success' | 'failed' | 'skipped';

/**
 * 修复执行记录
 */
export interface RemediationExecution {
  id: string;
  patternId: string;
  patternName: string;
  alertEventId: string;
  status: RemediationStatus;
  preSnapshotId?: string;
  aiConfirmation?: {
    confirmed: boolean;
    confidence: number;
    reasoning: string;
  };
  executionResult?: {
    output: string;
    error?: string;
  };
  verificationResult?: {
    passed: boolean;
    message: string;
  };
  startedAt: number;
  completedAt?: number;
}

// ==================== 通知类型 ====================

/**
 * Web Push 配置
 */
export interface WebPushConfig {
  // Web Push 使用浏览器原生 API，无需额外配置
}

/**
 * Webhook 配置
 */
export interface WebhookConfig {
  url: string;
  method: 'POST' | 'PUT';
  headers?: Record<string, string>;
  bodyTemplate?: string;  // 支持变量替换
}

/**
 * 邮件配置
 */
export interface EmailConfig {
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    auth: { user: string; pass: string };
  };
  from: string;
  to: string[];
}

/**
 * 通知渠道配置联合类型
 */
export type NotificationChannelConfig = WebPushConfig | WebhookConfig | EmailConfig;

/**
 * 通知渠道
 */
export interface NotificationChannel {
  id: string;
  name: string;
  type: ChannelType;
  enabled: boolean;
  config: NotificationChannelConfig;
  severityFilter?: AlertSeverity[];  // 只接收指定级别的告警
  createdAt: number;
}

/**
 * 创建通知渠道输入
 */
export type CreateNotificationChannelInput = Omit<NotificationChannel, 'id' | 'createdAt'>;

/**
 * 更新通知渠道输入
 */
export type UpdateNotificationChannelInput = Partial<Omit<NotificationChannel, 'id' | 'createdAt'>>;

/**
 * 通知类型
 */
export type NotificationType = 'alert' | 'recovery' | 'report' | 'remediation';

/**
 * 通知状态
 */
export type NotificationStatus = 'pending' | 'sent' | 'failed';

/**
 * 通知
 */
export interface Notification {
  id: string;
  channelId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  status: NotificationStatus;
  sentAt?: number;
  error?: string;
  retryCount: number;
}


// ==================== 审计日志类型 ====================

/**
 * 审计日志
 */
export interface AuditLog {
  id: string;
  timestamp: number;
  action: AuditAction;
  actor: 'system' | 'user';
  details: {
    trigger?: string;
    script?: string;
    result?: string;
    error?: string;
    metadata?: Record<string, unknown>;
  };
}

/**
 * 审计日志查询选项
 */
export interface AuditLogQueryOptions {
  from?: number;
  to?: number;
  action?: AuditAction;
  actor?: 'system' | 'user';
  limit?: number;
}

// ==================== AI 分析类型 ====================

/**
 * 分析请求类型
 */
export type AnalysisType = 'alert' | 'health_report' | 'config_diff' | 'fault_diagnosis';

/**
 * 分析请求
 */
export interface AnalysisRequest {
  type: AnalysisType;
  context: Record<string, unknown>;
}

/**
 * 分析结果
 */
export interface AnalysisResult {
  summary: string;
  details?: string;
  recommendations?: string[];
  riskLevel?: RiskLevel;
  confidence?: number;
}

// ==================== 数据存储类型 ====================

/**
 * AI-Ops 数据存储结构
 */
export interface AIOpsData {
  alertRules: AlertRule[];
  faultPatterns: FaultPattern[];
  notificationChannels: NotificationChannel[];
  scheduledTasks: ScheduledTask[];
  metricsConfig: MetricsCollectorConfig;
}

// ==================== 服务接口 ====================

/**
 * 指标采集服务接口
 */
export interface IMetricsCollector {
  start(): void;
  stop(): void;
  collectNow(): Promise<{ system: SystemMetrics; interfaces: InterfaceMetrics[] }>;
  getHistory(metric: string, from: number, to: number): Promise<MetricPoint[]>;
  getLatest(): Promise<{ system: SystemMetrics; interfaces: InterfaceMetrics[] } | null>;
}

/**
 * 告警引擎接口
 */
export interface IAlertEngine {
  // 规则管理
  createRule(rule: CreateAlertRuleInput): Promise<AlertRule>;
  updateRule(id: string, updates: UpdateAlertRuleInput): Promise<AlertRule>;
  deleteRule(id: string): Promise<void>;
  getRules(): Promise<AlertRule[]>;
  getRuleById(id: string): Promise<AlertRule | null>;
  enableRule(id: string): Promise<void>;
  disableRule(id: string): Promise<void>;

  // 告警评估
  evaluate(metrics: { system: SystemMetrics; interfaces: InterfaceMetrics[] }): Promise<AlertEvent[]>;

  // 告警事件
  getActiveAlerts(): Promise<AlertEvent[]>;
  getAlertHistory(from: number, to: number): Promise<AlertEvent[]>;
  resolveAlert(id: string): Promise<void>;
}


/**
 * 调度器接口
 */
export interface IScheduler {
  start(): void;
  stop(): void;

  // 任务管理
  createTask(task: CreateScheduledTaskInput): Promise<ScheduledTask>;
  updateTask(id: string, updates: UpdateScheduledTaskInput): Promise<ScheduledTask>;
  deleteTask(id: string): Promise<void>;
  getTasks(): Promise<ScheduledTask[]>;
  getTaskById(id: string): Promise<ScheduledTask | null>;

  // 手动执行
  runTaskNow(id: string): Promise<TaskExecution>;

  // 执行历史
  getExecutions(taskId?: string, limit?: number): Promise<TaskExecution[]>;
}

/**
 * 配置快照服务接口
 */
export interface IConfigSnapshotService {
  // 快照管理
  createSnapshot(trigger: SnapshotTrigger): Promise<ConfigSnapshot>;
  getSnapshots(limit?: number): Promise<ConfigSnapshot[]>;
  getSnapshotById(id: string): Promise<ConfigSnapshot | null>;
  deleteSnapshot(id: string): Promise<void>;
  downloadSnapshot(id: string): Promise<string>;  // 返回配置内容

  // 配置恢复
  restoreSnapshot(id: string): Promise<{ success: boolean; message: string }>;

  // 差异对比
  compareSnapshots(idA: string, idB: string): Promise<SnapshotDiff>;
  getLatestDiff(): Promise<SnapshotDiff | null>;
}

/**
 * 健康报告服务接口
 */
export interface IHealthReportService {
  generateReport(from: number, to: number): Promise<HealthReport>;
  getReports(limit?: number): Promise<HealthReport[]>;
  getReportById(id: string): Promise<HealthReport | null>;
  exportAsMarkdown(id: string): Promise<string>;
  exportAsPdf(id: string): Promise<Buffer>;
}

/**
 * 故障自愈服务接口
 */
export interface IFaultHealer {
  // 故障模式管理
  getPatterns(): Promise<FaultPattern[]>;
  getPatternById(id: string): Promise<FaultPattern | null>;
  createPattern(pattern: CreateFaultPatternInput): Promise<FaultPattern>;
  updatePattern(id: string, updates: UpdateFaultPatternInput): Promise<FaultPattern>;
  deletePattern(id: string): Promise<void>;
  enableAutoHeal(id: string): Promise<void>;
  disableAutoHeal(id: string): Promise<void>;

  // 故障匹配和修复
  matchPattern(alertEvent: AlertEvent): Promise<FaultPattern | null>;
  executeRemediation(patternId: string, alertEventId: string): Promise<RemediationExecution>;

  // 执行历史
  getRemediationHistory(limit?: number): Promise<RemediationExecution[]>;
}

/**
 * 通知服务接口
 */
export interface INotificationService {
  // 渠道管理
  createChannel(channel: CreateNotificationChannelInput): Promise<NotificationChannel>;
  updateChannel(id: string, updates: UpdateNotificationChannelInput): Promise<NotificationChannel>;
  deleteChannel(id: string): Promise<void>;
  getChannels(): Promise<NotificationChannel[]>;
  testChannel(id: string): Promise<{ success: boolean; message: string }>;

  // 发送通知
  send(
    channelIds: string[],
    notification: Omit<Notification, 'id' | 'channelId' | 'status' | 'retryCount'>
  ): Promise<void>;

  // 通知历史
  getNotificationHistory(limit?: number): Promise<Notification[]>;
}

/**
 * 审计日志服务接口
 */
export interface IAuditLogger {
  log(entry: Omit<AuditLog, 'id' | 'timestamp'>): Promise<AuditLog>;
  query(options: AuditLogQueryOptions): Promise<AuditLog[]>;
  cleanup(retentionDays: number): Promise<number>;  // 返回删除的记录数
}

/**
 * AI 分析服务接口
 */
export interface IAIAnalyzer {
  // 通用分析
  analyze(request: AnalysisRequest): Promise<AnalysisResult>;

  // 特定场景分析
  analyzeAlert(alertEvent: AlertEvent, metrics: SystemMetrics): Promise<AnalysisResult>;
  analyzeHealthReport(
    metrics: HealthReport['metrics'],
    alerts: HealthReport['alerts']
  ): Promise<AnalysisResult>;
  analyzeConfigDiff(diff: SnapshotDiff): Promise<AnalysisResult>;
  confirmFaultDiagnosis(
    pattern: FaultPattern,
    alertEvent: AlertEvent
  ): Promise<{ confirmed: boolean; confidence: number; reasoning: string }>;
}

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
 * 接口状态目标值
 */
export type InterfaceStatusTarget = 'up' | 'down';

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
  targetStatus?: InterfaceStatusTarget;  // 接口状态目标值（仅用于 interface_status 类型）
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
  log(entry: Omit<AuditLog, 'id' | 'timestamp'>): Promise<AuditLog | null>;
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


// ==================== AI-Ops 智能增强类型 ====================
// Phase 1 & Phase 2 Enhancement Types

// ==================== Syslog 接收类型 ====================

/**
 * Syslog 消息
 */
export interface SyslogMessage {
  facility: number;           // Syslog facility (0-23)
  severity: number;           // Syslog severity (0-7)
  timestamp: Date;
  hostname: string;
  topic: string;              // RouterOS topic (e.g., 'system', 'firewall')
  message: string;
  raw: string;
}

/**
 * Syslog 接收配置
 */
export interface SyslogReceiverConfig {
  port: number;               // 默认 514
  enabled: boolean;
}

/**
 * 事件来源类型
 */
export type EventSource = 'syslog' | 'metrics' | 'manual' | 'api';

/**
 * Syslog 事件
 */
export interface SyslogEvent {
  id: string;
  source: 'syslog';
  timestamp: number;
  severity: AlertSeverity;
  category: string;           // 映射自 RouterOS topic
  message: string;
  rawData: SyslogMessage;
  metadata: {
    hostname: string;
    facility: number;
    syslogSeverity: number;
  };
}

// ==================== 指纹缓存类型 ====================

/**
 * 指纹条目
 */
export interface FingerprintEntry {
  fingerprint: string;
  firstSeen: number;
  lastSeen: number;
  count: number;              // 重复次数
  ttl: number;                // 过期时间戳
}

/**
 * 指纹缓存配置
 */
export interface FingerprintCacheConfig {
  defaultTtlMs: number;       // 默认 TTL，默认 5 分钟
  cleanupIntervalMs: number;  // 清理间隔，默认 1 分钟
}

/**
 * 指纹缓存统计
 */
export interface FingerprintCacheStats {
  size: number;
  suppressedCount: number;
}

// ==================== 批处理类型 ====================

/**
 * 批处理配置
 */
export interface BatchConfig {
  windowMs: number;           // 批处理窗口，默认 5000ms
  maxBatchSize: number;       // 最大批次大小，默认 20
}

/**
 * 批处理项
 */
export interface BatchItem {
  alert: AlertEvent;
  resolve: (analysis: string) => void;
  reject: (error: Error) => void;
}

// ==================== 分析缓存类型 ====================

/**
 * 缓存的分析结果
 */
export interface CachedAnalysis {
  fingerprint: string;
  analysis: string;
  createdAt: number;
  ttl: number;
  hitCount: number;
}

/**
 * 分析缓存配置
 */
export interface AnalysisCacheConfig {
  defaultTtlMs: number;       // 默认 30 分钟
  maxSize: number;            // 最大缓存条目数，默认 1000
}

/**
 * 分析缓存统计
 */
export interface AnalysisCacheStats {
  size: number;
  hitCount: number;
  missCount: number;
}

// ==================== 事件预处理类型 ====================

/**
 * 设备信息
 */
export interface DeviceInfo {
  hostname: string;
  model: string;
  version: string;
  ip: string;
}

/**
 * 告警规则信息（用于 metrics 来源的事件）
 */
export interface AlertRuleInfo {
  ruleId: string;
  ruleName: string;
  metric: string;
  threshold: number;
  currentValue: number;
}

/**
 * 统一事件格式
 */
export interface UnifiedEvent {
  id: string;
  source: EventSource;
  timestamp: number;
  severity: AlertSeverity;
  category: string;
  message: string;
  rawData: unknown;
  metadata: Record<string, unknown>;
  deviceInfo?: DeviceInfo;
  alertRuleInfo?: AlertRuleInfo;
}

/**
 * 聚合信息
 */
export interface AggregationInfo {
  count: number;
  firstSeen: number;
  lastSeen: number;
  pattern: string;            // 聚合模式描述
}

/**
 * 复合事件（聚合后的事件）
 */
export interface CompositeEvent extends UnifiedEvent {
  isComposite: true;
  childEvents: string[];      // 子事件 ID 列表
  aggregation: AggregationInfo;
}

/**
 * 聚合规则
 */
export interface AggregationRule {
  id: string;
  name: string;
  pattern: string;            // 匹配模式（字符串形式的正则）
  windowMs: number;           // 聚合时间窗口
  minCount: number;           // 最小聚合数量
  category: string;           // 事件类别
}

// ==================== 垃圾告警过滤类型 ====================

/**
 * 周期性维护窗口配置
 */
export interface RecurringSchedule {
  type: 'daily' | 'weekly' | 'monthly';
  dayOfWeek?: number[];       // 0-6, 周日-周六
  dayOfMonth?: number[];
}

/**
 * 维护窗口
 */
export interface MaintenanceWindow {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  resources: string[];        // 受影响的资源（接口名、IP 等）
  recurring?: RecurringSchedule;
  createdAt?: number;
  updatedAt?: number;
}

/**
 * 创建维护窗口输入
 */
export type CreateMaintenanceWindowInput = Omit<MaintenanceWindow, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * 更新维护窗口输入
 */
export type UpdateMaintenanceWindowInput = Partial<Omit<MaintenanceWindow, 'id' | 'createdAt' | 'updatedAt'>>;

/**
 * 已知问题
 */
export interface KnownIssue {
  id: string;
  pattern: string;            // 匹配模式（字符串形式的正则）
  description: string;
  expiresAt?: number;
  autoResolve: boolean;
  createdAt?: number;
  updatedAt?: number;
}

/**
 * 创建已知问题输入
 */
export type CreateKnownIssueInput = Omit<KnownIssue, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * 更新已知问题输入
 */
export type UpdateKnownIssueInput = Partial<Omit<KnownIssue, 'id' | 'createdAt' | 'updatedAt'>>;

/**
 * 过滤原因
 */
export type FilterReason = 'maintenance' | 'known_issue' | 'transient' | 'ai_filtered';

/**
 * 过滤结果
 */
export interface FilterResult {
  filtered: boolean;
  reason?: FilterReason;
  details?: string;
  confidence?: number;        // AI 过滤时的置信度
}

/**
 * 过滤反馈类型
 */
export type FilterFeedbackType = 'correct' | 'false_positive' | 'false_negative';

/**
 * 过滤反馈
 */
export interface FilterFeedback {
  id: string;
  alertId: string;
  filterResult: FilterResult;
  userFeedback: FilterFeedbackType;
  timestamp: number;
  userId?: string;
}

/**
 * 过滤反馈统计
 */
export interface FilterFeedbackStats {
  total: number;
  falsePositives: number;
  falseNegatives: number;
}

// ==================== 根因分析类型 ====================

/**
 * 根因
 */
export interface RootCause {
  id: string;
  description: string;
  confidence: number;         // 0-100
  evidence: string[];         // 支持证据
  relatedAlerts: string[];    // 相关告警 ID
}

/**
 * 时间线事件类型
 */
export type TimelineEventType = 'trigger' | 'symptom' | 'cause' | 'effect';

/**
 * 时间线事件
 */
export interface TimelineEvent {
  timestamp: number;
  eventId: string;
  description: string;
  type: TimelineEventType;
}

/**
 * 事件时间线
 */
export interface EventTimeline {
  events: TimelineEvent[];
  startTime: number;
  endTime: number;
}

/**
 * 影响范围
 */
export type ImpactScope = 'local' | 'partial' | 'widespread';

/**
 * 影响评估
 */
export interface ImpactAssessment {
  scope: ImpactScope;
  affectedResources: string[];
  estimatedUsers: number;
  services: string[];
  networkSegments: string[];
}

/**
 * 相似历史事件
 */
export interface SimilarIncident {
  id: string;
  timestamp: number;
  similarity: number;
  resolution?: string;
}

/**
 * 根因分析结果
 */
export interface RootCauseAnalysis {
  id: string;
  alertId: string;
  timestamp: number;
  rootCauses: RootCause[];
  timeline: EventTimeline;
  impact: ImpactAssessment;
  similarIncidents?: SimilarIncident[];
}

// ==================== 修复方案类型 ====================

/**
 * 修复步骤验证
 */
export interface StepVerification {
  command: string;            // 验证命令
  expectedResult: string;     // 期望结果描述
}

/**
 * 修复步骤
 */
export interface RemediationStep {
  order: number;
  description: string;
  command: string;            // RouterOS 命令
  verification: StepVerification;
  autoExecutable: boolean;    // 是否可自动执行
  riskLevel: RiskLevel;
  estimatedDuration: number;  // 预计耗时（秒）
}

/**
 * 回滚步骤
 */
export interface RollbackStep {
  order: number;
  description: string;
  command: string;
  condition?: string;         // 执行条件
}

/**
 * 修复方案状态
 */
export type RemediationPlanStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';

/**
 * 修复方案
 */
export interface RemediationPlan {
  id: string;
  alertId: string;
  rootCauseId: string;
  timestamp: number;
  steps: RemediationStep[];
  rollback: RollbackStep[];
  overallRisk: RiskLevel;
  estimatedDuration: number;  // 总预计耗时（秒）
  requiresConfirmation: boolean;
  status: RemediationPlanStatus;
}

/**
 * 执行结果
 */
export interface ExecutionResult {
  stepOrder: number;
  success: boolean;
  output?: string;
  error?: string;
  duration: number;
  verificationPassed?: boolean;
}

// ==================== 智能决策类型 ====================

/**
 * 决策类型
 */
export type DecisionType = 'auto_execute' | 'notify_and_wait' | 'escalate' | 'silence';

/**
 * 决策因子评估函数类型
 */
export type DecisionFactorEvaluator = (event: UnifiedEvent, context: DecisionContext) => number;

/**
 * 决策因子
 */
export interface DecisionFactor {
  name: string;
  weight: number;             // 权重 0-1
  evaluate: DecisionFactorEvaluator;
}

/**
 * 决策因子（可序列化版本，不含函数）
 */
export interface DecisionFactorConfig {
  name: string;
  weight: number;
}

/**
 * 决策上下文
 */
export interface DecisionContext {
  currentTime: Date;
  historicalSuccessRate: number;
  affectedScope: ImpactAssessment;
  recentDecisions: Decision[];
  userPreferences?: Record<string, unknown>;
}

/**
 * 决策条件运算符
 */
export type DecisionConditionOperator = 'gt' | 'lt' | 'eq' | 'gte' | 'lte';

/**
 * 决策条件
 */
export interface DecisionCondition {
  factor: string;
  operator: DecisionConditionOperator;
  value: number;
}

/**
 * 决策规则
 */
export interface DecisionRule {
  id: string;
  name: string;
  priority: number;           // 优先级，数字越小优先级越高
  conditions: DecisionCondition[];
  action: DecisionType;
  enabled: boolean;
  createdAt?: number;
  updatedAt?: number;
}

/**
 * 创建决策规则输入
 */
export type CreateDecisionRuleInput = Omit<DecisionRule, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * 更新决策规则输入
 */
export type UpdateDecisionRuleInput = Partial<Omit<DecisionRule, 'id' | 'createdAt' | 'updatedAt'>>;

/**
 * 决策因子评分
 */
export interface DecisionFactorScore {
  name: string;
  score: number;
  weight: number;
}

/**
 * 决策执行结果
 */
export interface DecisionExecutionResult {
  success: boolean;
  details: string;
}

/**
 * 决策
 */
export interface Decision {
  id: string;
  alertId: string;
  timestamp: number;
  action: DecisionType;
  reasoning: string;
  factors: DecisionFactorScore[];
  matchedRule?: string;
  executed: boolean;
  executionResult?: DecisionExecutionResult;
}

// ==================== 用户反馈类型 ====================

/**
 * 告警反馈
 */
export interface AlertFeedback {
  id: string;
  alertId: string;
  timestamp: number;
  userId?: string;
  useful: boolean;
  comment?: string;
  tags?: string[];            // 如 'false_positive', 'noise', 'important'
}

/**
 * 创建告警反馈输入
 */
export type CreateAlertFeedbackInput = Omit<AlertFeedback, 'id' | 'timestamp'>;

/**
 * 反馈统计
 */
export interface FeedbackStats {
  ruleId: string;
  totalAlerts: number;
  usefulCount: number;
  notUsefulCount: number;
  falsePositiveRate: number;
  lastUpdated: number;
}

// ==================== 告警处理流水线类型 ====================

/**
 * 流水线阶段
 */
export type PipelineStage = 'normalize' | 'deduplicate' | 'filter' | 'analyze' | 'decide';

/**
 * 流水线处理结果
 */
export interface PipelineResult {
  event: UnifiedEvent | CompositeEvent;
  stage: PipelineStage;
  filtered: boolean;
  filterResult?: FilterResult;
  analysis?: RootCauseAnalysis;
  decision?: Decision;
  plan?: RemediationPlan;
}

// ==================== 增强服务接口 ====================

/**
 * Syslog 接收服务接口
 */
export interface ISyslogReceiver {
  start(): void;
  stop(): void;
  isRunning(): boolean;
  onMessage(handler: (event: SyslogEvent) => void): void;
  getConfig(): SyslogReceiverConfig;
  updateConfig(config: Partial<SyslogReceiverConfig>): void;
}

/**
 * 指纹缓存服务接口
 */
export interface IFingerprintCache {
  generateFingerprint(alert: AlertEvent): string;
  exists(fingerprint: string): boolean;
  set(fingerprint: string, ttlMs?: number): void;
  get(fingerprint: string): FingerprintEntry | null;
  delete(fingerprint: string): void;
  cleanup(): number;
  getStats(): FingerprintCacheStats;
}

/**
 * 批处理服务接口
 */
export interface IBatchProcessor {
  add(alert: AlertEvent): Promise<string>;
  flush(): Promise<void>;
  getPendingCount(): number;
  start(): void;
  stop(): void;
}

/**
 * 分析缓存服务接口
 */
export interface IAnalysisCache {
  get(fingerprint: string): string | null;
  set(fingerprint: string, analysis: string, ttlMs?: number): void;
  cleanup(): number;
  getStats(): AnalysisCacheStats;
}

/**
 * 告警预处理服务接口
 */
export interface IAlertPreprocessor {
  normalize(event: SyslogEvent | AlertEvent): UnifiedEvent;
  aggregate(event: UnifiedEvent): UnifiedEvent | CompositeEvent;
  enrichContext(event: UnifiedEvent): Promise<UnifiedEvent>;
  process(event: SyslogEvent | AlertEvent): Promise<UnifiedEvent | CompositeEvent>;
  addAggregationRule(rule: AggregationRule): void;
  removeAggregationRule(id: string): void;
  getAggregationRules(): AggregationRule[];
}

/**
 * 垃圾过滤服务接口
 */
export interface INoiseFilter {
  filter(event: UnifiedEvent): Promise<FilterResult>;
  addMaintenanceWindow(window: MaintenanceWindow): void;
  removeMaintenanceWindow(id: string): void;
  getMaintenanceWindows(): MaintenanceWindow[];
  isInMaintenanceWindow(event: UnifiedEvent): boolean;
  addKnownIssue(issue: KnownIssue): void;
  removeKnownIssue(id: string): void;
  getKnownIssues(): KnownIssue[];
  matchesKnownIssue(event: UnifiedEvent): KnownIssue | null;
  recordFeedback(feedback: Omit<FilterFeedback, 'id' | 'timestamp'>): void;
  getFeedbackStats(): FilterFeedbackStats;
}

/**
 * 根因分析服务接口
 */
export interface IRootCauseAnalyzer {
  analyzeSingle(event: UnifiedEvent): Promise<RootCauseAnalysis>;
  analyzeCorrelated(events: UnifiedEvent[], windowMs?: number): Promise<RootCauseAnalysis>;
  generateTimeline(events: UnifiedEvent[]): EventTimeline;
  assessImpact(event: UnifiedEvent, rootCauses: RootCause[]): Promise<ImpactAssessment>;
  findSimilarIncidents(event: UnifiedEvent, limit?: number): Promise<SimilarIncident[]>;
}

/**
 * 修复方案服务接口
 */
export interface IRemediationAdvisor {
  generatePlan(analysis: RootCauseAnalysis): Promise<RemediationPlan>;
  executeStep(planId: string, stepOrder: number): Promise<ExecutionResult>;
  executeAutoSteps(planId: string): Promise<ExecutionResult[]>;
  executeRollback(planId: string): Promise<ExecutionResult[]>;
  getPlan(planId: string): Promise<RemediationPlan | null>;
  getExecutionHistory(planId: string): Promise<ExecutionResult[]>;
}

/**
 * 决策引擎服务接口
 */
export interface IDecisionEngine {
  decide(event: UnifiedEvent, analysis?: RootCauseAnalysis): Promise<Decision>;
  executeDecision(decision: Decision, plan?: RemediationPlan): Promise<void>;
  addRule(rule: DecisionRule): void;
  updateRule(id: string, updates: Partial<DecisionRule>): void;
  removeRule(id: string): void;
  getRules(): DecisionRule[];
  registerFactor(factor: DecisionFactor): void;
  getFactors(): DecisionFactor[];
  getDecisionHistory(alertId?: string, limit?: number): Promise<Decision[]>;
}

/**
 * 反馈服务接口
 */
export interface IFeedbackService {
  recordFeedback(feedback: CreateAlertFeedbackInput): Promise<AlertFeedback>;
  getFeedback(alertId: string): Promise<AlertFeedback[]>;
  getRuleStats(ruleId: string): Promise<FeedbackStats>;
  getAllRuleStats(): Promise<FeedbackStats[]>;
  getRulesNeedingReview(threshold?: number): Promise<FeedbackStats[]>;
  exportFeedback(from?: number, to?: number): Promise<AlertFeedback[]>;
}

/**
 * 告警处理流水线服务接口
 */
export interface IAlertPipeline {
  process(event: SyslogEvent | AlertEvent): Promise<PipelineResult>;
  getStats(): {
    processed: number;
    filtered: number;
    analyzed: number;
    decided: number;
  };
}

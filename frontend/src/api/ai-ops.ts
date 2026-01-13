/**
 * AI-Ops 智能运维 API 客户端
 * 前端 AI-Ops 服务 API 客户端，实现与后端 AI-Ops 服务的通信
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

import api from './index'

// ==================== 类型定义 ====================

/**
 * 告警运算符
 */
export type AlertOperator = 'gt' | 'lt' | 'eq' | 'ne' | 'gte' | 'lte'

/**
 * 告警严重级别
 */
export type AlertSeverity = 'info' | 'warning' | 'critical' | 'emergency'

/**
 * 指标类型
 */
export type MetricType = 'cpu' | 'memory' | 'disk' | 'interface_status' | 'interface_traffic'

/**
 * 通知渠道类型
 */
export type ChannelType = 'web_push' | 'webhook' | 'email'

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
  | 'snapshot_create'

/**
 * 指标数据点
 */
export interface MetricPoint {
  timestamp: number
  value: number
  labels?: Record<string, string>
}

/**
 * 系统指标
 */
export interface SystemMetrics {
  cpu: { usage: number }
  memory: { total: number; used: number; free: number; usage: number }
  disk: { total: number; used: number; free: number; usage: number }
  uptime: number
}

/**
 * 接口指标
 */
export interface InterfaceMetrics {
  name: string
  status: 'up' | 'down'
  rxBytes: number
  txBytes: number
  rxPackets: number
  txPackets: number
  rxErrors: number
  txErrors: number
}

/**
 * 指标采集配置
 */
export interface MetricsCollectorConfig {
  intervalMs: number
  retentionDays: number
  enabled: boolean
}

/**
 * 告警规则
 */
export interface AlertRule {
  id: string
  name: string
  enabled: boolean
  metric: MetricType
  metricLabel?: string
  operator: AlertOperator
  threshold: number
  duration: number
  cooldownMs: number
  severity: AlertSeverity
  channels: string[]
  autoResponse?: {
    enabled: boolean
    script: string
  }
  createdAt: number
  updatedAt: number
  lastTriggeredAt?: number
}

/**
 * 创建告警规则输入
 */
export type CreateAlertRuleInput = Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>

/**
 * 更新告警规则输入
 */
export type UpdateAlertRuleInput = Partial<Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>>

/**
 * 告警事件
 */
export interface AlertEvent {
  id: string
  ruleId: string
  ruleName: string
  severity: AlertSeverity
  metric: MetricType
  currentValue: number
  threshold: number
  message: string
  aiAnalysis?: string
  status: 'active' | 'resolved'
  triggeredAt: number
  resolvedAt?: number
  autoResponseResult?: {
    executed: boolean
    success: boolean
    output?: string
    error?: string
  }
}

/**
 * 定时任务类型
 */
export type ScheduledTaskType = 'inspection' | 'backup' | 'custom'

/**
 * 定时任务
 */
export interface ScheduledTask {
  id: string
  name: string
  type: ScheduledTaskType
  cron: string
  enabled: boolean
  lastRunAt?: number
  nextRunAt?: number
  config?: Record<string, unknown>
  createdAt: number
}

/**
 * 创建定时任务输入
 */
export type CreateScheduledTaskInput = Omit<ScheduledTask, 'id' | 'createdAt' | 'nextRunAt'>

/**
 * 更新定时任务输入
 */
export type UpdateScheduledTaskInput = Partial<Omit<ScheduledTask, 'id' | 'createdAt' | 'nextRunAt'>>

/**
 * 任务执行状态
 */
export type TaskExecutionStatus = 'running' | 'success' | 'failed'

/**
 * 任务执行记录
 */
export interface TaskExecution {
  id: string
  taskId: string
  taskName: string
  type: string
  status: TaskExecutionStatus
  startedAt: number
  completedAt?: number
  result?: unknown
  error?: string
}

/**
 * 快照触发方式
 */
export type SnapshotTrigger = 'auto' | 'manual' | 'pre-remediation'

/**
 * 配置快照
 */
export interface ConfigSnapshot {
  id: string
  timestamp: number
  trigger: SnapshotTrigger
  size: number
  checksum: string
  metadata?: {
    routerVersion?: string
    routerModel?: string
  }
}

/**
 * 风险级别
 */
export type RiskLevel = 'low' | 'medium' | 'high'

/**
 * 快照差异
 */
export interface SnapshotDiff {
  snapshotA: string
  snapshotB: string
  additions: string[]
  modifications: Array<{ path: string; oldValue: string; newValue: string }>
  deletions: string[]
  aiAnalysis?: {
    riskLevel: RiskLevel
    summary: string
    recommendations: string[]
  }
}

/**
 * 健康状态
 */
export type HealthStatus = 'healthy' | 'warning' | 'critical'

/**
 * 健康报告
 */
export interface HealthReport {
  id: string
  generatedAt: number
  period: { from: number; to: number }
  summary: {
    overallHealth: HealthStatus
    score: number
  }
  metrics: {
    cpu: { avg: number; max: number; min: number }
    memory: { avg: number; max: number; min: number }
    disk: { avg: number; max: number; min: number }
  }
  interfaces: Array<{
    name: string
    avgRxRate: number
    avgTxRate: number
    downtime: number
  }>
  alerts: {
    total: number
    bySeverity: Record<AlertSeverity, number>
    topRules: Array<{ ruleName: string; count: number }>
  }
  configChanges: number
  aiAnalysis: {
    risks: string[]
    recommendations: string[]
    trends: string[]
  }
}

/**
 * 故障模式条件
 */
export interface FaultCondition {
  metric: MetricType
  metricLabel?: string
  operator: AlertOperator
  threshold: number
}

/**
 * 故障模式
 */
export interface FaultPattern {
  id: string
  name: string
  description: string
  enabled: boolean
  autoHeal: boolean
  builtin: boolean
  conditions: FaultCondition[]
  remediationScript: string
  verificationScript?: string
  createdAt: number
  updatedAt: number
}

/**
 * 创建故障模式输入
 */
export type CreateFaultPatternInput = Omit<FaultPattern, 'id' | 'builtin' | 'createdAt' | 'updatedAt'>

/**
 * 更新故障模式输入
 */
export type UpdateFaultPatternInput = Partial<Omit<FaultPattern, 'id' | 'builtin' | 'createdAt' | 'updatedAt'>>

/**
 * 修复执行状态
 */
export type RemediationStatus = 'pending' | 'executing' | 'success' | 'failed' | 'skipped'

/**
 * 修复执行记录
 */
export interface RemediationExecution {
  id: string
  patternId: string
  patternName: string
  alertEventId: string
  status: RemediationStatus
  preSnapshotId?: string
  aiConfirmation?: {
    confirmed: boolean
    confidence: number
    reasoning: string
  }
  executionResult?: {
    output: string
    error?: string
  }
  verificationResult?: {
    passed: boolean
    message: string
  }
  startedAt: number
  completedAt?: number
}

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
  url: string
  method: 'POST' | 'PUT'
  headers?: Record<string, string>
  bodyTemplate?: string
}

/**
 * 邮件配置
 */
export interface EmailConfig {
  smtp: {
    host: string
    port: number
    secure: boolean
    auth: { user: string; pass: string }
  }
  from: string
  to: string[]
}

/**
 * 通知渠道配置联合类型
 */
export type NotificationChannelConfig = WebPushConfig | WebhookConfig | EmailConfig

/**
 * 通知渠道
 */
export interface NotificationChannel {
  id: string
  name: string
  type: ChannelType
  enabled: boolean
  config: NotificationChannelConfig
  severityFilter?: AlertSeverity[]
  createdAt: number
}

/**
 * 创建通知渠道输入
 */
export type CreateNotificationChannelInput = Omit<NotificationChannel, 'id' | 'createdAt'>

/**
 * 更新通知渠道输入
 */
export type UpdateNotificationChannelInput = Partial<Omit<NotificationChannel, 'id' | 'createdAt'>>

/**
 * 通知类型
 */
export type NotificationType = 'alert' | 'recovery' | 'report' | 'remediation'

/**
 * 通知状态
 */
export type NotificationStatus = 'pending' | 'sent' | 'failed'

/**
 * 通知
 */
export interface Notification {
  id: string
  channelId: string
  type: NotificationType
  title: string
  body: string
  data?: Record<string, unknown>
  status: NotificationStatus
  sentAt?: number
  error?: string
  retryCount: number
}

/**
 * 审计日志
 */
export interface AuditLog {
  id: string
  timestamp: number
  action: AuditAction
  actor: 'system' | 'user'
  details: {
    trigger?: string
    script?: string
    result?: string
    error?: string
    metadata?: Record<string, unknown>
  }
}

/**
 * 仪表盘数据
 */
export interface DashboardData {
  metrics: { system: SystemMetrics; interfaces: InterfaceMetrics[] } | null
  alerts: {
    active: number
    critical: number
    warning: number
    info: number
    list: AlertEvent[]
  }
  remediations: {
    recent: number
    successful: number
    list: RemediationExecution[]
  }
  reports: {
    recent: number
    list: HealthReport[]
  }
  scheduler: {
    total: number
    enabled: number
  }
  timestamp: number
}

// ==================== API 响应类型 ====================

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// ==================== 指标 API ====================

export const metricsApi = {
  /**
   * 获取最新指标
   */
  getLatest: () =>
    api.get<ApiResponse<{ system: SystemMetrics; interfaces: InterfaceMetrics[] } | null>>(
      '/ai-ops/metrics/latest'
    ),

  /**
   * 获取历史指标
   */
  getHistory: (metric: string, from: number, to: number) =>
    api.get<ApiResponse<MetricPoint[]>>('/ai-ops/metrics/history', {
      params: { metric, from, to }
    }),

  /**
   * 获取采集配置
   */
  getConfig: () => api.get<ApiResponse<MetricsCollectorConfig>>('/ai-ops/metrics/config'),

  /**
   * 更新采集配置
   */
  updateConfig: (config: Partial<MetricsCollectorConfig>) =>
    api.put<ApiResponse<MetricsCollectorConfig>>('/ai-ops/metrics/config', config),

  /**
   * 立即采集指标
   */
  collectNow: () =>
    api.post<ApiResponse<{ system: SystemMetrics; interfaces: InterfaceMetrics[] }>>(
      '/ai-ops/metrics/collect'
    )
}

// ==================== 告警规则 API ====================

export const alertRulesApi = {
  /**
   * 获取告警规则列表
   */
  getAll: () => api.get<ApiResponse<AlertRule[]>>('/ai-ops/alerts/rules'),

  /**
   * 获取单个告警规则
   */
  getById: (id: string) => api.get<ApiResponse<AlertRule>>(`/ai-ops/alerts/rules/${id}`),

  /**
   * 创建告警规则
   */
  create: (rule: CreateAlertRuleInput) =>
    api.post<ApiResponse<AlertRule>>('/ai-ops/alerts/rules', rule),

  /**
   * 更新告警规则
   */
  update: (id: string, updates: UpdateAlertRuleInput) =>
    api.put<ApiResponse<AlertRule>>(`/ai-ops/alerts/rules/${id}`, updates),

  /**
   * 删除告警规则
   */
  delete: (id: string) => api.delete<ApiResponse<void>>(`/ai-ops/alerts/rules/${id}`),

  /**
   * 启用告警规则
   */
  enable: (id: string) => api.post<ApiResponse<void>>(`/ai-ops/alerts/rules/${id}/enable`),

  /**
   * 禁用告警规则
   */
  disable: (id: string) => api.post<ApiResponse<void>>(`/ai-ops/alerts/rules/${id}/disable`)
}

// ==================== 告警事件 API ====================

export const alertEventsApi = {
  /**
   * 获取告警事件列表
   */
  getAll: (from: number, to: number) =>
    api.get<ApiResponse<AlertEvent[]>>('/ai-ops/alerts/events', {
      params: { from, to }
    }),

  /**
   * 获取活跃告警
   */
  getActive: () => api.get<ApiResponse<AlertEvent[]>>('/ai-ops/alerts/events/active'),

  /**
   * 获取单个告警事件
   */
  getById: (id: string) => api.get<ApiResponse<AlertEvent>>(`/ai-ops/alerts/events/${id}`),

  /**
   * 解决告警
   */
  resolve: (id: string) => api.post<ApiResponse<void>>(`/ai-ops/alerts/events/${id}/resolve`)
}

// ==================== 调度器 API ====================

export const schedulerApi = {
  /**
   * 获取任务列表
   */
  getTasks: () => api.get<ApiResponse<ScheduledTask[]>>('/ai-ops/scheduler/tasks'),

  /**
   * 获取单个任务
   */
  getTaskById: (id: string) => api.get<ApiResponse<ScheduledTask>>(`/ai-ops/scheduler/tasks/${id}`),

  /**
   * 创建任务
   */
  createTask: (task: CreateScheduledTaskInput) =>
    api.post<ApiResponse<ScheduledTask>>('/ai-ops/scheduler/tasks', task),

  /**
   * 更新任务
   */
  updateTask: (id: string, updates: UpdateScheduledTaskInput) =>
    api.put<ApiResponse<ScheduledTask>>(`/ai-ops/scheduler/tasks/${id}`, updates),

  /**
   * 删除任务
   */
  deleteTask: (id: string) => api.delete<ApiResponse<void>>(`/ai-ops/scheduler/tasks/${id}`),

  /**
   * 立即执行任务
   */
  runTaskNow: (id: string) =>
    api.post<ApiResponse<TaskExecution>>(`/ai-ops/scheduler/tasks/${id}/run`),

  /**
   * 获取执行历史
   */
  getExecutions: (taskId?: string, limit?: number) =>
    api.get<ApiResponse<TaskExecution[]>>('/ai-ops/scheduler/executions', {
      params: { taskId, limit }
    })
}

// ==================== 配置快照 API ====================

export const snapshotsApi = {
  /**
   * 获取快照列表
   */
  getAll: (limit?: number) =>
    api.get<ApiResponse<ConfigSnapshot[]>>('/ai-ops/snapshots', {
      params: limit ? { limit } : undefined
    }),

  /**
   * 获取单个快照
   */
  getById: (id: string) => api.get<ApiResponse<ConfigSnapshot>>(`/ai-ops/snapshots/${id}`),

  /**
   * 创建快照
   */
  create: () => api.post<ApiResponse<ConfigSnapshot>>('/ai-ops/snapshots'),

  /**
   * 删除快照
   */
  delete: (id: string) => api.delete<ApiResponse<void>>(`/ai-ops/snapshots/${id}`),

  /**
   * 下载快照
   */
  download: async (id: string): Promise<Blob> => {
    const response = await api.get(`/ai-ops/snapshots/${id}/download`, {
      responseType: 'blob'
    })
    return response.data
  },

  /**
   * 恢复快照
   */
  restore: (id: string) =>
    api.post<ApiResponse<{ success: boolean; message: string }>>(`/ai-ops/snapshots/${id}/restore`),

  /**
   * 对比快照
   */
  compare: (idA: string, idB: string) =>
    api.get<ApiResponse<SnapshotDiff>>('/ai-ops/snapshots/diff', {
      params: { idA, idB }
    }),

  /**
   * 获取最新差异
   */
  getLatestDiff: () => api.get<ApiResponse<SnapshotDiff | null>>('/ai-ops/snapshots/diff/latest'),

  /**
   * 获取变更时间线
   */
  getTimeline: (limit?: number) =>
    api.get<ApiResponse<Array<{ snapshot: ConfigSnapshot; diff?: SnapshotDiff; dangerousChanges?: unknown }>>>('/ai-ops/snapshots/timeline', {
      params: limit ? { limit } : undefined
    })
}

// ==================== 健康报告 API ====================

export const reportsApi = {
  /**
   * 获取报告列表
   */
  getAll: (limit?: number) =>
    api.get<ApiResponse<HealthReport[]>>('/ai-ops/reports', {
      params: limit ? { limit } : undefined
    }),

  /**
   * 获取单个报告
   */
  getById: (id: string) => api.get<ApiResponse<HealthReport>>(`/ai-ops/reports/${id}`),

  /**
   * 生成报告
   */
  generate: (from: number, to: number, channelIds?: string[]) =>
    api.post<ApiResponse<HealthReport>>('/ai-ops/reports/generate', {
      from,
      to,
      channelIds
    }),

  /**
   * 导出报告为 Markdown
   */
  exportMarkdown: async (id: string): Promise<Blob> => {
    const response = await api.get(`/ai-ops/reports/${id}/export`, {
      responseType: 'blob',
      params: { format: 'markdown' }
    })
    return response.data
  },

  /**
   * 导出报告为 PDF
   */
  exportPdf: async (id: string): Promise<Blob> => {
    const response = await api.get(`/ai-ops/reports/${id}/export`, {
      responseType: 'blob',
      params: { format: 'pdf' }
    })
    return response.data
  },

  /**
   * 删除报告
   */
  delete: (id: string) => api.delete<ApiResponse<void>>(`/ai-ops/reports/${id}`)
}

// ==================== 故障模式 API ====================

export const faultPatternsApi = {
  /**
   * 获取故障模式列表
   */
  getAll: () => api.get<ApiResponse<FaultPattern[]>>('/ai-ops/patterns'),

  /**
   * 获取单个故障模式
   */
  getById: (id: string) => api.get<ApiResponse<FaultPattern>>(`/ai-ops/patterns/${id}`),

  /**
   * 创建故障模式
   */
  create: (pattern: CreateFaultPatternInput) =>
    api.post<ApiResponse<FaultPattern>>('/ai-ops/patterns', pattern),

  /**
   * 更新故障模式
   */
  update: (id: string, updates: UpdateFaultPatternInput) =>
    api.put<ApiResponse<FaultPattern>>(`/ai-ops/patterns/${id}`, updates),

  /**
   * 删除故障模式
   */
  delete: (id: string) => api.delete<ApiResponse<void>>(`/ai-ops/patterns/${id}`),

  /**
   * 启用自动修复
   */
  enableAutoHeal: (id: string) =>
    api.post<ApiResponse<void>>(`/ai-ops/patterns/${id}/enable-auto-heal`),

  /**
   * 禁用自动修复
   */
  disableAutoHeal: (id: string) =>
    api.post<ApiResponse<void>>(`/ai-ops/patterns/${id}/disable-auto-heal`),

  /**
   * 手动执行修复
   */
  executeRemediation: (id: string, alertEventId: string) =>
    api.post<ApiResponse<RemediationExecution>>(`/ai-ops/patterns/${id}/execute`, {
      alertEventId
    })
}

// ==================== 修复记录 API ====================

export const remediationsApi = {
  /**
   * 获取修复历史
   */
  getAll: (limit?: number) =>
    api.get<ApiResponse<RemediationExecution[]>>('/ai-ops/remediations', {
      params: limit ? { limit } : undefined
    }),

  /**
   * 获取单个修复记录
   */
  getById: (id: string) => api.get<ApiResponse<RemediationExecution>>(`/ai-ops/remediations/${id}`)
}

// ==================== 通知渠道 API ====================

export const notificationChannelsApi = {
  /**
   * 获取渠道列表
   */
  getAll: () => api.get<ApiResponse<NotificationChannel[]>>('/ai-ops/channels'),

  /**
   * 获取单个渠道
   */
  getById: (id: string) => api.get<ApiResponse<NotificationChannel>>(`/ai-ops/channels/${id}`),

  /**
   * 创建渠道
   */
  create: (channel: CreateNotificationChannelInput) =>
    api.post<ApiResponse<NotificationChannel>>('/ai-ops/channels', channel),

  /**
   * 更新渠道
   */
  update: (id: string, updates: UpdateNotificationChannelInput) =>
    api.put<ApiResponse<NotificationChannel>>(`/ai-ops/channels/${id}`, updates),

  /**
   * 删除渠道
   */
  delete: (id: string) => api.delete<ApiResponse<void>>(`/ai-ops/channels/${id}`),

  /**
   * 测试渠道
   */
  test: (id: string) =>
    api.post<ApiResponse<{ success: boolean; message: string }>>(`/ai-ops/channels/${id}/test`),

  /**
   * 获取待推送通知
   */
  getPending: (id: string) =>
    api.get<ApiResponse<Notification[]>>(`/ai-ops/channels/${id}/pending`),

  /**
   * 获取通知历史
   */
  getHistory: (limit?: number) =>
    api.get<ApiResponse<Notification[]>>('/ai-ops/notifications/history', {
      params: limit ? { limit } : undefined
    })
}

// ==================== 审计日志 API ====================

export const auditApi = {
  /**
   * 查询审计日志
   */
  query: (options?: {
    action?: AuditAction
    from?: number
    to?: number
    limit?: number
  }) =>
    api.get<ApiResponse<AuditLog[]>>('/ai-ops/audit', {
      params: options
    })
}

// ==================== 仪表盘 API ====================

export const dashboardApi = {
  /**
   * 获取仪表盘数据
   */
  getData: () => api.get<ApiResponse<DashboardData>>('/ai-ops/dashboard')
}

// ==================== 导出统一 API 对象 ====================

export const aiOpsApi = {
  metrics: metricsApi,
  alertRules: alertRulesApi,
  alertEvents: alertEventsApi,
  scheduler: schedulerApi,
  snapshots: snapshotsApi,
  reports: reportsApi,
  faultPatterns: faultPatternsApi,
  remediations: remediationsApi,
  notificationChannels: notificationChannelsApi,
  audit: auditApi,
  dashboard: dashboardApi
}

export default aiOpsApi

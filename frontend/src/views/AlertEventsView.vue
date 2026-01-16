<template>
  <div class="alert-events-view">
    <!-- Header -->
    <div class="page-header">
      <div class="header-left">
        <el-icon :size="28" color="#e6a23c"><WarningFilled /></el-icon>
        <span class="header-title">告警事件</span>
        <el-badge v-if="activeCount > 0" :value="activeCount" type="danger" />
      </div>
      <div class="header-actions">
        <el-radio-group v-model="viewMode" size="small">
          <el-radio-button value="active">活跃告警</el-radio-button>
          <el-radio-button value="history">历史记录</el-radio-button>
        </el-radio-group>
        <el-button :icon="Refresh" :loading="loading" @click="loadEvents">
          刷新
        </el-button>
      </div>
    </div>

    <!-- Time Range Filter (for history mode) -->
    <el-card v-if="viewMode === 'history'" class="filter-card" shadow="hover">
      <el-form :inline="true" class="filter-form">
        <el-form-item label="时间范围">
          <el-date-picker
            v-model="dateRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            :shortcuts="dateShortcuts"
            value-format="x"
            @change="loadEvents"
          />
        </el-form-item>
        <el-form-item label="严重级别">
          <el-select v-model="severityFilter" placeholder="全部" clearable style="width: 120px" @change="filterEvents">
            <el-option label="信息" value="info" />
            <el-option label="警告" value="warning" />
            <el-option label="严重" value="critical" />
            <el-option label="紧急" value="emergency" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="statusFilter" placeholder="全部" clearable style="width: 120px" @change="filterEvents">
            <el-option label="活跃" value="active" />
            <el-option label="已恢复" value="resolved" />
          </el-select>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- Batch Actions Bar -->
    <el-card v-if="activeEvents.length > 0" class="batch-actions-card" shadow="hover">
      <div class="batch-actions">
        <div class="select-actions">
          <el-checkbox
            v-model="selectAll"
            :indeterminate="isIndeterminate"
            @change="(val: any) => handleSelectAllChange(!!val)"
          >
            全选活跃告警
          </el-checkbox>
          <span class="selected-count" v-if="selectedEvents.length > 0">
            已选择 {{ selectedEvents.length }} 项
          </span>
        </div>
        <div class="action-buttons">
          <el-button
            type="success"
            :disabled="selectedEvents.length === 0"
            :loading="batchResolving"
            @click="batchResolveEvents"
          >
            <el-icon><CircleCheckFilled /></el-icon>
            批量解决 ({{ selectedEvents.length }})
          </el-button>
          <el-button
            v-if="selectedEvents.length > 0"
            @click="clearSelection"
          >
            清除选择
          </el-button>
        </div>
      </div>
    </el-card>

    <!-- Loading State -->
    <el-skeleton v-if="loading && events.length === 0" :rows="5" animated />

    <!-- Error State -->
    <el-alert
      v-else-if="error"
      :title="error"
      type="error"
      show-icon
      closable
      @close="error = ''"
    >
      <template #default>
        <el-button type="primary" size="small" @click="loadEvents">
          重新加载
        </el-button>
      </template>
    </el-alert>

    <!-- Empty State -->
    <el-card v-else-if="filteredEvents.length === 0" shadow="hover">
      <el-empty :description="viewMode === 'active' ? '暂无活跃告警' : '暂无告警记录'" />
    </el-card>

    <!-- Events List -->
    <div v-else class="events-list">
      <el-card
        v-for="event in filteredEvents"
        :key="event.id"
        class="event-card"
        :class="{ 
          'event-active': event.status === 'active',
          'event-selected': isSelected(event.id)
        }"
        shadow="hover"
        @click="showEventDetail(event)"
      >
        <div class="event-header">
          <div class="event-severity">
            <el-checkbox
              v-if="event.status === 'active'"
              :model-value="isSelected(event.id)"
              @click.stop
              @change="(val: any) => toggleSelection(event.id, !!val)"
            />
            <el-icon :color="getSeverityColor(event.severity)" :size="24">
              <WarningFilled />
            </el-icon>
            <el-tag :type="getSeverityType(event.severity)" size="small">
              {{ getSeverityText(event.severity) }}
            </el-tag>
          </div>
          <div class="event-status">
            <el-tag :type="event.status === 'active' ? 'danger' : 'success'" size="small">
              {{ event.status === 'active' ? '活跃' : '已恢复' }}
            </el-tag>
          </div>
        </div>

        <div class="event-body">
          <div class="event-title">{{ event.ruleName }}</div>
          <div class="event-message">{{ event.message }}</div>
          <div class="event-metrics">
            <span class="metric-item">
              <el-icon><Odometer /></el-icon>
              {{ getMetricText(event.metric) }}: {{ event.currentValue }}{{ getMetricUnit(event.metric) }}
            </span>
            <span class="metric-item">
              <el-icon><Aim /></el-icon>
              阈值: {{ event.threshold }}{{ getMetricUnit(event.metric) }}
            </span>
          </div>
        </div>

        <div class="event-footer">
          <div class="event-time">
            <el-icon><Clock /></el-icon>
            <span>触发时间: {{ formatTime(event.triggeredAt) }}</span>
            <span v-if="event.resolvedAt" class="resolved-time">
              | 恢复时间: {{ formatTime(event.resolvedAt) }}
            </span>
          </div>
          <div class="event-actions">
            <el-button
              v-if="event.status === 'active'"
              type="success"
              size="small"
              @click.stop="resolveEvent(event)"
            >
              手动解决
            </el-button>
            <el-button type="primary" size="small" text @click.stop="showEventDetail(event)">
              查看详情
            </el-button>
          </div>
        </div>

        <!-- Auto Response Result -->
        <div v-if="event.autoResponseResult" class="auto-response-result">
          <el-divider />
          <div class="response-header">
            <el-icon :color="event.autoResponseResult.success ? '#67c23a' : '#f56c6c'">
              <component :is="event.autoResponseResult.success ? CircleCheckFilled : CircleCloseFilled" />
            </el-icon>
            <span>自动响应: {{ event.autoResponseResult.success ? '执行成功' : '执行失败' }}</span>
          </div>
          <div v-if="event.autoResponseResult.output" class="response-output">
            {{ event.autoResponseResult.output }}
          </div>
          <div v-if="event.autoResponseResult.error" class="response-error">
            {{ event.autoResponseResult.error }}
          </div>
        </div>
      </el-card>
    </div>

    <!-- Event Detail Dialog -->
    <el-dialog
      v-model="detailVisible"
      title="告警事件详情"
      width="900px"
      destroy-on-close
      @open="loadEventAnalysis"
    >
      <template v-if="selectedEvent">
        <!-- Basic Info -->
        <el-descriptions :column="2" border>
          <el-descriptions-item label="规则名称" :span="2">{{ selectedEvent.ruleName }}</el-descriptions-item>
          <el-descriptions-item label="严重级别">
            <el-tag :type="getSeverityType(selectedEvent.severity)" size="small">
              {{ getSeverityText(selectedEvent.severity) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="selectedEvent.status === 'active' ? 'danger' : 'success'" size="small">
              {{ selectedEvent.status === 'active' ? '活跃' : '已恢复' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="指标类型">{{ getMetricText(selectedEvent.metric) }}</el-descriptions-item>
          <el-descriptions-item label="当前值">{{ selectedEvent.currentValue }}{{ getMetricUnit(selectedEvent.metric) }}</el-descriptions-item>
          <el-descriptions-item label="阈值">{{ selectedEvent.threshold }}{{ getMetricUnit(selectedEvent.metric) }}</el-descriptions-item>
          <el-descriptions-item label="规则 ID">{{ selectedEvent.ruleId }}</el-descriptions-item>
          <el-descriptions-item label="触发时间">{{ formatTime(selectedEvent.triggeredAt) }}</el-descriptions-item>
          <el-descriptions-item label="恢复时间">{{ selectedEvent.resolvedAt ? formatTime(selectedEvent.resolvedAt) : '-' }}</el-descriptions-item>
          <el-descriptions-item label="告警消息" :span="2">{{ selectedEvent.message }}</el-descriptions-item>
        </el-descriptions>

        <!-- Tabs for Analysis, Timeline, Remediation -->
        <el-tabs v-model="activeTab" class="detail-tabs">
          <!-- AI Root Cause Analysis Tab -->
          <el-tab-pane label="AI 根因分析" name="analysis">
            <div v-if="analysisLoading" class="loading-container">
              <el-skeleton :rows="4" animated />
            </div>
            <div v-else-if="rootCauseAnalysis" class="analysis-content">
              <!-- Root Causes -->
              <div class="section-title">
                <el-icon><DataAnalysis /></el-icon>
                根因分析
              </div>
              <div v-for="(cause, index) in rootCauseAnalysis.rootCauses" :key="cause.id" class="root-cause-item">
                <div class="cause-header">
                  <span class="cause-index">#{{ index + 1 }}</span>
                  <el-progress
                    :percentage="Math.round(cause.confidence)"
                    :color="getConfidenceColor(cause.confidence / 100)"
                    :stroke-width="8"
                    style="width: 120px"
                  />
                  <span class="confidence-text">置信度 {{ Math.round(cause.confidence) }}%</span>
                </div>
                <div class="cause-description">{{ cause.description }}</div>
                <div v-if="cause.evidence.length > 0" class="cause-evidence">
                  <span class="evidence-label">证据:</span>
                  <el-tag v-for="(ev, i) in cause.evidence" :key="i" size="small" type="info" class="evidence-tag">
                    {{ ev }}
                  </el-tag>
                </div>
              </div>

              <!-- Impact Assessment -->
              <div v-if="rootCauseAnalysis.impact" class="impact-section">
                <div class="section-title">
                  <el-icon><Warning /></el-icon>
                  影响评估
                </div>
                <el-descriptions :column="2" border size="small">
                  <el-descriptions-item label="影响范围">
                    <el-tag :type="getImpactScopeType(rootCauseAnalysis.impact.scope)">
                      {{ getImpactScopeText(rootCauseAnalysis.impact.scope) }}
                    </el-tag>
                  </el-descriptions-item>
                  <el-descriptions-item label="预估影响用户">
                    {{ rootCauseAnalysis.impact.estimatedUsers }}
                  </el-descriptions-item>
                  <el-descriptions-item label="受影响资源" :span="2">
                    <el-tag v-for="res in rootCauseAnalysis.impact.affectedResources" :key="res" size="small" class="resource-tag">
                      {{ res }}
                    </el-tag>
                  </el-descriptions-item>
                </el-descriptions>
              </div>

              <!-- Similar Incidents -->
              <div v-if="rootCauseAnalysis.similarIncidents?.length" class="similar-section">
                <div class="section-title">
                  <el-icon><Document /></el-icon>
                  相似历史事件
                </div>
                <el-table :data="rootCauseAnalysis.similarIncidents" size="small" stripe>
                  <el-table-column prop="timestamp" label="时间" width="180">
                    <template #default="{ row }">{{ formatTime(row.timestamp) }}</template>
                  </el-table-column>
                  <el-table-column prop="similarity" label="相似度" width="120">
                    <template #default="{ row }">
                      <el-progress :percentage="Math.round(row.similarity * 100)" :stroke-width="6" />
                    </template>
                  </el-table-column>
                  <el-table-column prop="resolution" label="解决方案" />
                </el-table>
              </div>
            </div>
            <el-empty v-else description="暂无根因分析数据">
              <el-button type="primary" @click="refreshAnalysis">生成分析</el-button>
            </el-empty>
          </el-tab-pane>

          <!-- Event Timeline Tab -->
          <el-tab-pane label="事件时间线" name="timeline">
            <div v-if="analysisLoading" class="loading-container">
              <el-skeleton :rows="4" animated />
            </div>
            <div v-else-if="eventTimeline && eventTimeline.events.length > 0" class="timeline-content">
              <el-timeline>
                <el-timeline-item
                  v-for="item in eventTimeline.events"
                  :key="item.eventId"
                  :timestamp="formatTime(item.timestamp)"
                  :type="getTimelineItemType(item.type)"
                  :hollow="item.type === 'symptom'"
                  placement="top"
                >
                  <div class="timeline-item-content">
                    <el-tag :type="getTimelineTagType(item.type)" size="small">
                      {{ getTimelineTypeText(item.type) }}
                    </el-tag>
                    <span class="timeline-description">{{ item.description }}</span>
                  </div>
                </el-timeline-item>
              </el-timeline>
            </div>
            <el-empty v-else description="暂无时间线数据" />
          </el-tab-pane>

          <!-- Related Alerts Tab -->
          <el-tab-pane label="关联告警" name="related">
            <div v-if="relatedLoading" class="loading-container">
              <el-skeleton :rows="3" animated />
            </div>
            <div v-else-if="relatedAlerts.length > 0" class="related-content">
              <el-table :data="relatedAlerts" size="small" stripe @row-click="switchToAlert">
                <el-table-column prop="ruleName" label="规则名称" />
                <el-table-column prop="severity" label="严重级别" width="100">
                  <template #default="{ row }">
                    <el-tag :type="getSeverityType(row.severity)" size="small">
                      {{ getSeverityText(row.severity) }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="status" label="状态" width="80">
                  <template #default="{ row }">
                    <el-tag :type="row.status === 'active' ? 'danger' : 'success'" size="small">
                      {{ row.status === 'active' ? '活跃' : '已恢复' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="triggeredAt" label="触发时间" width="180">
                  <template #default="{ row }">{{ formatTime(row.triggeredAt) }}</template>
                </el-table-column>
              </el-table>
            </div>
            <el-empty v-else description="暂无关联告警" />
          </el-tab-pane>

          <!-- Remediation Plan Tab -->
          <el-tab-pane label="修复方案" name="remediation">
            <div v-if="remediationLoading" class="loading-container">
              <el-skeleton :rows="4" animated />
            </div>
            <div v-else-if="remediationPlan" class="remediation-content">
              <!-- Plan Overview -->
              <div class="plan-overview">
                <el-descriptions :column="3" border size="small">
                  <el-descriptions-item label="整体风险">
                    <el-tag :type="getRiskType(remediationPlan.overallRisk)">
                      {{ getRiskText(remediationPlan.overallRisk) }}
                    </el-tag>
                  </el-descriptions-item>
                  <el-descriptions-item label="预估时间">
                    {{ formatDuration(remediationPlan.estimatedDuration) }}
                  </el-descriptions-item>
                  <el-descriptions-item label="状态">
                    <el-tag :type="getPlanStatusType(remediationPlan.status)">
                      {{ getPlanStatusText(remediationPlan.status) }}
                    </el-tag>
                  </el-descriptions-item>
                </el-descriptions>
              </div>

              <!-- Remediation Steps -->
              <div class="section-title">
                <el-icon><List /></el-icon>
                修复步骤
              </div>
              <el-steps :active="currentExecutingStep" direction="vertical" class="remediation-steps">
                <el-step
                  v-for="step in remediationPlan.steps"
                  :key="step.order"
                  :title="`步骤 ${step.order}: ${step.description}`"
                  :status="getStepStatus(step.order)"
                >
                  <template #description>
                    <div class="step-detail">
                      <div class="step-command">
                        <span class="command-label">命令:</span>
                        <el-tag type="info" class="command-tag">{{ step.command }}</el-tag>
                      </div>
                      <div class="step-meta">
                        <el-tag :type="getRiskType(step.riskLevel)" size="small">
                          风险: {{ getRiskText(step.riskLevel) }}
                        </el-tag>
                        <el-tag v-if="step.autoExecutable" type="success" size="small">
                          <el-icon><Check /></el-icon> 可自动执行
                        </el-tag>
                        <el-tag v-else type="warning" size="small">
                          <el-icon><User /></el-icon> 需手动确认
                        </el-tag>
                        <span class="step-duration">预估: {{ formatDuration(step.estimatedDuration) }}</span>
                      </div>
                      <!-- Execution Result -->
                      <div v-if="getStepResult(step.order)" class="step-result">
                        <el-alert
                          :type="getStepResult(step.order)?.success ? 'success' : 'error'"
                          :title="getStepResult(step.order)?.success ? '执行成功' : '执行失败'"
                          :closable="false"
                          show-icon
                        >
                          <template v-if="getStepResult(step.order)?.output">
                            <pre class="result-output">{{ getStepResult(step.order)?.output }}</pre>
                          </template>
                          <template v-if="getStepResult(step.order)?.error">
                            <pre class="result-error">{{ getStepResult(step.order)?.error }}</pre>
                          </template>
                        </el-alert>
                      </div>
                    </div>
                  </template>
                </el-step>
              </el-steps>

              <!-- Action Buttons -->
              <div class="remediation-actions">
                <el-button
                  v-if="remediationPlan.status === 'pending'"
                  type="primary"
                  :loading="executing"
                  @click="executeRemediation"
                >
                  <el-icon><VideoPlay /></el-icon>
                  一键执行自动步骤
                </el-button>
                <el-button
                  v-if="remediationPlan.status === 'completed' || remediationPlan.status === 'failed'"
                  type="warning"
                  :loading="rollingBack"
                  @click="executeRollback"
                >
                  <el-icon><RefreshLeft /></el-icon>
                  执行回滚
                </el-button>
              </div>

              <!-- Rollback Steps -->
              <div v-if="remediationPlan.rollback.length > 0" class="rollback-section">
                <el-collapse>
                  <el-collapse-item title="回滚步骤" name="rollback">
                    <div v-for="step in remediationPlan.rollback" :key="step.order" class="rollback-step">
                      <span class="rollback-order">{{ step.order }}.</span>
                      <span class="rollback-desc">{{ step.description }}</span>
                      <el-tag type="info" size="small">{{ step.command }}</el-tag>
                    </div>
                  </el-collapse-item>
                </el-collapse>
              </div>
            </div>
            <el-empty v-else description="暂无修复方案">
              <el-button type="primary" :loading="generatingPlan" @click="generateRemediationPlan">
                生成修复方案
              </el-button>
            </el-empty>
          </el-tab-pane>
        </el-tabs>

        <!-- User Feedback Section -->
        <div class="feedback-section">
          <el-divider content-position="left">
            <el-icon><ChatLineSquare /></el-icon>
            反馈评价
          </el-divider>
          <div class="feedback-content">
            <span class="feedback-label">此告警分析对您有帮助吗？</span>
            <div class="feedback-buttons">
              <el-button
                :type="feedbackSubmitted === 'useful' ? 'success' : 'default'"
                :disabled="feedbackSubmitted !== null"
                @click="submitFeedback(true)"
              >
                <el-icon><CircleCheckFilled /></el-icon>
                有用
              </el-button>
              <el-button
                :type="feedbackSubmitted === 'not_useful' ? 'danger' : 'default'"
                :disabled="feedbackSubmitted !== null"
                @click="submitFeedback(false)"
              >
                <el-icon><CircleCloseFilled /></el-icon>
                无用
              </el-button>
            </div>
            <el-input
              v-if="feedbackSubmitted"
              v-model="feedbackComment"
              type="textarea"
              :rows="2"
              placeholder="可选：添加更多反馈意见..."
              class="feedback-comment"
              @blur="updateFeedbackComment"
            />
          </div>
        </div>

        <!-- Legacy AI Analysis Section (for backward compatibility) -->
        <div v-if="selectedEvent.aiAnalysis && !rootCauseAnalysis" class="ai-analysis-section">
          <el-divider content-position="left">
            <el-icon><MagicStick /></el-icon>
            AI 分析
          </el-divider>
          <div class="ai-analysis-content">
            <el-icon color="#409eff" :size="20"><ChatDotRound /></el-icon>
            <div class="analysis-text">{{ selectedEvent.aiAnalysis }}</div>
          </div>
        </div>

        <!-- Auto Response Section -->
        <div v-if="selectedEvent.autoResponseResult" class="auto-response-section">
          <el-divider content-position="left">
            <el-icon><Operation /></el-icon>
            自动响应结果
          </el-divider>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="执行状态">
              <el-tag :type="selectedEvent.autoResponseResult.success ? 'success' : 'danger'" size="small">
                {{ selectedEvent.autoResponseResult.success ? '成功' : '失败' }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item v-if="selectedEvent.autoResponseResult.output" label="输出">
              <pre class="response-pre">{{ selectedEvent.autoResponseResult.output }}</pre>
            </el-descriptions-item>
            <el-descriptions-item v-if="selectedEvent.autoResponseResult.error" label="错误">
              <pre class="response-pre error">{{ selectedEvent.autoResponseResult.error }}</pre>
            </el-descriptions-item>
          </el-descriptions>
        </div>
      </template>

      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
        <el-button
          v-if="selectedEvent?.status === 'active'"
          type="success"
          @click="resolveEvent(selectedEvent!)"
        >
          手动解决
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Refresh,
  WarningFilled,
  Clock,
  Odometer,
  Aim,
  CircleCheckFilled,
  CircleCloseFilled,
  MagicStick,
  ChatDotRound,
  Operation,
  DataAnalysis,
  Warning,
  Document,
  List,
  Check,
  User,
  VideoPlay,
  RefreshLeft,
  ChatLineSquare
} from '@element-plus/icons-vue'
import {
  alertEventsApi,
  analysisApi,
  remediationPlansApi,
  feedbackApi,
  type AlertEvent,
  type AlertSeverity,
  type MetricType,
  type RootCauseAnalysis,
  type EventTimeline,
  type RemediationPlan,
  type ExecutionResult,
  type RiskLevel,
  type RemediationPlanStatus,
  type TimelineEventType,
  type ImpactScope
} from '@/api/ai-ops'

const route = useRoute()

// State
const loading = ref(false)
const error = ref('')
const events = ref<AlertEvent[]>([])
const viewMode = ref<'active' | 'history'>('active')
const detailVisible = ref(false)
const selectedEvent = ref<AlertEvent | null>(null)
const activeTab = ref('analysis')

// Selection state
const selectedIds = ref<Set<string>>(new Set())
const batchResolving = ref(false)

// Filters
const dateRange = ref<[number, number] | null>(null)
const severityFilter = ref<AlertSeverity | ''>('')
const statusFilter = ref<'active' | 'resolved' | ''>('')

// Analysis state
const analysisLoading = ref(false)
const rootCauseAnalysis = ref<RootCauseAnalysis | null>(null)
const eventTimeline = ref<EventTimeline | null>(null)

// Related alerts state
const relatedLoading = ref(false)
const relatedAlerts = ref<AlertEvent[]>([])

// Remediation state
const remediationLoading = ref(false)
const remediationPlan = ref<RemediationPlan | null>(null)
const executionResults = ref<ExecutionResult[]>([])
const executing = ref(false)
const rollingBack = ref(false)
const generatingPlan = ref(false)
const currentExecutingStep = ref(-1)

// Feedback state
const feedbackSubmitted = ref<'useful' | 'not_useful' | null>(null)
const feedbackComment = ref('')

// Date shortcuts
const dateShortcuts = [
  {
    text: '最近1小时',
    value: () => {
      const end = Date.now()
      const start = end - 3600 * 1000
      return [start, end]
    }
  },
  {
    text: '最近24小时',
    value: () => {
      const end = Date.now()
      const start = end - 24 * 3600 * 1000
      return [start, end]
    }
  },
  {
    text: '最近7天',
    value: () => {
      const end = Date.now()
      const start = end - 7 * 24 * 3600 * 1000
      return [start, end]
    }
  },
  {
    text: '最近30天',
    value: () => {
      const end = Date.now()
      const start = end - 30 * 24 * 3600 * 1000
      return [start, end]
    }
  }
]

// Computed
const activeCount = computed(() => {
  return events.value.filter(e => e.status === 'active').length
})

const activeEvents = computed(() => {
  return events.value.filter(e => e.status === 'active')
})

const selectedEvents = computed(() => {
  return activeEvents.value.filter(e => selectedIds.value.has(e.id))
})

const selectAll = computed({
  get: () => {
    return activeEvents.value.length > 0 && selectedIds.value.size === activeEvents.value.length
  },
  set: () => {}
})

const isIndeterminate = computed(() => {
  return selectedIds.value.size > 0 && selectedIds.value.size < activeEvents.value.length
})

const filteredEvents = computed(() => {
  let result = events.value

  if (severityFilter.value) {
    result = result.filter(e => e.severity === severityFilter.value)
  }

  if (statusFilter.value) {
    result = result.filter(e => e.status === statusFilter.value)
  }

  return result.sort((a, b) => b.triggeredAt - a.triggeredAt)
})

// Selection methods
const isSelected = (id: string): boolean => {
  return selectedIds.value.has(id)
}

const toggleSelection = (id: string, selected: boolean) => {
  if (selected) {
    selectedIds.value.add(id)
  } else {
    selectedIds.value.delete(id)
  }
  selectedIds.value = new Set(selectedIds.value)
}

const handleSelectAllChange = (val: boolean) => {
  if (val) {
    activeEvents.value.forEach(e => selectedIds.value.add(e.id))
  } else {
    selectedIds.value.clear()
  }
  selectedIds.value = new Set(selectedIds.value)
}

const clearSelection = () => {
  selectedIds.value.clear()
  selectedIds.value = new Set(selectedIds.value)
}

// Batch resolve
const batchResolveEvents = async () => {
  if (selectedEvents.value.length === 0) return

  try {
    await ElMessageBox.confirm(
      `确定要批量解决选中的 ${selectedEvents.value.length} 个告警吗？`,
      '批量解决告警',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    batchResolving.value = true
    let successCount = 0
    let failCount = 0

    for (const event of selectedEvents.value) {
      try {
        await alertEventsApi.resolve(event.id)
        successCount++
      } catch {
        failCount++
      }
    }

    if (failCount === 0) {
      ElMessage.success(`成功解决 ${successCount} 个告警`)
    } else {
      ElMessage.warning(`成功 ${successCount} 个，失败 ${failCount} 个`)
    }

    clearSelection()
    await loadEvents()
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error('批量操作失败')
    }
  } finally {
    batchResolving.value = false
  }
}

// Watch view mode changes
watch(viewMode, () => {
  clearSelection()
  loadEvents()
})

// Load events on mount
onMounted(() => {
  const eventId = route.query.id as string
  if (eventId) {
    loadEventById(eventId)
  }

  const end = Date.now()
  const start = end - 24 * 3600 * 1000
  dateRange.value = [start, end]

  loadEvents()
})

// Load events
const loadEvents = async () => {
  loading.value = true
  error.value = ''

  try {
    let response
    if (viewMode.value === 'active') {
      response = await alertEventsApi.getActive()
    } else {
      const [from, to] = dateRange.value || [Date.now() - 24 * 3600 * 1000, Date.now()]
      response = await alertEventsApi.getAll(from, to)
    }

    if (response.data.success && response.data.data) {
      events.value = response.data.data
    } else {
      throw new Error(response.data.error || '获取告警事件失败')
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取告警事件失败'
    error.value = message
    ElMessage.error(message)
  } finally {
    loading.value = false
  }
}

// Load single event by ID
const loadEventById = async (id: string) => {
  try {
    const response = await alertEventsApi.getById(id)
    if (response.data.success && response.data.data) {
      selectedEvent.value = response.data.data
      detailVisible.value = true
    }
  } catch (err) {
    console.error('Failed to load event:', err)
  }
}

// Filter events
const filterEvents = () => {
  // Filtering is done in computed property
}

// Show event detail
const showEventDetail = (event: AlertEvent) => {
  selectedEvent.value = event
  detailVisible.value = true
  // Reset states
  activeTab.value = 'analysis'
  rootCauseAnalysis.value = null
  eventTimeline.value = null
  relatedAlerts.value = []
  remediationPlan.value = null
  executionResults.value = []
  feedbackSubmitted.value = null
  feedbackComment.value = ''
}

// Load event analysis data
const loadEventAnalysis = async () => {
  if (!selectedEvent.value) return

  // Load root cause analysis
  analysisLoading.value = true
  try {
    const response = await analysisApi.getAnalysis(selectedEvent.value.id)
    if (response.data.success && response.data.data) {
      rootCauseAnalysis.value = response.data.data
      eventTimeline.value = response.data.data.timeline
    }
  } catch (err) {
    console.error('Failed to load analysis:', err)
  } finally {
    analysisLoading.value = false
  }

  // Load related alerts
  relatedLoading.value = true
  try {
    const response = await analysisApi.getRelatedAlerts(selectedEvent.value.id)
    if (response.data.success && response.data.data) {
      relatedAlerts.value = response.data.data.filter(a => a.id !== selectedEvent.value?.id)
    }
  } catch (err) {
    console.error('Failed to load related alerts:', err)
  } finally {
    relatedLoading.value = false
  }

  // Load remediation plan
  remediationLoading.value = true
  try {
    const response = await remediationPlansApi.getPlan(selectedEvent.value.id)
    if (response.data.success && response.data.data) {
      remediationPlan.value = response.data.data
    }
  } catch (err) {
    console.error('Failed to load remediation plan:', err)
  } finally {
    remediationLoading.value = false
  }
}

// Refresh analysis
const refreshAnalysis = async () => {
  if (!selectedEvent.value) return

  analysisLoading.value = true
  try {
    const response = await analysisApi.refreshAnalysis(selectedEvent.value.id)
    if (response.data.success && response.data.data) {
      rootCauseAnalysis.value = response.data.data
      eventTimeline.value = response.data.data.timeline
      ElMessage.success('分析已更新')
    }
  } catch (err) {
    ElMessage.error('刷新分析失败')
  } finally {
    analysisLoading.value = false
  }
}

// Generate remediation plan
const generateRemediationPlan = async () => {
  if (!selectedEvent.value) return

  generatingPlan.value = true
  try {
    const response = await remediationPlansApi.generatePlan(selectedEvent.value.id)
    if (response.data.success && response.data.data) {
      remediationPlan.value = response.data.data
      ElMessage.success('修复方案已生成')
    }
  } catch (err) {
    ElMessage.error('生成修复方案失败')
  } finally {
    generatingPlan.value = false
  }
}

// Execute remediation
const executeRemediation = async () => {
  if (!remediationPlan.value) return

  try {
    await ElMessageBox.confirm(
      '确定要执行修复方案吗？将自动执行所有可自动执行的步骤。',
      '执行修复',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    executing.value = true
    currentExecutingStep.value = 0

    const response = await remediationPlansApi.executePlan(remediationPlan.value.id)
    if (response.data.success && response.data.data) {
      executionResults.value = response.data.data
      // Reload plan to get updated status
      const planResponse = await remediationPlansApi.getPlan(selectedEvent.value!.id)
      if (planResponse.data.success && planResponse.data.data) {
        remediationPlan.value = planResponse.data.data
      }
      ElMessage.success('修复执行完成')
    }
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error('执行修复失败')
    }
  } finally {
    executing.value = false
    currentExecutingStep.value = -1
  }
}

// Execute rollback
const executeRollback = async () => {
  if (!remediationPlan.value) return

  try {
    await ElMessageBox.confirm(
      '确定要执行回滚吗？这将撤销之前的修复操作。',
      '执行回滚',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    rollingBack.value = true
    const response = await remediationPlansApi.executeRollback(remediationPlan.value.id)
    if (response.data.success) {
      // Reload plan
      const planResponse = await remediationPlansApi.getPlan(selectedEvent.value!.id)
      if (planResponse.data.success && planResponse.data.data) {
        remediationPlan.value = planResponse.data.data
      }
      ElMessage.success('回滚执行完成')
    }
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error('执行回滚失败')
    }
  } finally {
    rollingBack.value = false
  }
}

// Get step execution result
const getStepResult = (stepOrder: number): ExecutionResult | undefined => {
  return executionResults.value.find(r => r.stepOrder === stepOrder)
}

// Get step status for el-steps
const getStepStatus = (stepOrder: number): 'wait' | 'process' | 'finish' | 'error' | 'success' => {
  const result = getStepResult(stepOrder)
  if (result) {
    return result.success ? 'success' : 'error'
  }
  if (currentExecutingStep.value === stepOrder - 1) {
    return 'process'
  }
  return 'wait'
}

// Switch to another alert
const switchToAlert = (row: AlertEvent) => {
  selectedEvent.value = row
  loadEventAnalysis()
}

// Submit feedback
const submitFeedback = async (useful: boolean) => {
  if (!selectedEvent.value) return

  try {
    await feedbackApi.submit({
      alertId: selectedEvent.value.id,
      useful,
      comment: feedbackComment.value || undefined
    })
    feedbackSubmitted.value = useful ? 'useful' : 'not_useful'
    ElMessage.success('感谢您的反馈')
  } catch (err) {
    ElMessage.error('提交反馈失败')
  }
}

// Update feedback comment
const updateFeedbackComment = async () => {
  // Comment is included in the initial feedback submission
  // This is just for UI purposes
}

// Resolve event
const resolveEvent = async (event: AlertEvent) => {
  try {
    await ElMessageBox.confirm(
      '确定要手动解决此告警吗？这将标记告警为已恢复状态。',
      '确认操作',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await alertEventsApi.resolve(event.id)
    ElMessage.success('告警已解决')
    detailVisible.value = false
    await loadEvents()
  } catch (err) {
    if (err !== 'cancel') {
      const message = err instanceof Error ? err.message : '操作失败'
      ElMessage.error(message)
    }
  }
}

// Utility functions
const getMetricText = (metric: MetricType): string => {
  const texts: Record<MetricType, string> = {
    cpu: 'CPU 使用率',
    memory: '内存使用率',
    disk: '磁盘使用率',
    interface_status: '接口状态',
    interface_traffic: '接口流量'
  }
  return texts[metric] || metric
}

const getMetricUnit = (metric: MetricType): string => {
  if (metric === 'cpu' || metric === 'memory' || metric === 'disk') {
    return '%'
  }
  if (metric === 'interface_traffic') {
    return ' B/s'
  }
  return ''
}

const getSeverityColor = (severity: AlertSeverity): string => {
  const colors: Record<AlertSeverity, string> = {
    info: '#909399',
    warning: '#e6a23c',
    critical: '#f56c6c',
    emergency: '#f56c6c'
  }
  return colors[severity]
}

const getSeverityType = (severity: AlertSeverity): 'info' | 'warning' | 'danger' => {
  const types: Record<AlertSeverity, 'info' | 'warning' | 'danger'> = {
    info: 'info',
    warning: 'warning',
    critical: 'danger',
    emergency: 'danger'
  }
  return types[severity]
}

const getSeverityText = (severity: AlertSeverity): string => {
  const texts: Record<AlertSeverity, string> = {
    info: '信息',
    warning: '警告',
    critical: '严重',
    emergency: '紧急'
  }
  return texts[severity]
}

const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString('zh-CN')
}

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${Math.round(ms / 1000)}秒`
  if (ms < 3600000) return `${Math.round(ms / 60000)}分钟`
  return `${Math.round(ms / 3600000)}小时`
}

const getConfidenceColor = (confidence: number): string => {
  if (confidence >= 0.8) return '#67c23a'
  if (confidence >= 0.5) return '#e6a23c'
  return '#f56c6c'
}

const getImpactScopeType = (scope: ImpactScope): 'success' | 'warning' | 'danger' => {
  const types: Record<ImpactScope, 'success' | 'warning' | 'danger'> = {
    local: 'success',
    partial: 'warning',
    widespread: 'danger'
  }
  return types[scope]
}

const getImpactScopeText = (scope: ImpactScope): string => {
  const texts: Record<ImpactScope, string> = {
    local: '局部',
    partial: '部分',
    widespread: '广泛'
  }
  return texts[scope]
}

const getTimelineItemType = (type: TimelineEventType): 'primary' | 'success' | 'warning' | 'danger' | 'info' => {
  const types: Record<TimelineEventType, 'primary' | 'success' | 'warning' | 'danger' | 'info'> = {
    trigger: 'danger',
    symptom: 'warning',
    cause: 'primary',
    effect: 'info'
  }
  return types[type]
}

const getTimelineTagType = (type: TimelineEventType): 'primary' | 'success' | 'warning' | 'danger' | 'info' => {
  return getTimelineItemType(type)
}

const getTimelineTypeText = (type: TimelineEventType): string => {
  const texts: Record<TimelineEventType, string> = {
    trigger: '触发',
    symptom: '症状',
    cause: '原因',
    effect: '影响'
  }
  return texts[type]
}

const getRiskType = (risk: RiskLevel): 'success' | 'warning' | 'danger' => {
  const types: Record<RiskLevel, 'success' | 'warning' | 'danger'> = {
    low: 'success',
    medium: 'warning',
    high: 'danger'
  }
  return types[risk]
}

const getRiskText = (risk: RiskLevel): string => {
  const texts: Record<RiskLevel, string> = {
    low: '低',
    medium: '中',
    high: '高'
  }
  return texts[risk]
}

const getPlanStatusType = (status: RemediationPlanStatus): 'info' | 'warning' | 'success' | 'danger' => {
  const types: Record<RemediationPlanStatus, 'info' | 'warning' | 'success' | 'danger'> = {
    pending: 'info',
    in_progress: 'warning',
    completed: 'success',
    failed: 'danger',
    rolled_back: 'warning'
  }
  return types[status]
}

const getPlanStatusText = (status: RemediationPlanStatus): string => {
  const texts: Record<RemediationPlanStatus, string> = {
    pending: '待执行',
    in_progress: '执行中',
    completed: '已完成',
    failed: '失败',
    rolled_back: '已回滚'
  }
  return texts[status]
}
</script>

<style scoped>
.alert-events-view {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-title {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.filter-card {
  margin-bottom: 20px;
}

.filter-form {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.batch-actions-card {
  margin-bottom: 20px;
  background: linear-gradient(135deg, #f0f9eb 0%, #e1f3d8 100%);
}

.batch-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.select-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.selected-count {
  color: #67c23a;
  font-weight: 600;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.events-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.event-card {
  cursor: pointer;
  transition: all 0.3s ease;
}

.event-card:hover {
  transform: translateY(-2px);
}

.event-active {
  border-left: 4px solid #f56c6c;
}

.event-selected {
  background: linear-gradient(135deg, #ecf5ff 0%, #d9ecff 100%);
  border-color: #409eff;
}

.event-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.event-severity {
  display: flex;
  align-items: center;
  gap: 8px;
}

.event-body {
  margin-bottom: 12px;
}

.event-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}

.event-message {
  color: #606266;
  margin-bottom: 8px;
}

.event-metrics {
  display: flex;
  gap: 24px;
  color: #909399;
  font-size: 14px;
}

.metric-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.event-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid #ebeef5;
}

.event-time {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #909399;
  font-size: 14px;
}

.resolved-time {
  color: #67c23a;
}

.event-actions {
  display: flex;
  gap: 8px;
}

.auto-response-result {
  margin-top: 12px;
}

.response-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  margin-bottom: 8px;
}

.response-output {
  background: #f5f7fa;
  padding: 8px 12px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 13px;
  color: #606266;
}

.response-error {
  background: #fef0f0;
  padding: 8px 12px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 13px;
  color: #f56c6c;
}

/* Detail Dialog Styles */
.detail-tabs {
  margin-top: 20px;
}

.loading-container {
  padding: 20px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin: 16px 0 12px;
}

/* Analysis Tab Styles */
.analysis-content {
  padding: 10px 0;
}

.root-cause-item {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
}

.cause-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.cause-index {
  font-weight: 600;
  color: #409eff;
}

.confidence-text {
  font-size: 13px;
  color: #909399;
}

.cause-description {
  color: #606266;
  line-height: 1.6;
  margin-bottom: 8px;
}

.cause-evidence {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.evidence-label {
  font-size: 13px;
  color: #909399;
}

.evidence-tag {
  margin: 2px;
}

.impact-section {
  margin-top: 16px;
}

.resource-tag {
  margin: 2px;
}

.similar-section {
  margin-top: 16px;
}

/* Timeline Tab Styles */
.timeline-content {
  padding: 20px 0;
}

.timeline-item-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.timeline-description {
  color: #606266;
}

/* Related Tab Styles */
.related-content {
  padding: 10px 0;
}

/* Remediation Tab Styles */
.remediation-content {
  padding: 10px 0;
}

.plan-overview {
  margin-bottom: 20px;
}

.remediation-steps {
  margin: 16px 0;
}

.step-detail {
  padding: 8px 0;
}

.step-command {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.command-label {
  font-size: 13px;
  color: #909399;
}

.command-tag {
  font-family: monospace;
  max-width: 500px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.step-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.step-duration {
  font-size: 13px;
  color: #909399;
}

.step-result {
  margin-top: 8px;
}

.result-output,
.result-error {
  margin: 0;
  font-family: monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
}

.remediation-actions {
  display: flex;
  gap: 12px;
  margin: 20px 0;
}

.rollback-section {
  margin-top: 16px;
}

.rollback-step {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid #ebeef5;
}

.rollback-step:last-child {
  border-bottom: none;
}

.rollback-order {
  font-weight: 600;
  color: #909399;
}

.rollback-desc {
  flex: 1;
  color: #606266;
}

/* Feedback Section Styles */
.feedback-section {
  margin-top: 20px;
}

.feedback-content {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.feedback-label {
  color: #606266;
}

.feedback-buttons {
  display: flex;
  gap: 8px;
}

.feedback-comment {
  width: 100%;
  margin-top: 12px;
}

/* Legacy AI Analysis Styles */
.ai-analysis-section {
  margin-top: 20px;
}

.ai-analysis-content {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: linear-gradient(135deg, #ecf5ff 0%, #f4f4f5 100%);
  border-radius: 8px;
}

.analysis-text {
  flex: 1;
  line-height: 1.6;
  color: #606266;
}

.auto-response-section {
  margin-top: 20px;
}

.response-pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: monospace;
  font-size: 13px;
}

.response-pre.error {
  color: #f56c6c;
}
</style>

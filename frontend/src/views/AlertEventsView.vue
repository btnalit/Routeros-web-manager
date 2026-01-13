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
            <!-- Checkbox for active events -->
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
      width="700px"
      destroy-on-close
    >
      <template v-if="selectedEvent">
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

        <!-- AI Analysis Section -->
        <div v-if="selectedEvent.aiAnalysis" class="ai-analysis-section">
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
  Operation
} from '@element-plus/icons-vue'
import {
  alertEventsApi,
  type AlertEvent,
  type AlertSeverity,
  type MetricType
} from '@/api/ai-ops'

const route = useRoute()

// State
const loading = ref(false)
const error = ref('')
const events = ref<AlertEvent[]>([])
const viewMode = ref<'active' | 'history'>('active')
const detailVisible = ref(false)
const selectedEvent = ref<AlertEvent | null>(null)

// Selection state
const selectedIds = ref<Set<string>>(new Set())
const batchResolving = ref(false)

// Filters
const dateRange = ref<[number, number] | null>(null)
const severityFilter = ref<AlertSeverity | ''>('')
const statusFilter = ref<'active' | 'resolved' | ''>('')

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
  // Trigger reactivity
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
  // Check for event ID in query params
  const eventId = route.query.id as string
  if (eventId) {
    loadEventById(eventId)
  }

  // Set default date range for history mode
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

// Filter events (triggered by filter changes)
const filterEvents = () => {
  // Filtering is done in computed property
}

// Show event detail
const showEventDetail = (event: AlertEvent) => {
  selectedEvent.value = event
  detailVisible.value = true
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

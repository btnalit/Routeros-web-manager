<template>
  <div class="syslog-config-view">
    <!-- Header -->
    <div class="page-header">
      <div class="header-left">
        <el-icon :size="28" color="#409eff"><Monitor /></el-icon>
        <span class="header-title">Syslog 配置</span>
      </div>
      <div class="header-actions">
        <el-button :icon="Refresh" :loading="loading" @click="loadData">
          刷新
        </el-button>
      </div>
    </div>

    <!-- Service Status Card -->
    <el-card class="status-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <span>服务状态</span>
          <el-tag :type="status?.running ? 'success' : 'danger'" size="small">
            {{ status?.running ? '运行中' : '已停止' }}
          </el-tag>
        </div>
      </template>
      <el-skeleton v-if="loading && !status" :rows="2" animated />
      <el-descriptions v-else :column="2" border>
        <el-descriptions-item label="监听端口">
          {{ status?.port || config?.port || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="服务状态">
          <el-tag :type="status?.running ? 'success' : 'danger'" size="small">
            {{ status?.running ? '运行中' : '已停止' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="已接收消息数">
          {{ status?.messagesReceived ?? 0 }}
        </el-descriptions-item>
        <el-descriptions-item label="最后消息时间">
          {{ status?.lastMessageAt ? formatTime(status.lastMessageAt) : '-' }}
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <!-- Configuration Card -->
    <el-card class="config-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <span>服务配置</span>
        </div>
      </template>
      <el-form
        ref="formRef"
        :model="configForm"
        :rules="formRules"
        label-width="100px"
        label-position="right"
      >
        <el-form-item label="启用服务" prop="enabled">
          <el-switch v-model="configForm.enabled" />
          <span class="form-item-tip">启用后将监听 UDP 端口接收 Syslog 消息</span>
        </el-form-item>
        <el-form-item label="监听端口" prop="port">
          <el-input-number
            v-model="configForm.port"
            :min="1"
            :max="65535"
            :disabled="!configForm.enabled"
            style="width: 200px"
          />
          <span class="form-item-tip">默认端口 514，需确保端口未被占用</span>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="saving" @click="saveConfig">
            保存配置
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- Events History Card -->
    <el-card class="events-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <span>Syslog 事件历史</span>
          <div class="header-actions">
            <el-date-picker
              v-model="dateRange"
              type="datetimerange"
              range-separator="至"
              start-placeholder="开始时间"
              end-placeholder="结束时间"
              :shortcuts="dateShortcuts"
              value-format="x"
              size="small"
              @change="loadEvents"
            />
            <el-button :icon="Refresh" size="small" :loading="eventsLoading" @click="loadEvents">
              刷新
            </el-button>
          </div>
        </div>
      </template>

      <el-skeleton v-if="eventsLoading && events.length === 0" :rows="5" animated />

      <el-empty v-else-if="events.length === 0" description="暂无 Syslog 事件" />

      <el-table
        v-else
        :data="paginatedEvents"
        stripe
        style="width: 100%"
        @row-click="showEventDetail"
      >
        <el-table-column prop="timestamp" label="时间" width="180">
          <template #default="{ row }">
            {{ formatTime(row.timestamp) }}
          </template>
        </el-table-column>
        <el-table-column prop="severity" label="级别" width="100">
          <template #default="{ row }">
            <el-tag :type="getSeverityType(row.severity)" size="small">
              {{ getSeverityText(row.severity) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="category" label="类别" width="120" show-overflow-tooltip />
        <el-table-column prop="message" label="消息" min-width="300" show-overflow-tooltip />
        <el-table-column prop="metadata.hostname" label="主机名" width="150" show-overflow-tooltip />
      </el-table>

      <!-- Pagination -->
      <div v-if="events.length > 0" class="pagination-container">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="events.length"
          layout="total, sizes, prev, pager, next"
          background
        />
      </div>
    </el-card>

    <!-- Event Detail Dialog -->
    <el-dialog
      v-model="detailVisible"
      title="Syslog 事件详情"
      width="700px"
      destroy-on-close
    >
      <el-descriptions v-if="selectedEvent" :column="2" border>
        <el-descriptions-item label="事件 ID" :span="2">
          {{ selectedEvent.id }}
        </el-descriptions-item>
        <el-descriptions-item label="时间">
          {{ formatTime(selectedEvent.timestamp) }}
        </el-descriptions-item>
        <el-descriptions-item label="严重级别">
          <el-tag :type="getSeverityType(selectedEvent.severity)" size="small">
            {{ getSeverityText(selectedEvent.severity) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="类别">
          {{ selectedEvent.category }}
        </el-descriptions-item>
        <el-descriptions-item label="主机名">
          {{ selectedEvent.metadata?.hostname || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="Facility">
          {{ selectedEvent.metadata?.facility ?? '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="Syslog 级别">
          {{ selectedEvent.metadata?.syslogSeverity ?? '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="消息" :span="2">
          {{ selectedEvent.message }}
        </el-descriptions-item>
      </el-descriptions>

      <!-- Raw Data Section -->
      <el-divider content-position="left">原始数据</el-divider>
      <div v-if="selectedEvent?.rawData" class="raw-data-section">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="Topic">
            {{ selectedEvent.rawData.topic || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="原始时间戳">
            {{ selectedEvent.rawData.timestamp || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="原始消息" :span="2">
            <pre class="raw-message">{{ selectedEvent.rawData.raw || selectedEvent.rawData.message }}</pre>
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, Monitor } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import {
  syslogApi,
  type SyslogReceiverConfig,
  type SyslogStatus,
  type SyslogEvent,
  type AlertSeverity
} from '@/api/ai-ops'

// State
const loading = ref(false)
const saving = ref(false)
const eventsLoading = ref(false)
const config = ref<SyslogReceiverConfig | null>(null)
const status = ref<SyslogStatus | null>(null)
const events = ref<SyslogEvent[]>([])
const detailVisible = ref(false)
const selectedEvent = ref<SyslogEvent | null>(null)
const formRef = ref<FormInstance>()

// Pagination
const currentPage = ref(1)
const pageSize = ref(20)

// Date range for events
const dateRange = ref<[number, number] | null>(null)

// Form data
const configForm = reactive<SyslogReceiverConfig>({
  port: 514,
  enabled: false
})

// Form rules
const formRules: FormRules = {
  port: [
    { required: true, message: '请输入监听端口', trigger: 'blur' },
    { type: 'number', min: 1, max: 65535, message: '端口范围 1-65535', trigger: 'blur' }
  ]
}

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
  }
]

// Computed - paginated events
const paginatedEvents = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return events.value.slice(start, end)
})

// Load data on mount
onMounted(() => {
  // Set default date range to last 24 hours
  const end = Date.now()
  const start = end - 24 * 3600 * 1000
  dateRange.value = [start, end]
  loadData()
})

// Load all data
const loadData = async () => {
  loading.value = true
  try {
    await Promise.all([loadConfig(), loadStatus(), loadEvents()])
  } finally {
    loading.value = false
  }
}

// Load config
const loadConfig = async () => {
  try {
    const response = await syslogApi.getConfig()
    if (response.data.success && response.data.data) {
      config.value = response.data.data
      configForm.port = response.data.data.port
      configForm.enabled = response.data.data.enabled
    }
  } catch (err) {
    console.error('Failed to load syslog config:', err)
  }
}

// Load status
const loadStatus = async () => {
  try {
    const response = await syslogApi.getStatus()
    if (response.data.success && response.data.data) {
      status.value = response.data.data
    }
  } catch (err) {
    console.error('Failed to load syslog status:', err)
  }
}

// Load events
const loadEvents = async () => {
  eventsLoading.value = true
  try {
    const options: { from?: number; to?: number; limit?: number } = { limit: 500 }
    if (dateRange.value) {
      options.from = dateRange.value[0]
      options.to = dateRange.value[1]
    }
    const response = await syslogApi.getEvents(options)
    if (response.data.success && response.data.data) {
      events.value = response.data.data.sort((a, b) => b.timestamp - a.timestamp)
    }
  } catch (err) {
    console.error('Failed to load syslog events:', err)
  } finally {
    eventsLoading.value = false
  }
}

// Save config
const saveConfig = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()
  } catch {
    return
  }

  saving.value = true
  try {
    const response = await syslogApi.updateConfig({
      port: configForm.port,
      enabled: configForm.enabled
    })
    if (response.data.success) {
      ElMessage.success('配置已保存')
      await loadStatus()
    } else {
      throw new Error(response.data.error || '保存失败')
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '保存配置失败'
    ElMessage.error(message)
  } finally {
    saving.value = false
  }
}

// Show event detail
const showEventDetail = (event: SyslogEvent) => {
  selectedEvent.value = event
  detailVisible.value = true
}

// Utility functions
const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString('zh-CN')
}

const getSeverityType = (severity: AlertSeverity): 'info' | 'warning' | 'danger' => {
  const types: Record<AlertSeverity, 'info' | 'warning' | 'danger'> = {
    info: 'info',
    warning: 'warning',
    critical: 'danger',
    emergency: 'danger'
  }
  return types[severity] || 'info'
}

const getSeverityText = (severity: AlertSeverity): string => {
  const texts: Record<AlertSeverity, string> = {
    info: '信息',
    warning: '警告',
    critical: '严重',
    emergency: '紧急'
  }
  return texts[severity] || severity
}
</script>

<style scoped>
.syslog-config-view {
  height: 100%;
  padding: 20px;
  overflow-y: auto;
  background: #f5f7fa;
}

/* Header */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  padding: 16px 20px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-title {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* Cards */
.status-card,
.config-card,
.events-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* Form */
.form-item-tip {
  margin-left: 12px;
  font-size: 12px;
  color: #909399;
}

/* Pagination */
.pagination-container {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

/* Raw data */
.raw-data-section {
  margin-top: 12px;
}

.raw-message {
  margin: 0;
  padding: 8px;
  background: #f5f7fa;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 200px;
  overflow-y: auto;
}

/* Responsive */
@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    gap: 12px;
  }

  .header-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .card-header {
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }
}
</style>

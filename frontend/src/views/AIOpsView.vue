<template>
  <div class="ai-ops-view">
    <!-- Header -->
    <div class="page-header">
      <div class="header-left">
        <el-icon :size="28" color="#409eff"><DataAnalysis /></el-icon>
        <span class="header-title">智能运维仪表盘</span>
      </div>
      <div class="header-actions">
        <el-tag v-if="autoRefresh" type="success" size="small">
          <el-icon class="is-loading"><Loading /></el-icon>
          自动刷新中
        </el-tag>
        <el-switch
          v-model="autoRefresh"
          active-text="自动刷新"
          inactive-text=""
          size="small"
        />
        <el-button :icon="Refresh" :loading="loading" @click="loadDashboardData">
          刷新
        </el-button>
      </div>
    </div>

    <!-- Loading State -->
    <el-skeleton v-if="loading && !dashboardData" :rows="10" animated />

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
        <el-button type="primary" size="small" @click="loadDashboardData">
          重新加载
        </el-button>
      </template>
    </el-alert>

    <!-- Dashboard Content -->
    <div v-else class="dashboard-content">
      <!-- Critical Alert Banner -->
      <el-alert
        v-if="dashboardData?.alerts?.critical && dashboardData.alerts.critical > 0"
        type="error"
        :closable="false"
        class="critical-alert-banner"
      >
        <template #title>
          <div class="alert-banner-content">
            <el-icon><WarningFilled /></el-icon>
            <span>有 {{ dashboardData?.alerts?.critical || 0 }} 个严重告警需要处理</span>
            <el-button type="danger" size="small" text @click="goToAlerts">
              查看详情 →
            </el-button>
          </div>
        </template>
      </el-alert>

      <!-- No Metrics Warning -->
      <el-alert
        v-if="!hasMetricsData"
        type="warning"
        :closable="false"
        class="no-metrics-warning"
      >
        <template #title>
          <div class="alert-banner-content">
            <span>暂无指标数据，请确保已连接路由器并启用指标采集</span>
            <el-button type="primary" size="small" text @click="goToMetricsConfig">
              配置指标采集 →
            </el-button>
          </div>
        </template>
      </el-alert>

      <!-- System Resource Cards -->
      <el-row :gutter="20" class="resource-row">
        <!-- CPU Card -->
        <el-col :xs="24" :sm="12" :md="8">
          <el-card class="resource-card" shadow="hover">
            <div class="resource-header">
              <el-icon :size="24" color="#409eff"><Cpu /></el-icon>
              <span class="resource-title">CPU 使用率</span>
            </div>
            <div class="resource-progress">
              <el-progress
                type="dashboard"
                :percentage="cpuUsage"
                :color="getProgressColor(cpuUsage)"
                :width="120"
              >
                <template #default="{ percentage }">
                  <span class="percentage-value">{{ hasMetricsData ? percentage + '%' : '--' }}</span>
                </template>
              </el-progress>
            </div>
            <div class="resource-status">
              <el-tag :type="hasMetricsData ? getStatusType(cpuUsage) : 'info'" size="small">
                {{ hasMetricsData ? getStatusText(cpuUsage) : '无数据' }}
              </el-tag>
            </div>
          </el-card>
        </el-col>

        <!-- Memory Card -->
        <el-col :xs="24" :sm="12" :md="8">
          <el-card class="resource-card" shadow="hover">
            <div class="resource-header">
              <el-icon :size="24" color="#67c23a"><Coin /></el-icon>
              <span class="resource-title">内存使用率</span>
            </div>
            <div class="resource-progress">
              <el-progress
                type="dashboard"
                :percentage="memoryUsage"
                :color="getProgressColor(memoryUsage)"
                :width="120"
              >
                <template #default="{ percentage }">
                  <span class="percentage-value">{{ hasMetricsData ? percentage + '%' : '--' }}</span>
                </template>
              </el-progress>
            </div>
            <div class="resource-detail">
              {{ hasMetricsData ? formatBytes(memoryUsed) + ' / ' + formatBytes(memoryTotal) : '无数据' }}
            </div>
          </el-card>
        </el-col>

        <!-- Disk Card -->
        <el-col :xs="24" :sm="12" :md="8">
          <el-card class="resource-card" shadow="hover">
            <div class="resource-header">
              <el-icon :size="24" color="#e6a23c"><Files /></el-icon>
              <span class="resource-title">磁盘使用率</span>
            </div>
            <div class="resource-progress">
              <el-progress
                type="dashboard"
                :percentage="diskUsage"
                :color="getProgressColor(diskUsage)"
                :width="120"
              >
                <template #default="{ percentage }">
                  <span class="percentage-value">{{ hasMetricsData ? percentage + '%' : '--' }}</span>
                </template>
              </el-progress>
            </div>
            <div class="resource-detail">
              {{ hasMetricsData ? formatBytes(diskUsed) + ' / ' + formatBytes(diskTotal) : '无数据' }}
            </div>
          </el-card>
        </el-col>
      </el-row>

      <!-- Interface Traffic Chart -->
      <el-card class="chart-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <div class="header-left">
              <el-icon :size="20" color="#409eff"><Connection /></el-icon>
              <span>接口流量监控</span>
            </div>
            <el-select
              v-if="interfaces.length > 0"
              v-model="selectedInterface"
              placeholder="选择接口"
              size="small"
              style="width: 150px"
              @change="updateTrafficChart"
            >
              <el-option
                v-for="iface in interfaces"
                :key="iface.name"
                :label="iface.name"
                :value="iface.name"
              >
                <span>{{ iface.name }}</span>
                <el-tag
                  :type="iface.status === 'up' ? 'success' : 'danger'"
                  size="small"
                  style="margin-left: 8px"
                >
                  {{ iface.status }}
                </el-tag>
              </el-option>
            </el-select>
            <el-tag v-else type="info" size="small">无接口数据</el-tag>
          </div>
        </template>
        <div class="chart-container">
          <v-chart
            v-if="trafficChartOption && interfaces.length > 0"
            :option="trafficChartOption"
            :autoresize="true"
            style="height: 300px"
          />
          <div v-else-if="interfaces.length > 0 && !trafficHistory.length" class="chart-loading">
            <el-icon class="is-loading" :size="24"><Loading /></el-icon>
            <span>正在采集流量数据...</span>
          </div>
          <el-empty v-else description="暂无接口数据，请确保已连接路由器并启用指标采集" />
        </div>
      </el-card>

      <!-- Bottom Row: Alerts, Remediations, Scheduler -->
      <el-row :gutter="20" class="bottom-row">
        <!-- Recent Alerts -->
        <el-col :xs="24" :md="12" :lg="8">
          <el-card class="list-card" shadow="hover">
            <template #header>
              <div class="card-header">
                <div class="header-left">
                  <el-icon :size="20" color="#f56c6c"><Bell /></el-icon>
                  <span>最近告警</span>
                  <el-badge
                    v-if="dashboardData?.alerts?.active && dashboardData.alerts.active > 0"
                    :value="dashboardData?.alerts?.active || 0"
                    type="danger"
                  />
                </div>
                <el-button type="primary" text size="small" @click="goToAlerts">
                  查看全部
                </el-button>
              </div>
            </template>
            <div class="list-content">
              <el-empty
                v-if="!dashboardData?.alerts.list?.length"
                description="暂无告警"
                :image-size="60"
              />
              <div v-else class="alert-list">
                <div
                  v-for="alert in dashboardData.alerts.list.slice(0, 5)"
                  :key="alert.id"
                  class="alert-item"
                  @click="viewAlertDetail(alert)"
                >
                  <div class="alert-icon">
                    <el-icon :color="getSeverityColor(alert.severity)">
                      <WarningFilled />
                    </el-icon>
                  </div>
                  <div class="alert-info">
                    <div class="alert-name">{{ alert.ruleName }}</div>
                    <div class="alert-meta">
                      <el-tag :type="getSeverityType(alert.severity)" size="small">
                        {{ getSeverityText(alert.severity) }}
                      </el-tag>
                      <span class="alert-time">{{ formatTime(alert.triggeredAt) }}</span>
                    </div>
                  </div>
                  <el-tag :type="alert.status === 'active' ? 'danger' : 'success'" size="small">
                    {{ alert.status === 'active' ? '活跃' : '已恢复' }}
                  </el-tag>
                </div>
              </div>
            </div>
          </el-card>
        </el-col>

        <!-- Recent Remediations -->
        <el-col :xs="24" :md="12" :lg="8">
          <el-card class="list-card" shadow="hover">
            <template #header>
              <div class="card-header">
                <div class="header-left">
                  <el-icon :size="20" color="#67c23a"><FirstAidKit /></el-icon>
                  <span>最近修复</span>
                </div>
                <el-button type="primary" text size="small" @click="goToRemediations">
                  查看全部
                </el-button>
              </div>
            </template>
            <div class="list-content">
              <el-empty
                v-if="!dashboardData?.remediations.list?.length"
                description="暂无修复记录"
                :image-size="60"
              />
              <div v-else class="remediation-list">
                <div
                  v-for="remediation in dashboardData.remediations.list.slice(0, 5)"
                  :key="remediation.id"
                  class="remediation-item"
                >
                  <div class="remediation-icon">
                    <el-icon :color="getRemediationStatusColor(remediation.status)">
                      <component :is="getRemediationStatusIcon(remediation.status)" />
                    </el-icon>
                  </div>
                  <div class="remediation-info">
                    <div class="remediation-name">{{ remediation.patternName }}</div>
                    <div class="remediation-time">{{ formatTime(remediation.startedAt) }}</div>
                  </div>
                  <el-tag :type="getRemediationStatusType(remediation.status)" size="small">
                    {{ getRemediationStatusText(remediation.status) }}
                  </el-tag>
                </div>
              </div>
            </div>
          </el-card>
        </el-col>

        <!-- Scheduled Tasks -->
        <el-col :xs="24" :md="12" :lg="8">
          <el-card class="list-card" shadow="hover">
            <template #header>
              <div class="card-header">
                <div class="header-left">
                  <el-icon :size="20" color="#909399"><Clock /></el-icon>
                  <span>计划任务</span>
                </div>
                <el-button type="primary" text size="small" @click="goToScheduler">
                  管理任务
                </el-button>
              </div>
            </template>
            <div class="list-content">
              <div class="scheduler-summary">
                <div class="summary-item">
                  <span class="summary-label">总任务数</span>
                  <span class="summary-value">{{ dashboardData?.scheduler.total || 0 }}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">已启用</span>
                  <span class="summary-value success">{{ dashboardData?.scheduler.enabled || 0 }}</span>
                </div>
              </div>
              <el-divider />
              <div class="next-tasks">
                <div class="next-tasks-title">下次执行任务</div>
                <el-empty
                  v-if="!nextTasks.length"
                  description="暂无计划任务"
                  :image-size="60"
                />
                <div v-else class="task-list">
                  <div
                    v-for="task in nextTasks"
                    :key="task.id"
                    class="task-item"
                  >
                    <div class="task-info">
                      <div class="task-name">{{ task.name }}</div>
                      <div class="task-type">
                        <el-tag size="small" type="info">{{ getTaskTypeText(task.type) }}</el-tag>
                      </div>
                    </div>
                    <div class="task-next-run">
                      <el-icon><Clock /></el-icon>
                      <span>{{ formatNextRun(task.nextRunAt) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, markRaw } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  Refresh,
  Loading,
  DataAnalysis,
  Cpu,
  Coin,
  Files,
  Connection,
  Bell,
  Clock,
  WarningFilled,
  FirstAidKit,
  CircleCheckFilled,
  CircleCloseFilled,
  MoreFilled
} from '@element-plus/icons-vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent
} from 'echarts/components'
import type { EChartsOption } from 'echarts'
import {
  dashboardApi,
  schedulerApi,
  type DashboardData,
  type AlertEvent,
  type AlertSeverity,
  type RemediationStatus,
  type ScheduledTask,
  type InterfaceMetrics
} from '@/api/ai-ops'
import { useTrafficCacheStore } from '@/stores/trafficCache'

// Register ECharts components
use([
  CanvasRenderer,
  LineChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent
])

const router = useRouter()

// Traffic cache store (global, persists across page navigation)
const trafficCacheStore = useTrafficCacheStore()

// State
const loading = ref(false)
const error = ref('')
const dashboardData = ref<DashboardData | null>(null)
const autoRefresh = ref(true)
const selectedInterface = ref('')
const scheduledTasks = ref<ScheduledTask[]>([])
let refreshTimer: ReturnType<typeof setInterval> | null = null

// Computed
const hasMetricsData = computed(() => {
  return dashboardData.value?.metrics !== null && dashboardData.value?.metrics !== undefined
})

const cpuUsage = computed(() => {
  return dashboardData.value?.metrics?.system?.cpu?.usage || 0
})

const memoryUsage = computed(() => {
  return dashboardData.value?.metrics?.system?.memory?.usage || 0
})

const memoryUsed = computed(() => {
  return dashboardData.value?.metrics?.system?.memory?.used || 0
})

const memoryTotal = computed(() => {
  return dashboardData.value?.metrics?.system?.memory?.total || 0
})

const diskUsage = computed(() => {
  return dashboardData.value?.metrics?.system?.disk?.usage || 0
})

const diskUsed = computed(() => {
  return dashboardData.value?.metrics?.system?.disk?.used || 0
})

const diskTotal = computed(() => {
  return dashboardData.value?.metrics?.system?.disk?.total || 0
})

const interfaces = computed<InterfaceMetrics[]>(() => {
  return dashboardData.value?.metrics?.interfaces || []
})

const nextTasks = computed(() => {
  return scheduledTasks.value
    .filter(t => t.enabled && t.nextRunAt)
    .sort((a, b) => (a.nextRunAt || 0) - (b.nextRunAt || 0))
    .slice(0, 3)
})

// Get current interface's traffic history from global cache
const trafficHistory = computed(() => {
  return trafficCacheStore.getTrafficHistory(selectedInterface.value)
})

// Traffic Chart Option
const trafficChartOption = computed<EChartsOption | null>(() => {
  const history = trafficHistory.value
  if (!history.length) return null

  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const data = params as Array<{ seriesName: string; value: number; axisValue: string }>
        if (!data.length) return ''
        let result = `${data[0].axisValue}<br/>`
        data.forEach(item => {
          result += `${item.seriesName}: ${formatBytesRate(item.value)}<br/>`
        })
        return result
      }
    },
    legend: {
      data: ['接收', '发送'],
      bottom: 0
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: history.map(d => d.time)
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value: number) => formatBytesRate(value)
      }
    },
    series: [
      {
        name: '接收',
        type: 'line',
        smooth: true,
        showSymbol: false,
        areaStyle: {
          opacity: 0.3
        },
        lineStyle: {
          color: '#67c23a',
          width: 2
        },
        itemStyle: {
          color: '#67c23a'
        },
        data: history.map(d => d.rx)
      },
      {
        name: '发送',
        type: 'line',
        smooth: true,
        showSymbol: false,
        areaStyle: {
          opacity: 0.3
        },
        lineStyle: {
          color: '#409eff',
          width: 2
        },
        itemStyle: {
          color: '#409eff'
        },
        data: history.map(d => d.tx)
      }
    ]
  }
})

// Methods
const loadDashboardData = async () => {
  loading.value = true
  error.value = ''

  try {
    const [dashboardResponse, tasksResponse] = await Promise.all([
      dashboardApi.getData(),
      schedulerApi.getTasks()
    ])

    if (dashboardResponse.data.success && dashboardResponse.data.data) {
      dashboardData.value = dashboardResponse.data.data

      // Auto-select first interface if not selected
      if (!selectedInterface.value && interfaces.value.length > 0) {
        selectedInterface.value = interfaces.value[0].name
      }

      // Update traffic history for all interfaces
      updateAllTrafficHistory()
    } else {
      throw new Error(dashboardResponse.data.error || '获取仪表盘数据失败')
    }

    if (tasksResponse.data.success && tasksResponse.data.data) {
      scheduledTasks.value = tasksResponse.data.data
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取数据失败'
    error.value = message
    if (!dashboardData.value) {
      ElMessage.error(message)
    }
  } finally {
    loading.value = false
  }
}

// Update traffic history for ALL interfaces using global cache store
const updateAllTrafficHistory = () => {
  // Use the global store to update traffic data for all interfaces
  trafficCacheStore.updateAllInterfacesTraffic(
    interfaces.value.map(iface => ({
      name: iface.name,
      rxBytes: iface.rxBytes,
      txBytes: iface.txBytes
    }))
  )
}

const updateTrafficChart = () => {
  // When switching interfaces, no need to reload - data is already in global cache
  // The computed property will automatically get the correct data
}

// Utility functions
const formatBytes = (bytes: number): string => {
  if (!bytes || bytes <= 0 || !isFinite(bytes)) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  if (i < 0 || i >= sizes.length) return '0 B'
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatBytesRate = (bytes: number): string => {
  return formatBytes(bytes) + '/s'
}

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return `${Math.floor(diff / 86400000)} 天前`
}

const formatNextRun = (timestamp?: number): string => {
  if (!timestamp) return '未设置'
  const date = new Date(timestamp)
  const now = new Date()
  const diff = date.getTime() - now.getTime()

  if (diff < 0) return '已过期'
  if (diff < 60000) return '即将执行'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟后`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时后`
  return `${Math.floor(diff / 86400000)} 天后`
}

const getProgressColor = (percentage: number): string => {
  if (percentage < 60) return '#67c23a'
  if (percentage < 80) return '#e6a23c'
  return '#f56c6c'
}

const getStatusType = (percentage: number): 'success' | 'warning' | 'danger' => {
  if (percentage < 60) return 'success'
  if (percentage < 80) return 'warning'
  return 'danger'
}

const getStatusText = (percentage: number): string => {
  if (percentage < 60) return '正常'
  if (percentage < 80) return '警告'
  return '严重'
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

const getRemediationStatusColor = (status: RemediationStatus): string => {
  const colors: Record<RemediationStatus, string> = {
    pending: '#909399',
    executing: '#409eff',
    success: '#67c23a',
    failed: '#f56c6c',
    skipped: '#909399'
  }
  return colors[status]
}

const getRemediationStatusType = (status: RemediationStatus): 'info' | 'primary' | 'success' | 'danger' | 'warning' => {
  const types: Record<RemediationStatus, 'info' | 'primary' | 'success' | 'danger' | 'warning'> = {
    pending: 'info',
    executing: 'primary',
    success: 'success',
    failed: 'danger',
    skipped: 'warning'
  }
  return types[status]
}

const getRemediationStatusText = (status: RemediationStatus): string => {
  const texts: Record<RemediationStatus, string> = {
    pending: '等待中',
    executing: '执行中',
    success: '成功',
    failed: '失败',
    skipped: '已跳过'
  }
  return texts[status]
}

const getRemediationStatusIcon = (status: RemediationStatus) => {
  const icons: Record<RemediationStatus, unknown> = {
    pending: markRaw(MoreFilled),
    executing: markRaw(Loading),
    success: markRaw(CircleCheckFilled),
    failed: markRaw(CircleCloseFilled),
    skipped: markRaw(MoreFilled)
  }
  return icons[status]
}

const getTaskTypeText = (type: string): string => {
  const texts: Record<string, string> = {
    inspection: '巡检',
    backup: '备份',
    custom: '自定义'
  }
  return texts[type] || type
}

// Navigation
const goToAlerts = () => {
  router.push('/ai-ops/alerts')
}

const goToMetricsConfig = () => {
  // Navigate to connection page where metrics config can be managed
  router.push('/connection')
}

const goToRemediations = () => {
  router.push('/ai-ops/patterns')
}

const goToScheduler = () => {
  router.push('/ai-ops/scheduler')
}

const viewAlertDetail = (alert: AlertEvent) => {
  router.push(`/ai-ops/alerts?id=${alert.id}`)
}

// Auto refresh
const startAutoRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
  }
  refreshTimer = setInterval(() => {
    if (autoRefresh.value) {
      loadDashboardData()
    }
  }, 30000) // 30 seconds - longer interval for more stable data
}

const stopAutoRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

// Lifecycle
onMounted(() => {
  loadDashboardData()
  startAutoRefresh()
})

onUnmounted(() => {
  stopAutoRefresh()
})
</script>


<style scoped>
.ai-ops-view {
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
  gap: 16px;
}

/* Critical Alert Banner */
.critical-alert-banner {
  margin-bottom: 20px;
}

/* No Metrics Warning */
.no-metrics-warning {
  margin-bottom: 20px;
}

.alert-banner-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Resource Cards */
.resource-row {
  margin-bottom: 20px;
}

.resource-card {
  text-align: center;
  min-height: 220px;
}

.resource-card :deep(.el-card__body) {
  padding: 20px;
}

.resource-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 16px;
}

.resource-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.resource-progress {
  display: flex;
  justify-content: center;
  margin-bottom: 12px;
}

.percentage-value {
  font-size: 24px;
  font-weight: 700;
  color: #303133;
}

.resource-detail {
  font-size: 14px;
  color: #606266;
}

.resource-status {
  margin-top: 8px;
}

/* Chart Card */
.chart-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-header .header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.chart-container {
  min-height: 300px;
}

.chart-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  gap: 12px;
  color: #909399;
  font-size: 14px;
}

/* List Cards */
.bottom-row {
  margin-bottom: 20px;
}

.list-card {
  min-height: 350px;
}

.list-card :deep(.el-card__body) {
  padding: 16px;
}

.list-content {
  min-height: 250px;
}

/* Alert List */
.alert-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.alert-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.alert-item:hover {
  background: #e4e7ed;
  transform: translateX(4px);
}

.alert-icon {
  flex-shrink: 0;
}

.alert-info {
  flex: 1;
  min-width: 0;
}

.alert-name {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.alert-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.alert-time {
  font-size: 12px;
  color: #909399;
}

/* Remediation List */
.remediation-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.remediation-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 8px;
}

.remediation-icon {
  flex-shrink: 0;
}

.remediation-info {
  flex: 1;
  min-width: 0;
}

.remediation-name {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.remediation-time {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

/* Scheduler Summary */
.scheduler-summary {
  display: flex;
  justify-content: space-around;
  padding: 12px 0;
}

.summary-item {
  text-align: center;
}

.summary-label {
  display: block;
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}

.summary-value {
  font-size: 24px;
  font-weight: 700;
  color: #303133;
}

.summary-value.success {
  color: #67c23a;
}

/* Next Tasks */
.next-tasks {
  padding-top: 8px;
}

.next-tasks-title {
  font-size: 14px;
  font-weight: 500;
  color: #606266;
  margin-bottom: 12px;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.task-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 8px;
}

.task-info {
  flex: 1;
  min-width: 0;
}

.task-name {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-type {
  margin-top: 4px;
}

.task-next-run {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #909399;
  flex-shrink: 0;
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

  .resource-card {
    margin-bottom: 12px;
  }
}
</style>

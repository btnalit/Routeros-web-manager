<template>
  <div class="alert-rules-view">
    <!-- Header -->
    <div class="page-header">
      <div class="header-left">
        <el-icon :size="28" color="#f56c6c"><Bell /></el-icon>
        <span class="header-title">告警规则管理</span>
      </div>
      <div class="header-actions">
        <el-button type="primary" :icon="Plus" @click="showCreateDialog">
          新建规则
        </el-button>
        <el-button :icon="Refresh" :loading="loading" @click="loadRules">
          刷新
        </el-button>
      </div>
    </div>

    <!-- Loading State -->
    <el-skeleton v-if="loading && rules.length === 0" :rows="5" animated />

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
        <el-button type="primary" size="small" @click="loadRules">
          重新加载
        </el-button>
      </template>
    </el-alert>

    <!-- Rules Table -->
    <el-card v-else shadow="hover">
      <el-table
        v-loading="loading"
        :data="paginatedRules"
        stripe
        style="width: 100%"
        @row-click="handleRowClick"
      >
        <el-table-column prop="name" label="规则名称" min-width="150" show-overflow-tooltip />
        <el-table-column prop="metric" label="指标类型" width="140">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ getMetricText(row.metric) }}</el-tag>
            <span v-if="row.metricLabel" class="metric-label">{{ row.metricLabel }}</span>
          </template>
        </el-table-column>
        <el-table-column label="条件" width="180">
          <template #default="{ row }">
            <span class="condition-text">
              <template v-if="row.metric === 'interface_status'">
                目标状态: {{ row.targetStatus === 'down' ? '断开' : '连接' }}
              </template>
              <template v-else>
                {{ getOperatorText(row.operator) }} {{ row.threshold }}{{ getMetricUnit(row.metric) }}
              </template>
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="duration" label="持续次数" width="100" align="center">
          <template #default="{ row }">
            {{ row.duration }} 次
          </template>
        </el-table-column>
        <el-table-column prop="severity" label="严重级别" width="100">
          <template #default="{ row }">
            <el-tag :type="getSeverityType(row.severity)" size="small">
              {{ getSeverityText(row.severity) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'" size="small">
              {{ row.enabled ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最近触发" width="160">
          <template #default="{ row }">
            {{ row.lastTriggeredAt ? formatTime(row.lastTriggeredAt) : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" link @click.stop="editRule(row)">
              编辑
            </el-button>
            <el-button
              size="small"
              :type="row.enabled ? 'warning' : 'success'"
              link
              @click.stop="toggleRule(row)"
            >
              {{ row.enabled ? '禁用' : '启用' }}
            </el-button>
            <el-popconfirm
              title="确定要删除此规则吗？"
              confirm-button-text="确定"
              cancel-button-text="取消"
              @confirm="deleteRule(row)"
            >
              <template #reference>
                <el-button size="small" type="danger" link @click.stop>
                  删除
                </el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <!-- Pagination -->
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="rules.length"
          layout="total, sizes, prev, pager, next, jumper"
          background
        />
      </div>
    </el-card>

    <!-- Create/Edit Dialog -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEditing ? '编辑告警规则' : '新建告警规则'"
      width="650px"
      destroy-on-close
      @close="resetForm"
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="100px"
        label-position="right"
      >
        <el-form-item label="规则名称" prop="name">
          <el-input v-model="formData.name" placeholder="请输入规则名称" />
        </el-form-item>

        <!-- 指标类型选择 -->
        <el-form-item label="指标类型" prop="metric">
          <el-select v-model="formData.metric" placeholder="选择指标" style="width: 100%">
            <el-option
              v-for="item in metricOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            >
              <div class="metric-option">
                <span class="metric-option-label">{{ item.label }}</span>
                <span class="metric-option-unit" v-if="item.unit">({{ item.unit }})</span>
              </div>
            </el-option>
          </el-select>
        </el-form-item>

        <!-- 指标说明提示 -->
        <el-alert
          v-if="currentMetricInfo"
          :title="currentMetricInfo.description"
          type="info"
          :closable="false"
          show-icon
          style="margin-bottom: 18px"
        >
          <template #default>
            <div class="metric-hint">
              <el-icon><InfoFilled /></el-icon>
              <span>{{ currentMetricInfo.example }}</span>
            </div>
          </template>
        </el-alert>

        <!-- 接口名称（仅接口相关指标显示） -->
        <el-form-item
          v-if="needsMetricLabel"
          label="接口名称"
          prop="metricLabel"
        >
          <el-input 
            v-model="formData.metricLabel" 
            placeholder="如 ether1, lan01, bridge1"
          >
            <template #prepend>
              <el-icon><Connection /></el-icon>
            </template>
          </el-input>
          <div class="form-item-tip">
            请输入 RouterOS 中的接口名称，可在「接口管理」页面查看
          </div>
        </el-form-item>

        <!-- 接口状态类型：目标状态选择 -->
        <el-form-item
          v-if="isInterfaceStatus"
          label="触发条件"
          prop="targetStatus"
        >
          <el-radio-group v-model="formData.targetStatus" class="status-radio-group">
            <el-radio-button
              v-for="item in interfaceStatusOptions"
              :key="item.value"
              :value="item.value"
            >
              <div class="status-option">
                <el-icon v-if="item.value === 'down'" color="#f56c6c"><CircleClose /></el-icon>
                <el-icon v-else color="#67c23a"><CircleCheck /></el-icon>
                <span>{{ item.label }}</span>
              </div>
            </el-radio-button>
          </el-radio-group>
          <div class="form-item-tip">
            {{ interfaceStatusOptions.find(o => o.value === formData.targetStatus)?.description }}
          </div>
        </el-form-item>

        <!-- 数值型指标：运算符和阈值 -->
        <template v-if="!isInterfaceStatus">
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="运算符" prop="operator">
                <el-select v-model="formData.operator" placeholder="选择运算符" style="width: 100%">
                  <el-option
                    v-for="item in operatorOptions"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="阈值" prop="threshold">
                <el-input-number
                  v-model="formData.threshold"
                  :min="0"
                  :precision="2"
                  style="width: 100%"
                  :placeholder="getThresholdPlaceholder()"
                />
                <template #label>
                  <span>阈值</span>
                  <span class="threshold-unit" v-if="currentMetricInfo?.unit">
                    ({{ currentMetricInfo.unit }})
                  </span>
                </template>
              </el-form-item>
            </el-col>
          </el-row>

          <!-- 流量阈值参考 -->
          <el-alert
            v-if="isInterfaceTraffic"
            title="流量阈值参考"
            type="warning"
            :closable="false"
            show-icon
            style="margin-bottom: 18px"
          >
            <template #default>
              <div class="traffic-reference">
                <div class="traffic-item">
                  <span class="traffic-label">100 KB/s</span>
                  <span class="traffic-desc">≈ 0.1 MB/s，适合低流量接口</span>
                </div>
                <div class="traffic-item">
                  <span class="traffic-label">1024 KB/s</span>
                  <span class="traffic-desc">≈ 1 MB/s，适合普通接口</span>
                </div>
                <div class="traffic-item">
                  <span class="traffic-label">10240 KB/s</span>
                  <span class="traffic-desc">≈ 10 MB/s，适合高速接口</span>
                </div>
                <div class="traffic-item">
                  <span class="traffic-label">102400 KB/s</span>
                  <span class="traffic-desc">≈ 100 MB/s，适合千兆接口</span>
                </div>
              </div>
            </template>
          </el-alert>
        </template>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="持续次数" prop="duration">
              <el-input-number
                v-model="formData.duration"
                :min="1"
                :max="100"
                style="width: 100%"
              />
              <div class="form-item-tip">
                连续满足条件的采集次数（采集间隔约 60 秒）
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="冷却时间" prop="cooldownMs">
              <el-select v-model="formData.cooldownMs" style="width: 100%">
                <el-option :value="0" label="无冷却" />
                <el-option :value="60000" label="1 分钟" />
                <el-option :value="300000" label="5 分钟" />
                <el-option :value="600000" label="10 分钟" />
                <el-option :value="1800000" label="30 分钟" />
                <el-option :value="3600000" label="1 小时" />
              </el-select>
              <div class="form-item-tip">
                告警触发后的静默时间，避免重复告警
              </div>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="严重级别" prop="severity">
          <el-radio-group v-model="formData.severity" class="severity-radio-group">
            <el-radio-button value="info">
              <el-icon><InfoFilled /></el-icon> 信息
            </el-radio-button>
            <el-radio-button value="warning">
              <el-icon><WarningFilled /></el-icon> 警告
            </el-radio-button>
            <el-radio-button value="critical">
              <el-icon><CircleCloseFilled /></el-icon> 严重
            </el-radio-button>
            <el-radio-button value="emergency">
              <el-icon><Bell /></el-icon> 紧急
            </el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="通知渠道" prop="channels">
          <el-select
            v-model="formData.channels"
            multiple
            placeholder="选择通知渠道"
            style="width: 100%"
          >
            <el-option
              v-for="channel in notificationChannels"
              :key="channel.id"
              :label="channel.name"
              :value="channel.id"
            >
              <span>{{ channel.name }}</span>
              <el-tag size="small" style="margin-left: 8px">{{ getChannelTypeText(channel.type) }}</el-tag>
            </el-option>
          </el-select>
          <div class="form-item-tip" v-if="notificationChannels.length === 0">
            暂无通知渠道，请先在「通知渠道」页面创建
          </div>
        </el-form-item>

        <el-form-item label="启用状态">
          <el-switch v-model="formData.enabled" />
        </el-form-item>

        <el-divider content-position="left">自动响应（可选）</el-divider>

        <el-form-item label="启用自动响应">
          <el-switch v-model="formData.autoResponse!.enabled" />
        </el-form-item>

        <el-form-item v-if="formData.autoResponse?.enabled" label="响应脚本" prop="autoResponse.script">
          <el-input
            v-model="formData.autoResponse!.script"
            type="textarea"
            :rows="4"
            placeholder="输入 RouterOS 脚本，告警触发时自动执行"
          />
          <div class="form-item-tip">
            示例：/interface enable ether1
          </div>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitForm">
          {{ isEditing ? '保存' : '创建' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- Detail Dialog -->
    <el-dialog
      v-model="detailVisible"
      title="告警规则详情"
      width="600px"
      destroy-on-close
    >
      <el-descriptions :column="2" border v-if="selectedRule">
        <el-descriptions-item label="规则名称" :span="2">{{ selectedRule.name }}</el-descriptions-item>
        <el-descriptions-item label="指标类型">{{ getMetricText(selectedRule.metric) }}</el-descriptions-item>
        <el-descriptions-item label="接口名称">{{ selectedRule.metricLabel || '-' }}</el-descriptions-item>
        <el-descriptions-item label="运算符">{{ selectedRule.metric === 'interface_status' ? '-' : getOperatorText(selectedRule.operator) }}</el-descriptions-item>
        <el-descriptions-item label="阈值/目标状态">
          <template v-if="selectedRule.metric === 'interface_status'">
            {{ selectedRule.targetStatus === 'down' ? '接口断开 (down)' : '接口连接 (up)' }}
          </template>
          <template v-else>
            {{ selectedRule.threshold }}{{ getMetricUnit(selectedRule.metric) }}
          </template>
        </el-descriptions-item>
        <el-descriptions-item label="持续次数">{{ selectedRule.duration }} 次</el-descriptions-item>
        <el-descriptions-item label="冷却时间">{{ formatCooldown(selectedRule.cooldownMs) }}</el-descriptions-item>
        <el-descriptions-item label="严重级别">
          <el-tag :type="getSeverityType(selectedRule.severity)" size="small">
            {{ getSeverityText(selectedRule.severity) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="selectedRule.enabled ? 'success' : 'info'" size="small">
            {{ selectedRule.enabled ? '启用' : '禁用' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="通知渠道" :span="2">
          <el-tag
            v-for="channelId in selectedRule.channels"
            :key="channelId"
            size="small"
            style="margin-right: 4px"
          >
            {{ getChannelName(channelId) }}
          </el-tag>
          <span v-if="!selectedRule.channels.length">-</span>
        </el-descriptions-item>
        <el-descriptions-item label="自动响应">
          {{ selectedRule.autoResponse?.enabled ? '启用' : '禁用' }}
        </el-descriptions-item>
        <el-descriptions-item label="最近触发">
          {{ selectedRule.lastTriggeredAt ? formatTime(selectedRule.lastTriggeredAt) : '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ formatTime(selectedRule.createdAt) }}</el-descriptions-item>
        <el-descriptions-item label="更新时间">{{ formatTime(selectedRule.updatedAt) }}</el-descriptions-item>
        <el-descriptions-item v-if="selectedRule.autoResponse?.enabled" label="响应脚本" :span="2">
          <el-input
            :model-value="selectedRule.autoResponse?.script"
            type="textarea"
            :rows="3"
            readonly
          />
        </el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
        <el-button type="primary" @click="editRule(selectedRule!)">编辑</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, Plus, Bell, InfoFilled, WarningFilled, CircleCloseFilled, CircleClose, CircleCheck, Connection } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import {
  alertRulesApi,
  notificationChannelsApi,
  type AlertRule,
  type CreateAlertRuleInput,
  type AlertSeverity,
  type AlertOperator,
  type MetricType,
  type NotificationChannel,
  type ChannelType
} from '@/api/ai-ops'

// State
const loading = ref(false)
const error = ref('')
const rules = ref<AlertRule[]>([])
const notificationChannels = ref<NotificationChannel[]>([])
const dialogVisible = ref(false)
const detailVisible = ref(false)
const isEditing = ref(false)
const submitting = ref(false)
const selectedRule = ref<AlertRule | null>(null)
const editingRuleId = ref<string | null>(null)
const formRef = ref<FormInstance>()

// Pagination
const currentPage = ref(1)
const pageSize = ref(10)

// Computed - paginated rules
const paginatedRules = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return rules.value.slice(start, end)
})

// Form data
const getDefaultFormData = (): CreateAlertRuleInput => ({
  name: '',
  enabled: true,
  metric: 'cpu',
  metricLabel: '',
  operator: 'gt',
  threshold: 80,
  targetStatus: 'down',
  duration: 3,
  cooldownMs: 300000,
  severity: 'warning',
  channels: [],
  autoResponse: {
    enabled: false,
    script: ''
  }
})

const formData = reactive<CreateAlertRuleInput>(getDefaultFormData())

// Form validation rules - 动态根据指标类型调整
const formRules = computed<FormRules>(() => {
  const isInterfaceStatusType = formData.metric === 'interface_status'
  
  const baseRules: FormRules = {
    name: [
      { required: true, message: '请输入规则名称', trigger: 'blur' },
      { min: 2, max: 50, message: '长度在 2 到 50 个字符', trigger: 'blur' }
    ],
    metric: [{ required: true, message: '请选择指标类型', trigger: 'change' }],
    duration: [{ required: true, message: '请输入持续次数', trigger: 'blur' }],
    cooldownMs: [{ required: true, message: '请输入冷却时间', trigger: 'blur' }],
    severity: [{ required: true, message: '请选择严重级别', trigger: 'change' }]
  }
  
  if (isInterfaceStatusType) {
    // 接口状态类型：要求 targetStatus，不要求 threshold 和 operator
    baseRules.targetStatus = [{ required: true, message: '请选择目标状态', trigger: 'change' }]
  } else {
    // 数值型指标：要求 threshold 和 operator
    baseRules.operator = [{ required: true, message: '请选择运算符', trigger: 'change' }]
    baseRules.threshold = [{ required: true, message: '请输入阈值', trigger: 'blur' }]
  }
  
  return baseRules
})

// Options - 指标类型选项，包含详细说明
const metricOptions = [
  { value: 'cpu', label: 'CPU 使用率', unit: '%', description: '设备 CPU 使用百分比，范围 0-100', example: '阈值 80 表示 CPU 超过 80% 时触发' },
  { value: 'memory', label: '内存使用率', unit: '%', description: '设备内存使用百分比，范围 0-100', example: '阈值 90 表示内存超过 90% 时触发' },
  { value: 'disk', label: '磁盘使用率', unit: '%', description: '设备磁盘使用百分比，范围 0-100', example: '阈值 85 表示磁盘超过 85% 时触发' },
  { value: 'interface_status', label: '接口状态', unit: '', description: '监控网络接口的连接状态 (up/down)', example: '当接口断开时触发告警' },
  { value: 'interface_traffic', label: '接口流量', unit: 'KB/s', description: '接口的收发流量速率总和 (KB/s)', example: '阈值 1024 表示流量超过 1 MB/s 时触发' }
]

const operatorOptions = [
  { value: 'gt', label: '大于 (>)' },
  { value: 'gte', label: '大于等于 (>=)' },
  { value: 'lt', label: '小于 (<)' },
  { value: 'lte', label: '小于等于 (<=)' },
  { value: 'eq', label: '等于 (=)' },
  { value: 'ne', label: '不等于 (!=)' }
]

// 接口状态目标选项
const interfaceStatusOptions = [
  { value: 'down', label: '接口断开时告警', description: '当接口状态变为 down 时触发告警' },
  { value: 'up', label: '接口连接时告警', description: '当接口状态变为 up 时触发告警（较少使用）' }
]

// 获取当前选中指标的详细信息
const currentMetricInfo = computed(() => {
  return metricOptions.find(m => m.value === formData.metric)
})

// 是否为接口流量类型
const isInterfaceTraffic = computed(() => formData.metric === 'interface_traffic')

// Computed
const needsMetricLabel = computed(() => {
  return formData.metric === 'interface_status' || formData.metric === 'interface_traffic'
})

// 计算属性：是否为接口状态类型
const isInterfaceStatus = computed(() => formData.metric === 'interface_status')

// Load data on mount
onMounted(() => {
  loadRules()
  loadChannels()
})

// Load alert rules
const loadRules = async () => {
  loading.value = true
  error.value = ''

  try {
    const response = await alertRulesApi.getAll()
    if (response.data.success && response.data.data) {
      rules.value = response.data.data
    } else {
      throw new Error(response.data.error || '获取告警规则失败')
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取告警规则失败'
    error.value = message
    ElMessage.error(message)
  } finally {
    loading.value = false
  }
}

// Load notification channels
const loadChannels = async () => {
  try {
    const response = await notificationChannelsApi.getAll()
    if (response.data.success && response.data.data) {
      notificationChannels.value = response.data.data
    }
  } catch (err) {
    console.error('Failed to load notification channels:', err)
  }
}

// Show create dialog
const showCreateDialog = () => {
  isEditing.value = false
  editingRuleId.value = null
  Object.assign(formData, getDefaultFormData())
  dialogVisible.value = true
}

// Edit rule
const editRule = (rule: AlertRule) => {
  isEditing.value = true
  editingRuleId.value = rule.id
  Object.assign(formData, {
    name: rule.name,
    enabled: rule.enabled,
    metric: rule.metric,
    metricLabel: rule.metricLabel || '',
    operator: rule.operator,
    threshold: rule.threshold,
    targetStatus: rule.targetStatus || 'down',
    duration: rule.duration,
    cooldownMs: rule.cooldownMs,
    severity: rule.severity,
    channels: [...rule.channels],
    autoResponse: {
      enabled: rule.autoResponse?.enabled || false,
      script: rule.autoResponse?.script || ''
    }
  })
  detailVisible.value = false
  dialogVisible.value = true
}

// Toggle rule enabled/disabled
const toggleRule = async (rule: AlertRule) => {
  try {
    if (rule.enabled) {
      await alertRulesApi.disable(rule.id)
      ElMessage.success('规则已禁用')
    } else {
      await alertRulesApi.enable(rule.id)
      ElMessage.success('规则已启用')
    }
    await loadRules()
  } catch (err) {
    const message = err instanceof Error ? err.message : '操作失败'
    ElMessage.error(message)
  }
}

// Delete rule
const deleteRule = async (rule: AlertRule) => {
  try {
    await alertRulesApi.delete(rule.id)
    ElMessage.success('规则已删除')
    await loadRules()
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除失败'
    ElMessage.error(message)
  }
}

// Submit form
const submitForm = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()
  } catch {
    return
  }

  submitting.value = true

  try {
    const data: CreateAlertRuleInput = {
      ...formData,
      metricLabel: needsMetricLabel.value ? formData.metricLabel : undefined,
      // 接口状态类型时包含 targetStatus，否则不包含
      targetStatus: isInterfaceStatus.value ? formData.targetStatus : undefined
    }

    if (isEditing.value && editingRuleId.value) {
      await alertRulesApi.update(editingRuleId.value, data)
      ElMessage.success('规则已更新')
    } else {
      await alertRulesApi.create(data)
      ElMessage.success('规则已创建')
    }

    dialogVisible.value = false
    await loadRules()
  } catch (err) {
    const message = err instanceof Error ? err.message : '操作失败'
    ElMessage.error(message)
  } finally {
    submitting.value = false
  }
}

// Reset form
const resetForm = () => {
  formRef.value?.resetFields()
  Object.assign(formData, getDefaultFormData())
}

// Handle row click
const handleRowClick = (row: AlertRule) => {
  selectedRule.value = row
  detailVisible.value = true
}

// Utility functions
const getMetricText = (metric: MetricType): string => {
  const texts: Record<MetricType, string> = {
    cpu: 'CPU',
    memory: '内存',
    disk: '磁盘',
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
    return ' KB/s'
  }
  return ''
}

const getOperatorText = (operator: AlertOperator): string => {
  const texts: Record<AlertOperator, string> = {
    gt: '>',
    lt: '<',
    eq: '=',
    ne: '≠',
    gte: '≥',
    lte: '≤'
  }
  return texts[operator] || operator
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

const getChannelTypeText = (type: ChannelType): string => {
  const texts: Record<ChannelType, string> = {
    web_push: 'Web 推送',
    webhook: 'Webhook',
    email: '邮件'
  }
  return texts[type] || type
}

const getChannelName = (channelId: string): string => {
  const channel = notificationChannels.value.find(c => c.id === channelId)
  return channel?.name || channelId
}

const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString('zh-CN')
}

const formatCooldown = (ms: number): string => {
  if (ms < 60000) return `${ms / 1000} 秒`
  if (ms < 3600000) return `${ms / 60000} 分钟`
  return `${ms / 3600000} 小时`
}

// 获取阈值输入框的占位符
const getThresholdPlaceholder = (): string => {
  switch (formData.metric) {
    case 'cpu':
    case 'memory':
    case 'disk':
      return '0-100'
    case 'interface_traffic':
      return 'KB/s'
    default:
      return ''
  }
}
</script>


<style scoped>
.alert-rules-view {
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

/* Table */
.metric-label {
  margin-left: 8px;
  color: #909399;
  font-size: 12px;
}

.condition-text {
  font-family: monospace;
  font-size: 13px;
  color: #606266;
}

/* Form styles */
.form-item-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
  line-height: 1.4;
}

.threshold-unit {
  font-size: 12px;
  color: #909399;
  margin-left: 4px;
}

/* Metric option in select */
.metric-option {
  display: flex;
  align-items: center;
  gap: 4px;
}

.metric-option-label {
  font-weight: 500;
}

.metric-option-unit {
  color: #909399;
  font-size: 12px;
}

/* Metric hint */
.metric-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #606266;
}

/* Status radio group */
.status-radio-group {
  width: 100%;
}

.status-radio-group .el-radio-button {
  flex: 1;
}

.status-option {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: center;
}

/* Severity radio group */
.severity-radio-group .el-radio-button__inner {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Traffic reference */
.traffic-reference {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-top: 4px;
}

.traffic-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.traffic-label {
  font-weight: 600;
  color: #303133;
  font-family: monospace;
}

.traffic-desc {
  font-size: 11px;
  color: #909399;
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

  .traffic-reference {
    grid-template-columns: 1fr;
  }
}

/* Pagination */
.pagination-container {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;
}
</style>

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
              {{ getOperatorText(row.operator) }} {{ row.threshold }}{{ getMetricUnit(row.metric) }}
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

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="指标类型" prop="metric">
              <el-select v-model="formData.metric" placeholder="选择指标" style="width: 100%">
                <el-option
                  v-for="item in metricOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item
              v-if="needsMetricLabel"
              label="接口名称"
              prop="metricLabel"
            >
              <el-input v-model="formData.metricLabel" placeholder="如 ether1" />
            </el-form-item>
          </el-col>
        </el-row>

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
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="持续次数" prop="duration">
              <el-input-number
                v-model="formData.duration"
                :min="1"
                :max="100"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="冷却时间" prop="cooldownMs">
              <el-input-number
                v-model="formData.cooldownMs"
                :min="0"
                :step="60000"
                style="width: 100%"
              >
                <template #append>毫秒</template>
              </el-input-number>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="严重级别" prop="severity">
          <el-radio-group v-model="formData.severity">
            <el-radio value="info">信息</el-radio>
            <el-radio value="warning">警告</el-radio>
            <el-radio value="critical">严重</el-radio>
            <el-radio value="emergency">紧急</el-radio>
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
            placeholder="输入 RouterOS 脚本"
          />
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
        <el-descriptions-item label="运算符">{{ getOperatorText(selectedRule.operator) }}</el-descriptions-item>
        <el-descriptions-item label="阈值">{{ selectedRule.threshold }}{{ getMetricUnit(selectedRule.metric) }}</el-descriptions-item>
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
import { Refresh, Plus, Bell } from '@element-plus/icons-vue'
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

// Form validation rules
const formRules: FormRules = {
  name: [
    { required: true, message: '请输入规则名称', trigger: 'blur' },
    { min: 2, max: 50, message: '长度在 2 到 50 个字符', trigger: 'blur' }
  ],
  metric: [{ required: true, message: '请选择指标类型', trigger: 'change' }],
  operator: [{ required: true, message: '请选择运算符', trigger: 'change' }],
  threshold: [{ required: true, message: '请输入阈值', trigger: 'blur' }],
  duration: [{ required: true, message: '请输入持续次数', trigger: 'blur' }],
  cooldownMs: [{ required: true, message: '请输入冷却时间', trigger: 'blur' }],
  severity: [{ required: true, message: '请选择严重级别', trigger: 'change' }]
}

// Options
const metricOptions = [
  { value: 'cpu', label: 'CPU 使用率' },
  { value: 'memory', label: '内存使用率' },
  { value: 'disk', label: '磁盘使用率' },
  { value: 'interface_status', label: '接口状态' },
  { value: 'interface_traffic', label: '接口流量' }
]

const operatorOptions = [
  { value: 'gt', label: '大于 (>)' },
  { value: 'gte', label: '大于等于 (>=)' },
  { value: 'lt', label: '小于 (<)' },
  { value: 'lte', label: '小于等于 (<=)' },
  { value: 'eq', label: '等于 (=)' },
  { value: 'ne', label: '不等于 (!=)' }
]

// Computed
const needsMetricLabel = computed(() => {
  return formData.metric === 'interface_status' || formData.metric === 'interface_traffic'
})

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
      metricLabel: needsMetricLabel.value ? formData.metricLabel : undefined
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
    return ' B/s'
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

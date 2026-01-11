<template>
  <div class="ipv6-firewall-filter-view">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>IPv6 防火墙 Filter 规则</span>
          <div class="header-actions">
            <el-select
              v-model="chainFilter"
              placeholder="按 Chain 筛选"
              clearable
              style="width: 150px; margin-right: 8px"
            >
              <el-option label="input" value="input" />
              <el-option label="forward" value="forward" />
              <el-option label="output" value="output" />
            </el-select>
            <el-button type="primary" :icon="Plus" @click="handleAdd">
              新增
            </el-button>
            <el-button
              :icon="Refresh"
              :loading="loading"
              @click="loadFilterRules"
            >
              刷新
            </el-button>
          </div>
        </div>
      </template>

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
      />

      <!-- Filter Rules Table -->
      <el-table
        v-else
        v-loading="loading"
        :data="filteredRules"
        stripe
        style="width: 100%"
        @row-click="handleRowClick"
      >
        <el-table-column prop="chain" label="Chain" width="100" sortable />
        <el-table-column prop="action" label="Action" width="120">
          <template #default="{ row }">
            <el-tag :type="getActionType(row.action)" size="small">
              {{ row.action }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="src-address" label="源地址" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row['src-address'] || row['src-address-list'] || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="dst-address" label="目标地址" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row['dst-address'] || row['dst-address-list'] || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="protocol" label="协议" width="80">
          <template #default="{ row }">
            {{ row.protocol || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="端口" width="120" show-overflow-tooltip>
          <template #default="{ row }">
            {{ getPortDisplay(row) }}
          </template>
        </el-table-column>
        <el-table-column label="接口" width="120" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row['in-interface'] || row['out-interface'] || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.disabled ? 'danger' : 'success'" size="small">
              {{ row.disabled ? '禁用' : '启用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="comment" label="备注" min-width="120" show-overflow-tooltip />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" link @click.stop="showDetail(row)">
              详情
            </el-button>
            <el-button size="small" type="warning" link @click.stop="handleEdit(row)">
              编辑
            </el-button>
            <el-button
              size="small"
              :type="row.disabled ? 'success' : 'info'"
              link
              @click.stop="handleToggleStatus(row)"
            >
              {{ row.disabled ? '启用' : '禁用' }}
            </el-button>
            <el-button size="small" type="danger" link @click.stop="handleDelete(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Detail Dialog -->
    <el-dialog
      v-model="detailVisible"
      title="IPv6 Filter 规则详情"
      width="700px"
      destroy-on-close
    >
      <el-descriptions :column="2" border v-if="selectedRule">
        <el-descriptions-item label="ID">{{ selectedRule['.id'] }}</el-descriptions-item>
        <el-descriptions-item label="Chain">{{ selectedRule.chain }}</el-descriptions-item>
        <el-descriptions-item label="Action">
          <el-tag :type="getActionType(selectedRule.action)" size="small">
            {{ selectedRule.action }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="selectedRule.disabled ? 'danger' : 'success'" size="small">
            {{ selectedRule.disabled ? '禁用' : '启用' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="源地址">{{ selectedRule['src-address'] || '-' }}</el-descriptions-item>
        <el-descriptions-item label="目标地址">{{ selectedRule['dst-address'] || '-' }}</el-descriptions-item>
        <el-descriptions-item label="源地址列表">{{ selectedRule['src-address-list'] || '-' }}</el-descriptions-item>
        <el-descriptions-item label="目标地址列表">{{ selectedRule['dst-address-list'] || '-' }}</el-descriptions-item>
        <el-descriptions-item label="协议">{{ selectedRule.protocol || '-' }}</el-descriptions-item>
        <el-descriptions-item label="源端口">{{ selectedRule['src-port'] || '-' }}</el-descriptions-item>
        <el-descriptions-item label="目标端口">{{ selectedRule['dst-port'] || '-' }}</el-descriptions-item>
        <el-descriptions-item label="任意端口">{{ selectedRule['any-port'] || '-' }}</el-descriptions-item>
        <el-descriptions-item label="入接口">{{ selectedRule['in-interface'] || '-' }}</el-descriptions-item>
        <el-descriptions-item label="出接口">{{ selectedRule['out-interface'] || '-' }}</el-descriptions-item>
        <el-descriptions-item label="入接口列表">{{ selectedRule['in-interface-list'] || '-' }}</el-descriptions-item>
        <el-descriptions-item label="出接口列表">{{ selectedRule['out-interface-list'] || '-' }}</el-descriptions-item>
        <el-descriptions-item label="连接状态">{{ selectedRule['connection-state'] || '-' }}</el-descriptions-item>
        <el-descriptions-item label="连接类型">{{ selectedRule['connection-type'] || '-' }}</el-descriptions-item>
        <el-descriptions-item label="连接 NAT 状态">{{ selectedRule['connection-nat-state'] || '-' }}</el-descriptions-item>
        <el-descriptions-item label="数据包标记">{{ selectedRule['packet-mark'] || '-' }}</el-descriptions-item>
        <el-descriptions-item label="连接标记">{{ selectedRule['connection-mark'] || '-' }}</el-descriptions-item>
        <el-descriptions-item label="路由标记">{{ selectedRule['routing-mark'] || '-' }}</el-descriptions-item>
        <el-descriptions-item label="动态规则">{{ selectedRule.dynamic ? '是' : '否' }}</el-descriptions-item>
        <el-descriptions-item label="字节数">{{ formatBytes(selectedRule.bytes) }}</el-descriptions-item>
        <el-descriptions-item label="数据包数">{{ selectedRule.packets || 0 }}</el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">{{ selectedRule.comment || '-' }}</el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- Add/Edit Dialog -->
    <el-dialog
      v-model="formVisible"
      :title="isEdit ? '编辑 IPv6 Filter 规则' : '新增 IPv6 Filter 规则'"
      width="750px"
      destroy-on-close
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="110px"
      >
        <el-tabs v-model="activeTab">
          <el-tab-pane label="基本设置" name="basic">
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="Chain" prop="chain">
                  <el-select v-model="formData.chain" placeholder="选择 Chain" style="width: 100%">
                    <el-option label="input" value="input" />
                    <el-option label="forward" value="forward" />
                    <el-option label="output" value="output" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="Action" prop="action">
                  <el-select v-model="formData.action" placeholder="选择 Action" style="width: 100%">
                    <el-option label="accept" value="accept" />
                    <el-option label="drop" value="drop" />
                    <el-option label="reject" value="reject" />
                    <el-option label="jump" value="jump" />
                    <el-option label="return" value="return" />
                    <el-option label="log" value="log" />
                    <el-option label="passthrough" value="passthrough" />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="源地址" prop="src-address">
                  <el-input v-model="formData['src-address']" placeholder="如: 2001:db8::/32" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="目标地址" prop="dst-address">
                  <el-input v-model="formData['dst-address']" placeholder="如: 2001:db8::1/128" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="源地址列表" prop="src-address-list">
                  <el-input v-model="formData['src-address-list']" placeholder="如: my_list" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="目标地址列表" prop="dst-address-list">
                  <el-input v-model="formData['dst-address-list']" placeholder="如: blocked_ips" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="协议" prop="protocol">
                  <el-select v-model="formData.protocol" placeholder="选择协议" clearable style="width: 100%">
                    <el-option label="tcp" value="tcp" />
                    <el-option label="udp" value="udp" />
                    <el-option label="icmpv6" value="icmpv6" />
                    <el-option label="gre" value="gre" />
                    <el-option label="esp" value="esp" />
                    <el-option label="ah" value="ah" />
                    <el-option label="ipv6" value="ipv6" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="连接状态" prop="connection-state">
                  <el-select v-model="formData['connection-state']" placeholder="选择连接状态" clearable style="width: 100%">
                    <el-option label="established" value="established" />
                    <el-option label="new" value="new" />
                    <el-option label="related" value="related" />
                    <el-option label="invalid" value="invalid" />
                    <el-option label="untracked" value="untracked" />
                    <el-option label="established,related" value="established,related" />
                    <el-option label="established,related,untracked" value="established,related,untracked" />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>
            <el-form-item label="备注" prop="comment">
              <el-input v-model="formData.comment" placeholder="规则备注" />
            </el-form-item>
          </el-tab-pane>

          <el-tab-pane label="端口设置" name="ports">
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="源端口" prop="src-port">
                  <el-input v-model="formData['src-port']" placeholder="如: 1024-65535" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="目标端口" prop="dst-port">
                  <el-input v-model="formData['dst-port']" placeholder="如: 80,443 或 80-443" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="任意端口" prop="any-port">
                  <el-input v-model="formData['any-port']" placeholder="如: 22" />
                </el-form-item>
              </el-col>
            </el-row>
          </el-tab-pane>

          <el-tab-pane label="接口设置" name="interfaces">
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="入接口" prop="in-interface">
                  <el-input v-model="formData['in-interface']" placeholder="如: ether1" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="出接口" prop="out-interface">
                  <el-input v-model="formData['out-interface']" placeholder="如: ether2" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="入接口列表" prop="in-interface-list">
                  <el-input v-model="formData['in-interface-list']" placeholder="如: LAN" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="出接口列表" prop="out-interface-list">
                  <el-input v-model="formData['out-interface-list']" placeholder="如: WAN" />
                </el-form-item>
              </el-col>
            </el-row>
          </el-tab-pane>

          <el-tab-pane label="高级设置" name="advanced">
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="数据包标记" prop="packet-mark">
                  <el-input v-model="formData['packet-mark']" placeholder="如: my_mark" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="连接标记" prop="connection-mark">
                  <el-input v-model="formData['connection-mark']" placeholder="如: conn_mark" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="路由标记" prop="routing-mark">
                  <el-input v-model="formData['routing-mark']" placeholder="如: route_mark" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="连接类型" prop="connection-type">
                  <el-input v-model="formData['connection-type']" placeholder="如: ftp" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="连接 NAT 状态" prop="connection-nat-state">
                  <el-select v-model="formData['connection-nat-state']" placeholder="选择 NAT 状态" clearable style="width: 100%">
                    <el-option label="srcnat" value="srcnat" />
                    <el-option label="dstnat" value="dstnat" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="ICMP 选项" prop="icmp-options">
                  <el-input v-model="formData['icmp-options']" placeholder="如: 128:0" />
                </el-form-item>
              </el-col>
            </el-row>
          </el-tab-pane>
        </el-tabs>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">
          {{ isEdit ? '保存' : '创建' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue'
import { ElMessage, ElMessageBox, FormInstance, FormRules } from 'element-plus'
import { Refresh, Plus } from '@element-plus/icons-vue'
import { ipv6Api } from '@/api'

// IPv6 Filter Rule type definition
interface IPv6FilterRule {
  '.id': string
  chain: string
  action: string
  'src-address'?: string
  'dst-address'?: string
  'src-address-list'?: string
  'dst-address-list'?: string
  protocol?: string
  'src-port'?: string
  'dst-port'?: string
  'any-port'?: string
  'in-interface'?: string
  'out-interface'?: string
  'in-interface-list'?: string
  'out-interface-list'?: string
  'packet-mark'?: string
  'connection-mark'?: string
  'routing-mark'?: string
  'connection-type'?: string
  'connection-state'?: string
  'connection-nat-state'?: string
  'icmp-options'?: string
  disabled: boolean
  dynamic: boolean
  comment?: string
  bytes?: number
  packets?: number
}

// Form data type
interface FilterFormData {
  chain: string
  action: string
  'src-address'?: string
  'dst-address'?: string
  'src-address-list'?: string
  'dst-address-list'?: string
  protocol?: string
  'src-port'?: string
  'dst-port'?: string
  'any-port'?: string
  'in-interface'?: string
  'out-interface'?: string
  'in-interface-list'?: string
  'out-interface-list'?: string
  'packet-mark'?: string
  'connection-mark'?: string
  'routing-mark'?: string
  'connection-type'?: string
  'connection-state'?: string
  'connection-nat-state'?: string
  'icmp-options'?: string
  comment?: string
}

// State
const loading = ref(false)
const error = ref('')
const rules = ref<IPv6FilterRule[]>([])
const chainFilter = ref('')
const detailVisible = ref(false)
const selectedRule = ref<IPv6FilterRule | null>(null)
const formVisible = ref(false)
const isEdit = ref(false)
const editingId = ref('')
const submitting = ref(false)
const formRef = ref<FormInstance>()
const activeTab = ref('basic')

// Form data
const defaultFormData: FilterFormData = {
  chain: 'input',
  action: 'accept',
  'src-address': '',
  'dst-address': '',
  'src-address-list': '',
  'dst-address-list': '',
  protocol: '',
  'src-port': '',
  'dst-port': '',
  'any-port': '',
  'in-interface': '',
  'out-interface': '',
  'in-interface-list': '',
  'out-interface-list': '',
  'packet-mark': '',
  'connection-mark': '',
  'routing-mark': '',
  'connection-type': '',
  'connection-state': '',
  'connection-nat-state': '',
  'icmp-options': '',
  comment: ''
}

const formData = reactive<FilterFormData>({ ...defaultFormData })

// Form validation rules
const formRules: FormRules = {
  chain: [{ required: true, message: '请选择 Chain', trigger: 'change' }],
  action: [{ required: true, message: '请选择 Action', trigger: 'change' }]
}

// Computed filtered rules
const filteredRules = computed(() => {
  if (!chainFilter.value) {
    return rules.value
  }
  return rules.value.filter(rule => rule.chain === chainFilter.value)
})

// Load filter rules on mount
onMounted(() => {
  loadFilterRules()
})

// Convert string boolean to real boolean
const toBool = (val: unknown): boolean => {
  if (typeof val === 'boolean') return val
  if (typeof val === 'string') return val.toLowerCase() === 'true'
  return Boolean(val)
}

// Load all filter rules
const loadFilterRules = async () => {
  loading.value = true
  error.value = ''

  try {
    const response = await ipv6Api.getFirewallFilters()
    const result = response.data
    if (result.success && Array.isArray(result.data)) {
      rules.value = result.data.map((rule: IPv6FilterRule) => ({
        ...rule,
        disabled: toBool(rule.disabled),
        dynamic: toBool(rule.dynamic)
      }))
    } else {
      rules.value = []
      if (!result.success && result.error) {
        throw new Error(result.error)
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '加载 IPv6 Filter 规则列表失败'
    error.value = message
    ElMessage.error(message)
  } finally {
    loading.value = false
  }
}

// Handle row click
const handleRowClick = (row: IPv6FilterRule) => {
  showDetail(row)
}

// Show rule detail
const showDetail = (row: IPv6FilterRule) => {
  selectedRule.value = row
  detailVisible.value = true
}

// Handle add
const handleAdd = () => {
  isEdit.value = false
  editingId.value = ''
  activeTab.value = 'basic'
  Object.assign(formData, defaultFormData)
  formVisible.value = true
}

// Handle edit
const handleEdit = (row: IPv6FilterRule) => {
  isEdit.value = true
  editingId.value = row['.id']
  activeTab.value = 'basic'
  Object.assign(formData, {
    chain: row.chain,
    action: row.action,
    'src-address': row['src-address'] || '',
    'dst-address': row['dst-address'] || '',
    'src-address-list': row['src-address-list'] || '',
    'dst-address-list': row['dst-address-list'] || '',
    protocol: row.protocol || '',
    'src-port': row['src-port'] || '',
    'dst-port': row['dst-port'] || '',
    'any-port': row['any-port'] || '',
    'in-interface': row['in-interface'] || '',
    'out-interface': row['out-interface'] || '',
    'in-interface-list': row['in-interface-list'] || '',
    'out-interface-list': row['out-interface-list'] || '',
    'packet-mark': row['packet-mark'] || '',
    'connection-mark': row['connection-mark'] || '',
    'routing-mark': row['routing-mark'] || '',
    'connection-type': row['connection-type'] || '',
    'connection-state': row['connection-state'] || '',
    'connection-nat-state': row['connection-nat-state'] || '',
    'icmp-options': row['icmp-options'] || '',
    comment: row.comment || ''
  })
  formVisible.value = true
}

// Handle submit
const handleSubmit = async () => {
  if (!formRef.value) return
  
  try {
    await formRef.value.validate()
  } catch {
    return
  }

  submitting.value = true

  try {
    // Clean up empty fields
    const submitData: Record<string, string> = {
      chain: formData.chain,
      action: formData.action
    }
    
    if (formData['src-address']) submitData['src-address'] = formData['src-address']
    if (formData['dst-address']) submitData['dst-address'] = formData['dst-address']
    if (formData['src-address-list']) submitData['src-address-list'] = formData['src-address-list']
    if (formData['dst-address-list']) submitData['dst-address-list'] = formData['dst-address-list']
    if (formData.protocol) submitData.protocol = formData.protocol
    if (formData['src-port']) submitData['src-port'] = formData['src-port']
    if (formData['dst-port']) submitData['dst-port'] = formData['dst-port']
    if (formData['any-port']) submitData['any-port'] = formData['any-port']
    if (formData['in-interface']) submitData['in-interface'] = formData['in-interface']
    if (formData['out-interface']) submitData['out-interface'] = formData['out-interface']
    if (formData['in-interface-list']) submitData['in-interface-list'] = formData['in-interface-list']
    if (formData['out-interface-list']) submitData['out-interface-list'] = formData['out-interface-list']
    if (formData['packet-mark']) submitData['packet-mark'] = formData['packet-mark']
    if (formData['connection-mark']) submitData['connection-mark'] = formData['connection-mark']
    if (formData['routing-mark']) submitData['routing-mark'] = formData['routing-mark']
    if (formData['connection-type']) submitData['connection-type'] = formData['connection-type']
    if (formData['connection-state']) submitData['connection-state'] = formData['connection-state']
    if (formData['connection-nat-state']) submitData['connection-nat-state'] = formData['connection-nat-state']
    if (formData['icmp-options']) submitData['icmp-options'] = formData['icmp-options']
    if (formData.comment) submitData.comment = formData.comment

    if (isEdit.value) {
      await ipv6Api.updateFirewallFilter(editingId.value, submitData)
      ElMessage.success('IPv6 Filter 规则已更新')
    } else {
      await ipv6Api.createFirewallFilter(submitData)
      ElMessage.success('IPv6 Filter 规则已创建')
    }

    formVisible.value = false
    loadFilterRules()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : (isEdit.value ? '更新 IPv6 Filter 规则失败' : '创建 IPv6 Filter 规则失败')
    ElMessage.error(message)
  } finally {
    submitting.value = false
  }
}

// Handle delete
const handleDelete = async (row: IPv6FilterRule) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除此 IPv6 Filter 规则吗？`,
      '确认删除',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await ipv6Api.deleteFirewallFilter(row['.id'])
    ElMessage.success('IPv6 Filter 规则已删除')
    loadFilterRules()
  } catch (err: unknown) {
    if (err !== 'cancel') {
      const message = err instanceof Error ? err.message : '删除 IPv6 Filter 规则失败'
      ElMessage.error(message)
    }
  }
}

// Handle toggle status (enable/disable)
const handleToggleStatus = async (row: IPv6FilterRule) => {
  try {
    if (row.disabled) {
      await ipv6Api.enableFirewallFilter(row['.id'])
      ElMessage.success('IPv6 Filter 规则已启用')
    } else {
      await ipv6Api.disableFirewallFilter(row['.id'])
      ElMessage.success('IPv6 Filter 规则已禁用')
    }
    loadFilterRules()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '操作失败'
    ElMessage.error(message)
  }
}

// Get action tag type
const getActionType = (action: string): 'success' | 'danger' | 'warning' | 'info' | 'primary' => {
  switch (action) {
    case 'accept':
      return 'success'
    case 'drop':
      return 'danger'
    case 'reject':
      return 'warning'
    case 'jump':
    case 'return':
      return 'info'
    case 'log':
      return 'primary'
    default:
      return 'info'
  }
}

// Get port display
const getPortDisplay = (row: IPv6FilterRule) => {
  const srcPort = row['src-port']
  const dstPort = row['dst-port']
  const anyPort = row['any-port']
  if (anyPort) {
    return `any: ${anyPort}`
  }
  if (srcPort && dstPort) {
    return `${srcPort} → ${dstPort}`
  }
  if (dstPort) {
    return `→ ${dstPort}`
  }
  if (srcPort) {
    return `${srcPort} →`
  }
  return '-'
}

// Format bytes
const formatBytes = (bytes?: number) => {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
</script>

<style scoped>
.ipv6-firewall-filter-view {
  height: 100%;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 18px;
  font-weight: 600;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>

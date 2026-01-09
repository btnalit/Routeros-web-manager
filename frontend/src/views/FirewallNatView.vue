<template>
  <div class="firewall-nat-view">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>防火墙 NAT 规则</span>
          <div class="header-actions">
            <el-select
              v-model="chainFilter"
              placeholder="按 Chain 筛选"
              clearable
              style="width: 150px; margin-right: 8px"
            >
              <el-option label="srcnat" value="srcnat" />
              <el-option label="dstnat" value="dstnat" />
            </el-select>
            <el-button type="primary" :icon="Plus" @click="handleAdd">
              新增
            </el-button>
            <el-button
              :icon="Refresh"
              :loading="loading"
              @click="loadNatRules"
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

      <!-- NAT Rules Table -->
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
        <el-table-column prop="src-address" label="源地址" min-width="130" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row['src-address'] || row['src-address-list'] || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="dst-address" label="目标地址" min-width="130" show-overflow-tooltip>
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
        <el-table-column label="转换地址" width="130" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row['to-addresses'] || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="转换端口" width="100" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row['to-ports'] || '-' }}
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
      title="NAT 规则详情"
      width="650px"
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
        <el-descriptions-item label="转换地址">{{ selectedRule['to-addresses'] || '-' }}</el-descriptions-item>
        <el-descriptions-item label="转换端口">{{ selectedRule['to-ports'] || '-' }}</el-descriptions-item>
        <el-descriptions-item label="入接口">{{ selectedRule['in-interface'] || '-' }}</el-descriptions-item>
        <el-descriptions-item label="出接口">{{ selectedRule['out-interface'] || '-' }}</el-descriptions-item>
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
      :title="isEdit ? '编辑 NAT 规则' : '新增 NAT 规则'"
      width="650px"
      destroy-on-close
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="100px"
      >
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="Chain" prop="chain">
              <el-select v-model="formData.chain" placeholder="选择 Chain" style="width: 100%">
                <el-option label="srcnat" value="srcnat" />
                <el-option label="dstnat" value="dstnat" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="Action" prop="action">
              <el-select v-model="formData.action" placeholder="选择 Action" style="width: 100%">
                <el-option label="masquerade" value="masquerade" />
                <el-option label="src-nat" value="src-nat" />
                <el-option label="dst-nat" value="dst-nat" />
                <el-option label="redirect" value="redirect" />
                <el-option label="netmap" value="netmap" />
                <el-option label="accept" value="accept" />
                <el-option label="passthrough" value="passthrough" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="源地址" prop="src-address">
              <el-input v-model="formData['src-address']" placeholder="如: 192.168.1.0/24" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="目标地址" prop="dst-address">
              <el-input v-model="formData['dst-address']" placeholder="如: 10.0.0.1" />
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
                <el-option label="icmp" value="icmp" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="目标端口" prop="dst-port">
              <el-input v-model="formData['dst-port']" placeholder="如: 80 或 80-443" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="转换地址" prop="to-addresses">
              <el-input v-model="formData['to-addresses']" placeholder="如: 192.168.1.100" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="转换端口" prop="to-ports">
              <el-input v-model="formData['to-ports']" placeholder="如: 8080" />
            </el-form-item>
          </el-col>
        </el-row>
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
        <el-form-item label="备注" prop="comment">
          <el-input v-model="formData.comment" placeholder="规则备注" />
        </el-form-item>
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
import { firewallApi } from '@/api'

// NAT Rule type definition
interface NatRule {
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
  'to-addresses'?: string
  'to-ports'?: string
  'in-interface'?: string
  'out-interface'?: string
  disabled: boolean
  dynamic: boolean
  comment?: string
  bytes?: number
  packets?: number
}

// Form data type
interface NatFormData {
  chain: string
  action: string
  'src-address'?: string
  'dst-address'?: string
  'src-address-list'?: string
  'dst-address-list'?: string
  protocol?: string
  'dst-port'?: string
  'to-addresses'?: string
  'to-ports'?: string
  'in-interface'?: string
  'out-interface'?: string
  comment?: string
}

// State
const loading = ref(false)
const error = ref('')
const rules = ref<NatRule[]>([])
const chainFilter = ref('')
const detailVisible = ref(false)
const selectedRule = ref<NatRule | null>(null)
const formVisible = ref(false)
const isEdit = ref(false)
const editingId = ref('')
const submitting = ref(false)
const formRef = ref<FormInstance>()

// Form data
const defaultFormData: NatFormData = {
  chain: 'dstnat',
  action: 'dst-nat',
  'src-address': '',
  'dst-address': '',
  'src-address-list': '',
  'dst-address-list': '',
  protocol: '',
  'dst-port': '',
  'to-addresses': '',
  'to-ports': '',
  'in-interface': '',
  'out-interface': '',
  comment: ''
}

const formData = reactive<NatFormData>({ ...defaultFormData })

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

// Load NAT rules on mount
onMounted(() => {
  loadNatRules()
})

// Convert string boolean to real boolean
const toBool = (val: unknown): boolean => {
  if (typeof val === 'boolean') return val
  if (typeof val === 'string') return val.toLowerCase() === 'true'
  return Boolean(val)
}

// Load all NAT rules
const loadNatRules = async () => {
  loading.value = true
  error.value = ''

  try {
    const response = await firewallApi.getNats()
    const result = response.data
    if (result.success && Array.isArray(result.data)) {
      rules.value = result.data.map((rule: NatRule) => ({
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
    const message = err instanceof Error ? err.message : '加载 NAT 规则列表失败'
    error.value = message
    ElMessage.error(message)
  } finally {
    loading.value = false
  }
}

// Handle row click
const handleRowClick = (row: NatRule) => {
  showDetail(row)
}

// Show rule detail
const showDetail = (row: NatRule) => {
  selectedRule.value = row
  detailVisible.value = true
}

// Handle add
const handleAdd = () => {
  isEdit.value = false
  editingId.value = ''
  Object.assign(formData, defaultFormData)
  formVisible.value = true
}

// Handle edit
const handleEdit = (row: NatRule) => {
  isEdit.value = true
  editingId.value = row['.id']
  Object.assign(formData, {
    chain: row.chain,
    action: row.action,
    'src-address': row['src-address'] || '',
    'dst-address': row['dst-address'] || '',
    'src-address-list': row['src-address-list'] || '',
    'dst-address-list': row['dst-address-list'] || '',
    protocol: row.protocol || '',
    'dst-port': row['dst-port'] || '',
    'to-addresses': row['to-addresses'] || '',
    'to-ports': row['to-ports'] || '',
    'in-interface': row['in-interface'] || '',
    'out-interface': row['out-interface'] || '',
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
    if (formData['dst-port']) submitData['dst-port'] = formData['dst-port']
    if (formData['to-addresses']) submitData['to-addresses'] = formData['to-addresses']
    if (formData['to-ports']) submitData['to-ports'] = formData['to-ports']
    if (formData['in-interface']) submitData['in-interface'] = formData['in-interface']
    if (formData['out-interface']) submitData['out-interface'] = formData['out-interface']
    if (formData.comment) submitData.comment = formData.comment

    if (isEdit.value) {
      await firewallApi.updateNat(editingId.value, submitData)
      ElMessage.success('NAT 规则已更新')
    } else {
      await firewallApi.createNat(submitData)
      ElMessage.success('NAT 规则已创建')
    }

    formVisible.value = false
    loadNatRules()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : (isEdit.value ? '更新 NAT 规则失败' : '创建 NAT 规则失败')
    ElMessage.error(message)
  } finally {
    submitting.value = false
  }
}

// Handle delete
const handleDelete = async (row: NatRule) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除此 NAT 规则吗？`,
      '确认删除',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await firewallApi.deleteNat(row['.id'])
    ElMessage.success('NAT 规则已删除')
    loadNatRules()
  } catch (err: unknown) {
    if (err !== 'cancel') {
      const message = err instanceof Error ? err.message : '删除 NAT 规则失败'
      ElMessage.error(message)
    }
  }
}

// Handle toggle status (enable/disable)
const handleToggleStatus = async (row: NatRule) => {
  try {
    if (row.disabled) {
      await firewallApi.enableNat(row['.id'])
      ElMessage.success('NAT 规则已启用')
    } else {
      await firewallApi.disableNat(row['.id'])
      ElMessage.success('NAT 规则已禁用')
    }
    loadNatRules()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '操作失败'
    ElMessage.error(message)
  }
}

// Get action tag type
const getActionType = (action: string): 'success' | 'danger' | 'warning' | 'info' | 'primary' => {
  switch (action) {
    case 'masquerade':
    case 'accept':
      return 'success'
    case 'dst-nat':
    case 'src-nat':
      return 'primary'
    case 'redirect':
      return 'warning'
    case 'netmap':
      return 'info'
    default:
      return 'info'
  }
}

// Get port display
const getPortDisplay = (row: NatRule) => {
  const srcPort = row['src-port']
  const dstPort = row['dst-port']
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
.firewall-nat-view {
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

<template>
  <div class="veth-interface-view">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>VETH 虚拟接口</span>
          <div class="header-actions">
            <el-button type="primary" :icon="Plus" @click="handleAdd">
              新增
            </el-button>
            <el-button
              :icon="Refresh"
              :loading="loading"
              @click="loadVethInterfaces"
            >
              刷新
            </el-button>
          </div>
        </div>
      </template>

      <!-- Loading State -->
      <el-skeleton v-if="loading && vethInterfaces.length === 0" :rows="5" animated />

      <!-- Error State -->
      <el-alert
        v-else-if="error"
        :title="error"
        type="error"
        show-icon
        closable
        @close="error = ''"
      />

      <!-- Empty State -->
      <el-empty
        v-else-if="vethInterfaces.length === 0"
        description="暂无 VETH 接口"
      >
        <el-button type="primary" @click="handleAdd">创建 VETH 接口</el-button>
      </el-empty>

      <!-- VETH Interface Table -->
      <el-table
        v-else
        v-loading="loading"
        :data="vethInterfaces"
        stripe
        style="width: 100%"
        @row-click="handleRowClick"
      >
        <el-table-column prop="name" label="名称" min-width="120" sortable />
        <el-table-column prop="mac-address" label="MAC 地址" min-width="150" />
        <el-table-column prop="address" label="IP 地址" min-width="150" />
        <el-table-column prop="gateway" label="网关" min-width="130" />
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row)" size="small">
              {{ getStatusText(row) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="comment" label="备注" min-width="150" show-overflow-tooltip />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button-group>
              <el-button
                size="small"
                type="primary"
                @click.stop="handleEdit(row)"
              >
                编辑
              </el-button>
              <el-button
                size="small"
                type="danger"
                @click.stop="handleDelete(row)"
              >
                删除
              </el-button>
            </el-button-group>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Detail Dialog -->
    <el-dialog
      v-model="detailDialogVisible"
      title="VETH 接口详情"
      width="500px"
      destroy-on-close
    >
      <el-descriptions v-if="selectedInterface" :column="1" border>
        <el-descriptions-item label="名称">
          {{ selectedInterface.name }}
        </el-descriptions-item>
        <el-descriptions-item label="MAC 地址">
          {{ selectedInterface['mac-address'] || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="IP 地址">
          {{ selectedInterface.address || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="IPv4 网关">
          {{ selectedInterface.gateway || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="IPv6 网关">
          {{ selectedInterface.gateway6 || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="MTU">
          {{ selectedInterface.mtu || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusType(selectedInterface)" size="small">
            {{ getStatusText(selectedInterface) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="运行状态">
          <el-tag :type="selectedInterface.running ? 'success' : 'info'" size="small">
            {{ selectedInterface.running ? '运行中' : '未运行' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="备注">
          {{ selectedInterface.comment || '-' }}
        </el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="detailDialogVisible = false">关闭</el-button>
        <el-button type="primary" @click="handleEditFromDetail">编辑</el-button>
      </template>
    </el-dialog>

    <!-- Add/Edit Dialog -->
    <el-dialog
      v-model="editDialogVisible"
      :title="isAdding ? '新增 VETH 接口' : '编辑 VETH 接口'"
      width="550px"
      destroy-on-close
      @closed="resetForm"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="formRules"
        label-width="100px"
        :disabled="saving"
      >
        <el-form-item label="接口名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入接口名称，如 veth1" />
        </el-form-item>
        <el-form-item label="MAC 地址" prop="mac-address">
          <el-input v-model="form['mac-address']" placeholder="如 30:C5:DF:45:2B:FB（可选）" />
        </el-form-item>
        <el-form-item label="IP 地址" prop="address">
          <el-input v-model="form.address" placeholder="支持多个地址用逗号分隔，如 172.18.0.1/24,IPv6地址/64" />
        </el-form-item>
        <el-form-item label="IPv4 网关" prop="gateway">
          <el-input v-model="form.gateway" placeholder="如 192.168.1.254（可选）" />
        </el-form-item>
        <el-form-item label="IPv6 网关" prop="gateway6">
          <el-input v-model="form.gateway6" placeholder="IPv6 网关地址（可选）" />
        </el-form-item>
        <el-form-item label="备注" prop="comment">
          <el-input
            v-model="form.comment"
            type="textarea"
            :rows="2"
            placeholder="请输入备注信息"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Refresh, Plus } from '@element-plus/icons-vue'
import { vethApi } from '@/api'

// VETH Interface type definition
interface VethInterface {
  '.id': string
  name: string
  'mac-address'?: string
  address?: string
  gateway?: string
  gateway6?: string
  mtu?: number
  disabled: boolean
  running: boolean
  comment?: string
}

// State
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const vethInterfaces = ref<VethInterface[]>([])

// Detail dialog
const detailDialogVisible = ref(false)
const selectedInterface = ref<VethInterface | null>(null)

// Edit dialog
const editDialogVisible = ref(false)
const isAdding = ref(false)
const formRef = ref<FormInstance>()
const form = reactive({
  id: '',
  name: '',
  'mac-address': '',
  address: '',
  gateway: '',
  gateway6: '',
  comment: ''
})

// Validation functions
const validateMacAddress = (_rule: unknown, value: string, callback: (error?: Error) => void) => {
  if (!value) {
    callback()
    return
  }
  const macRegex = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/
  if (!macRegex.test(value)) {
    callback(new Error('MAC 地址格式无效，应为 XX:XX:XX:XX:XX:XX'))
  } else {
    callback()
  }
}

// Validate a single IPv4 address with optional CIDR
const isValidIPv4 = (addr: string): boolean => {
  const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/
  if (!cidrRegex.test(addr)) return false
  
  const ipPart = addr.split('/')[0]
  const octets = ipPart.split('.')
  for (const octet of octets) {
    const num = parseInt(octet, 10)
    if (num < 0 || num > 255) return false
  }
  
  if (addr.includes('/')) {
    const prefix = parseInt(addr.split('/')[1], 10)
    if (prefix < 0 || prefix > 32) return false
  }
  return true
}

// Validate a single IPv6 address with optional CIDR
const isValidIPv6 = (addr: string): boolean => {
  // Split CIDR prefix if present
  const parts = addr.split('/')
  const ipPart = parts[0]
  
  // Basic IPv6 format check (simplified - allows :: shorthand)
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/
  if (!ipv6Regex.test(ipPart)) return false
  
  // Validate CIDR prefix if present
  if (parts.length === 2) {
    const prefix = parseInt(parts[1], 10)
    if (isNaN(prefix) || prefix < 0 || prefix > 128) return false
  }
  return true
}

const validateIpAddress = (_rule: unknown, value: string, callback: (error?: Error) => void) => {
  if (!value) {
    callback()
    return
  }
  
  // RouterOS supports multiple addresses separated by comma
  // e.g., "172.18.0.1/24,2408:8256:1480:af77:662b:a4ff:fe36:19e2/64"
  const addresses = value.split(',').map(addr => addr.trim())
  
  for (const addr of addresses) {
    if (!addr) continue
    
    // Check if it's IPv4 or IPv6
    const isIPv4 = addr.includes('.') && !addr.includes(':')
    const isIPv6 = addr.includes(':')
    
    if (isIPv4) {
      if (!isValidIPv4(addr)) {
        callback(new Error('IP 地址格式无效'))
        return
      }
    } else if (isIPv6) {
      if (!isValidIPv6(addr)) {
        callback(new Error('IP 地址格式无效'))
        return
      }
    } else {
      callback(new Error('IP 地址格式无效'))
      return
    }
  }
  
  callback()
}

const validateGateway = (_rule: unknown, value: string, callback: (error?: Error) => void) => {
  if (!value) {
    callback()
    return
  }
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
  if (!ipRegex.test(value)) {
    callback(new Error('网关地址格式无效'))
    return
  }
  const octets = value.split('.')
  for (const octet of octets) {
    const num = parseInt(octet, 10)
    if (num < 0 || num > 255) {
      callback(new Error('网关地址格式无效'))
      return
    }
  }
  callback()
}

const formRules: FormRules = {
  name: [
    { required: true, message: '请输入接口名称', trigger: 'blur' },
    { min: 1, max: 64, message: '名称长度应在 1-64 个字符之间', trigger: 'blur' }
  ],
  'mac-address': [
    { validator: validateMacAddress, trigger: 'blur' }
  ],
  address: [
    { validator: validateIpAddress, trigger: 'blur' }
  ],
  gateway: [
    { validator: validateGateway, trigger: 'blur' }
  ]
}

// Load VETH interfaces on mount
onMounted(() => {
  loadVethInterfaces()
})

// Convert string boolean to real boolean
const toBool = (val: unknown): boolean => {
  if (typeof val === 'boolean') return val
  if (typeof val === 'string') return val.toLowerCase() === 'true'
  return Boolean(val)
}

// Load all VETH interfaces
const loadVethInterfaces = async () => {
  loading.value = true
  error.value = ''

  try {
    const response = await vethApi.getAll()
    const result = response.data
    if (result.success && Array.isArray(result.data)) {
      vethInterfaces.value = result.data.map((iface: VethInterface) => ({
        ...iface,
        disabled: toBool(iface.disabled),
        running: toBool(iface.running)
      }))
    } else {
      vethInterfaces.value = []
      if (!result.success && result.error) {
        throw new Error(result.error)
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '加载 VETH 接口列表失败'
    error.value = message
    ElMessage.error(message)
  } finally {
    loading.value = false
  }
}

// Get status tag type
const getStatusType = (row: VethInterface) => {
  if (row.disabled) return 'danger'
  if (row.running) return 'success'
  return 'warning'
}

// Get status text
const getStatusText = (row: VethInterface) => {
  if (row.disabled) return '已禁用'
  if (row.running) return '运行中'
  return '已停止'
}

// Handle row click to show detail
const handleRowClick = (row: VethInterface) => {
  selectedInterface.value = row
  detailDialogVisible.value = true
}

// Handle add button click
const handleAdd = () => {
  isAdding.value = true
  form.id = ''
  form.name = ''
  form['mac-address'] = ''
  form.address = ''
  form.gateway = ''
  form.gateway6 = ''
  form.comment = ''
  editDialogVisible.value = true
}

// Handle edit button click
const handleEdit = (row: VethInterface) => {
  isAdding.value = false
  form.id = row['.id']
  form.name = row.name
  form['mac-address'] = row['mac-address'] || ''
  form.address = row.address || ''
  form.gateway = row.gateway || ''
  form.gateway6 = row.gateway6 || ''
  form.comment = row.comment || ''
  editDialogVisible.value = true
}

// Handle edit from detail dialog
const handleEditFromDetail = () => {
  if (selectedInterface.value) {
    detailDialogVisible.value = false
    handleEdit(selectedInterface.value)
  }
}

// Handle delete
const handleDelete = async (row: VethInterface) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除 VETH 接口 "${row.name}" 吗？此操作不可恢复。`,
      '删除确认',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    loading.value = true
    await vethApi.delete(row['.id'])
    ElMessage.success(`VETH 接口 ${row.name} 已删除`)
    await loadVethInterfaces()
  } catch (err: unknown) {
    if (err !== 'cancel') {
      const message = err instanceof Error ? err.message : '删除失败'
      ElMessage.error(message)
    }
  } finally {
    loading.value = false
  }
}

// Reset form
const resetForm = () => {
  isAdding.value = false
  form.id = ''
  form.name = ''
  form['mac-address'] = ''
  form.address = ''
  form.gateway = ''
  form.gateway6 = ''
  form.comment = ''
  formRef.value?.resetFields()
}

// Handle save
const handleSave = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  saving.value = true

  try {
    const data: Record<string, unknown> = {
      name: form.name
    }
    
    // Only include optional fields if they have values
    if (form['mac-address']) {
      data['mac-address'] = form['mac-address']
    }
    if (form.address) {
      data.address = form.address
    }
    if (form.gateway) {
      data.gateway = form.gateway
    }
    if (form.gateway6) {
      data.gateway6 = form.gateway6
    }
    if (form.comment) {
      data.comment = form.comment
    }
    
    if (isAdding.value) {
      await vethApi.create(data)
      ElMessage.success('VETH 接口已创建')
    } else {
      await vethApi.update(form.id, data)
      ElMessage.success('VETH 接口配置已更新')
    }
    
    editDialogVisible.value = false
    await loadVethInterfaces()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '操作失败'
    ElMessage.error(message)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.veth-interface-view {
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
  gap: 8px;
}

:deep(.el-table__row) {
  cursor: pointer;
}

:deep(.el-table__row:hover) {
  background-color: var(--el-fill-color-light);
}
</style>

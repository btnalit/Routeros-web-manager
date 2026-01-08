<template>
  <div class="ip-address-view">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>IP 地址管理</span>
          <div class="header-actions">
            <el-button
              type="primary"
              :icon="Plus"
              @click="handleAdd"
            >
              添加
            </el-button>
            <el-button
              :icon="Refresh"
              :loading="loading"
              @click="loadAddresses"
            >
              刷新
            </el-button>
          </div>
        </div>
      </template>

      <!-- Loading State -->
      <el-skeleton v-if="loading && addresses.length === 0" :rows="5" animated />

      <!-- Error State -->
      <el-alert
        v-else-if="error"
        :title="error"
        type="error"
        show-icon
        closable
        @close="error = ''"
      />

      <!-- IP Address Table -->
      <el-table
        v-else
        v-loading="loading"
        :data="addresses"
        stripe
        style="width: 100%"
      >
        <el-table-column prop="address" label="IP 地址" min-width="150" sortable />
        <el-table-column prop="network" label="网络" min-width="130" />
        <el-table-column prop="interface" label="接口" min-width="120" sortable />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.disabled ? 'danger' : 'success'" size="small">
              {{ row.disabled ? '已禁用' : '已启用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="comment" label="备注" min-width="150" show-overflow-tooltip />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button-group>
              <el-button
                size="small"
                type="primary"
                @click="handleEdit(row)"
              >
                编辑
              </el-button>
              <el-button
                size="small"
                type="danger"
                @click="handleDelete(row)"
              >
                删除
              </el-button>
            </el-button-group>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Add/Edit Dialog -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEditing ? '编辑 IP 地址' : '添加 IP 地址'"
      width="500px"
      destroy-on-close
      @closed="resetForm"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="formRules"
        label-width="80px"
        :disabled="saving"
      >
        <el-form-item label="IP 地址" prop="address">
          <el-input
            v-model="form.address"
            placeholder="请输入 IP 地址（CIDR 格式，如 192.168.1.1/24）"
          />
        </el-form-item>
        <el-form-item label="接口" prop="interface">
          <el-input
            v-model="form.interface"
            placeholder="请输入绑定的接口名称"
          />
        </el-form-item>
        <el-form-item label="状态" prop="disabled">
          <el-switch
            v-model="form.enabled"
            active-text="启用"
            inactive-text="禁用"
            active-color="#67c23a"
            inactive-color="#f56c6c"
          />
        </el-form-item>
        <el-form-item label="备注" prop="comment">
          <el-input
            v-model="form.comment"
            type="textarea"
            :rows="3"
            placeholder="请输入备注信息"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">
          {{ isEditing ? '保存' : '添加' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Plus, Refresh } from '@element-plus/icons-vue'
import { ipApi } from '@/api'

// IP Address type definition
interface IpAddress {
  '.id': string
  address: string
  network: string
  interface: string
  disabled: boolean
  comment?: string
}

// State
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const addresses = ref<IpAddress[]>([])

// Dialog state
const dialogVisible = ref(false)
const isEditing = ref(false)
const editingId = ref('')
const formRef = ref<FormInstance>()

// Form data
const form = reactive({
  address: '',
  interface: '',
  enabled: true,  // 使用 enabled 而不是 disabled，更直观
  comment: ''
})

// IP address CIDR format validator
const validateCidr = (_rule: unknown, value: string, callback: (error?: Error) => void) => {
  if (!value) {
    callback(new Error('请输入 IP 地址'))
    return
  }
  const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/
  if (!cidrRegex.test(value)) {
    callback(new Error('请使用 CIDR 格式（如 192.168.1.1/24）'))
    return
  }
  // Validate IP octets
  const [ip, prefix] = value.split('/')
  const octets = ip.split('.').map(Number)
  const prefixNum = Number(prefix)
  
  if (octets.some(o => o < 0 || o > 255)) {
    callback(new Error('IP 地址各段应在 0-255 之间'))
    return
  }
  if (prefixNum < 0 || prefixNum > 32) {
    callback(new Error('子网掩码应在 0-32 之间'))
    return
  }
  callback()
}

// Form validation rules
const formRules: FormRules = {
  address: [
    { required: true, message: '请输入 IP 地址', trigger: 'blur' },
    { validator: validateCidr, trigger: 'blur' }
  ],
  interface: [
    { required: true, message: '请输入接口名称', trigger: 'blur' }
  ]
}

// Load addresses on mount
onMounted(() => {
  loadAddresses()
})

// 将字符串布尔值转换为真正的布尔值
const toBool = (val: unknown): boolean => {
  if (typeof val === 'boolean') return val
  if (typeof val === 'string') return val.toLowerCase() === 'true'
  return Boolean(val)
}

// Load all IP addresses
const loadAddresses = async () => {
  loading.value = true
  error.value = ''

  try {
    const response = await ipApi.getAddresses()
    const result = response.data
    if (result.success && Array.isArray(result.data)) {
      addresses.value = result.data.map((addr: IpAddress) => ({
        ...addr,
        // RouterOS API 返回的布尔值可能是字符串 "true"/"false"
        disabled: toBool(addr.disabled)
      }))
    } else {
      addresses.value = []
      if (!result.success && result.error) {
        throw new Error(result.error)
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '加载 IP 地址列表失败'
    error.value = message
    ElMessage.error(message)
  } finally {
    loading.value = false
  }
}

// Handle add button click
const handleAdd = () => {
  isEditing.value = false
  editingId.value = ''
  dialogVisible.value = true
}

// Handle edit button click
const handleEdit = (row: IpAddress) => {
  isEditing.value = true
  editingId.value = row['.id']
  form.address = row.address
  form.interface = row.interface
  // 确保使用转换后的布尔值，enabled = !disabled
  form.enabled = !toBool(row.disabled)
  form.comment = row.comment || ''
  dialogVisible.value = true
}

// Handle delete button click
const handleDelete = async (row: IpAddress) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除 IP 地址 "${row.address}" 吗？`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    loading.value = true
    await ipApi.deleteAddress(row['.id'])
    ElMessage.success('IP 地址已删除')
    await loadAddresses()
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
  form.address = ''
  form.interface = ''
  form.enabled = true
  form.comment = ''
  formRef.value?.resetFields()
}

// Handle save (add or update)
const handleSave = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  saving.value = true

  try {
    const data = {
      address: form.address,
      interface: form.interface,
      disabled: !form.enabled,  // 转换回 disabled
      comment: form.comment || undefined
    }

    if (isEditing.value) {
      await ipApi.updateAddress(editingId.value, data)
      ElMessage.success('IP 地址已更新')
    } else {
      await ipApi.addAddress(data)
      ElMessage.success('IP 地址已添加')
    }

    dialogVisible.value = false
    await loadAddresses()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '操作失败'
    ElMessage.error(message)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.ip-address-view {
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
</style>

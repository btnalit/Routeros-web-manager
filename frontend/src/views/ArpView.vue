<template>
  <div class="arp-view">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>ARP 管理</span>
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
              @click="loadArpEntries"
            >
              刷新
            </el-button>
          </div>
        </div>
      </template>

      <!-- Loading State -->
      <el-skeleton v-if="loading && arpEntries.length === 0" :rows="5" animated />

      <!-- Error State -->
      <el-alert
        v-else-if="error"
        :title="error"
        type="error"
        show-icon
        closable
        @close="error = ''"
      />

      <!-- ARP Table -->
      <el-table
        v-else
        v-loading="loading"
        :data="arpEntries"
        stripe
        style="width: 100%"
      >
        <el-table-column prop="address" label="IP 地址" min-width="140" sortable />
        <el-table-column prop="mac-address" label="MAC 地址" min-width="160" sortable />
        <el-table-column prop="interface" label="接口" min-width="120" sortable />
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="toBool(row.dynamic) ? 'info' : 'success'" size="small">
              {{ toBool(row.dynamic) ? '动态' : '静态' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="toBool(row.complete) ? 'success' : 'warning'" size="small">
              {{ toBool(row.complete) ? '完整' : '不完整' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="comment" label="备注" min-width="150" show-overflow-tooltip />
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button
              size="small"
              type="danger"
              @click="handleDelete(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Add Dialog -->
    <el-dialog
      v-model="dialogVisible"
      title="添加静态 ARP 绑定"
      width="500px"
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
        <el-form-item label="IP 地址" prop="address">
          <el-input
            v-model="form.address"
            placeholder="请输入 IP 地址（如 192.168.1.1）"
          />
        </el-form-item>
        <el-form-item label="MAC 地址" prop="macAddress">
          <el-input
            v-model="form.macAddress"
            placeholder="请输入 MAC 地址（如 AA:BB:CC:DD:EE:FF）"
          />
        </el-form-item>
        <el-form-item label="接口" prop="interface">
          <el-input
            v-model="form.interface"
            placeholder="请输入接口名称（可选）"
          />
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
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">
          添加
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

// ARP Entry type definition
interface ArpEntry {
  '.id': string
  address: string
  'mac-address': string
  interface: string
  dynamic: boolean | string
  complete: boolean | string
  disabled: boolean | string
  comment?: string
}

// State
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const arpEntries = ref<ArpEntry[]>([])

// Dialog state
const dialogVisible = ref(false)
const formRef = ref<FormInstance>()

// Form data
const form = reactive({
  address: '',
  macAddress: '',
  interface: '',
  comment: ''
})

// Convert string boolean to real boolean
const toBool = (val: unknown): boolean => {
  if (typeof val === 'boolean') return val
  if (typeof val === 'string') return val.toLowerCase() === 'true'
  return Boolean(val)
}

// IP address validator
const validateIp = (_rule: unknown, value: string, callback: (error?: Error) => void) => {
  if (!value) {
    callback(new Error('请输入 IP 地址'))
    return
  }
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
  if (!ipRegex.test(value)) {
    callback(new Error('请使用正确的 IP 地址格式（如 192.168.1.1）'))
    return
  }
  const octets = value.split('.').map(Number)
  if (octets.some(o => o < 0 || o > 255)) {
    callback(new Error('IP 地址各段应在 0-255 之间'))
    return
  }
  callback()
}

// MAC address validator
const validateMac = (_rule: unknown, value: string, callback: (error?: Error) => void) => {
  if (!value) {
    callback(new Error('请输入 MAC 地址'))
    return
  }
  const macRegex = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/
  if (!macRegex.test(value)) {
    callback(new Error('请使用正确的 MAC 地址格式（如 AA:BB:CC:DD:EE:FF）'))
    return
  }
  callback()
}

// Form validation rules
const formRules: FormRules = {
  address: [
    { required: true, message: '请输入 IP 地址', trigger: 'blur' },
    { validator: validateIp, trigger: 'blur' }
  ],
  macAddress: [
    { required: true, message: '请输入 MAC 地址', trigger: 'blur' },
    { validator: validateMac, trigger: 'blur' }
  ]
}

// Load ARP entries on mount
onMounted(() => {
  loadArpEntries()
})

// Load all ARP entries
const loadArpEntries = async () => {
  loading.value = true
  error.value = ''

  try {
    const response = await ipApi.getArp()
    const result = response.data
    if (result.success && Array.isArray(result.data)) {
      arpEntries.value = result.data
    } else {
      arpEntries.value = []
      if (!result.success && result.error) {
        throw new Error(result.error)
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '加载 ARP 列表失败'
    error.value = message
    ElMessage.error(message)
  } finally {
    loading.value = false
  }
}

// Handle add button click
const handleAdd = () => {
  dialogVisible.value = true
}

// Handle delete button click
const handleDelete = async (row: ArpEntry) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除 ARP 条目 "${row.address}" (${row['mac-address']}) 吗？`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    loading.value = true
    await ipApi.deleteArp(row['.id'])
    ElMessage.success('ARP 条目已删除')
    await loadArpEntries()
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
  form.macAddress = ''
  form.interface = ''
  form.comment = ''
  formRef.value?.resetFields()
}

// Handle save
const handleSave = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  saving.value = true

  try {
    const data: Record<string, string> = {
      address: form.address,
      'mac-address': form.macAddress
    }
    
    if (form.interface) {
      data.interface = form.interface
    }
    if (form.comment) {
      data.comment = form.comment
    }

    await ipApi.addArp(data)
    ElMessage.success('ARP 条目已添加')

    dialogVisible.value = false
    await loadArpEntries()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '添加失败'
    ElMessage.error(message)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.arp-view {
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

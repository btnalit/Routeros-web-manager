<template>
  <div class="ipv6-address-view">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>IPv6 地址管理</span>
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

      <!-- IPv6 Address Table -->
      <el-table
        v-else
        v-loading="loading"
        :data="addresses"
        stripe
        style="width: 100%"
      >
        <el-table-column prop="address" label="IPv6 地址" min-width="200" sortable show-overflow-tooltip />
        <el-table-column prop="from-pool" label="来源池" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row['from-pool'] || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="interface" label="接口" min-width="120" sortable />
        <el-table-column label="通告" width="80">
          <template #default="{ row }">
            <el-tag :type="row.advertise ? 'success' : 'info'" size="small">
              {{ row.advertise ? '是' : '否' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.dynamic" type="info" size="small">动态</el-tag>
            <el-tag v-else-if="row['link-local']" type="warning" size="small">链路本地</el-tag>
            <el-tag v-else type="primary" size="small">静态</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.disabled ? 'danger' : 'success'" size="small">
              {{ row.disabled ? '禁用' : '启用' }}
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
                :disabled="row.dynamic"
                @click="handleEdit(row)"
              >
                编辑
              </el-button>
              <el-button
                size="small"
                type="danger"
                :disabled="row.dynamic"
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
      :title="isEditing ? '编辑 IPv6 地址' : '添加 IPv6 地址'"
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
        <el-form-item label="IPv6 地址" prop="address">
          <el-input
            v-model="form.address"
            placeholder="请输入 IPv6 地址（CIDR 格式，如 2001:db8::1/64）"
          />
        </el-form-item>
        <el-form-item label="接口" prop="interface">
          <el-input
            v-model="form.interface"
            placeholder="请输入绑定的接口名称"
          />
        </el-form-item>
        <el-form-item label="来源池" prop="from-pool">
          <el-input
            v-model="form['from-pool']"
            placeholder="可选，从指定池分配地址"
          />
        </el-form-item>
        <el-form-item label="EUI-64">
          <el-switch v-model="form.eui64" />
          <span class="form-tip">使用 EUI-64 生成接口标识符</span>
        </el-form-item>
        <el-form-item label="通告">
          <el-switch v-model="form.advertise" />
          <span class="form-tip">在路由器通告中包含此地址</span>
        </el-form-item>
        <el-form-item label="禁用 DAD">
          <el-switch v-model="form['no-dad']" />
          <span class="form-tip">禁用重复地址检测</span>
        </el-form-item>
        <el-form-item label="状态">
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
import { ipv6Api } from '@/api'

// IPv6 Address type definition
interface IPv6Address {
  '.id': string
  address: string
  'from-pool'?: string
  interface: string
  eui64?: boolean
  advertise?: boolean
  'no-dad'?: boolean
  disabled?: boolean
  comment?: string
  dynamic?: boolean
  global?: boolean
  invalid?: boolean
  'link-local'?: boolean
  actual?: string
}

// State
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const addresses = ref<IPv6Address[]>([])

// Dialog state
const dialogVisible = ref(false)
const isEditing = ref(false)
const editingId = ref('')
const formRef = ref<FormInstance>()

// Form data
const form = reactive({
  address: '',
  interface: '',
  'from-pool': '',
  eui64: false,
  advertise: true,
  'no-dad': false,
  enabled: true,
  comment: ''
})

// IPv6 address CIDR format validator
const validateIPv6Cidr = (_rule: unknown, value: string, callback: (error?: Error) => void) => {
  if (!value) {
    callback(new Error('请输入 IPv6 地址'))
    return
  }
  
  // Check for CIDR format
  const cidrParts = value.split('/')
  if (cidrParts.length !== 2) {
    callback(new Error('请使用 CIDR 格式（如 2001:db8::1/64）'))
    return
  }
  
  const [ipv6, prefix] = cidrParts
  const prefixNum = Number(prefix)
  
  // Validate prefix length
  if (isNaN(prefixNum) || prefixNum < 0 || prefixNum > 128) {
    callback(new Error('前缀长度应在 0-128 之间'))
    return
  }
  
  // Validate IPv6 address format
  // IPv6 can have :: for zero compression, and can have mixed IPv4 notation
  const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]+|::(ffff(:0{1,4})?:)?((25[0-5]|(2[0-4]|1?[0-9])?[0-9])\.){3}(25[0-5]|(2[0-4]|1?[0-9])?[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1?[0-9])?[0-9])\.){3}(25[0-5]|(2[0-4]|1?[0-9])?[0-9]))$/
  
  if (!ipv6Regex.test(ipv6)) {
    callback(new Error('无效的 IPv6 地址格式'))
    return
  }
  
  callback()
}

// Form validation rules
const formRules: FormRules = {
  address: [
    { required: true, message: '请输入 IPv6 地址', trigger: 'blur' },
    { validator: validateIPv6Cidr, trigger: 'blur' }
  ],
  interface: [
    { required: true, message: '请输入接口名称', trigger: 'blur' }
  ]
}

// Load addresses on mount
onMounted(() => {
  loadAddresses()
})

// Convert string boolean to real boolean
const toBool = (val: unknown): boolean => {
  if (typeof val === 'boolean') return val
  if (typeof val === 'string') return val.toLowerCase() === 'true'
  return Boolean(val)
}

// Load all IPv6 addresses
const loadAddresses = async () => {
  loading.value = true
  error.value = ''

  try {
    const response = await ipv6Api.getAddresses()
    const result = response.data
    if (result.success && Array.isArray(result.data)) {
      addresses.value = result.data.map((addr: IPv6Address) => ({
        ...addr,
        disabled: toBool(addr.disabled),
        dynamic: toBool(addr.dynamic),
        eui64: toBool(addr.eui64),
        advertise: toBool(addr.advertise),
        'no-dad': toBool(addr['no-dad']),
        global: toBool(addr.global),
        invalid: toBool(addr.invalid),
        'link-local': toBool(addr['link-local'])
      }))
    } else {
      addresses.value = []
      if (!result.success && result.error) {
        throw new Error(result.error)
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '加载 IPv6 地址列表失败'
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
const handleEdit = (row: IPv6Address) => {
  isEditing.value = true
  editingId.value = row['.id']
  form.address = row.address
  form.interface = row.interface
  form['from-pool'] = row['from-pool'] || ''
  form.eui64 = toBool(row.eui64)
  form.advertise = toBool(row.advertise)
  form['no-dad'] = toBool(row['no-dad'])
  form.enabled = !toBool(row.disabled)
  form.comment = row.comment || ''
  dialogVisible.value = true
}

// Handle delete button click
const handleDelete = async (row: IPv6Address) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除 IPv6 地址 "${row.address}" 吗？`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    loading.value = true
    await ipv6Api.deleteAddress(row['.id'])
    ElMessage.success('IPv6 地址已删除')
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
  form['from-pool'] = ''
  form.eui64 = false
  form.advertise = true
  form['no-dad'] = false
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
    const data: Record<string, unknown> = {
      address: form.address,
      interface: form.interface,
      disabled: !form.enabled,
      eui64: form.eui64,
      advertise: form.advertise,
      'no-dad': form['no-dad']
    }
    
    // Only include optional fields if they have values
    if (form['from-pool']) {
      data['from-pool'] = form['from-pool']
    }
    if (form.comment) {
      data.comment = form.comment
    }

    if (isEditing.value) {
      await ipv6Api.updateAddress(editingId.value, data)
      ElMessage.success('IPv6 地址已更新')
    } else {
      await ipv6Api.addAddress(data)
      ElMessage.success('IPv6 地址已添加')
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
.ipv6-address-view {
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

.form-tip {
  margin-left: 12px;
  color: #909399;
  font-size: 12px;
}
</style>

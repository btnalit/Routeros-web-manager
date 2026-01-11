<template>
  <div class="ipv6-dhcp-client-view">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>DHCPv6 客户端管理</span>
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
              @click="loadClients"
            >
              刷新
            </el-button>
          </div>
        </div>
      </template>

      <!-- Loading State -->
      <el-skeleton v-if="loading && clients.length === 0" :rows="5" animated />

      <!-- Error State -->
      <el-alert
        v-else-if="error"
        :title="error"
        type="error"
        show-icon
        closable
        @close="error = ''"
      />

      <!-- DHCPv6 Client Table -->
      <el-table
        v-else
        v-loading="loading"
        :data="clients"
        stripe
        style="width: 100%"
      >
        <el-table-column prop="interface" label="接口" min-width="120" sortable />
        <el-table-column label="请求类型" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="getRequestTypeTag(row.request)">
              {{ row.request || 'prefix' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="getStatusTag(row.status)" size="small">
              {{ row.status || '-' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="address" label="获取的地址" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.address || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="prefix" label="获取的前缀" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.prefix || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="pool-name" label="池名称" min-width="100" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row['pool-name'] || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="启用状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.disabled ? 'danger' : 'success'" size="small">
              {{ row.disabled ? '禁用' : '启用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="expires-after" label="过期时间" min-width="100" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row['expires-after'] || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="comment" label="备注" min-width="100" show-overflow-tooltip />
        <el-table-column label="操作" width="300" fixed="right">
          <template #default="{ row }">
            <el-button-group>
              <el-button
                size="small"
                type="warning"
                :loading="actionLoading[row['.id']]"
                @click="handleRelease(row)"
              >
                Release
              </el-button>
              <el-button
                size="small"
                type="success"
                :loading="actionLoading[row['.id']]"
                @click="handleRenew(row)"
              >
                Renew
              </el-button>
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
      :title="isEditing ? '编辑 DHCPv6 客户端' : '添加 DHCPv6 客户端'"
      width="600px"
      destroy-on-close
      @closed="resetForm"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="formRules"
        label-width="140px"
        :disabled="saving"
      >
        <el-form-item label="接口" prop="interface">
          <el-input
            v-model="form.interface"
            placeholder="请输入接口名称（如 ether1）"
          />
        </el-form-item>
        <el-form-item label="请求类型" prop="request">
          <el-select v-model="form.request" style="width: 100%">
            <el-option label="prefix - 请求前缀" value="prefix" />
            <el-option label="address - 请求地址" value="address" />
            <el-option label="info - 仅请求信息" value="info" />
          </el-select>
        </el-form-item>
        <el-form-item label="池名称" prop="pool-name">
          <el-input
            v-model="form['pool-name']"
            placeholder="可选，用于存储获取的前缀"
          />
        </el-form-item>
        <el-form-item label="池前缀长度" prop="pool-prefix-length">
          <el-input-number
            v-model="form['pool-prefix-length']"
            :min="1"
            :max="128"
            placeholder="可选"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="前缀提示" prop="prefix-hint">
          <el-input
            v-model="form['prefix-hint']"
            placeholder="可选，请求特定前缀长度（如 ::/60）"
          />
        </el-form-item>
        <el-form-item label="快速提交">
          <el-switch v-model="form['rapid-commit']" />
          <span class="form-tip">启用 DHCPv6 快速提交选项</span>
        </el-form-item>
        <el-form-item label="添加默认路由">
          <el-switch v-model="form['add-default-route']" />
          <span class="form-tip">自动添加默认 IPv6 路由</span>
        </el-form-item>
        <el-form-item label="使用对端 DNS">
          <el-switch v-model="form['use-peer-dns']" />
          <span class="form-tip">使用 DHCPv6 服务器提供的 DNS</span>
        </el-form-item>
        <el-form-item label="允许重配置">
          <el-switch v-model="form['allow-reconfigure']" />
          <span class="form-tip">允许服务器发送重配置消息</span>
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

// DHCPv6 Client type definition
interface DHCPv6Client {
  '.id': string
  interface: string
  request?: string
  'pool-name'?: string
  'pool-prefix-length'?: number
  'prefix-hint'?: string
  'rapid-commit'?: boolean
  'add-default-route'?: boolean
  'allow-reconfigure'?: boolean
  'use-peer-dns'?: boolean
  disabled?: boolean
  comment?: string
  status?: string
  address?: string
  prefix?: string
  'expires-after'?: string
  duid?: string
  dynamic?: boolean
  invalid?: boolean
}

// State
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const clients = ref<DHCPv6Client[]>([])
const actionLoading = ref<Record<string, boolean>>({})

// Dialog state
const dialogVisible = ref(false)
const isEditing = ref(false)
const editingId = ref('')
const formRef = ref<FormInstance>()

// Form data
const form = reactive({
  interface: '',
  request: 'prefix',
  'pool-name': '',
  'pool-prefix-length': undefined as number | undefined,
  'prefix-hint': '',
  'rapid-commit': false,
  'add-default-route': true,
  'use-peer-dns': true,
  'allow-reconfigure': false,
  enabled: true,
  comment: ''
})

// Form validation rules
const formRules: FormRules = {
  interface: [
    { required: true, message: '请输入接口名称', trigger: 'blur' }
  ],
  request: [
    { required: true, message: '请选择请求类型', trigger: 'change' }
  ]
}

// Load clients on mount
onMounted(() => {
  loadClients()
})

// Convert string boolean to real boolean
const toBool = (val: unknown): boolean => {
  if (typeof val === 'boolean') return val
  if (typeof val === 'string') return val.toLowerCase() === 'true'
  return Boolean(val)
}

// Tag type definition
type TagType = 'primary' | 'success' | 'warning' | 'info' | 'danger'

// Get request type tag color
const getRequestTypeTag = (request?: string): TagType => {
  switch (request) {
    case 'prefix': return 'primary'
    case 'address': return 'success'
    case 'info': return 'info'
    default: return 'primary'
  }
}

// Get status tag color
const getStatusTag = (status?: string): TagType => {
  if (!status) return 'info'
  const lowerStatus = status.toLowerCase()
  if (lowerStatus.includes('bound') || lowerStatus.includes('searching')) return 'success'
  if (lowerStatus.includes('error') || lowerStatus.includes('stopped')) return 'danger'
  return 'warning'
}

// Load all DHCPv6 clients
const loadClients = async () => {
  loading.value = true
  error.value = ''

  try {
    const response = await ipv6Api.getDhcpClients()
    const result = response.data
    if (result.success && Array.isArray(result.data)) {
      clients.value = result.data.map((client: DHCPv6Client) => ({
        ...client,
        disabled: toBool(client.disabled),
        dynamic: toBool(client.dynamic),
        invalid: toBool(client.invalid),
        'rapid-commit': toBool(client['rapid-commit']),
        'add-default-route': toBool(client['add-default-route']),
        'use-peer-dns': toBool(client['use-peer-dns']),
        'allow-reconfigure': toBool(client['allow-reconfigure'])
      }))
    } else {
      clients.value = []
      if (!result.success && result.error) {
        throw new Error(result.error)
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '加载 DHCPv6 客户端列表失败'
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
const handleEdit = (row: DHCPv6Client) => {
  isEditing.value = true
  editingId.value = row['.id']
  form.interface = row.interface
  form.request = row.request || 'prefix'
  form['pool-name'] = row['pool-name'] || ''
  form['pool-prefix-length'] = row['pool-prefix-length']
  form['prefix-hint'] = row['prefix-hint'] || ''
  form['rapid-commit'] = toBool(row['rapid-commit'])
  form['add-default-route'] = toBool(row['add-default-route'])
  form['use-peer-dns'] = toBool(row['use-peer-dns'])
  form['allow-reconfigure'] = toBool(row['allow-reconfigure'])
  form.enabled = !toBool(row.disabled)
  form.comment = row.comment || ''
  dialogVisible.value = true
}

// Handle delete button click
const handleDelete = async (row: DHCPv6Client) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除接口 "${row.interface}" 的 DHCPv6 客户端吗？`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    loading.value = true
    await ipv6Api.deleteDhcpClient(row['.id'])
    ElMessage.success('DHCPv6 客户端已删除')
    await loadClients()
  } catch (err: unknown) {
    if (err !== 'cancel') {
      const message = err instanceof Error ? err.message : '删除失败'
      ElMessage.error(message)
    }
  } finally {
    loading.value = false
  }
}

// Handle Release operation
const handleRelease = async (row: DHCPv6Client) => {
  try {
    await ElMessageBox.confirm(
      `确定要释放接口 "${row.interface}" 的 DHCPv6 租约吗？`,
      'Release 确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    actionLoading.value[row['.id']] = true
    await ipv6Api.releaseDhcpClient(row['.id'])
    ElMessage.success('DHCPv6 租约已释放')
    await loadClients()
  } catch (err: unknown) {
    if (err !== 'cancel') {
      const message = err instanceof Error ? err.message : 'Release 操作失败'
      ElMessage.error(message)
    }
  } finally {
    actionLoading.value[row['.id']] = false
  }
}

// Handle Renew operation
const handleRenew = async (row: DHCPv6Client) => {
  try {
    actionLoading.value[row['.id']] = true
    await ipv6Api.renewDhcpClient(row['.id'])
    ElMessage.success('DHCPv6 租约已续期')
    await loadClients()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Renew 操作失败'
    ElMessage.error(message)
  } finally {
    actionLoading.value[row['.id']] = false
  }
}

// Reset form
const resetForm = () => {
  form.interface = ''
  form.request = 'prefix'
  form['pool-name'] = ''
  form['pool-prefix-length'] = undefined
  form['prefix-hint'] = ''
  form['rapid-commit'] = false
  form['add-default-route'] = true
  form['use-peer-dns'] = true
  form['allow-reconfigure'] = false
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
      interface: form.interface,
      request: form.request,
      disabled: !form.enabled,
      'rapid-commit': form['rapid-commit'],
      'add-default-route': form['add-default-route'],
      'use-peer-dns': form['use-peer-dns'],
      'allow-reconfigure': form['allow-reconfigure']
    }

    // Only include optional fields if they have values
    if (form['pool-name']) {
      data['pool-name'] = form['pool-name']
    }
    if (form['pool-prefix-length'] !== undefined) {
      data['pool-prefix-length'] = form['pool-prefix-length']
    }
    if (form['prefix-hint']) {
      data['prefix-hint'] = form['prefix-hint']
    }
    if (form.comment) {
      data.comment = form.comment
    }

    if (isEditing.value) {
      await ipv6Api.updateDhcpClient(editingId.value, data)
      ElMessage.success('DHCPv6 客户端已更新')
    } else {
      await ipv6Api.addDhcpClient(data)
      ElMessage.success('DHCPv6 客户端已添加')
    }

    dialogVisible.value = false
    await loadClients()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '操作失败'
    ElMessage.error(message)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.ipv6-dhcp-client-view {
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

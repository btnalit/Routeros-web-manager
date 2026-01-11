<template>
  <div class="ipv6-nd-view">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>IPv6 邻居发现（ND）管理</span>
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
              @click="loadNdList"
            >
              刷新
            </el-button>
          </div>
        </div>
      </template>

      <!-- Loading State -->
      <el-skeleton v-if="loading && ndList.length === 0" :rows="5" animated />

      <!-- Error State -->
      <el-alert
        v-else-if="error"
        :title="error"
        type="error"
        show-icon
        closable
        @close="error = ''"
      />

      <!-- ND Configuration Table -->
      <el-table
        v-else
        v-loading="loading"
        :data="ndList"
        stripe
        style="width: 100%"
      >
        <el-table-column prop="interface" label="接口" min-width="120" sortable />
        <el-table-column prop="ra-interval" label="RA 间隔" min-width="100">
          <template #default="{ row }">
            {{ row['ra-interval'] || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="RA 优先级" width="100">
          <template #default="{ row }">
            <el-tag :type="getRaPreferenceTag(row['ra-preference'])" size="small">
              {{ row['ra-preference'] || 'medium' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="hop-limit" label="Hop Limit" width="100">
          <template #default="{ row }">
            {{ row['hop-limit'] ?? '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="mtu" label="MTU" width="80">
          <template #default="{ row }">
            {{ row.mtu ?? '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="dns-servers" label="DNS 服务器" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row['dns-servers'] || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="通告 DNS" width="90">
          <template #default="{ row }">
            <el-tag :type="row['advertise-dns'] ? 'success' : 'info'" size="small">
              {{ row['advertise-dns'] ? '是' : '否' }}
            </el-tag>
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
      :title="isEditing ? '编辑 ND 配置' : '添加 ND 配置'"
      width="700px"
      destroy-on-close
      @closed="resetForm"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="formRules"
        label-width="160px"
        :disabled="saving"
      >
        <!-- 基本配置 -->
        <el-divider content-position="left">基本配置</el-divider>
        
        <el-form-item label="接口" prop="interface">
          <el-input
            v-model="form.interface"
            placeholder="请输入接口名称（如 bridge1）"
          />
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

        <!-- RA 配置 -->
        <el-divider content-position="left">路由器通告（RA）配置</el-divider>

        <el-form-item label="RA 间隔" prop="ra-interval">
          <el-input
            v-model="form['ra-interval']"
            placeholder="如 200-600 或 3m20s-10m"
          />
          <span class="form-tip">路由器通告发送间隔范围</span>
        </el-form-item>

        <el-form-item label="RA 延迟" prop="ra-delay">
          <el-input
            v-model="form['ra-delay']"
            placeholder="如 3s"
          />
          <span class="form-tip">响应路由器请求的最小延迟</span>
        </el-form-item>

        <el-form-item label="RA 优先级" prop="ra-preference">
          <el-select v-model="form['ra-preference']" style="width: 100%">
            <el-option label="low - 低" value="low" />
            <el-option label="medium - 中（默认）" value="medium" />
            <el-option label="high - 高" value="high" />
          </el-select>
        </el-form-item>

        <el-form-item label="RA 生命周期" prop="ra-lifetime">
          <el-input
            v-model="form['ra-lifetime']"
            placeholder="如 30m 或 1800"
          />
          <span class="form-tip">路由器作为默认路由器的有效时间</span>
        </el-form-item>

        <!-- 网络参数 -->
        <el-divider content-position="left">网络参数</el-divider>

        <el-form-item label="MTU" prop="mtu">
          <el-input-number
            v-model="form.mtu"
            :min="0"
            :max="65535"
            placeholder="可选"
            style="width: 100%"
          />
          <span class="form-tip">通告的链路 MTU 值</span>
        </el-form-item>

        <el-form-item label="Hop Limit" prop="hop-limit">
          <el-input-number
            v-model="form['hop-limit']"
            :min="0"
            :max="255"
            placeholder="可选"
            style="width: 100%"
          />
          <span class="form-tip">通告的跳数限制（0 表示不指定）</span>
        </el-form-item>

        <el-form-item label="可达时间" prop="reachable-time">
          <el-input
            v-model="form['reachable-time']"
            placeholder="如 30s 或 unspecified"
          />
          <span class="form-tip">邻居可达状态的有效时间</span>
        </el-form-item>

        <el-form-item label="重传间隔" prop="retransmit-interval">
          <el-input
            v-model="form['retransmit-interval']"
            placeholder="如 1s 或 unspecified"
          />
          <span class="form-tip">邻居请求重传间隔</span>
        </el-form-item>

        <!-- DNS 配置 -->
        <el-divider content-position="left">DNS 配置</el-divider>

        <el-form-item label="DNS 服务器" prop="dns-servers">
          <el-input
            v-model="form['dns-servers']"
            placeholder="多个地址用逗号分隔，如 2001:db8::1,2001:db8::2"
          />
          <span class="form-tip">通告的 DNS 服务器地址</span>
        </el-form-item>

        <el-form-item label="通告 DNS">
          <el-switch v-model="form['advertise-dns']" />
          <span class="form-tip">在 RA 中包含 DNS 信息</span>
        </el-form-item>

        <!-- 高级配置 -->
        <el-divider content-position="left">高级配置</el-divider>

        <el-form-item label="PREF64 前缀" prop="pref64-prefixes">
          <el-input
            v-model="form['pref64-prefixes']"
            placeholder="如 64:ff9b::/96"
          />
          <span class="form-tip">NAT64 前缀（RFC 8781）</span>
        </el-form-item>

        <el-form-item label="通告 MAC 地址">
          <el-switch v-model="form['advertise-mac-address']" />
          <span class="form-tip">在 RA 中包含源链路层地址选项</span>
        </el-form-item>

        <el-form-item label="托管地址配置">
          <el-switch v-model="form['managed-address-configuration']" />
          <span class="form-tip">M 标志 - 指示使用 DHCPv6 获取地址</span>
        </el-form-item>

        <el-form-item label="其他配置">
          <el-switch v-model="form['other-configuration']" />
          <span class="form-tip">O 标志 - 指示使用 DHCPv6 获取其他配置</span>
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

// ND type definition
interface ND {
  '.id': string
  interface: string
  'ra-interval'?: string
  'ra-delay'?: string
  'ra-preference'?: string
  mtu?: number
  'reachable-time'?: string
  'retransmit-interval'?: string
  'ra-lifetime'?: string
  'hop-limit'?: number
  'dns-servers'?: string
  'pref64-prefixes'?: string
  'advertise-mac-address'?: boolean
  'advertise-dns'?: boolean
  'managed-address-configuration'?: boolean
  'other-configuration'?: boolean
  disabled?: boolean
  comment?: string
  dynamic?: boolean
  invalid?: boolean
}

// State
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const ndList = ref<ND[]>([])

// Dialog state
const dialogVisible = ref(false)
const isEditing = ref(false)
const editingId = ref('')
const formRef = ref<FormInstance>()

// Form data
const form = reactive({
  interface: '',
  'ra-interval': '',
  'ra-delay': '',
  'ra-preference': 'medium',
  mtu: undefined as number | undefined,
  'reachable-time': '',
  'retransmit-interval': '',
  'ra-lifetime': '',
  'hop-limit': undefined as number | undefined,
  'dns-servers': '',
  'pref64-prefixes': '',
  'advertise-mac-address': true,
  'advertise-dns': true,
  'managed-address-configuration': false,
  'other-configuration': false,
  enabled: true,
  comment: ''
})

// Form validation rules
const formRules: FormRules = {
  interface: [
    { required: true, message: '请输入接口名称', trigger: 'blur' }
  ]
}

// Load ND list on mount
onMounted(() => {
  loadNdList()
})

// Convert string boolean to real boolean
const toBool = (val: unknown): boolean => {
  if (typeof val === 'boolean') return val
  if (typeof val === 'string') return val.toLowerCase() === 'true'
  return Boolean(val)
}

// Tag type definition
type TagType = 'primary' | 'success' | 'warning' | 'info' | 'danger'

// Get RA preference tag color
const getRaPreferenceTag = (preference?: string): TagType => {
  switch (preference) {
    case 'high': return 'danger'
    case 'low': return 'info'
    case 'medium':
    default: return 'warning'
  }
}

// Load all ND configurations
const loadNdList = async () => {
  loading.value = true
  error.value = ''

  try {
    const response = await ipv6Api.getNd()
    const result = response.data
    if (result.success && Array.isArray(result.data)) {
      ndList.value = result.data.map((nd: ND) => ({
        ...nd,
        disabled: toBool(nd.disabled),
        dynamic: toBool(nd.dynamic),
        invalid: toBool(nd.invalid),
        'advertise-mac-address': toBool(nd['advertise-mac-address']),
        'advertise-dns': toBool(nd['advertise-dns']),
        'managed-address-configuration': toBool(nd['managed-address-configuration']),
        'other-configuration': toBool(nd['other-configuration'])
      }))
    } else {
      ndList.value = []
      if (!result.success && result.error) {
        throw new Error(result.error)
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '加载 ND 配置列表失败'
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
const handleEdit = (row: ND) => {
  isEditing.value = true
  editingId.value = row['.id']
  form.interface = row.interface
  form['ra-interval'] = row['ra-interval'] || ''
  form['ra-delay'] = row['ra-delay'] || ''
  form['ra-preference'] = row['ra-preference'] || 'medium'
  form.mtu = row.mtu
  form['reachable-time'] = row['reachable-time'] || ''
  form['retransmit-interval'] = row['retransmit-interval'] || ''
  form['ra-lifetime'] = row['ra-lifetime'] || ''
  form['hop-limit'] = row['hop-limit']
  form['dns-servers'] = row['dns-servers'] || ''
  form['pref64-prefixes'] = row['pref64-prefixes'] || ''
  form['advertise-mac-address'] = toBool(row['advertise-mac-address'])
  form['advertise-dns'] = toBool(row['advertise-dns'])
  form['managed-address-configuration'] = toBool(row['managed-address-configuration'])
  form['other-configuration'] = toBool(row['other-configuration'])
  form.enabled = !toBool(row.disabled)
  form.comment = row.comment || ''
  dialogVisible.value = true
}

// Handle delete button click
const handleDelete = async (row: ND) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除接口 "${row.interface}" 的 ND 配置吗？`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    loading.value = true
    await ipv6Api.deleteNd(row['.id'])
    ElMessage.success('ND 配置已删除')
    await loadNdList()
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
  form.interface = ''
  form['ra-interval'] = ''
  form['ra-delay'] = ''
  form['ra-preference'] = 'medium'
  form.mtu = undefined
  form['reachable-time'] = ''
  form['retransmit-interval'] = ''
  form['ra-lifetime'] = ''
  form['hop-limit'] = undefined
  form['dns-servers'] = ''
  form['pref64-prefixes'] = ''
  form['advertise-mac-address'] = true
  form['advertise-dns'] = true
  form['managed-address-configuration'] = false
  form['other-configuration'] = false
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
      disabled: !form.enabled,
      'ra-preference': form['ra-preference'],
      'advertise-mac-address': form['advertise-mac-address'],
      'advertise-dns': form['advertise-dns'],
      'managed-address-configuration': form['managed-address-configuration'],
      'other-configuration': form['other-configuration']
    }

    // Only include optional fields if they have values
    if (form['ra-interval']) {
      data['ra-interval'] = form['ra-interval']
    }
    if (form['ra-delay']) {
      data['ra-delay'] = form['ra-delay']
    }
    if (form.mtu !== undefined) {
      data.mtu = form.mtu
    }
    if (form['reachable-time']) {
      data['reachable-time'] = form['reachable-time']
    }
    if (form['retransmit-interval']) {
      data['retransmit-interval'] = form['retransmit-interval']
    }
    if (form['ra-lifetime']) {
      data['ra-lifetime'] = form['ra-lifetime']
    }
    if (form['hop-limit'] !== undefined) {
      data['hop-limit'] = form['hop-limit']
    }
    if (form['dns-servers']) {
      data['dns-servers'] = form['dns-servers']
    }
    if (form['pref64-prefixes']) {
      data['pref64-prefixes'] = form['pref64-prefixes']
    }
    if (form.comment) {
      data.comment = form.comment
    }

    if (isEditing.value) {
      await ipv6Api.updateNd(editingId.value, data)
      ElMessage.success('ND 配置已更新')
    } else {
      await ipv6Api.addNd(data)
      ElMessage.success('ND 配置已添加')
    }

    dialogVisible.value = false
    await loadNdList()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '操作失败'
    ElMessage.error(message)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.ipv6-nd-view {
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

.el-divider {
  margin: 16px 0;
}

.el-divider :deep(.el-divider__text) {
  font-weight: 600;
  color: #606266;
}
</style>

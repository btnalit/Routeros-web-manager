<template>
  <div class="ip-route-view">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>路由表管理</span>
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
              @click="loadRoutes"
            >
              刷新
            </el-button>
          </div>
        </div>
      </template>

      <!-- Loading State -->
      <el-skeleton v-if="loading && routes.length === 0" :rows="5" animated />

      <!-- Error State -->
      <el-alert
        v-else-if="error"
        :title="error"
        type="error"
        show-icon
        closable
        @close="error = ''"
      />

      <!-- Route Table -->
      <el-table
        v-else
        v-loading="loading"
        :data="routes"
        stripe
        style="width: 100%"
      >
        <el-table-column prop="dst-address" label="目标地址" min-width="150" sortable />
        <el-table-column prop="gateway" label="网关" min-width="130" />
        <el-table-column prop="distance" label="距离" width="80" sortable />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row)" size="small">
              {{ getStatusText(row) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="80">
          <template #default="{ row }">
            <el-tag :type="row._routeType === '直连' ? 'success' : (row._routeType === '动态' ? 'info' : 'primary')" size="small">
              {{ row._routeType }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="comment" label="备注" min-width="150" show-overflow-tooltip />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button-group v-if="row._routeType === '静态'">
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
            <span v-else class="dynamic-hint">{{ row._routeType === '直连' ? '直连路由' : '动态路由' }}</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Add/Edit Dialog -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEditing ? '编辑路由' : '添加路由'"
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
        <el-form-item label="目标地址" prop="dstAddress">
          <el-input
            v-model="form.dstAddress"
            placeholder="请输入目标地址（CIDR 格式，如 0.0.0.0/0）"
          />
        </el-form-item>
        <el-form-item label="网关" prop="gateway">
          <el-input
            v-model="form.gateway"
            placeholder="请输入网关 IP 地址或接口名称"
          />
        </el-form-item>
        <el-form-item label="距离" prop="distance">
          <el-input-number
            v-model="form.distance"
            :min="1"
            :max="255"
            controls-position="right"
            style="width: 100%"
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

// Route type definition
interface Route {
  '.id': string
  'dst-address': string
  gateway: string
  'gateway-status'?: string
  distance: number
  scope: number
  disabled: boolean
  active: boolean
  dynamic: boolean
  connect?: boolean  // 直连路由标识
  static?: boolean   // 静态路由标识
  comment?: string
  _routeType?: string // 计算后的路由类型
}

// State
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const routes = ref<Route[]>([])

// Dialog state
const dialogVisible = ref(false)
const isEditing = ref(false)
const editingId = ref('')
const formRef = ref<FormInstance>()

// Form data
const form = reactive({
  dstAddress: '',
  gateway: '',
  distance: 1,
  enabled: true,  // 使用 enabled 而不是 disabled，更直观
  comment: ''
})

// CIDR format validator for destination address
const validateDstAddress = (_rule: unknown, value: string, callback: (error?: Error) => void) => {
  if (!value) {
    callback(new Error('请输入目标地址'))
    return
  }
  const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/
  if (!cidrRegex.test(value)) {
    callback(new Error('请使用 CIDR 格式（如 0.0.0.0/0 或 192.168.1.0/24）'))
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

// Gateway validator (IP address or interface name)
const validateGateway = (_rule: unknown, value: string, callback: (error?: Error) => void) => {
  if (!value) {
    callback() // Gateway is optional
    return
  }
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
  const interfaceNameRegex = /^[a-zA-Z][a-zA-Z0-9\-_]*$/
  
  if (ipRegex.test(value)) {
    // Validate IP octets
    const octets = value.split('.').map(Number)
    if (octets.some(o => o < 0 || o > 255)) {
      callback(new Error('IP 地址各段应在 0-255 之间'))
      return
    }
  } else if (!interfaceNameRegex.test(value)) {
    callback(new Error('请输入有效的 IP 地址或接口名称'))
    return
  }
  callback()
}

// Form validation rules
const formRules: FormRules = {
  dstAddress: [
    { required: true, message: '请输入目标地址', trigger: 'blur' },
    { validator: validateDstAddress, trigger: 'blur' }
  ],
  gateway: [
    { validator: validateGateway, trigger: 'blur' }
  ],
  distance: [
    { type: 'number', min: 1, max: 255, message: '距离范围 1-255', trigger: 'blur' }
  ]
}

// Load routes on mount
onMounted(() => {
  loadRoutes()
})

// 将字符串布尔值转换为真正的布尔值
const toBool = (val: unknown): boolean => {
  if (typeof val === 'boolean') return val
  if (typeof val === 'string') return val.toLowerCase() === 'true'
  return Boolean(val)
}

// 计算路由类型 - 判断路由是否可编辑
const getRouteType = (route: Route): string => {
  // RouterOS 路由类型判断
  // 检查原始数据中的标志字段（可能是字符串或布尔值）
  const rawDynamic = route.dynamic
  const rawConnect = route.connect
  const rawStatic = route.static
  
  // 转换为布尔值
  const isDynamic = toBool(rawDynamic)
  const isConnect = toBool(rawConnect)
  const isStatic = toBool(rawStatic)
  
  // 优先检查 RouterOS 返回的标志
  if (isConnect) return '直连'
  if (isDynamic) return '动态'
  if (isStatic) return '静态'
  
  // 如果没有明确标志，检查网关特征
  const gateway = route.gateway || ''
  const gatewayStatus = route['gateway-status'] || ''
  
  // 如果网关状态包含 "reachable via" 或网关包含 %，通常是动态/直连
  if (gatewayStatus.includes('reachable') || gateway.includes('%')) {
    // 检查是否是接口名（直连）还是IP（动态）
    if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(gateway.split('%')[0])) {
      return '直连'
    }
    return '动态'
  }
  
  // 默认为静态（用户可编辑）
  return '静态'
}

// Load all routes
const loadRoutes = async () => {
  loading.value = true
  error.value = ''

  try {
    const response = await ipApi.getRoutes()
    // 后端返回格式: { success: true, data: [...] }
    // axios 响应格式: response.data = { success, data }
    const result = response.data
    if (result.success && Array.isArray(result.data)) {
      routes.value = result.data.map((route: Route) => ({
        ...route,
        // RouterOS API 返回的布尔值可能是字符串 "true"/"false"
        disabled: toBool(route.disabled),
        active: toBool(route.active),
        dynamic: toBool(route.dynamic),
        connect: toBool(route.connect),
        static: toBool(route.static),
        _routeType: getRouteType(route)
      }))
    } else {
      routes.value = []
      if (!result.success && result.error) {
        throw new Error(result.error)
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '加载路由列表失败'
    error.value = message
    ElMessage.error(message)
  } finally {
    loading.value = false
  }
}

// Get status tag type
const getStatusType = (row: Route) => {
  if (row.disabled) return 'danger'
  if (row.active) return 'success'
  return 'warning'
}

// Get status text
const getStatusText = (row: Route) => {
  if (row.disabled) return '已禁用'
  if (row.active) return '活动'
  return '非活动'
}

// Handle add button click
const handleAdd = () => {
  isEditing.value = false
  editingId.value = ''
  dialogVisible.value = true
}

// Handle edit button click
const handleEdit = (row: Route) => {
  isEditing.value = true
  editingId.value = row['.id']
  form.dstAddress = row['dst-address']
  form.gateway = row.gateway || ''
  form.distance = row.distance || 1
  // 确保使用转换后的布尔值，enabled = !disabled
  form.enabled = !toBool(row.disabled)
  form.comment = row.comment || ''
  dialogVisible.value = true
}

// Handle delete button click
const handleDelete = async (row: Route) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除路由 "${row['dst-address']}" 吗？`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    loading.value = true
    await ipApi.deleteRoute(row['.id'])
    ElMessage.success('路由已删除')
    await loadRoutes()
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
  form.dstAddress = ''
  form.gateway = ''
  form.distance = 1
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
      'dst-address': form.dstAddress,
      distance: form.distance,
      disabled: !form.enabled  // 转换回 disabled
    }
    
    if (form.gateway) {
      data.gateway = form.gateway
    }
    if (form.comment) {
      data.comment = form.comment
    }

    if (isEditing.value) {
      await ipApi.updateRoute(editingId.value, data)
      ElMessage.success('路由已更新')
    } else {
      await ipApi.addRoute(data)
      ElMessage.success('路由已添加')
    }

    dialogVisible.value = false
    await loadRoutes()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '操作失败'
    ElMessage.error(message)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.ip-route-view {
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

.dynamic-hint {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>

<template>
  <div class="ipv6-route-view">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>IPv6 路由管理</span>
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

      <!-- IPv6 Route Table -->
      <el-table
        v-else
        v-loading="loading"
        :data="routes"
        stripe
        style="width: 100%"
      >
        <el-table-column prop="dst-address" label="目标地址" min-width="200" sortable show-overflow-tooltip />
        <el-table-column prop="gateway" label="网关" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.gateway || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="distance" label="距离" width="80" sortable />
        <el-table-column prop="routing-table" label="路由表" width="100">
          <template #default="{ row }">
            {{ row['routing-table'] || 'main' }}
          </template>
        </el-table-column>
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
      :title="isEditing ? '编辑 IPv6 路由' : '添加 IPv6 路由'"
      width="600px"
      destroy-on-close
      @closed="resetForm"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="formRules"
        label-width="120px"
        :disabled="saving"
      >
        <el-form-item label="目标地址" prop="dstAddress">
          <el-input
            v-model="form.dstAddress"
            placeholder="请输入目标地址（CIDR 格式，如 ::/0 或 2001:db8::/32）"
          />
        </el-form-item>
        <el-form-item label="网关" prop="gateway">
          <el-input
            v-model="form.gateway"
            placeholder="请输入网关 IPv6 地址或接口名称"
          />
        </el-form-item>
        <el-form-item label="首选源" prop="prefSrc">
          <el-input
            v-model="form.prefSrc"
            placeholder="可选，首选源地址"
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
        <el-form-item label="检查网关" prop="checkGateway">
          <el-select v-model="form.checkGateway" placeholder="选择检查方式" clearable style="width: 100%">
            <el-option label="无" value="" />
            <el-option label="Ping" value="ping" />
            <el-option label="ARP" value="arp" />
            <el-option label="BFD" value="bfd" />
          </el-select>
        </el-form-item>
        <el-form-item label="路由表" prop="routingTable">
          <el-input
            v-model="form.routingTable"
            placeholder="可选，默认为 main"
          />
        </el-form-item>
        <el-form-item label="Scope" prop="scope">
          <el-input-number
            v-model="form.scope"
            :min="0"
            :max="255"
            controls-position="right"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="Target Scope" prop="targetScope">
          <el-input-number
            v-model="form.targetScope"
            :min="0"
            :max="255"
            controls-position="right"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="黑洞路由">
          <el-switch v-model="form.blackhole" />
          <span class="form-tip">丢弃匹配此路由的数据包</span>
        </el-form-item>
        <el-form-item label="抑制硬件卸载">
          <el-switch v-model="form.suppressHwOffload" />
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

// IPv6 Route type definition
interface IPv6Route {
  '.id': string
  'dst-address': string
  gateway?: string
  'pref-src'?: string
  'immediate-gw'?: string
  'check-gateway'?: string
  'suppress-hw-offload'?: boolean
  blackhole?: boolean
  distance?: number
  scope?: number
  'target-scope'?: number
  'vrf-interface'?: string
  'routing-table'?: string
  mtu?: number
  'hop-limit'?: number
  disabled?: boolean
  comment?: string
  active?: boolean
  dynamic?: boolean
  static?: boolean
  'gateway-status'?: string
  _routeType?: string
}

// State
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const routes = ref<IPv6Route[]>([])

// Dialog state
const dialogVisible = ref(false)
const isEditing = ref(false)
const editingId = ref('')
const formRef = ref<FormInstance>()

// Form data
const form = reactive({
  dstAddress: '',
  gateway: '',
  prefSrc: '',
  distance: 1,
  checkGateway: '',
  routingTable: '',
  scope: 30,
  targetScope: 10,
  blackhole: false,
  suppressHwOffload: false,
  enabled: true,
  comment: ''
})

// IPv6 CIDR format validator for destination address
const validateIPv6Cidr = (_rule: unknown, value: string, callback: (error?: Error) => void) => {
  if (!value) {
    callback(new Error('请输入目标地址'))
    return
  }

  // Check for CIDR format
  const cidrParts = value.split('/')
  if (cidrParts.length !== 2) {
    callback(new Error('请使用 CIDR 格式（如 ::/0 或 2001:db8::/32）'))
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
  // IPv6 can have :: for zero compression
  const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]+|::(ffff(:0{1,4})?:)?((25[0-5]|(2[0-4]|1?[0-9])?[0-9])\.){3}(25[0-5]|(2[0-4]|1?[0-9])?[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1?[0-9])?[0-9])\.){3}(25[0-5]|(2[0-4]|1?[0-9])?[0-9]))$/

  if (!ipv6Regex.test(ipv6)) {
    callback(new Error('无效的 IPv6 地址格式'))
    return
  }

  callback()
}

// Gateway validator (IPv6 address or interface name)
const validateGateway = (_rule: unknown, value: string, callback: (error?: Error) => void) => {
  if (!value) {
    callback() // Gateway is optional
    return
  }

  // IPv6 address regex (simplified, allows :: compression)
  const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]+)$/
  // Interface name regex
  const interfaceNameRegex = /^[a-zA-Z][a-zA-Z0-9\-_]*$/
  // Gateway with interface (e.g., fe80::1%ether1)
  const gatewayWithInterfaceRegex = /^.+%[a-zA-Z][a-zA-Z0-9\-_]*$/

  if (ipv6Regex.test(value) || interfaceNameRegex.test(value) || gatewayWithInterfaceRegex.test(value)) {
    callback()
    return
  }

  callback(new Error('请输入有效的 IPv6 地址或接口名称'))
}

// Form validation rules
const formRules: FormRules = {
  dstAddress: [
    { required: true, message: '请输入目标地址', trigger: 'blur' },
    { validator: validateIPv6Cidr, trigger: 'blur' }
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

// Convert string boolean to real boolean
const toBool = (val: unknown): boolean => {
  if (typeof val === 'boolean') return val
  if (typeof val === 'string') return val.toLowerCase() === 'true'
  return Boolean(val)
}

// Calculate route type - determine if route is editable
const getRouteType = (route: IPv6Route): string => {
  const isDynamic = toBool(route.dynamic)
  const isStatic = toBool(route.static)

  // Check RouterOS flags
  if (isDynamic) return '动态'
  if (isStatic) return '静态'

  // Check gateway characteristics
  const gateway = route.gateway || ''
  const gatewayStatus = route['gateway-status'] || ''

  // If gateway status contains "reachable" or gateway contains %, usually dynamic/connected
  if (gatewayStatus.includes('reachable') || gateway.includes('%')) {
    return '动态'
  }

  // Default to static (user editable)
  return '静态'
}

// Load all IPv6 routes
const loadRoutes = async () => {
  loading.value = true
  error.value = ''

  try {
    const response = await ipv6Api.getRoutes()
    const result = response.data
    if (result.success && Array.isArray(result.data)) {
      routes.value = result.data.map((route: IPv6Route) => ({
        ...route,
        disabled: toBool(route.disabled),
        active: toBool(route.active),
        dynamic: toBool(route.dynamic),
        static: toBool(route.static),
        blackhole: toBool(route.blackhole),
        'suppress-hw-offload': toBool(route['suppress-hw-offload']),
        _routeType: getRouteType(route)
      }))
    } else {
      routes.value = []
      if (!result.success && result.error) {
        throw new Error(result.error)
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '加载 IPv6 路由列表失败'
    error.value = message
    ElMessage.error(message)
  } finally {
    loading.value = false
  }
}

// Get status tag type
const getStatusType = (row: IPv6Route) => {
  if (row.disabled) return 'danger'
  if (row.active) return 'success'
  return 'warning'
}

// Get status text
const getStatusText = (row: IPv6Route) => {
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
const handleEdit = (row: IPv6Route) => {
  isEditing.value = true
  editingId.value = row['.id']
  form.dstAddress = row['dst-address']
  form.gateway = row.gateway || ''
  form.prefSrc = row['pref-src'] || ''
  form.distance = row.distance || 1
  form.checkGateway = row['check-gateway'] || ''
  form.routingTable = row['routing-table'] || ''
  form.scope = row.scope || 30
  form.targetScope = row['target-scope'] || 10
  form.blackhole = toBool(row.blackhole)
  form.suppressHwOffload = toBool(row['suppress-hw-offload'])
  form.enabled = !toBool(row.disabled)
  form.comment = row.comment || ''
  dialogVisible.value = true
}

// Handle delete button click
const handleDelete = async (row: IPv6Route) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除 IPv6 路由 "${row['dst-address']}" 吗？`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    loading.value = true
    await ipv6Api.deleteRoute(row['.id'])
    ElMessage.success('IPv6 路由已删除')
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
  form.prefSrc = ''
  form.distance = 1
  form.checkGateway = ''
  form.routingTable = ''
  form.scope = 30
  form.targetScope = 10
  form.blackhole = false
  form.suppressHwOffload = false
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
      disabled: !form.enabled,
      blackhole: form.blackhole,
      'suppress-hw-offload': form.suppressHwOffload
    }

    // Only include optional fields if they have values
    if (form.gateway) {
      data.gateway = form.gateway
    }
    if (form.prefSrc) {
      data['pref-src'] = form.prefSrc
    }
    if (form.checkGateway) {
      data['check-gateway'] = form.checkGateway
    }
    if (form.routingTable) {
      data['routing-table'] = form.routingTable
    }
    if (form.scope !== 30) {
      data.scope = form.scope
    }
    if (form.targetScope !== 10) {
      data['target-scope'] = form.targetScope
    }
    if (form.comment) {
      data.comment = form.comment
    }

    if (isEditing.value) {
      await ipv6Api.updateRoute(editingId.value, data)
      ElMessage.success('IPv6 路由已更新')
    } else {
      await ipv6Api.addRoute(data)
      ElMessage.success('IPv6 路由已添加')
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
.ipv6-route-view {
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

.form-tip {
  margin-left: 12px;
  color: #909399;
  font-size: 12px;
}
</style>

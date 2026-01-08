<template>
  <div class="interface-view">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>网络接口</span>
          <div class="header-actions">
            <el-dropdown @command="handleAddCommand">
              <el-button type="primary" :icon="Plus">
                新增 <el-icon class="el-icon--right"><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="l2tp">L2TP Client</el-dropdown-item>
                  <el-dropdown-item command="pppoe">PPPoE Client</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <el-button
              :icon="Refresh"
              :loading="loading"
              @click="loadInterfaces"
            >
              刷新
            </el-button>
          </div>
        </div>
      </template>

      <!-- Loading State -->
      <el-skeleton v-if="loading && interfaces.length === 0" :rows="5" animated />

      <!-- Error State -->
      <el-alert
        v-else-if="error"
        :title="error"
        type="error"
        show-icon
        closable
        @close="error = ''"
      />

      <!-- Interface Table -->
      <el-table
        v-else
        v-loading="loading"
        :data="interfaces"
        stripe
        style="width: 100%"
        @row-click="handleRowClick"
      >
        <el-table-column prop="name" label="名称" min-width="120" sortable />
        <el-table-column prop="type" label="类型" width="120" sortable />
        <el-table-column prop="mac-address" label="MAC 地址" min-width="150" />
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row)" size="small">
              {{ getStatusText(row) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="comment" label="备注" min-width="150" show-overflow-tooltip />
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button-group>
              <el-button
                size="small"
                :type="row.disabled ? 'success' : 'warning'"
                :loading="row._toggling"
                @click.stop="handleToggleStatus(row)"
              >
                {{ row.disabled ? '启用' : '禁用' }}
              </el-button>
              <el-button
                size="small"
                type="primary"
                @click.stop="handleEdit(row)"
              >
                编辑
              </el-button>
              <el-button
                v-if="isL2tpClient(row) || isPppoeClient(row)"
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
      title="接口详情"
      width="500px"
      destroy-on-close
    >
      <el-descriptions v-if="selectedInterface" :column="1" border>
        <el-descriptions-item label="名称">
          {{ selectedInterface.name }}
        </el-descriptions-item>
        <el-descriptions-item label="类型">
          {{ selectedInterface.type }}
        </el-descriptions-item>
        <el-descriptions-item label="MAC 地址">
          {{ selectedInterface['mac-address'] || '-' }}
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

    <!-- Generic Edit Dialog -->
    <el-dialog
      v-model="editDialogVisible"
      title="编辑接口"
      width="500px"
      destroy-on-close
      @closed="resetEditForm"
    >
      <el-form
        ref="editFormRef"
        :model="editForm"
        :rules="editRules"
        label-width="100px"
        :disabled="saving"
      >
        <el-form-item label="接口名称" prop="name">
          <el-input v-model="editForm.name" placeholder="请输入接口名称" />
        </el-form-item>
        <el-form-item label="MTU" prop="mtu">
          <el-input-number
            v-model="editForm.mtu"
            :min="68"
            :max="65535"
            controls-position="right"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="备注" prop="comment">
          <el-input
            v-model="editForm.comment"
            type="textarea"
            :rows="3"
            placeholder="请输入备注信息"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSaveEdit">
          保存
        </el-button>
      </template>
    </el-dialog>

    <!-- L2TP Client Edit Dialog -->
    <el-dialog
      v-model="l2tpEditDialogVisible"
      :title="isL2tpAdding ? '新增 L2TP Client' : '编辑 L2TP Client'"
      width="550px"
      destroy-on-close
      @closed="resetL2tpForm"
    >
      <el-form
        ref="l2tpFormRef"
        :model="l2tpForm"
        :rules="l2tpRules"
        label-width="130px"
        :disabled="saving"
      >
        <el-form-item label="接口名称" prop="name">
          <el-input v-model="l2tpForm.name" placeholder="请输入接口名称" />
        </el-form-item>
        <el-form-item label="连接服务器" prop="connect-to">
          <el-input v-model="l2tpForm['connect-to']" placeholder="IP 地址或域名" />
        </el-form-item>
        <el-form-item label="用户名" prop="user">
          <el-input v-model="l2tpForm.user" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="l2tpForm.password" type="password" show-password placeholder="请输入密码" />
        </el-form-item>
        <el-form-item label="自动连接">
          <el-switch v-model="l2tpForm['dial-on-demand']" />
          <span class="form-tip">Dial On Demand</span>
        </el-form-item>
        <el-form-item label="添加默认路由">
          <el-switch v-model="l2tpForm['add-default-route']" />
        </el-form-item>
        <el-form-item label="默认路由距离" v-if="l2tpForm['add-default-route']">
          <el-input-number
            v-model="l2tpForm['default-route-distance']"
            :min="1"
            :max="255"
            controls-position="right"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="备注" prop="comment">
          <el-input
            v-model="l2tpForm.comment"
            type="textarea"
            :rows="2"
            placeholder="请输入备注信息"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="l2tpEditDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSaveL2tp">
          保存
        </el-button>
      </template>
    </el-dialog>

    <!-- PPPoE Client Edit Dialog -->
    <el-dialog
      v-model="pppoeEditDialogVisible"
      :title="isPppoeAdding ? '新增 PPPoE Client' : '编辑 PPPoE Client'"
      width="550px"
      destroy-on-close
      @closed="resetPppoeForm"
    >
      <el-form
        ref="pppoeFormRef"
        :model="pppoeForm"
        :rules="pppoeRules"
        label-width="130px"
        :disabled="saving"
      >
        <el-form-item label="接口名称" prop="name">
          <el-input v-model="pppoeForm.name" placeholder="请输入接口名称" />
        </el-form-item>
        <el-form-item label="关联接口" prop="interface">
          <el-select v-model="pppoeForm.interface" placeholder="选择关联接口" style="width: 100%">
            <el-option
              v-for="iface in availableInterfaces"
              :key="iface.name"
              :label="iface.name"
              :value="iface.name"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="用户名" prop="user">
          <el-input v-model="pppoeForm.user" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="pppoeForm.password" type="password" show-password placeholder="请输入密码" />
        </el-form-item>
        <el-form-item label="Keepalive">
          <el-input-number
            v-model="pppoeForm['keepalive-timeout']"
            :min="0"
            :max="3600"
            controls-position="right"
            style="width: 100%"
          />
          <span class="form-tip">秒 (0 表示禁用)</span>
        </el-form-item>
        <el-form-item label="自动连接">
          <el-switch v-model="pppoeForm['dial-on-demand']" />
          <span class="form-tip">Dial On Demand</span>
        </el-form-item>
        <el-form-item label="添加默认路由">
          <el-switch v-model="pppoeForm['add-default-route']" />
        </el-form-item>
        <el-form-item label="默认路由距离" v-if="pppoeForm['add-default-route']">
          <el-input-number
            v-model="pppoeForm['default-route-distance']"
            :min="1"
            :max="255"
            controls-position="right"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="备注" prop="comment">
          <el-input
            v-model="pppoeForm.comment"
            type="textarea"
            :rows="2"
            placeholder="请输入备注信息"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pppoeEditDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSavePppoe">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>


<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Refresh, Plus, ArrowDown } from '@element-plus/icons-vue'
import { interfaceApi } from '@/api'

// Interface type definition
interface NetworkInterface {
  '.id': string
  name: string
  type: string
  'mac-address': string
  mtu: number
  disabled: boolean
  running: boolean
  comment?: string
  _toggling?: boolean
}

// L2TP Client type
interface L2tpClient {
  '.id': string
  name: string
  'connect-to': string
  user: string
  password?: string
  'dial-on-demand': boolean
  'add-default-route': boolean
  'default-route-distance': number
  comment?: string
}

// PPPoE Client type
interface PppoeClient {
  '.id': string
  name: string
  interface: string
  user: string
  password?: string
  'keepalive-timeout': number
  'dial-on-demand': boolean
  'add-default-route': boolean
  'default-route-distance': number
  comment?: string
}

// State
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const interfaces = ref<NetworkInterface[]>([])
const l2tpClients = ref<L2tpClient[]>([])
const pppoeClients = ref<PppoeClient[]>([])

// Detail dialog
const detailDialogVisible = ref(false)
const selectedInterface = ref<NetworkInterface | null>(null)

// Generic Edit dialog
const editDialogVisible = ref(false)
const editFormRef = ref<FormInstance>()
const editForm = reactive({
  id: '',
  name: '',
  mtu: 1500,
  comment: ''
})

const editRules: FormRules = {
  name: [{ required: true, message: '请输入接口名称', trigger: 'blur' }],
  mtu: [{ type: 'number', min: 68, max: 65535, message: 'MTU 范围 68-65535', trigger: 'blur' }]
}

// L2TP Edit dialog
const l2tpEditDialogVisible = ref(false)
const l2tpFormRef = ref<FormInstance>()
const isL2tpAdding = ref(false)
const l2tpForm = reactive({
  id: '',
  name: '',
  'connect-to': '',
  user: '',
  password: '',
  'dial-on-demand': false,
  'add-default-route': false,
  'default-route-distance': 1,
  comment: ''
})

const l2tpRules: FormRules = {
  name: [{ required: true, message: '请输入接口名称', trigger: 'blur' }],
  'connect-to': [{ required: true, message: '请输入连接服务器地址', trigger: 'blur' }],
  user: [{ required: true, message: '请输入用户名', trigger: 'blur' }]
}

// PPPoE Edit dialog
const pppoeEditDialogVisible = ref(false)
const pppoeFormRef = ref<FormInstance>()
const isPppoeAdding = ref(false)
const pppoeForm = reactive({
  id: '',
  name: '',
  interface: '',
  user: '',
  password: '',
  'keepalive-timeout': 30,
  'dial-on-demand': false,
  'add-default-route': false,
  'default-route-distance': 1,
  comment: ''
})

const pppoeRules: FormRules = {
  name: [{ required: true, message: '请输入接口名称', trigger: 'blur' }],
  interface: [{ required: true, message: '请选择关联接口', trigger: 'change' }],
  user: [{ required: true, message: '请输入用户名', trigger: 'blur' }]
}

// Available interfaces for PPPoE (exclude PPPoE and L2TP types)
const availableInterfaces = computed(() => {
  return interfaces.value.filter(iface => 
    !['pppoe-out', 'l2tp-out', 'pptp-out', 'ovpn-out'].some(t => iface.type?.includes(t))
  )
})

// Load interfaces on mount
onMounted(() => {
  loadInterfaces()
})

// 将字符串布尔值转换为真正的布尔值
const toBool = (val: unknown): boolean => {
  if (typeof val === 'boolean') return val
  if (typeof val === 'string') return val.toLowerCase() === 'true'
  return Boolean(val)
}

// Load all interfaces
const loadInterfaces = async () => {
  loading.value = true
  error.value = ''

  try {
    // Load all interfaces
    const response = await interfaceApi.getAll()
    const result = response.data
    if (result.success && Array.isArray(result.data)) {
      interfaces.value = result.data.map((iface: NetworkInterface) => ({
        ...iface,
        disabled: toBool(iface.disabled),
        running: toBool(iface.running),
        _toggling: false
      }))
    } else {
      interfaces.value = []
      if (!result.success && result.error) {
        throw new Error(result.error)
      }
    }

    // Load L2TP clients
    try {
      const l2tpResponse = await interfaceApi.getL2tpClients()
      const l2tpResult = l2tpResponse.data
      if (l2tpResult.success && Array.isArray(l2tpResult.data)) {
        l2tpClients.value = l2tpResult.data.map((client: L2tpClient) => ({
          ...client,
          'dial-on-demand': toBool(client['dial-on-demand']),
          'add-default-route': toBool(client['add-default-route'])
        }))
      }
    } catch {
      // L2TP may not be available
      l2tpClients.value = []
    }

    // Load PPPoE clients
    try {
      const pppoeResponse = await interfaceApi.getPppoeClients()
      const pppoeResult = pppoeResponse.data
      if (pppoeResult.success && Array.isArray(pppoeResult.data)) {
        pppoeClients.value = pppoeResult.data.map((client: PppoeClient) => ({
          ...client,
          'dial-on-demand': toBool(client['dial-on-demand']),
          'add-default-route': toBool(client['add-default-route'])
        }))
      }
    } catch {
      // PPPoE may not be available
      pppoeClients.value = []
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '加载接口列表失败'
    error.value = message
    ElMessage.error(message)
  } finally {
    loading.value = false
  }
}

// Get status tag type
const getStatusType = (row: NetworkInterface) => {
  if (row.disabled) return 'danger'
  if (row.running) return 'success'
  return 'warning'
}

// Get status text
const getStatusText = (row: NetworkInterface) => {
  if (row.disabled) return '已禁用'
  if (row.running) return '运行中'
  return '已停止'
}

// Handle row click to show detail
const handleRowClick = (row: NetworkInterface) => {
  selectedInterface.value = row
  detailDialogVisible.value = true
}

// Handle toggle enable/disable
const handleToggleStatus = async (row: NetworkInterface) => {
  row._toggling = true

  try {
    if (row.disabled) {
      await interfaceApi.enable(row['.id'])
      ElMessage.success(`接口 ${row.name} 已启用`)
    } else {
      await interfaceApi.disable(row['.id'])
      ElMessage.success(`接口 ${row.name} 已禁用`)
    }
    await loadInterfaces()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '操作失败'
    ElMessage.error(message)
  } finally {
    row._toggling = false
  }
}

// Handle delete interface
const handleDelete = async (row: NetworkInterface) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除接口 "${row.name}" 吗？此操作不可恢复。`,
      '删除确认',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    loading.value = true
    
    if (isL2tpClient(row)) {
      const client = findL2tpClient(row.name)
      if (client) {
        await interfaceApi.deleteL2tpClient(client['.id'])
        ElMessage.success(`L2TP 客户端 ${row.name} 已删除`)
      }
    } else if (isPppoeClient(row)) {
      const client = findPppoeClient(row.name)
      if (client) {
        await interfaceApi.deletePppoeClient(client['.id'])
        ElMessage.success(`PPPoE 客户端 ${row.name} 已删除`)
      }
    }
    
    await loadInterfaces()
  } catch (err: unknown) {
    if (err !== 'cancel') {
      const message = err instanceof Error ? err.message : '删除失败'
      ElMessage.error(message)
    }
  } finally {
    loading.value = false
  }
}

// Handle add command from dropdown
const handleAddCommand = (command: string) => {
  if (command === 'l2tp') {
    handleAddL2tp()
  } else if (command === 'pppoe') {
    handleAddPppoe()
  }
}

// Handle add L2TP Client
const handleAddL2tp = () => {
  isL2tpAdding.value = true
  l2tpForm.id = ''
  l2tpForm.name = ''
  l2tpForm['connect-to'] = ''
  l2tpForm.user = ''
  l2tpForm.password = ''
  l2tpForm['dial-on-demand'] = true
  l2tpForm['add-default-route'] = false
  l2tpForm['default-route-distance'] = 1
  l2tpForm.comment = ''
  l2tpEditDialogVisible.value = true
}

// Handle add PPPoE Client
const handleAddPppoe = () => {
  isPppoeAdding.value = true
  pppoeForm.id = ''
  pppoeForm.name = ''
  pppoeForm.interface = ''
  pppoeForm.user = ''
  pppoeForm.password = ''
  pppoeForm['keepalive-timeout'] = 30
  pppoeForm['dial-on-demand'] = true
  pppoeForm['add-default-route'] = false
  pppoeForm['default-route-distance'] = 1
  pppoeForm.comment = ''
  pppoeEditDialogVisible.value = true
}

// Check if interface is L2TP Client
const isL2tpClient = (row: NetworkInterface): boolean => {
  return row.type === 'l2tp-out' || row.name.toLowerCase().includes('l2tp')
}

// Check if interface is PPPoE Client
const isPppoeClient = (row: NetworkInterface): boolean => {
  return row.type === 'pppoe-out' || row.type === 'PPPoE Client'
}

// Find L2TP client by name
const findL2tpClient = (name: string): L2tpClient | undefined => {
  return l2tpClients.value.find(c => c.name === name)
}

// Find PPPoE client by name
const findPppoeClient = (name: string): PppoeClient | undefined => {
  return pppoeClients.value.find(c => c.name === name)
}

// Handle edit button click
const handleEdit = async (row: NetworkInterface) => {
  if (isL2tpClient(row)) {
    // Edit L2TP Client
    const client = findL2tpClient(row.name)
    if (client) {
      isL2tpAdding.value = false
      l2tpForm.id = client['.id']
      l2tpForm.name = client.name
      l2tpForm['connect-to'] = client['connect-to'] || ''
      l2tpForm.user = client.user || ''
      l2tpForm.password = ''
      l2tpForm['dial-on-demand'] = toBool(client['dial-on-demand'])
      l2tpForm['add-default-route'] = toBool(client['add-default-route'])
      l2tpForm['default-route-distance'] = Number(client['default-route-distance']) || 1
      l2tpForm.comment = client.comment || ''
      l2tpEditDialogVisible.value = true
    } else {
      // Fallback to generic edit
      openGenericEdit(row)
    }
  } else if (isPppoeClient(row)) {
    // Edit PPPoE Client
    const client = findPppoeClient(row.name)
    if (client) {
      isPppoeAdding.value = false
      pppoeForm.id = client['.id']
      pppoeForm.name = client.name
      pppoeForm.interface = client.interface || ''
      pppoeForm.user = client.user || ''
      pppoeForm.password = ''
      pppoeForm['keepalive-timeout'] = Number(client['keepalive-timeout']) || 30
      pppoeForm['dial-on-demand'] = toBool(client['dial-on-demand'])
      pppoeForm['add-default-route'] = toBool(client['add-default-route'])
      pppoeForm['default-route-distance'] = Number(client['default-route-distance']) || 1
      pppoeForm.comment = client.comment || ''
      pppoeEditDialogVisible.value = true
    } else {
      // Fallback to generic edit
      openGenericEdit(row)
    }
  } else {
    // Generic interface edit
    openGenericEdit(row)
  }
}

// Open generic edit dialog
const openGenericEdit = (row: NetworkInterface) => {
  editForm.id = row['.id']
  editForm.name = row.name
  editForm.mtu = row.mtu || 1500
  editForm.comment = row.comment || ''
  editDialogVisible.value = true
}

// Handle edit from detail dialog
const handleEditFromDetail = () => {
  if (selectedInterface.value) {
    detailDialogVisible.value = false
    handleEdit(selectedInterface.value)
  }
}

// Reset edit form
const resetEditForm = () => {
  editForm.id = ''
  editForm.name = ''
  editForm.mtu = 1500
  editForm.comment = ''
  editFormRef.value?.resetFields()
}

// Reset L2TP form
const resetL2tpForm = () => {
  isL2tpAdding.value = false
  l2tpForm.id = ''
  l2tpForm.name = ''
  l2tpForm['connect-to'] = ''
  l2tpForm.user = ''
  l2tpForm.password = ''
  l2tpForm['dial-on-demand'] = false
  l2tpForm['add-default-route'] = false
  l2tpForm['default-route-distance'] = 1
  l2tpForm.comment = ''
  l2tpFormRef.value?.resetFields()
}

// Reset PPPoE form
const resetPppoeForm = () => {
  isPppoeAdding.value = false
  pppoeForm.id = ''
  pppoeForm.name = ''
  pppoeForm.interface = ''
  pppoeForm.user = ''
  pppoeForm.password = ''
  pppoeForm['keepalive-timeout'] = 30
  pppoeForm['dial-on-demand'] = false
  pppoeForm['add-default-route'] = false
  pppoeForm['default-route-distance'] = 1
  pppoeForm.comment = ''
  pppoeFormRef.value?.resetFields()
}

// Save generic edit
const handleSaveEdit = async () => {
  const valid = await editFormRef.value?.validate().catch(() => false)
  if (!valid) return

  saving.value = true

  try {
    const data: Record<string, unknown> = {
      name: editForm.name,
      comment: editForm.comment
    }
    // Only include mtu if it's a valid number
    if (editForm.mtu && editForm.mtu >= 68) {
      data.mtu = editForm.mtu
    }
    
    await interfaceApi.update(editForm.id, data)
    ElMessage.success('接口配置已更新')
    editDialogVisible.value = false
    await loadInterfaces()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '更新失败'
    ElMessage.error(message)
  } finally {
    saving.value = false
  }
}

// Save L2TP edit
const handleSaveL2tp = async () => {
  const valid = await l2tpFormRef.value?.validate().catch(() => false)
  if (!valid) return

  saving.value = true

  try {
    const data: Record<string, unknown> = {
      name: l2tpForm.name,
      'connect-to': l2tpForm['connect-to'],
      user: l2tpForm.user,
      'dial-on-demand': l2tpForm['dial-on-demand'] ? 'yes' : 'no',
      'add-default-route': l2tpForm['add-default-route'] ? 'yes' : 'no'
    }
    
    // Password is required for new, optional for edit
    if (l2tpForm.password || isL2tpAdding.value) {
      data.password = l2tpForm.password
    }
    
    // Include default route distance if add-default-route is enabled
    if (l2tpForm['add-default-route']) {
      data['default-route-distance'] = l2tpForm['default-route-distance']
    }
    
    if (l2tpForm.comment) {
      data.comment = l2tpForm.comment
    }
    
    if (isL2tpAdding.value) {
      await interfaceApi.createL2tpClient(data)
      ElMessage.success('L2TP 客户端已创建')
    } else {
      await interfaceApi.updateL2tpClient(l2tpForm.id, data)
      ElMessage.success('L2TP 客户端配置已更新')
    }
    
    l2tpEditDialogVisible.value = false
    await loadInterfaces()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '操作失败'
    ElMessage.error(message)
  } finally {
    saving.value = false
  }
}

// Save PPPoE edit
const handleSavePppoe = async () => {
  const valid = await pppoeFormRef.value?.validate().catch(() => false)
  if (!valid) return

  saving.value = true

  try {
    const data: Record<string, unknown> = {
      name: pppoeForm.name,
      interface: pppoeForm.interface,
      user: pppoeForm.user,
      'keepalive-timeout': pppoeForm['keepalive-timeout'],
      'dial-on-demand': pppoeForm['dial-on-demand'] ? 'yes' : 'no',
      'add-default-route': pppoeForm['add-default-route'] ? 'yes' : 'no'
    }
    
    // Password is required for new, optional for edit
    if (pppoeForm.password || isPppoeAdding.value) {
      data.password = pppoeForm.password
    }
    
    // Include default route distance if add-default-route is enabled
    if (pppoeForm['add-default-route']) {
      data['default-route-distance'] = pppoeForm['default-route-distance']
    }
    
    if (pppoeForm.comment) {
      data.comment = pppoeForm.comment
    }
    
    if (isPppoeAdding.value) {
      await interfaceApi.createPppoeClient(data)
      ElMessage.success('PPPoE 客户端已创建')
    } else {
      await interfaceApi.updatePppoeClient(pppoeForm.id, data)
      ElMessage.success('PPPoE 客户端配置已更新')
    }
    
    pppoeEditDialogVisible.value = false
    await loadInterfaces()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '操作失败'
    ElMessage.error(message)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.interface-view {
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

.form-tip {
  margin-left: 10px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>

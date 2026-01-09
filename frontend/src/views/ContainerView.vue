<template>
  <div class="container-view">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>容器管理</span>
          <div class="header-actions">
            <el-button type="primary" :icon="Plus" @click="handleAdd">
              新增
            </el-button>
            <el-button
              :icon="Refresh"
              :loading="loading"
              @click="loadContainers"
            >
              刷新
            </el-button>
          </div>
        </div>
      </template>

      <!-- Loading State -->
      <el-skeleton v-if="loading && containers.length === 0" :rows="5" animated />

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
        v-else-if="containers.length === 0"
        description="暂无容器"
      >
        <el-button type="primary" @click="handleAdd">创建容器</el-button>
      </el-empty>

      <!-- Container Table -->
      <el-table
        v-else
        v-loading="loading"
        :data="containers"
        stripe
        style="width: 100%"
        @row-click="handleRowClick"
      >
        <el-table-column prop="name" label="名称" min-width="120" sortable />
        <el-table-column prop="tag" label="镜像" min-width="180" show-overflow-tooltip />
        <el-table-column prop="interface" label="接口" width="120">
          <template #default="{ row }">
            {{ row.interface || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="hostname" label="主机名" width="120">
          <template #default="{ row }">
            {{ row.hostname || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row)" size="small">
              {{ getStatusText(row) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="comment" label="备注" min-width="150" show-overflow-tooltip />
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" link @click.stop="showDetail(row)">
              详情
            </el-button>
            <el-button size="small" type="warning" link @click.stop="handleEdit(row)">
              编辑
            </el-button>
            <el-button
              v-if="getContainerStatus(row) !== 'running'"
              size="small"
              type="success"
              link
              :loading="actionLoading === row['.id'] + '-start'"
              @click.stop="handleStart(row)"
            >
              启动
            </el-button>
            <el-button
              v-else
              size="small"
              type="danger"
              link
              :loading="actionLoading === row['.id'] + '-stop'"
              @click.stop="handleStop(row)"
            >
              停止
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Detail Dialog -->
    <el-dialog
      v-model="detailVisible"
      title="容器详情"
      width="700px"
      destroy-on-close
    >
      <el-descriptions :column="2" border v-if="selectedContainer">
        <el-descriptions-item label="ID">{{ selectedContainer['.id'] }}</el-descriptions-item>
        <el-descriptions-item label="名称">{{ selectedContainer.name }}</el-descriptions-item>
        <el-descriptions-item label="镜像标签" :span="2">{{ selectedContainer.tag }}</el-descriptions-item>
        <el-descriptions-item label="Root 目录" :span="2">{{ selectedContainer['root-dir'] }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusType(selectedContainer)" size="small">
            {{ getStatusText(selectedContainer) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="接口">{{ selectedContainer.interface || '-' }}</el-descriptions-item>
        <el-descriptions-item label="主机名">{{ selectedContainer.hostname || '-' }}</el-descriptions-item>
        <el-descriptions-item label="DNS">{{ selectedContainer.dns || '-' }}</el-descriptions-item>
        <el-descriptions-item label="域名">{{ selectedContainer['domain-name'] || '-' }}</el-descriptions-item>
        <el-descriptions-item label="工作目录">{{ selectedContainer.workdir || '-' }}</el-descriptions-item>
        <el-descriptions-item label="入口点" :span="2">{{ selectedContainer.entrypoint || '-' }}</el-descriptions-item>
        <el-descriptions-item label="启动命令" :span="2">{{ selectedContainer.cmd || '-' }}</el-descriptions-item>
        <el-descriptions-item label="挂载点">{{ selectedContainer.mounts || '-' }}</el-descriptions-item>
        <el-descriptions-item label="环境变量">{{ selectedContainer.envlist || '-' }}</el-descriptions-item>
        <el-descriptions-item label="运行用户">{{ selectedContainer.user || '-' }}</el-descriptions-item>
        <el-descriptions-item label="内存限制">{{ selectedContainer['memory-high'] || '-' }}</el-descriptions-item>
        <el-descriptions-item label="停止信号">{{ selectedContainer['stop-signal'] || '-' }}</el-descriptions-item>
        <el-descriptions-item label="开机自启">{{ selectedContainer['start-on-boot'] ? '是' : '否' }}</el-descriptions-item>
        <el-descriptions-item label="启用日志">{{ selectedContainer.logging ? '是' : '否' }}</el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">{{ selectedContainer.comment || '-' }}</el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
        <el-button type="primary" @click="handleEditFromDetail">编辑</el-button>
      </template>
    </el-dialog>

    <!-- Add/Edit Dialog -->
    <el-dialog
      v-model="formVisible"
      :title="isEdit ? '编辑容器' : '新增容器'"
      width="700px"
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
            <el-form-item label="容器名称" prop="name">
              <el-input v-model="formData.name" placeholder="如: my-container" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="镜像标签" prop="tag">
              <el-input v-model="formData.tag" placeholder="如: nginx:latest" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="Root 目录" prop="root-dir">
          <el-input v-model="formData['root-dir']" placeholder="如: /disk1/containers/nginx" />
        </el-form-item>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="网络接口" prop="interface">
              <el-input v-model="formData.interface" placeholder="VETH 接口名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="主机名" prop="hostname">
              <el-input v-model="formData.hostname" placeholder="容器主机名" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="DNS" prop="dns">
              <el-input v-model="formData.dns" placeholder="DNS 服务器地址" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="域名" prop="domain-name">
              <el-input v-model="formData['domain-name']" placeholder="域名" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="挂载点" prop="mounts">
              <el-input v-model="formData.mounts" placeholder="挂载点名称，逗号分隔" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="环境变量" prop="envlist">
              <el-input v-model="formData.envlist" placeholder="环境变量列表名称" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="工作目录" prop="workdir">
          <el-input v-model="formData.workdir" placeholder="容器内工作目录" />
        </el-form-item>
        <el-form-item label="入口点" prop="entrypoint">
          <el-input v-model="formData.entrypoint" placeholder="容器入口点" />
        </el-form-item>
        <el-form-item label="启动命令" prop="cmd">
          <el-input v-model="formData.cmd" placeholder="容器启动命令" />
        </el-form-item>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="运行用户" prop="user">
              <el-input v-model="formData.user" placeholder="运行用户" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="内存限制" prop="memory-high">
              <el-input v-model="formData['memory-high']" placeholder="如: 512M" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="开机自启" prop="start-on-boot">
              <el-switch v-model="formData['start-on-boot']" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="启用日志" prop="logging">
              <el-switch v-model="formData.logging" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="备注" prop="comment">
          <el-input v-model="formData.comment" type="textarea" :rows="2" placeholder="备注信息" />
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
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox, FormInstance, FormRules } from 'element-plus'
import { Refresh, Plus } from '@element-plus/icons-vue'
import { containerApi } from '@/api'

// Container type definition
// RouterOS returns status as multiple boolean fields instead of a single status field
interface Container {
  '.id': string
  name: string
  tag: string
  'root-dir': string
  interface?: string
  hostname?: string
  dns?: string
  'domain-name'?: string
  mounts?: string
  envlist?: string
  workdir?: string
  entrypoint?: string
  cmd?: string
  user?: string
  'memory-high'?: string
  'stop-signal'?: string
  logging?: boolean
  'start-on-boot'?: boolean
  // RouterOS status boolean fields
  running?: string
  stopped?: string
  starting?: string
  stopping?: string
  extracting?: string
  comment?: string
}

// Form data type
interface ContainerFormData {
  name: string
  tag: string
  'root-dir': string
  interface?: string
  hostname?: string
  dns?: string
  'domain-name'?: string
  mounts?: string
  envlist?: string
  workdir?: string
  entrypoint?: string
  cmd?: string
  user?: string
  'memory-high'?: string
  'start-on-boot'?: boolean
  logging?: boolean
  comment?: string
}

// State
const loading = ref(false)
const error = ref('')
const containers = ref<Container[]>([])
const detailVisible = ref(false)
const selectedContainer = ref<Container | null>(null)
const formVisible = ref(false)
const isEdit = ref(false)
const editingId = ref('')
const submitting = ref(false)
const actionLoading = ref('')
const formRef = ref<FormInstance>()

// Form data
const defaultFormData: ContainerFormData = {
  name: '',
  tag: '',
  'root-dir': '',
  interface: '',
  hostname: '',
  dns: '',
  'domain-name': '',
  mounts: '',
  envlist: '',
  workdir: '',
  entrypoint: '',
  cmd: '',
  user: '',
  'memory-high': '',
  'start-on-boot': false,
  logging: false,
  comment: ''
}

const formData = reactive<ContainerFormData>({ ...defaultFormData })

// Form validation rules
const formRules: FormRules = {
  name: [{ required: true, message: '请输入容器名称', trigger: 'blur' }],
  tag: [{ required: true, message: '请输入镜像标签', trigger: 'blur' }],
  'root-dir': [{ required: true, message: '请输入 Root 目录', trigger: 'blur' }]
}

// Load containers on mount
onMounted(() => {
  loadContainers()
})

// Convert string boolean to real boolean
const toBool = (val: unknown): boolean => {
  if (typeof val === 'boolean') return val
  if (typeof val === 'string') return val.toLowerCase() === 'true'
  return Boolean(val)
}

// Load all containers
const loadContainers = async () => {
  loading.value = true
  error.value = ''

  try {
    const response = await containerApi.getAll()
    const result = response.data
    if (result.success && Array.isArray(result.data)) {
      containers.value = result.data.map((container: Container) => ({
        ...container,
        logging: toBool(container.logging),
        'start-on-boot': toBool(container['start-on-boot'])
      }))
    } else {
      containers.value = []
      if (!result.success && result.error) {
        throw new Error(result.error)
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '加载容器列表失败'
    error.value = message
    ElMessage.error(message)
  } finally {
    loading.value = false
  }
}

// Get container status from RouterOS boolean fields
const getContainerStatus = (container: Container): string => {
  if (container.running === 'true') return 'running'
  if (container.stopped === 'true') return 'stopped'
  if (container.starting === 'true') return 'starting'
  if (container.stopping === 'true') return 'stopping'
  if (container.extracting === 'true') return 'extracting'
  return 'unknown'
}

// Get status tag type based on container status
const getStatusType = (container: Container): 'success' | 'danger' | 'warning' | 'info' => {
  const status = getContainerStatus(container)
  switch (status) {
    case 'running':
      return 'success'
    case 'stopped':
      return 'info'
    case 'starting':
    case 'stopping':
    case 'extracting':
      return 'warning'
    default:
      return 'danger'
  }
}

// Get status text for display
const getStatusText = (container: Container): string => {
  const status = getContainerStatus(container)
  switch (status) {
    case 'running':
      return '运行中'
    case 'stopped':
      return '已停止'
    case 'starting':
      return '启动中'
    case 'stopping':
      return '停止中'
    case 'extracting':
      return '解压中'
    default:
      return '未知'
  }
}

// Handle row click
const handleRowClick = (row: Container) => {
  showDetail(row)
}

// Show container detail
const showDetail = (row: Container) => {
  selectedContainer.value = row
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
const handleEdit = (row: Container) => {
  isEdit.value = true
  editingId.value = row['.id']
  Object.assign(formData, {
    name: row.name,
    tag: row.tag,
    'root-dir': row['root-dir'],
    interface: row.interface || '',
    hostname: row.hostname || '',
    dns: row.dns || '',
    'domain-name': row['domain-name'] || '',
    mounts: row.mounts || '',
    envlist: row.envlist || '',
    workdir: row.workdir || '',
    entrypoint: row.entrypoint || '',
    cmd: row.cmd || '',
    user: row.user || '',
    'memory-high': row['memory-high'] || '',
    'start-on-boot': toBool(row['start-on-boot']),
    logging: toBool(row.logging),
    comment: row.comment || ''
  })
  formVisible.value = true
}

// Handle edit from detail dialog
const handleEditFromDetail = () => {
  if (selectedContainer.value) {
    detailVisible.value = false
    handleEdit(selectedContainer.value)
  }
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
    // Build submit data with only non-empty fields
    const submitData: Record<string, unknown> = {
      name: formData.name,
      tag: formData.tag,
      'root-dir': formData['root-dir']
    }
    
    if (formData.interface) submitData.interface = formData.interface
    if (formData.hostname) submitData.hostname = formData.hostname
    if (formData.dns) submitData.dns = formData.dns
    if (formData['domain-name']) submitData['domain-name'] = formData['domain-name']
    if (formData.mounts) submitData.mounts = formData.mounts
    if (formData.envlist) submitData.envlist = formData.envlist
    if (formData.workdir) submitData.workdir = formData.workdir
    if (formData.entrypoint) submitData.entrypoint = formData.entrypoint
    if (formData.cmd) submitData.cmd = formData.cmd
    if (formData.user) submitData.user = formData.user
    if (formData['memory-high']) submitData['memory-high'] = formData['memory-high']
    if (formData['start-on-boot']) submitData['start-on-boot'] = 'yes'
    if (formData.logging) submitData.logging = 'yes'
    if (formData.comment) submitData.comment = formData.comment

    if (isEdit.value) {
      await containerApi.update(editingId.value, submitData)
      ElMessage.success('容器配置已更新')
    } else {
      await containerApi.create(submitData)
      ElMessage.success('容器已创建')
    }

    formVisible.value = false
    loadContainers()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : (isEdit.value ? '更新容器失败' : '创建容器失败')
    ElMessage.error(message)
  } finally {
    submitting.value = false
  }
}

// Handle start container
const handleStart = async (row: Container) => {
  try {
    await ElMessageBox.confirm(
      `确定要启动容器 "${row.name}" 吗？`,
      '启动确认',
      {
        confirmButtonText: '启动',
        cancelButtonText: '取消',
        type: 'info'
      }
    )

    actionLoading.value = row['.id'] + '-start'
    await containerApi.start(row['.id'])
    ElMessage.success(`容器 ${row.name} 已启动`)
    loadContainers()
  } catch (err: unknown) {
    if (err !== 'cancel') {
      const message = err instanceof Error ? err.message : '启动容器失败'
      ElMessage.error(message)
    }
  } finally {
    actionLoading.value = ''
  }
}

// Handle stop container
const handleStop = async (row: Container) => {
  try {
    await ElMessageBox.confirm(
      `确定要停止容器 "${row.name}" 吗？`,
      '停止确认',
      {
        confirmButtonText: '停止',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    actionLoading.value = row['.id'] + '-stop'
    await containerApi.stop(row['.id'])
    ElMessage.success(`容器 ${row.name} 已停止`)
    loadContainers()
  } catch (err: unknown) {
    if (err !== 'cancel') {
      const message = err instanceof Error ? err.message : '停止容器失败'
      ElMessage.error(message)
    }
  } finally {
    actionLoading.value = ''
  }
}
</script>

<style scoped>
.container-view {
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

:deep(.el-table__row) {
  cursor: pointer;
}

:deep(.el-table__row:hover) {
  background-color: var(--el-fill-color-light);
}
</style>

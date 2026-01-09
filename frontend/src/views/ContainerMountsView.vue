<template>
  <div class="container-mounts-view">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>容器挂载点</span>
          <div class="header-actions">
            <el-button
              :icon="Refresh"
              :loading="loading"
              @click="loadMounts"
            >
              刷新
            </el-button>
          </div>
        </div>
      </template>

      <!-- Loading State -->
      <el-skeleton v-if="loading && mounts.length === 0" :rows="5" animated />

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
        v-else-if="mounts.length === 0"
        description="暂无挂载点"
      />

      <!-- Mounts Table -->
      <el-table
        v-else
        v-loading="loading"
        :data="mounts"
        stripe
        style="width: 100%"
      >
        <el-table-column prop="name" label="名称" min-width="150" sortable />
        <el-table-column prop="src" label="源路径" min-width="200" show-overflow-tooltip />
        <el-table-column prop="dst" label="目标路径" min-width="200" show-overflow-tooltip />
        <el-table-column prop="comment" label="备注" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.comment || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="warning" link @click="handleEdit(row)">
              编辑
            </el-button>
            <el-button size="small" type="danger" link @click="handleDelete(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Edit Dialog -->
    <el-dialog
      v-model="formVisible"
      title="编辑挂载点"
      width="500px"
      destroy-on-close
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="80px"
      >
        <el-form-item label="名称" prop="name">
          <el-input v-model="formData.name" disabled />
        </el-form-item>
        <el-form-item label="源路径" prop="src">
          <el-input v-model="formData.src" placeholder="宿主机路径" />
        </el-form-item>
        <el-form-item label="目标路径" prop="dst">
          <el-input v-model="formData.dst" placeholder="容器内路径" />
        </el-form-item>
        <el-form-item label="备注" prop="comment">
          <el-input v-model="formData.comment" type="textarea" :rows="2" placeholder="备注信息" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>


<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox, FormInstance, FormRules } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { containerApi } from '@/api'

// Mount type definition
interface ContainerMount {
  '.id': string
  name: string
  src: string
  dst: string
  comment?: string
}

// Form data type
interface MountFormData {
  name: string
  src: string
  dst: string
  comment: string
}

// State
const loading = ref(false)
const error = ref('')
const mounts = ref<ContainerMount[]>([])
const formVisible = ref(false)
const editingId = ref('')
const submitting = ref(false)
const formRef = ref<FormInstance>()

// Form data
const defaultFormData: MountFormData = {
  name: '',
  src: '',
  dst: '',
  comment: ''
}

const formData = reactive<MountFormData>({ ...defaultFormData })

// Form validation rules
const formRules: FormRules = {
  src: [{ required: true, message: '请输入源路径', trigger: 'blur' }],
  dst: [{ required: true, message: '请输入目标路径', trigger: 'blur' }]
}

// Load mounts on mount
onMounted(() => {
  loadMounts()
})

// Load all mounts
const loadMounts = async () => {
  loading.value = true
  error.value = ''

  try {
    const response = await containerApi.getMounts()
    const result = response.data
    if (result.success && Array.isArray(result.data)) {
      mounts.value = result.data
    } else {
      mounts.value = []
      if (!result.success && result.error) {
        throw new Error(result.error)
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '加载挂载点列表失败'
    error.value = message
    ElMessage.error(message)
  } finally {
    loading.value = false
  }
}

// Handle edit
const handleEdit = (row: ContainerMount) => {
  editingId.value = row['.id']
  Object.assign(formData, {
    name: row.name,
    src: row.src,
    dst: row.dst,
    comment: row.comment || ''
  })
  formVisible.value = true
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
    const submitData: Record<string, unknown> = {
      src: formData.src,
      dst: formData.dst
    }
    
    if (formData.comment) submitData.comment = formData.comment

    await containerApi.updateMount(editingId.value, submitData)
    ElMessage.success('挂载点已更新')

    formVisible.value = false
    loadMounts()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '更新挂载点失败'
    ElMessage.error(message)
  } finally {
    submitting.value = false
  }
}

// Handle delete
const handleDelete = async (row: ContainerMount) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除挂载点 "${row.name}" 吗？此操作不可恢复。`,
      '删除确认',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    loading.value = true
    await containerApi.deleteMount(row['.id'])
    ElMessage.success(`挂载点 ${row.name} 已删除`)
    loadMounts()
  } catch (err: unknown) {
    if (err !== 'cancel') {
      const message = err instanceof Error ? err.message : '删除挂载点失败'
      ElMessage.error(message)
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.container-mounts-view {
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
</style>

<template>
  <div class="container-envs-view">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>容器环境变量</span>
          <div class="header-actions">
            <el-button
              :icon="Refresh"
              :loading="loading"
              @click="loadEnvs"
            >
              刷新
            </el-button>
          </div>
        </div>
      </template>

      <!-- Loading State -->
      <el-skeleton v-if="loading && envs.length === 0" :rows="5" animated />

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
        v-else-if="envs.length === 0"
        description="暂无环境变量"
      />

      <!-- Envs Table -->
      <el-table
        v-else
        v-loading="loading"
        :data="envs"
        stripe
        style="width: 100%"
      >
        <el-table-column prop="list" label="列表名称" min-width="150" sortable />
        <el-table-column prop="key" label="键" min-width="150" sortable />
        <el-table-column prop="value" label="值" min-width="200" show-overflow-tooltip />
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
      title="编辑环境变量"
      width="500px"
      destroy-on-close
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="80px"
      >
        <el-form-item label="列表名称" prop="list">
          <el-input v-model="formData.list" disabled />
        </el-form-item>
        <el-form-item label="键" prop="key">
          <el-input v-model="formData.key" placeholder="环境变量名称" />
        </el-form-item>
        <el-form-item label="值" prop="value">
          <el-input v-model="formData.value" placeholder="环境变量值" />
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

// Env type definition - RouterOS uses 'list' field for the list name
interface ContainerEnv {
  '.id': string
  list: string
  key: string
  value: string
  comment?: string
}

// Form data type
interface EnvFormData {
  list: string
  key: string
  value: string
  comment: string
}

// State
const loading = ref(false)
const error = ref('')
const envs = ref<ContainerEnv[]>([])
const formVisible = ref(false)
const editingId = ref('')
const submitting = ref(false)
const formRef = ref<FormInstance>()

// Form data
const defaultFormData: EnvFormData = {
  list: '',
  key: '',
  value: '',
  comment: ''
}

const formData = reactive<EnvFormData>({ ...defaultFormData })

// Form validation rules
const formRules: FormRules = {
  key: [{ required: true, message: '请输入环境变量键', trigger: 'blur' }],
  value: [{ required: true, message: '请输入环境变量值', trigger: 'blur' }]
}

// Load envs on mount
onMounted(() => {
  loadEnvs()
})

// Load all envs
const loadEnvs = async () => {
  loading.value = true
  error.value = ''

  try {
    const response = await containerApi.getEnvs()
    const result = response.data
    if (result.success && Array.isArray(result.data)) {
      envs.value = result.data
    } else {
      envs.value = []
      if (!result.success && result.error) {
        throw new Error(result.error)
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '加载环境变量列表失败'
    error.value = message
    ElMessage.error(message)
  } finally {
    loading.value = false
  }
}

// Handle edit
const handleEdit = (row: ContainerEnv) => {
  editingId.value = row['.id']
  Object.assign(formData, {
    list: row.list,
    key: row.key,
    value: row.value,
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
      key: formData.key,
      value: formData.value
    }
    
    if (formData.comment) submitData.comment = formData.comment

    await containerApi.updateEnv(editingId.value, submitData)
    ElMessage.success('环境变量已更新')

    formVisible.value = false
    loadEnvs()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '更新环境变量失败'
    ElMessage.error(message)
  } finally {
    submitting.value = false
  }
}

// Handle delete
const handleDelete = async (row: ContainerEnv) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除环境变量 "${row.key}" 吗？此操作不可恢复。`,
      '删除确认',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    loading.value = true
    await containerApi.deleteEnv(row['.id'])
    ElMessage.success(`环境变量 ${row.key} 已删除`)
    loadEnvs()
  } catch (err: unknown) {
    if (err !== 'cancel') {
      const message = err instanceof Error ? err.message : '删除环境变量失败'
      ElMessage.error(message)
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.container-envs-view {
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

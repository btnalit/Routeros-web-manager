<template>
  <div class="script-view">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>脚本管理</span>
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
              @click="loadScripts"
            >
              刷新
            </el-button>
          </div>
        </div>
      </template>

      <!-- Loading State -->
      <el-skeleton v-if="loading && scripts.length === 0" :rows="5" animated />

      <!-- Error State -->
      <el-alert
        v-else-if="error"
        :title="error"
        type="error"
        show-icon
        closable
        @close="error = ''"
      />

      <!-- Script Table -->
      <el-table
        v-else
        v-loading="loading"
        :data="scripts"
        stripe
        style="width: 100%"
      >
        <el-table-column prop="name" label="脚本名称" min-width="150" sortable />
        <el-table-column prop="owner" label="所有者" min-width="100" />
        <el-table-column label="最后运行" min-width="180">
          <template #default="{ row }">
            {{ row['last-started'] || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="run-count" label="运行次数" width="100" />
        <el-table-column prop="comment" label="备注" min-width="150" show-overflow-tooltip />
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button-group>
              <el-button
                size="small"
                type="success"
                :icon="VideoPlay"
                :loading="row._running"
                @click="handleRun(row)"
              >
                运行
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
      :title="isEditing ? '编辑脚本' : '添加脚本'"
      width="700px"
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
        <el-form-item label="脚本名称" prop="name">
          <el-input
            v-model="form.name"
            placeholder="请输入脚本名称"
          />
        </el-form-item>
        <el-form-item label="脚本内容" prop="source">
          <div class="code-editor-wrapper">
            <el-input
              v-model="form.source"
              type="textarea"
              :rows="15"
              placeholder="请输入 RouterOS 脚本代码"
              class="code-editor"
              resize="vertical"
            />
          </div>
        </el-form-item>
        <el-form-item label="权限策略" prop="policy">
          <el-checkbox-group v-model="form.policy">
            <el-checkbox label="ftp">FTP</el-checkbox>
            <el-checkbox label="reboot">Reboot</el-checkbox>
            <el-checkbox label="read">Read</el-checkbox>
            <el-checkbox label="write">Write</el-checkbox>
            <el-checkbox label="policy">Policy</el-checkbox>
            <el-checkbox label="test">Test</el-checkbox>
            <el-checkbox label="password">Password</el-checkbox>
            <el-checkbox label="sniff">Sniff</el-checkbox>
            <el-checkbox label="sensitive">Sensitive</el-checkbox>
            <el-checkbox label="romon">Romon</el-checkbox>
          </el-checkbox-group>
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

    <!-- View Script Dialog -->
    <el-dialog
      v-model="viewDialogVisible"
      title="脚本详情"
      width="700px"
      destroy-on-close
    >
      <el-descriptions v-if="viewingScript" :column="2" border>
        <el-descriptions-item label="脚本名称" :span="2">
          {{ viewingScript.name }}
        </el-descriptions-item>
        <el-descriptions-item label="所有者">
          {{ viewingScript.owner || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="运行次数">
          {{ viewingScript['run-count'] || 0 }}
        </el-descriptions-item>
        <el-descriptions-item label="最后运行" :span="2">
          {{ viewingScript['last-started'] || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="权限策略" :span="2">
          <el-tag
            v-for="p in (viewingScript.policy || [])"
            :key="p"
            size="small"
            style="margin-right: 4px"
          >
            {{ p }}
          </el-tag>
          <span v-if="!viewingScript.policy?.length">-</span>
        </el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">
          {{ viewingScript.comment || '-' }}
        </el-descriptions-item>
      </el-descriptions>
      <div v-if="viewingScript" class="script-source-view">
        <div class="source-label">脚本内容：</div>
        <pre class="source-content">{{ viewingScript.source || '(空)' }}</pre>
      </div>
      <template #footer>
        <el-button @click="viewDialogVisible = false">关闭</el-button>
        <el-button type="primary" @click="handleEditFromView">编辑</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Plus, Refresh, VideoPlay } from '@element-plus/icons-vue'
import { systemApi } from '@/api'

// Script type definition
interface Script {
  '.id': string
  name: string
  source: string
  owner: string
  policy: string[]
  'run-count': number
  'last-started'?: string
  comment?: string
  _running?: boolean
}

// State
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const scripts = ref<Script[]>([])

// Dialog state
const dialogVisible = ref(false)
const isEditing = ref(false)
const editingId = ref('')
const formRef = ref<FormInstance>()

// View dialog state
const viewDialogVisible = ref(false)
const viewingScript = ref<Script | null>(null)

// Form data
const form = reactive({
  name: '',
  source: '',
  policy: [] as string[],
  comment: ''
})

// Form validation rules
const formRules: FormRules = {
  name: [
    { required: true, message: '请输入脚本名称', trigger: 'blur' }
  ],
  source: [
    { required: true, message: '请输入脚本内容', trigger: 'blur' }
  ]
}

// Load scripts on mount
onMounted(() => {
  loadScripts()
})

// Load all scripts
const loadScripts = async () => {
  loading.value = true
  error.value = ''

  try {
    const response = await systemApi.getScripts()
    // 后端返回格式: { success: true, data: [...] }
    // axios 响应格式: response.data = { success, data }
    const result = response.data
    if (result.success && Array.isArray(result.data)) {
      scripts.value = result.data.map((s: Script) => ({
        ...s,
        policy: Array.isArray(s.policy) ? s.policy : (s.policy ? String(s.policy).split(',') : []),
        _running: false
      }))
    } else {
      scripts.value = []
      if (!result.success && result.error) {
        throw new Error(result.error)
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '加载脚本列表失败'
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
const handleEdit = (row: Script) => {
  isEditing.value = true
  editingId.value = row['.id']
  form.name = row.name
  form.source = row.source || ''
  form.policy = Array.isArray(row.policy) ? [...row.policy] : []
  form.comment = row.comment || ''
  dialogVisible.value = true
}

// Handle edit from view dialog
const handleEditFromView = () => {
  if (viewingScript.value) {
    viewDialogVisible.value = false
    handleEdit(viewingScript.value)
  }
}

// Handle run script
const handleRun = async (row: Script) => {
  try {
    await ElMessageBox.confirm(
      `确定要运行脚本 "${row.name}" 吗？`,
      '运行确认',
      {
        confirmButtonText: '运行',
        cancelButtonText: '取消',
        type: 'info'
      }
    )

    row._running = true
    await systemApi.runScript(row['.id'])
    ElMessage.success(`脚本 ${row.name} 已执行`)
    await loadScripts()
  } catch (err: unknown) {
    if (err !== 'cancel') {
      const message = err instanceof Error ? err.message : '运行失败'
      ElMessage.error(message)
    }
  } finally {
    row._running = false
  }
}

// Handle delete button click
const handleDelete = async (row: Script) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除脚本 "${row.name}" 吗？`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    loading.value = true
    await systemApi.deleteScript(row['.id'])
    ElMessage.success('脚本已删除')
    await loadScripts()
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
  form.name = ''
  form.source = ''
  form.policy = []
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
      name: form.name,
      source: form.source
    }

    if (form.policy.length > 0) {
      data.policy = form.policy.join(',')
    }
    if (form.comment) {
      data.comment = form.comment
    }

    if (isEditing.value) {
      await systemApi.updateScript(editingId.value, data)
      ElMessage.success('脚本已更新')
    } else {
      await systemApi.addScript(data)
      ElMessage.success('脚本已添加')
    }

    dialogVisible.value = false
    await loadScripts()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '操作失败'
    ElMessage.error(message)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.script-view {
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

.code-editor-wrapper {
  width: 100%;
}

.code-editor :deep(textarea) {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.5;
}

.script-source-view {
  margin-top: 16px;
}

.source-label {
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--el-text-color-primary);
}

.source-content {
  background-color: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  padding: 12px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.5;
  max-height: 300px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}
</style>

<template>
  <div class="firewall-address-list-view">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>防火墙地址列表</span>
          <div class="header-actions">
            <el-select
              v-model="listFilter"
              placeholder="按列表名称筛选"
              clearable
              filterable
              style="width: 180px; margin-right: 8px"
            >
              <el-option
                v-for="name in listNames"
                :key="name"
                :label="name"
                :value="name"
              />
            </el-select>
            <el-button type="primary" :icon="Plus" @click="handleAdd">
              新增
            </el-button>
            <el-button
              :icon="Refresh"
              :loading="loading"
              @click="loadAddressList"
            >
              刷新
            </el-button>
          </div>
        </div>
      </template>

      <!-- Loading State -->
      <el-skeleton v-if="loading && entries.length === 0" :rows="5" animated />

      <!-- Error State -->
      <el-alert
        v-else-if="error"
        :title="error"
        type="error"
        show-icon
        closable
        @close="error = ''"
      />

      <!-- Address List Table with Pagination -->
      <template v-else>
        <el-table
          v-loading="loading"
          :data="paginatedEntries"
          stripe
          style="width: 100%"
          max-height="600"
        >
          <el-table-column prop="list" label="列表名称" width="180" sortable />
          <el-table-column prop="address" label="IP 地址" min-width="180" show-overflow-tooltip />
          <el-table-column label="超时时间" width="150">
            <template #default="{ row }">
              {{ row.timeout || (row.dynamic ? 'dynamic' : '永久') }}
            </template>
          </el-table-column>
          <el-table-column label="创建时间" width="180" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row['creation-time'] || '-' }}
            </template>
          </el-table-column>
          <el-table-column label="类型" width="100">
            <template #default="{ row }">
              <el-tag :type="row.dynamic ? 'warning' : 'primary'" size="small">
                {{ row.dynamic ? '动态' : '静态' }}
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
          <el-table-column prop="comment" label="备注" min-width="150" show-overflow-tooltip />
          <el-table-column label="操作" width="150" fixed="right">
            <template #default="{ row }">
              <el-button size="small" type="warning" link @click.stop="handleEdit(row)">
                编辑
              </el-button>
              <el-button size="small" type="danger" link @click.stop="handleDelete(row)">
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        
        <!-- Pagination -->
        <div class="pagination-container">
          <el-pagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :page-sizes="[50, 100, 200, 500]"
            :total="filteredEntries.length"
            layout="total, sizes, prev, pager, next, jumper"
            background
            @size-change="handleSizeChange"
            @current-change="handleCurrentChange"
          />
        </div>
      </template>
    </el-card>

    <!-- Add/Edit Dialog -->
    <el-dialog
      v-model="formVisible"
      :title="isEdit ? '编辑地址条目' : '新增地址条目'"
      width="500px"
      destroy-on-close
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="100px"
      >
        <el-form-item label="列表名称" prop="list">
          <el-autocomplete
            v-model="formData.list"
            :fetch-suggestions="queryListNames"
            placeholder="输入或选择列表名称"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="IP 地址" prop="address">
          <el-input v-model="formData.address" placeholder="如: 192.168.1.1 或 192.168.1.0/24" />
        </el-form-item>
        <el-form-item label="超时时间" prop="timeout">
          <el-input v-model="formData.timeout" placeholder="如: 1d, 12h, 30m (留空为永久)" />
        </el-form-item>
        <el-form-item label="备注" prop="comment">
          <el-input v-model="formData.comment" placeholder="条目备注" />
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
import { ref, computed, onMounted, reactive, watch } from 'vue'
import { ElMessage, ElMessageBox, FormInstance, FormRules } from 'element-plus'
import { Refresh, Plus } from '@element-plus/icons-vue'
import { firewallApi } from '@/api'

// Address List Entry type definition
interface AddressListEntry {
  '.id': string
  list: string
  address: string
  timeout?: string
  'creation-time'?: string
  disabled: boolean
  dynamic: boolean
  comment?: string
}

// Form data type
interface AddressFormData {
  list: string
  address: string
  timeout?: string
  comment?: string
}

// State
const loading = ref(false)
const error = ref('')
const entries = ref<AddressListEntry[]>([])
const listFilter = ref('')
const formVisible = ref(false)
const isEdit = ref(false)
const editingId = ref('')
const submitting = ref(false)
const formRef = ref<FormInstance>()

// Pagination state
const currentPage = ref(1)
const pageSize = ref(100)

// Form data
const defaultFormData: AddressFormData = {
  list: '',
  address: '',
  timeout: '',
  comment: ''
}

const formData = reactive<AddressFormData>({ ...defaultFormData })

// IP address validation
const validateAddress = (_rule: unknown, value: string, callback: (error?: Error) => void) => {
  if (!value) {
    callback(new Error('请输入 IP 地址'))
    return
  }
  // Basic IP/CIDR validation
  const ipPattern = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/
  if (!ipPattern.test(value)) {
    callback(new Error('请输入有效的 IP 地址或 CIDR 格式'))
    return
  }
  callback()
}

// Form validation rules
const formRules: FormRules = {
  list: [{ required: true, message: '请输入列表名称', trigger: 'blur' }],
  address: [{ required: true, validator: validateAddress, trigger: 'blur' }]
}

// Get unique list names for filter
const listNames = computed(() => {
  const names = new Set(entries.value.map(e => e.list))
  return Array.from(names).sort()
})

// Computed filtered entries
const filteredEntries = computed(() => {
  if (!listFilter.value) {
    return entries.value
  }
  return entries.value.filter(entry => entry.list === listFilter.value)
})

// Computed paginated entries
const paginatedEntries = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredEntries.value.slice(start, end)
})

// Pagination handlers
const handleSizeChange = (val: number) => {
  pageSize.value = val
  currentPage.value = 1
}

const handleCurrentChange = (val: number) => {
  currentPage.value = val
}

// Load address list on mount
onMounted(() => {
  loadAddressList()
})

// Reset pagination when filter changes
watch(listFilter, () => {
  currentPage.value = 1
})

// Convert string boolean to real boolean
const toBool = (val: unknown): boolean => {
  if (typeof val === 'boolean') return val
  if (typeof val === 'string') return val.toLowerCase() === 'true'
  return Boolean(val)
}

// Load all address list entries
const loadAddressList = async () => {
  loading.value = true
  error.value = ''

  try {
    const response = await firewallApi.getAddressList()
    const result = response.data
    if (result.success && Array.isArray(result.data)) {
      entries.value = result.data.map((entry: AddressListEntry) => ({
        ...entry,
        disabled: toBool(entry.disabled),
        dynamic: toBool(entry.dynamic)
      }))
    } else {
      entries.value = []
      if (!result.success && result.error) {
        throw new Error(result.error)
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '加载地址列表失败'
    error.value = message
    ElMessage.error(message)
  } finally {
    loading.value = false
  }
}

// Query list names for autocomplete
const queryListNames = (queryString: string, cb: (results: { value: string }[]) => void) => {
  const results = queryString
    ? listNames.value.filter(name => name.toLowerCase().includes(queryString.toLowerCase()))
    : listNames.value
  cb(results.map(name => ({ value: name })))
}

// Handle add
const handleAdd = () => {
  isEdit.value = false
  editingId.value = ''
  Object.assign(formData, defaultFormData)
  formVisible.value = true
}

// Handle edit
const handleEdit = (row: AddressListEntry) => {
  isEdit.value = true
  editingId.value = row['.id']
  Object.assign(formData, {
    list: row.list,
    address: row.address,
    timeout: row.timeout || '',
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
    const submitData: Record<string, string> = {
      list: formData.list,
      address: formData.address
    }
    
    if (formData.timeout) submitData.timeout = formData.timeout
    if (formData.comment) submitData.comment = formData.comment

    if (isEdit.value) {
      await firewallApi.updateAddressEntry(editingId.value, submitData)
      ElMessage.success('地址条目已更新')
    } else {
      await firewallApi.createAddressEntry(submitData)
      ElMessage.success('地址条目已创建')
    }

    formVisible.value = false
    loadAddressList()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : (isEdit.value ? '更新地址条目失败' : '创建地址条目失败')
    ElMessage.error(message)
  } finally {
    submitting.value = false
  }
}

// Handle delete
const handleDelete = async (row: AddressListEntry) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除地址 "${row.address}" 从列表 "${row.list}" 吗？`,
      '确认删除',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await firewallApi.deleteAddressEntry(row['.id'])
    ElMessage.success('地址条目已删除')
    loadAddressList()
  } catch (err: unknown) {
    if (err !== 'cancel') {
      const message = err instanceof Error ? err.message : '删除地址条目失败'
      ElMessage.error(message)
    }
  }
}
</script>

<style scoped>
.firewall-address-list-view {
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

.pagination-container {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}
</style>

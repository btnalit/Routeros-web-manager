<template>
  <div class="dhcp-client-view">
    <div class="page-header">
      <h2>DHCP Client</h2>
      <el-button type="primary" @click="showAddDialog">
        <el-icon><Plus /></el-icon> 新增
      </el-button>
    </div>

    <el-table :data="clients" v-loading="loading" stripe>
      <el-table-column prop="interface" label="接口" min-width="120" />
      <el-table-column label="状态" width="80" align="center">
        <template #default="{ row }">
          <el-switch
            :model-value="isEnabled(row)"
            @change="(val: string | number | boolean) => toggleStatus(row, Boolean(val))"
            size="small"
          />
        </template>
      </el-table-column>
      <el-table-column prop="address" label="获取的地址" min-width="160" show-overflow-tooltip />
      <el-table-column prop="gateway" label="网关" min-width="140" show-overflow-tooltip />
      <el-table-column label="Use Peer DNS" width="110" align="center">
        <template #default="{ row }">
          {{ toBool(row['use-peer-dns']) ? '是' : '否' }}
        </template>
      </el-table-column>
      <el-table-column label="Use Peer NTP" width="110" align="center">
        <template #default="{ row }">
          {{ toBool(row['use-peer-ntp']) ? '是' : '否' }}
        </template>
      </el-table-column>
      <el-table-column label="添加默认路由" width="110" align="center">
        <template #default="{ row }">
          {{ row['add-default-route'] || 'no' }}
        </template>
      </el-table-column>
      <el-table-column prop="status" label="连接状态" width="90" align="center" />
      <el-table-column prop="comment" label="备注" min-width="100" show-overflow-tooltip />
      <el-table-column label="操作" width="140" fixed="right" align="center">
        <template #default="{ row }">
          <el-button size="small" @click="showEditDialog(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 新增/编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑 DHCP Client' : '新增 DHCP Client'" width="500px">
      <el-form :model="form" label-width="140px">
        <el-form-item label="接口" required>
          <el-input v-model="form.interface" placeholder="如: wan01" />
        </el-form-item>
        <el-form-item label="Use Peer DNS">
          <el-switch v-model="form['use-peer-dns']" />
        </el-form-item>
        <el-form-item label="Use Peer NTP">
          <el-switch v-model="form['use-peer-ntp']" />
        </el-form-item>
        <el-form-item label="添加默认路由">
          <el-select v-model="form['add-default-route']" style="width: 100%">
            <el-option label="yes" value="yes" />
            <el-option label="no" value="no" />
            <el-option label="special-classless" value="special-classless" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.comment" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave" :loading="saving">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { ipApi } from '@/api'

const loading = ref(false)
const saving = ref(false)
const clients = ref<any[]>([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const editingId = ref('')

const form = ref({
  interface: '',
  'use-peer-dns': true,
  'use-peer-ntp': true,
  'add-default-route': 'yes',
  comment: ''
})

const toBool = (val: any): boolean => {
  if (typeof val === 'boolean') return val
  if (typeof val === 'string') return val.toLowerCase() === 'true'
  return Boolean(val)
}

// 判断是否启用（disabled 为 false 或 "false" 或不存在时表示启用）
const isEnabled = (row: any): boolean => {
  const disabled = row.disabled
  if (disabled === undefined || disabled === null) return true
  if (typeof disabled === 'boolean') return !disabled
  if (typeof disabled === 'string') return disabled.toLowerCase() !== 'true'
  return !disabled
}

const fetchData = async () => {
  loading.value = true
  try {
    const result = await ipApi.getDhcpClients()
    if (result.data.success && Array.isArray(result.data.data)) {
      clients.value = result.data.data
    }
  } catch (error: any) {
    ElMessage.error(error.message || '获取数据失败')
  } finally {
    loading.value = false
  }
}

const showAddDialog = () => {
  isEdit.value = false
  editingId.value = ''
  form.value = {
    interface: '',
    'use-peer-dns': true,
    'use-peer-ntp': true,
    'add-default-route': 'yes',
    comment: ''
  }
  dialogVisible.value = true
}

const showEditDialog = (row: any) => {
  isEdit.value = true
  editingId.value = row['.id']
  form.value = {
    interface: row.interface || '',
    'use-peer-dns': toBool(row['use-peer-dns']),
    'use-peer-ntp': toBool(row['use-peer-ntp']),
    'add-default-route': row['add-default-route'] || 'yes',
    comment: row.comment || ''
  }
  dialogVisible.value = true
}

const handleSave = async () => {
  if (!form.value.interface) {
    ElMessage.warning('请填写接口')
    return
  }
  saving.value = true
  try {
    const data = {
      interface: form.value.interface,
      'use-peer-dns': form.value['use-peer-dns'] ? 'yes' : 'no',
      'use-peer-ntp': form.value['use-peer-ntp'] ? 'yes' : 'no',
      'add-default-route': form.value['add-default-route'],
      comment: form.value.comment
    }
    if (isEdit.value) {
      await ipApi.updateDhcpClient(editingId.value, data)
      ElMessage.success('更新成功')
    } else {
      await ipApi.addDhcpClient(data)
      ElMessage.success('添加成功')
    }
    dialogVisible.value = false
    fetchData()
  } catch (error: any) {
    ElMessage.error(error.message || '操作失败')
  } finally {
    saving.value = false
  }
}

const toggleStatus = async (row: any, enabled: boolean) => {
  try {
    if (enabled) {
      await ipApi.enableDhcpClient(row['.id'])
      ElMessage.success('已启用')
    } else {
      await ipApi.disableDhcpClient(row['.id'])
      ElMessage.success('已禁用')
    }
    fetchData()
  } catch (error: any) {
    ElMessage.error(error.message || '操作失败')
  }
}

const handleDelete = async (row: any) => {
  try {
    await ElMessageBox.confirm('确定要删除此 DHCP Client 吗？', '确认删除', {
      type: 'warning'
    })
    await ipApi.deleteDhcpClient(row['.id'])
    ElMessage.success('删除成功')
    fetchData()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除失败')
    }
  }
}

onMounted(() => {
  fetchData()
})
</script>

<style scoped>
.dhcp-client-view {
  padding: 20px;
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.page-header h2 {
  margin: 0;
}
</style>

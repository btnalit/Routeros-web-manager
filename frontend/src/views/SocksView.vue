<template>
  <div class="socks-view">
    <div class="page-header">
      <h2>Socksify</h2>
      <el-button type="primary" @click="showDialog()">
        <el-icon><Plus /></el-icon> 新增
      </el-button>
    </div>

    <el-table :data="socksList" v-loading="loading" stripe>
      <el-table-column prop="name" label="名称" min-width="120" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-switch
            :model-value="toBool(!row.disabled)"
            @change="(val: string | number | boolean) => toggleStatus(row, Boolean(val))"
          />
        </template>
      </el-table-column>
      <el-table-column prop="connection-timeout" label="连接超时" min-width="120" />
      <el-table-column prop="port" label="端口" width="80" />
      <el-table-column prop="socks5-server" label="SOCKS5 服务器" min-width="140" />
      <el-table-column prop="socks5-port" label="SOCKS5 端口" width="100" />
      <el-table-column prop="socks5-user" label="SOCKS5 用户" min-width="100" />
      <el-table-column prop="comment" label="备注" min-width="100" />
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="showDialog(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 新增/编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑 Socksify' : '新增 Socksify'" width="500px">
      <el-form :model="form" label-width="140px">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="连接超时">
          <el-input v-model="form['connection-timeout']" placeholder="如: 00:01:00" />
        </el-form-item>
        <el-form-item label="端口">
          <el-input-number v-model="form.port" :min="1" :max="65535" />
        </el-form-item>
        <el-form-item label="SOCKS5 服务器">
          <el-input v-model="form['socks5-server']" placeholder="如: 0.0.0.0" />
        </el-form-item>
        <el-form-item label="SOCKS5 端口">
          <el-input-number v-model="form['socks5-port']" :min="1" :max="65535" />
        </el-form-item>
        <el-form-item label="SOCKS5 用户">
          <el-input v-model="form['socks5-user']" />
        </el-form-item>
        <el-form-item label="SOCKS5 密码">
          <el-input v-model="form['socks5-password']" type="password" show-password />
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
const socksList = ref<any[]>([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const editingId = ref('')

const form = ref({
  name: '',
  'connection-timeout': '00:01:00',
  port: 952,
  'socks5-server': '0.0.0.0',
  'socks5-port': 1080,
  'socks5-user': '',
  'socks5-password': '',
  comment: ''
})

const toBool = (val: any): boolean => {
  if (typeof val === 'boolean') return val
  if (typeof val === 'string') return val.toLowerCase() === 'true'
  return Boolean(val)
}

const fetchData = async () => {
  loading.value = true
  try {
    const result = await ipApi.getSocks()
    if (result.data.success && Array.isArray(result.data.data)) {
      // 过滤掉空数据（没有 .id 或 name 的记录）
      socksList.value = result.data.data.filter((item: any) => item['.id'] && item.name)
    } else {
      socksList.value = []
    }
  } catch (error: any) {
    ElMessage.error(error.message || '获取数据失败')
  } finally {
    loading.value = false
  }
}

const showDialog = (row?: any) => {
  isEdit.value = !!row
  editingId.value = row?.['.id'] || ''
  form.value = {
    name: row?.name || '',
    'connection-timeout': row?.['connection-timeout'] || '00:01:00',
    port: parseInt(row?.port) || 952,
    'socks5-server': row?.['socks5-server'] || '0.0.0.0',
    'socks5-port': parseInt(row?.['socks5-port']) || 1080,
    'socks5-user': row?.['socks5-user'] || '',
    'socks5-password': '',
    comment: row?.comment || ''
  }
  dialogVisible.value = true
}

const handleSave = async () => {
  if (!form.value.name) {
    ElMessage.warning('请填写名称')
    return
  }
  saving.value = true
  try {
    const data: any = {
      name: form.value.name,
      'connection-timeout': form.value['connection-timeout'],
      port: String(form.value.port),
      'socks5-server': form.value['socks5-server'],
      'socks5-port': String(form.value['socks5-port']),
      comment: form.value.comment
    }
    if (form.value['socks5-user']) {
      data['socks5-user'] = form.value['socks5-user']
    }
    if (form.value['socks5-password']) {
      data['socks5-password'] = form.value['socks5-password']
    }
    if (isEdit.value) {
      await ipApi.updateSocks(editingId.value, data)
      ElMessage.success('更新成功')
    } else {
      await ipApi.addSocks(data)
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
      await ipApi.enableSocks(row['.id'])
      ElMessage.success('已启用')
    } else {
      await ipApi.disableSocks(row['.id'])
      ElMessage.success('已禁用')
    }
    fetchData()
  } catch (error: any) {
    ElMessage.error(error.message || '操作失败')
  }
}

const handleDelete = async (row: any) => {
  try {
    await ElMessageBox.confirm('确定要删除此 Socksify 配置吗？', '确认删除', { type: 'warning' })
    await ipApi.deleteSocks(row['.id'])
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
.socks-view { padding: 20px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.page-header h2 { margin: 0; }
</style>

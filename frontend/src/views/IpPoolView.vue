<template>
  <div class="ip-pool-view">
    <div class="page-header">
      <h2>IP Pool</h2>
      <el-button type="primary" @click="showDialog()">
        <el-icon><Plus /></el-icon> 新增
      </el-button>
    </div>

    <el-table :data="pools" v-loading="loading" stripe>
      <el-table-column prop="name" label="名称" min-width="150" />
      <el-table-column prop="ranges" label="地址范围" min-width="200" />
      <el-table-column prop="next-pool" label="下一个池" min-width="120" />
      <el-table-column prop="comment" label="备注" min-width="150" />
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="showDialog(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 新增/编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑 IP Pool' : '新增 IP Pool'" width="500px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" placeholder="如: dhcp-pool01" />
        </el-form-item>
        <el-form-item label="地址范围" required>
          <el-input v-model="form.ranges" placeholder="如: 10.20.1.100-10.20.1.200" />
        </el-form-item>
        <el-form-item label="下一个池">
          <el-input v-model="form['next-pool']" placeholder="可选，如: none" />
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
const pools = ref<any[]>([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const editingId = ref('')

const form = ref({
  name: '',
  ranges: '',
  'next-pool': '',
  comment: ''
})

const fetchData = async () => {
  loading.value = true
  try {
    const result = await ipApi.getPools()
    if (result.data.success && Array.isArray(result.data.data)) {
      pools.value = result.data.data
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
    ranges: row?.ranges || '',
    'next-pool': row?.['next-pool'] || '',
    comment: row?.comment || ''
  }
  dialogVisible.value = true
}

const handleSave = async () => {
  if (!form.value.name || !form.value.ranges) {
    ElMessage.warning('请填写名称和地址范围')
    return
  }
  saving.value = true
  try {
    const data: any = {
      name: form.value.name,
      ranges: form.value.ranges,
      comment: form.value.comment
    }
    if (form.value['next-pool']) {
      data['next-pool'] = form.value['next-pool']
    }
    if (isEdit.value) {
      await ipApi.updatePool(editingId.value, data)
      ElMessage.success('更新成功')
    } else {
      await ipApi.addPool(data)
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

const handleDelete = async (row: any) => {
  try {
    await ElMessageBox.confirm('确定要删除此 IP Pool 吗？', '确认删除', { type: 'warning' })
    await ipApi.deletePool(row['.id'])
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
.ip-pool-view { padding: 20px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.page-header h2 { margin: 0; }
</style>

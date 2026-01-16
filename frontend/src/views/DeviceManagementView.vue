<template>
  <div class="device-management">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>设备管理</span>
          <el-button type="primary" @click="showAddDialog">添加设备</el-button>
        </div>
      </template>

      <el-table v-loading="loading" :data="devices" style="width: 100%">
        <el-table-column prop="name" label="名称" />
        <el-table-column prop="host" label="主机地址" />
        <el-table-column prop="port" label="端口" width="100" />
        <el-table-column prop="username" label="用户名" />
        <el-table-column label="TLS" width="80">
          <template #default="{ row }">
            <el-tag :type="row.useTLS ? 'success' : 'info'">
              {{ row.useTLS ? '是' : '否' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="250">
          <template #default="{ row }">
            <el-button-group>
              <el-button
                type="primary"
                size="small"
                :disabled="isSelected(row)"
                @click="handleSelect(row)"
              >
                {{ isSelected(row) ? '当前设备' : '连接' }}
              </el-button>
              <el-button
                type="danger"
                size="small"
                @click="handleDelete(row)"
              >
                删除
              </el-button>
            </el-button-group>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 添加设备对话框 -->
    <el-dialog
      v-model="dialogVisible"
      title="添加设备"
      width="500px"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="100px"
      >
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="设备名称" />
        </el-form-item>
        <el-form-item label="主机地址" prop="host">
          <el-input v-model="form.host" placeholder="IP地址或域名" />
        </el-form-item>
        <el-form-item label="端口" prop="port">
          <el-input-number v-model="form.port" :min="1" :max="65535" />
        </el-form-item>
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" placeholder="admin" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" type="password" show-password />
        </el-form-item>
        <el-form-item label="使用TLS" prop="useTLS">
          <el-switch v-model="form.useTLS" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="submitting" @click="handleSubmit">
            确认
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance } from 'element-plus'
import { deviceApi } from '@/api'
import { useDeviceStore } from '@/stores/device'
import { useConnectionStore } from '@/stores/connection'

const deviceStore = useDeviceStore()
const connectionStore = useConnectionStore()

const loading = ref(false)
const dialogVisible = ref(false)
const submitting = ref(false)
const formRef = ref<FormInstance>()

const devices = computed(() => deviceStore.devices)

const form = ref({
  name: '',
  host: '',
  port: 8728,
  username: 'admin',
  password: '',
  useTLS: false
})

const rules = {
  name: [{ required: true, message: '请输入设备名称', trigger: 'blur' }],
  host: [{ required: true, message: '请输入主机地址', trigger: 'blur' }],
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

const isSelected = (device: any) => device.id === deviceStore.selectedDeviceId

async function loadDevices() {
  loading.value = true
  try {
    const res = await deviceApi.getAll()
    deviceStore.setDevices(res.data)
  } catch (error: any) {
    ElMessage.error(error.message || '加载设备列表失败')
  } finally {
    loading.value = false
  }
}

function showAddDialog() {
  form.value = {
    name: '',
    host: '',
    port: 8728,
    username: 'admin',
    password: '',
    useTLS: false
  }
  dialogVisible.value = true
}

async function handleSubmit() {
  if (!formRef.value) return

  await formRef.value.validate(async (valid) => {
    if (valid) {
      submitting.value = true
      try {
        await deviceApi.create(form.value)
        ElMessage.success('添加设备成功')
        dialogVisible.value = false
        await loadDevices()
      } catch (error: any) {
        ElMessage.error(error.message || '添加设备失败')
      } finally {
        submitting.value = false
      }
    }
  })
}

async function handleDelete(device: any) {
  try {
    await ElMessageBox.confirm(
      `确定要删除设备 "${device.name}" 吗？`,
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )

    await deviceApi.delete(device.id)
    ElMessage.success('删除成功')

    // 如果删除的是当前选中的设备
    if (isSelected(device)) {
       deviceStore.clearSelection()
       // 重新连接状态置为断开
       connectionStore.setConnected(false)
    }

    await loadDevices()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除失败')
    }
  }
}

async function handleSelect(device: any) {
  deviceStore.selectDevice(device.id)
  ElMessage.success(`已切换到设备: ${device.name}`)
  // 触发一次连接检查或刷新
  connectionStore.setConnected(false) // 先重置状态
  // 这里可以触发重新加载当前页面的数据，或者由 App 层的监听器处理
  // 简单起见，我们刷新页面或让各个组件的 onMounted/activated 重新请求
  window.location.reload()
}

onMounted(() => {
  loadDevices()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>

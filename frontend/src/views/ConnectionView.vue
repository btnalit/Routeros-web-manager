<template>
  <div class="connection-view">
    <el-card class="connection-card">
      <template #header>
        <div class="card-header">
          <span>RouterOS 连接配置</span>
          <el-tag :type="connectionStore.isConnected ? 'success' : 'warning'" size="small">
            {{ connectionStore.isConnected ? '已连接' : '未连接' }}
          </el-tag>
        </div>
      </template>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="100px"
        :disabled="loading"
      >
        <el-form-item label="地址" prop="host">
          <el-input
            v-model="form.host"
            placeholder="请输入 RouterOS 地址"
            clearable
          >
            <template #prepend>
              <el-icon><Monitor /></el-icon>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item label="端口" prop="port">
          <el-input-number
            v-model="form.port"
            :min="1"
            :max="65535"
            controls-position="right"
            style="width: 100%"
          />
        </el-form-item>

        <el-form-item label="用户名" prop="username">
          <el-input
            v-model="form.username"
            placeholder="请输入用户名"
            clearable
          >
            <template #prepend>
              <el-icon><User /></el-icon>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            show-password
            clearable
          >
            <template #prepend>
              <el-icon><Lock /></el-icon>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item label="使用 TLS">
          <el-switch v-model="form.useTLS" @change="handleTLSChange" />
          <span class="tls-hint">启用 SSL 安全连接 (端口 8729)</span>
        </el-form-item>

        <el-divider />

        <el-form-item>
          <div class="button-group">
            <el-button
              type="primary"
              :loading="loading"
              @click="handleTestConnect"
            >
              <el-icon v-if="!loading"><Connection /></el-icon>
              测试连接
            </el-button>
            <el-button
              type="success"
              :loading="saving"
              @click="handleSaveAndConnect"
            >
              <el-icon v-if="!saving"><Check /></el-icon>
              保存并连接
            </el-button>
            <el-button
              v-if="connectionStore.isConnected"
              type="danger"
              @click="handleDisconnect"
            >
              <el-icon><SwitchButton /></el-icon>
              断开连接
            </el-button>
          </div>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- Connection Status Card -->
    <el-card v-if="connectionStore.isConnected" class="status-card">
      <template #header>
        <div class="card-header">
          <span>连接状态</span>
        </div>
      </template>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="状态">
          <el-tag type="success">已连接</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="地址">
          {{ connectionStore.config?.host }}:{{ connectionStore.config?.port }}
        </el-descriptions-item>
        <el-descriptions-item label="用户名">
          {{ connectionStore.config?.username }}
        </el-descriptions-item>
        <el-descriptions-item label="TLS">
          <el-tag :type="connectionStore.config?.useTLS ? 'success' : 'info'" size="small">
            {{ connectionStore.config?.useTLS ? '已启用' : '未启用' }}
          </el-tag>
        </el-descriptions-item>
      </el-descriptions>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import {
  Monitor,
  User,
  Lock,
  Connection,
  Check,
  SwitchButton
} from '@element-plus/icons-vue'
import { connectionApi, type RouterOSConfig } from '@/api'
import { useConnectionStore } from '@/stores/connection'

const router = useRouter()
const connectionStore = useConnectionStore()

const formRef = ref<FormInstance>()
const loading = ref(false)
const saving = ref(false)

const form = reactive<RouterOSConfig>({
  host: '',
  port: 8728,
  username: 'admin',
  password: '',
  useTLS: false
})

const rules: FormRules<RouterOSConfig> = {
  host: [
    { required: true, message: '请输入 RouterOS 地址', trigger: 'blur' },
    { 
      pattern: /^[a-zA-Z0-9]([a-zA-Z0-9\-\.]*[a-zA-Z0-9])?$/,
      message: '请输入有效的主机名或 IP 地址',
      trigger: 'blur'
    }
  ],
  port: [
    { required: true, message: '请输入端口号', trigger: 'blur' },
    { type: 'number', min: 1, max: 65535, message: '端口范围 1-65535', trigger: 'blur' }
  ],
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' }
  ]
}

// Load saved config on mount
onMounted(async () => {
  await loadSavedConfig()
  await checkConnectionStatus()
})

const loadSavedConfig = async () => {
  try {
    const response = await connectionApi.getConfig()
    const result = response.data
    if (result.success && result.data && result.data.host) {
      // 加载完整配置（包括密码）
      Object.assign(form, result.data)
    }
  } catch {
    // No saved config, use defaults
  }
}

const checkConnectionStatus = async () => {
  try {
    const response = await connectionApi.getStatus()
    const result = response.data
    if (result.success && result.data) {
      connectionStore.setConnected(result.data.connected)
      if (result.data.connected && result.data.config) {
        connectionStore.setConfig(result.data.config)
      }
    } else {
      connectionStore.setConnected(false)
    }
  } catch {
    connectionStore.setConnected(false)
  }
}

const handleTestConnect = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  connectionStore.setError(null)

  try {
    const response = await connectionApi.connect(form)
    if (response.data.success) {
      ElMessage.success('连接测试成功！')
      connectionStore.setConnected(true)
      connectionStore.setConfig({ ...form })
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '连接失败'
    ElMessage.error(message)
    connectionStore.setError(message)
    connectionStore.setConnected(false)
  } finally {
    loading.value = false
  }
}

const handleSaveAndConnect = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  connectionStore.setError(null)

  try {
    // First save the config
    await connectionApi.saveConfig(form)
    
    // Then connect
    const response = await connectionApi.connect(form)
    if (response.data.success) {
      ElMessage.success('配置已保存，连接成功！')
      connectionStore.setConnected(true)
      connectionStore.setConfig({ ...form })
      
      // Navigate to interfaces page after successful connection
      router.push('/interfaces')
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '操作失败'
    ElMessage.error(message)
    connectionStore.setError(message)
    connectionStore.setConnected(false)
  } finally {
    saving.value = false
  }
}

const handleDisconnect = async () => {
  try {
    await connectionApi.disconnect()
    ElMessage.success('已断开连接')
    connectionStore.setConnected(false)
    connectionStore.setConfig(null)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '断开连接失败'
    ElMessage.error(message)
  }
}

const handleTLSChange = (useTLS: string | number | boolean) => {
  // 自动切换端口：8728 (普通) / 8729 (SSL)
  form.port = useTLS === true ? 8729 : 8728
}
</script>

<style scoped>
.connection-view {
  max-width: 600px;
  margin: 0 auto;
}

.connection-card {
  margin-bottom: 20px;
}

.status-card {
  margin-top: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 18px;
  font-weight: 600;
}

.tls-hint {
  margin-left: 12px;
  color: #909399;
  font-size: 12px;
}

.button-group {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

:deep(.el-form-item__content) {
  flex-wrap: nowrap;
}

:deep(.el-input-group__prepend) {
  padding: 0 12px;
}
</style>

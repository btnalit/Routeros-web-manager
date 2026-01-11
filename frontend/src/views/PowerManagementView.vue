<template>
  <div class="power-management-view">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>电源管理</span>
        </div>
      </template>

      <el-alert
        title="警告：以下操作将影响 RouterOS 设备的运行状态"
        type="warning"
        :closable="false"
        show-icon
        style="margin-bottom: 24px;"
      />

      <div class="power-actions">
        <!-- 重启按钮 -->
        <el-card shadow="hover" class="action-card">
          <div class="action-content">
            <el-icon :size="48" color="#E6A23C">
              <RefreshRight />
            </el-icon>
            <h3>重启系统</h3>
            <p>重新启动 RouterOS 设备，所有连接将暂时中断</p>
            <el-button
              type="warning"
              size="large"
              :loading="rebootLoading"
              @click="handleReboot"
            >
              <el-icon><RefreshRight /></el-icon>
              重启
            </el-button>
          </div>
        </el-card>

        <!-- 关机按钮 -->
        <el-card shadow="hover" class="action-card">
          <div class="action-content">
            <el-icon :size="48" color="#F56C6C">
              <SwitchButton />
            </el-icon>
            <h3>关闭系统</h3>
            <p>安全关闭 RouterOS 设备，需要手动开机恢复</p>
            <el-button
              type="danger"
              size="large"
              :loading="shutdownLoading"
              @click="handleShutdown"
            >
              <el-icon><SwitchButton /></el-icon>
              关机
            </el-button>
          </div>
        </el-card>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { RefreshRight, SwitchButton } from '@element-plus/icons-vue'
import { systemApi } from '@/api'

const rebootLoading = ref(false)
const shutdownLoading = ref(false)

// 处理重启
const handleReboot = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要重启 RouterOS 设备吗？重启期间所有网络连接将暂时中断。',
      '重启确认',
      {
        confirmButtonText: '确定重启',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--warning'
      }
    )

    rebootLoading.value = true
    await systemApi.reboot()
    ElMessage.success('重启命令已发送，设备正在重启...')
  } catch (err: unknown) {
    if (err !== 'cancel') {
      const message = err instanceof Error ? err.message : '重启失败'
      ElMessage.error(message)
    }
  } finally {
    rebootLoading.value = false
  }
}

// 处理关机
const handleShutdown = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要关闭 RouterOS 设备吗？关机后需要手动开机才能恢复服务。',
      '关机确认',
      {
        confirmButtonText: '确定关机',
        cancelButtonText: '取消',
        type: 'error',
        confirmButtonClass: 'el-button--danger'
      }
    )

    // 二次确认
    await ElMessageBox.confirm(
      '请再次确认：关机后设备将完全停止运行，所有网络服务将不可用！',
      '最终确认',
      {
        confirmButtonText: '我确定要关机',
        cancelButtonText: '取消',
        type: 'error',
        confirmButtonClass: 'el-button--danger'
      }
    )

    shutdownLoading.value = true
    await systemApi.shutdown()
    ElMessage.success('关机命令已发送，设备正在关闭...')
  } catch (err: unknown) {
    if (err !== 'cancel') {
      const message = err instanceof Error ? err.message : '关机失败'
      ElMessage.error(message)
    }
  } finally {
    shutdownLoading.value = false
  }
}
</script>

<style scoped>
.power-management-view {
  height: 100%;
}

.card-header {
  font-size: 18px;
  font-weight: 600;
}

.power-actions {
  display: flex;
  gap: 24px;
  justify-content: center;
  flex-wrap: wrap;
}

.action-card {
  width: 280px;
  transition: transform 0.3s;
}

.action-card:hover {
  transform: translateY(-4px);
}

.action-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 16px;
}

.action-content h3 {
  margin: 16px 0 8px;
  font-size: 18px;
  color: #303133;
}

.action-content p {
  margin: 0 0 20px;
  color: #909399;
  font-size: 14px;
  line-height: 1.5;
}
</style>

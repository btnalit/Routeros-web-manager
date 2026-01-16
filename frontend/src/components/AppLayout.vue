<template>
  <el-container class="app-layout">
    <el-aside :width="menuCollapsed ? '64px' : '220px'" class="app-aside">
      <SideMenu :collapsed="menuCollapsed" />
    </el-aside>

    <el-container class="main-container">
      <el-header class="app-header">
        <div class="header-left">
          <el-button
            :icon="menuCollapsed ? Expand : Fold"
            circle
            @click="toggleMenu"
          />
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item v-for="item in breadcrumbs" :key="item.path">
              {{ item.title }}
            </el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="header-right">
          <!-- Device Switcher -->
          <el-dropdown
            v-if="deviceStore.devices.length > 0"
            trigger="click"
            @command="handleDeviceCommand"
            class="device-switcher"
          >
            <span class="el-dropdown-link">
              {{ currentDeviceName }}
              <el-icon class="el-icon--right"><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-for="device in deviceStore.devices"
                  :key="device.id"
                  :command="device.id"
                  :class="{ 'active-device': device.id === deviceStore.selectedDeviceId }"
                >
                  {{ device.name }}
                </el-dropdown-item>
                <el-dropdown-item divided command="manage">
                  <el-icon><Setting /></el-icon>管理设备
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>

          <ConnectionStatus />
        </div>
      </el-header>

      <el-main class="app-main">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Fold, Expand, ArrowDown, Setting } from '@element-plus/icons-vue'
import SideMenu from './SideMenu.vue'
import ConnectionStatus from './ConnectionStatus.vue'
import { connectionApi, deviceApi } from '@/api'
import { useConnectionStore } from '@/stores/connection'
import { useDeviceStore } from '@/stores/device'
import { ElMessage } from 'element-plus'

const menuCollapsed = ref(false)
const route = useRoute()
const router = useRouter()
const connectionStore = useConnectionStore()
const deviceStore = useDeviceStore()

let statusCheckInterval: ReturnType<typeof setInterval> | null = null

const toggleMenu = () => {
  menuCollapsed.value = !menuCollapsed.value
}

// Periodic connection status check
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
    // Don't set disconnected on network errors - might be temporary
  }
}

// Load devices on startup
const loadDevices = async () => {
  try {
    const res = await deviceApi.getAll()
    deviceStore.setDevices(res.data)
  } catch (error) {
    console.error('Failed to load devices:', error)
  }
}

const currentDeviceName = computed(() => {
  return deviceStore.selectedDevice?.name || '选择设备'
})

const handleDeviceCommand = async (command: string) => {
  if (command === 'manage') {
    router.push('/devices')
    return
  }

  if (command !== deviceStore.selectedDeviceId) {
    deviceStore.selectDevice(command)
    ElMessage.success(`已切换到设备: ${deviceStore.selectedDevice?.name}`)
    // Reset connection status
    connectionStore.setConnected(false)
    // Reload current page to refresh data for new device
    // Or we could rely on reactivity if views are watching deviceStore.selectedDeviceId
    // But reloading is safer to ensure all API calls re-fire
    // Using router.go(0) or window.location.reload()
    window.location.reload()
  }
}

onMounted(async () => {
  await loadDevices()
  // Initial check
  checkConnectionStatus()
  // Check every 30 seconds
  statusCheckInterval = setInterval(checkConnectionStatus, 30000)
})

onUnmounted(() => {
  if (statusCheckInterval) {
    clearInterval(statusCheckInterval)
    statusCheckInterval = null
  }
})

interface BreadcrumbItem {
  path: string
  title: string
}

const routeTitles: Record<string, string> = {
  '/devices': '设备管理',
  '/connection': '连接配置',
  '/interfaces': '接口列表',
  '/ip/addresses': 'IP 地址',
  '/ip/routes': '路由表',
  '/ip/pools': 'IP Pool',
  '/ip/dhcp-client': 'DHCP Client',
  '/ip/dhcp-server': 'DHCP Server',
  '/ip/socks': 'Socksify',
  '/system/scheduler': '计划任务',
  '/system/scripts': '脚本管理'
}

const breadcrumbs = computed<BreadcrumbItem[]>(() => {
  const path = route.path
  const title = routeTitles[path] || route.meta.title as string
  if (title) {
    return [{ path, title }]
  }
  return []
})
</script>

<style scoped>
.app-layout {
  height: 100vh;
  overflow: hidden;
}

.app-aside {
  background-color: #304156;
  transition: width 0.3s ease;
  overflow-x: hidden;
  overflow-y: auto;
}

/* 自定义侧边栏滚动条样式 */
.app-aside::-webkit-scrollbar {
  width: 6px;
}

.app-aside::-webkit-scrollbar-track {
  background: #304156;
}

.app-aside::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.app-aside::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

.main-container {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background-color: #fff;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
  z-index: 10;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.device-switcher {
  cursor: pointer;
}

.el-dropdown-link {
  display: flex;
  align-items: center;
  color: #606266;
  font-size: 14px;
}

.el-dropdown-link:hover {
  color: #409eff;
}

.active-device {
  color: #409eff;
  background-color: #ecf5ff;
}

.app-main {
  flex: 1;
  overflow: auto;
  background-color: #f0f2f5;
  padding: 20px;
}

/* Transition animations */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

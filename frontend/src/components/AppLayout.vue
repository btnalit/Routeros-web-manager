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
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { Fold, Expand } from '@element-plus/icons-vue'
import SideMenu from './SideMenu.vue'
import ConnectionStatus from './ConnectionStatus.vue'

const menuCollapsed = ref(false)
const route = useRoute()

const toggleMenu = () => {
  menuCollapsed.value = !menuCollapsed.value
}

interface BreadcrumbItem {
  path: string
  title: string
}

const routeTitles: Record<string, string> = {
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
  const title = routeTitles[path]
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

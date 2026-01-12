<template>
  <el-menu
    :default-active="activeMenu"
    class="side-menu"
    :collapse="collapsed"
    :router="true"
    background-color="#304156"
    text-color="#bfcbd9"
    active-text-color="#409eff"
  >
    <div class="menu-header">
      <el-icon :size="24" color="#409eff">
        <Setting />
      </el-icon>
      <span v-if="!collapsed" class="menu-title">RouterOS Manager</span>
    </div>

    <el-menu-item index="/dashboard">
      <el-icon><Odometer /></el-icon>
      <template #title>系统监控</template>
    </el-menu-item>

    <el-menu-item index="/connection">
      <el-icon><Connection /></el-icon>
      <template #title>连接配置</template>
    </el-menu-item>

    <el-sub-menu index="interfaces">
      <template #title>
        <el-icon><Monitor /></el-icon>
        <span>Interface</span>
      </template>
      <el-menu-item index="/interfaces">接口列表</el-menu-item>
      <el-menu-item index="/interfaces/veth">VETH 接口</el-menu-item>
    </el-sub-menu>

    <el-sub-menu index="ip">
      <template #title>
        <el-icon><Position /></el-icon>
        <span>IP</span>
      </template>
      <el-menu-item index="/ip/addresses">IP 地址</el-menu-item>
      <el-menu-item index="/ip/routes">路由表</el-menu-item>
      <el-menu-item index="/ip/pools">IP Pool</el-menu-item>
      <el-menu-item index="/ip/dhcp-client">DHCP Client</el-menu-item>
      <el-menu-item index="/ip/dhcp-server">DHCP Server</el-menu-item>
      <el-menu-item index="/ip/socks">Socksify</el-menu-item>
    </el-sub-menu>

    <el-sub-menu index="ipv6">
      <template #title>
        <el-icon><Share /></el-icon>
        <span>IPv6</span>
      </template>
      <el-menu-item index="/ipv6/addresses">地址</el-menu-item>
      <el-menu-item index="/ipv6/dhcp-client">DHCPv6 客户端</el-menu-item>
      <el-menu-item index="/ipv6/nd">ND</el-menu-item>
      <el-menu-item index="/ipv6/neighbors">邻居表</el-menu-item>
      <el-menu-item index="/ipv6/routes">路由</el-menu-item>
      <el-menu-item index="/ipv6/firewall/filter">防火墙 Filter</el-menu-item>
    </el-sub-menu>

    <el-sub-menu index="system">
      <template #title>
        <el-icon><Tools /></el-icon>
        <span>System</span>
      </template>
      <el-menu-item index="/system/scheduler">计划任务</el-menu-item>
      <el-menu-item index="/system/scripts">脚本管理</el-menu-item>
      <el-menu-item index="/system/power">电源管理</el-menu-item>
    </el-sub-menu>

    <el-sub-menu index="firewall">
      <template #title>
        <el-icon><Lock /></el-icon>
        <span>Firewall</span>
      </template>
      <el-menu-item index="/firewall/filter">Filter 规则</el-menu-item>
      <el-menu-item index="/firewall/nat">NAT 规则</el-menu-item>
      <el-menu-item index="/firewall/mangle">Mangle 规则</el-menu-item>
      <el-menu-item index="/firewall/address-list">地址列表</el-menu-item>
    </el-sub-menu>

    <el-sub-menu index="container">
      <template #title>
        <el-icon><Box /></el-icon>
        <span>Container</span>
      </template>
      <el-menu-item index="/container">容器列表</el-menu-item>
      <el-menu-item index="/container/mounts">挂载点</el-menu-item>
      <el-menu-item index="/container/envs">环境变量</el-menu-item>
    </el-sub-menu>

    <el-sub-menu index="ai">
      <template #title>
        <el-icon><ChatDotRound /></el-icon>
        <span>AI Agent</span>
      </template>
      <el-menu-item index="/ai/chat">AI 对话</el-menu-item>
      <el-menu-item index="/ai/config">服务配置</el-menu-item>
    </el-sub-menu>
  </el-menu>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Setting, Connection, Monitor, Position, Tools, Odometer, Lock, Box, Share, ChatDotRound } from '@element-plus/icons-vue'

defineProps<{
  collapsed?: boolean
}>()

const route = useRoute()

const activeMenu = computed(() => route.path)
</script>

<style scoped>
.side-menu {
  height: 100%;
  border-right: none;
}

.side-menu:not(.el-menu--collapse) {
  width: 220px;
}

.menu-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 20px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.menu-title {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
}

:deep(.el-menu-item),
:deep(.el-sub-menu__title) {
  height: 50px;
  line-height: 50px;
}

:deep(.el-menu-item.is-active) {
  background-color: rgba(64, 158, 255, 0.2) !important;
}

:deep(.el-menu-item:hover),
:deep(.el-sub-menu__title:hover) {
  background-color: rgba(255, 255, 255, 0.05) !important;
}
</style>

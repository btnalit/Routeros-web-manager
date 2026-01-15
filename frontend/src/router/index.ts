import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: AppLayout,
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/DashboardView.vue'),
        meta: { title: '系统监控' }
      },
      {
        path: 'connection',
        name: 'Connection',
        component: () => import('@/views/ConnectionView.vue'),
        meta: { title: '连接配置' }
      },
      {
        path: 'interfaces',
        name: 'Interfaces',
        component: () => import('@/views/InterfaceView.vue'),
        meta: { title: '接口列表' }
      },
      {
        path: 'interfaces/veth',
        name: 'VethInterfaces',
        component: () => import('@/views/VethInterfaceView.vue'),
        meta: { title: 'VETH 接口' }
      },
      {
        path: 'ip/addresses',
        name: 'IpAddresses',
        component: () => import('@/views/IpAddressView.vue'),
        meta: { title: 'IP 地址' }
      },
      {
        path: 'ip/routes',
        name: 'IpRoutes',
        component: () => import('@/views/IpRouteView.vue'),
        meta: { title: '路由表' }
      },
      {
        path: 'ip/pools',
        name: 'IpPools',
        component: () => import('@/views/IpPoolView.vue'),
        meta: { title: 'IP Pool' }
      },
      {
        path: 'ip/dhcp-client',
        name: 'DhcpClient',
        component: () => import('@/views/DhcpClientView.vue'),
        meta: { title: 'DHCP Client' }
      },
      {
        path: 'ip/dhcp-server',
        name: 'DhcpServer',
        component: () => import('@/views/DhcpServerView.vue'),
        meta: { title: 'DHCP Server' }
      },
      {
        path: 'ip/socks',
        name: 'Socks',
        component: () => import('@/views/SocksView.vue'),
        meta: { title: 'Socksify' }
      },
      {
        path: 'ip/arp',
        name: 'IpArp',
        component: () => import('@/views/ArpView.vue'),
        meta: { title: 'ARP' }
      },
      // IP Firewall routes (new location under IP)
      {
        path: 'ip/firewall/filter',
        name: 'IpFirewallFilter',
        component: () => import('@/views/FirewallFilterView.vue'),
        meta: { title: 'Filter 规则' }
      },
      {
        path: 'ip/firewall/nat',
        name: 'IpFirewallNat',
        component: () => import('@/views/FirewallNatView.vue'),
        meta: { title: 'NAT 规则' }
      },
      {
        path: 'ip/firewall/mangle',
        name: 'IpFirewallMangle',
        component: () => import('@/views/FirewallMangleView.vue'),
        meta: { title: 'Mangle 规则' }
      },
      {
        path: 'ip/firewall/address-list',
        name: 'IpFirewallAddressList',
        component: () => import('@/views/FirewallAddressListView.vue'),
        meta: { title: '地址列表' }
      },
      {
        path: 'system/scheduler',
        name: 'Scheduler',
        component: () => import('@/views/SchedulerView.vue'),
        meta: { title: '计划任务' }
      },
      {
        path: 'system/scripts',
        name: 'Scripts',
        component: () => import('@/views/ScriptView.vue'),
        meta: { title: '脚本管理' }
      },
      {
        path: 'system/power',
        name: 'PowerManagement',
        component: () => import('@/views/PowerManagementView.vue'),
        meta: { title: '电源管理' }
      },
      // Old firewall routes - redirect to new IP firewall routes
      {
        path: 'firewall/filter',
        redirect: '/ip/firewall/filter'
      },
      {
        path: 'firewall/nat',
        redirect: '/ip/firewall/nat'
      },
      {
        path: 'firewall/mangle',
        redirect: '/ip/firewall/mangle'
      },
      {
        path: 'firewall/address-list',
        redirect: '/ip/firewall/address-list'
      },
      {
        path: 'container',
        name: 'Container',
        component: () => import('@/views/ContainerView.vue'),
        meta: { title: '容器管理' }
      },
      {
        path: 'container/mounts',
        name: 'ContainerMounts',
        component: () => import('@/views/ContainerMountsView.vue'),
        meta: { title: '容器挂载点' }
      },
      {
        path: 'container/envs',
        name: 'ContainerEnvs',
        component: () => import('@/views/ContainerEnvsView.vue'),
        meta: { title: '容器环境变量' }
      },
      // IPv6 routes
      {
        path: 'ipv6/addresses',
        name: 'IPv6Addresses',
        component: () => import('@/views/IPv6AddressView.vue'),
        meta: { title: 'IPv6 地址' }
      },
      {
        path: 'ipv6/dhcp-client',
        name: 'IPv6DhcpClient',
        component: () => import('@/views/IPv6DhcpClientView.vue'),
        meta: { title: 'DHCPv6 客户端' }
      },
      {
        path: 'ipv6/nd',
        name: 'IPv6Nd',
        component: () => import('@/views/IPv6NdView.vue'),
        meta: { title: 'ND 配置' }
      },
      {
        path: 'ipv6/neighbors',
        name: 'IPv6Neighbors',
        component: () => import('@/views/IPv6NeighborView.vue'),
        meta: { title: 'IPv6 邻居表' }
      },
      {
        path: 'ipv6/routes',
        name: 'IPv6Routes',
        component: () => import('@/views/IPv6RouteView.vue'),
        meta: { title: 'IPv6 路由' }
      },
      {
        path: 'ipv6/firewall/filter',
        name: 'IPv6FirewallFilter',
        component: () => import('@/views/IPv6FirewallFilterView.vue'),
        meta: { title: 'IPv6 防火墙 Filter' }
      },
      // AI Agent routes
      {
        path: 'ai/chat',
        name: 'AIChat',
        component: () => import('@/views/AIChatView.vue'),
        meta: { title: 'AI 对话' }
      },
      {
        path: 'ai/config',
        name: 'AIConfig',
        component: () => import('@/views/AIConfigView.vue'),
        meta: { title: 'AI 服务配置' }
      },
      // AI-Ops routes
      {
        path: 'ai-ops',
        name: 'AIOps',
        component: () => import('@/views/AIOpsView.vue'),
        meta: { title: '智能运维仪表盘' }
      },
      {
        path: 'ai-ops/alerts',
        name: 'AlertEvents',
        component: () => import('@/views/AlertEventsView.vue'),
        meta: { title: '告警事件' }
      },
      {
        path: 'ai-ops/alerts/rules',
        name: 'AlertRules',
        component: () => import('@/views/AlertRulesView.vue'),
        meta: { title: '告警规则' }
      },
      {
        path: 'ai-ops/scheduler',
        name: 'AIOpsScheduler',
        component: () => import('@/views/AIOpsSchedulerView.vue'),
        meta: { title: '定时任务' }
      },
      {
        path: 'ai-ops/snapshots',
        name: 'Snapshots',
        component: () => import('@/views/SnapshotsView.vue'),
        meta: { title: '配置快照' }
      },
      {
        path: 'ai-ops/changes',
        name: 'ConfigChanges',
        component: () => import('@/views/ConfigChangesView.vue'),
        meta: { title: '配置变更' }
      },
      {
        path: 'ai-ops/reports',
        name: 'HealthReports',
        component: () => import('@/views/HealthReportsView.vue'),
        meta: { title: '健康报告' }
      },
      {
        path: 'ai-ops/patterns',
        name: 'FaultPatterns',
        component: () => import('@/views/FaultPatternsView.vue'),
        meta: { title: '故障自愈' }
      },
      {
        path: 'ai-ops/channels',
        name: 'NotificationChannels',
        component: () => import('@/views/NotificationChannelsView.vue'),
        meta: { title: '通知渠道' }
      },
      {
        path: 'ai-ops/audit',
        name: 'AuditLog',
        component: () => import('@/views/AuditLogView.vue'),
        meta: { title: '审计日志' }
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/connection'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Global error handler for navigation failures
router.onError((error) => {
  console.error('Router error:', error)
  // If it's a chunk loading error, try to reload the page
  if (error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('Loading chunk')) {
    window.location.reload()
  }
})

export default router

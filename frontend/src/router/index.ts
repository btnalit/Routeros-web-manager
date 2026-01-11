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
      {
        path: 'firewall/filter',
        name: 'FirewallFilter',
        component: () => import('@/views/FirewallFilterView.vue'),
        meta: { title: 'Filter 规则' }
      },
      {
        path: 'firewall/nat',
        name: 'FirewallNat',
        component: () => import('@/views/FirewallNatView.vue'),
        meta: { title: 'NAT 规则' }
      },
      {
        path: 'firewall/mangle',
        name: 'FirewallMangle',
        component: () => import('@/views/FirewallMangleView.vue'),
        meta: { title: 'Mangle 规则' }
      },
      {
        path: 'firewall/address-list',
        name: 'FirewallAddressList',
        component: () => import('@/views/FirewallAddressListView.vue'),
        meta: { title: '地址列表' }
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

export default router

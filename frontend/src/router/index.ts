import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: AppLayout,
    redirect: '/connection',
    children: [
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

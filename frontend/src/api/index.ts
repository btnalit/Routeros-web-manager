import axios from 'axios'
import { useConnectionStore } from '@/stores/connection'

const api = axios.create({
  baseURL: '/api',
})

// Request interceptor
api.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error)
)

// Response interceptor - update connection status based on API responses
api.interceptors.response.use(
  (response) => {
    // If API call succeeds and returns data, connection is working
    // Only update for non-connection endpoints to avoid circular updates
    const url = response.config.url || ''
    if (!url.includes('/connection/')) {
      try {
        const connectionStore = useConnectionStore()
        // If we get a successful response from RouterOS-related endpoints, we're connected
        if (response.data?.success !== false) {
          connectionStore.setConnected(true)
        }
      } catch {
        // Store might not be initialized yet, ignore
      }
    }
    return response
  },
  (error) => {
    // Check if error indicates connection issue
    const message = error.response?.data?.error || error.message || 'Request failed'
    const lowerMessage = message.toLowerCase()
    
    // If error indicates connection is lost, update store
    if (lowerMessage.includes('not connected') || 
        lowerMessage.includes('连接已断开') ||
        lowerMessage.includes('connection') && lowerMessage.includes('closed')) {
      try {
        const connectionStore = useConnectionStore()
        connectionStore.setConnected(false)
      } catch {
        // Store might not be initialized yet, ignore
      }
    }
    
    return Promise.reject(new Error(message))
  }
)

export default api

// RouterOS Config interface
export interface RouterOSConfig {
  host: string
  port: number
  username: string
  password: string
  useTLS: boolean
}

// Connection API
export const connectionApi = {
  getStatus: () => api.get('/connection/status'),
  connect: (config: RouterOSConfig) => api.post('/connection/connect', config),
  disconnect: () => api.post('/connection/disconnect'),
  getConfig: () => api.get('/connection/config'),
  saveConfig: (config: RouterOSConfig) => api.post('/connection/config', config)
}

// Interface API
export const interfaceApi = {
  getAll: () => api.get('/interfaces'),
  getById: (id: string) => api.get(`/interfaces/${id}`),
  update: (id: string, data: object) => api.patch(`/interfaces/${id}`, data),
  enable: (id: string) => api.post(`/interfaces/${id}/enable`),
  disable: (id: string) => api.post(`/interfaces/${id}/disable`),
  // L2TP Client
  getL2tpClients: () => api.get('/interfaces/l2tp-client'),
  createL2tpClient: (data: object) => api.post('/interfaces/l2tp-client', data),
  updateL2tpClient: (id: string, data: object) => api.patch(`/interfaces/l2tp-client/${id}`, data),
  deleteL2tpClient: (id: string) => api.delete(`/interfaces/l2tp-client/${id}`),
  // PPPoE Client
  getPppoeClients: () => api.get('/interfaces/pppoe-client'),
  createPppoeClient: (data: object) => api.post('/interfaces/pppoe-client', data),
  updatePppoeClient: (id: string, data: object) => api.patch(`/interfaces/pppoe-client/${id}`, data),
  deletePppoeClient: (id: string) => api.delete(`/interfaces/pppoe-client/${id}`)
}

// VETH Interface API
export const vethApi = {
  getAll: () => api.get('/interfaces/veth'),
  getById: (id: string) => api.get(`/interfaces/veth/${id}`),
  create: (data: object) => api.post('/interfaces/veth', data),
  update: (id: string, data: object) => api.patch(`/interfaces/veth/${id}`, data),
  delete: (id: string) => api.delete(`/interfaces/veth/${id}`)
}

// IP API
export const ipApi = {
  // IP Addresses
  getAddresses: () => api.get('/ip/addresses'),
  addAddress: (data: object) => api.post('/ip/addresses', data),
  updateAddress: (id: string, data: object) => api.patch(`/ip/addresses/${id}`, data),
  deleteAddress: (id: string) => api.delete(`/ip/addresses/${id}`),
  // Routes
  getRoutes: () => api.get('/ip/routes'),
  addRoute: (data: object) => api.post('/ip/routes', data),
  updateRoute: (id: string, data: object) => api.patch(`/ip/routes/${id}`, data),
  deleteRoute: (id: string) => api.delete(`/ip/routes/${id}`),
  // IP Pools
  getPools: () => api.get('/ip/pools'),
  addPool: (data: object) => api.post('/ip/pools', data),
  updatePool: (id: string, data: object) => api.patch(`/ip/pools/${id}`, data),
  deletePool: (id: string) => api.delete(`/ip/pools/${id}`),
  // DHCP Client
  getDhcpClients: () => api.get('/ip/dhcp-client'),
  addDhcpClient: (data: object) => api.post('/ip/dhcp-client', data),
  updateDhcpClient: (id: string, data: object) => api.patch(`/ip/dhcp-client/${id}`, data),
  deleteDhcpClient: (id: string) => api.delete(`/ip/dhcp-client/${id}`),
  enableDhcpClient: (id: string) => api.post(`/ip/dhcp-client/${id}/enable`),
  disableDhcpClient: (id: string) => api.post(`/ip/dhcp-client/${id}/disable`),
  // DHCP Server
  getDhcpServers: () => api.get('/ip/dhcp-server'),
  addDhcpServer: (data: object) => api.post('/ip/dhcp-server', data),
  updateDhcpServer: (id: string, data: object) => api.patch(`/ip/dhcp-server/${id}`, data),
  deleteDhcpServer: (id: string) => api.delete(`/ip/dhcp-server/${id}`),
  enableDhcpServer: (id: string) => api.post(`/ip/dhcp-server/${id}/enable`),
  disableDhcpServer: (id: string) => api.post(`/ip/dhcp-server/${id}/disable`),
  // DHCP Networks
  getDhcpNetworks: () => api.get('/ip/dhcp-server/networks'),
  addDhcpNetwork: (data: object) => api.post('/ip/dhcp-server/networks', data),
  updateDhcpNetwork: (id: string, data: object) => api.patch(`/ip/dhcp-server/networks/${id}`, data),
  deleteDhcpNetwork: (id: string) => api.delete(`/ip/dhcp-server/networks/${id}`),
  // DHCP Leases
  getDhcpLeases: () => api.get('/ip/dhcp-server/leases'),
  addDhcpLease: (data: object) => api.post('/ip/dhcp-server/leases', data),
  updateDhcpLease: (id: string, data: object) => api.patch(`/ip/dhcp-server/leases/${id}`, data),
  deleteDhcpLease: (id: string) => api.delete(`/ip/dhcp-server/leases/${id}`),
  makeDhcpLeaseStatic: (id: string) => api.post(`/ip/dhcp-server/leases/${id}/make-static`),
  // Socks
  getSocks: () => api.get('/ip/socks'),
  addSocks: (data: object) => api.post('/ip/socks', data),
  updateSocks: (id: string, data: object) => api.patch(`/ip/socks/${id}`, data),
  deleteSocks: (id: string) => api.delete(`/ip/socks/${id}`),
  enableSocks: (id: string) => api.post(`/ip/socks/${id}/enable`),
  disableSocks: (id: string) => api.post(`/ip/socks/${id}/disable`)
}


// System API
export const systemApi = {
  // Scheduler
  getSchedulers: () => api.get('/system/scheduler'),
  addScheduler: (data: object) => api.post('/system/scheduler', data),
  updateScheduler: (id: string, data: object) => api.patch(`/system/scheduler/${id}`, data),
  deleteScheduler: (id: string) => api.delete(`/system/scheduler/${id}`),
  enableScheduler: (id: string) => api.post(`/system/scheduler/${id}/enable`),
  disableScheduler: (id: string) => api.post(`/system/scheduler/${id}/disable`),
  // Scripts
  getScripts: () => api.get('/system/scripts'),
  addScript: (data: object) => api.post('/system/scripts', data),
  updateScript: (id: string, data: object) => api.patch(`/system/scripts/${id}`, data),
  deleteScript: (id: string) => api.delete(`/system/scripts/${id}`),
  runScript: (id: string) => api.post(`/system/scripts/${id}/run`),
  // Power Management
  reboot: () => api.post('/system/reboot'),
  shutdown: () => api.post('/system/shutdown')
}

// Dashboard API
export const dashboardApi = {
  getResource: () => api.get('/dashboard/resource')
}

// Firewall API
export const firewallApi = {
  // Filter Rules (只读)
  getFilters: () => api.get('/firewall/filter'),
  getFilterById: (id: string) => api.get(`/firewall/filter/${id}`),
  // NAT Rules (完整 CRUD)
  getNats: () => api.get('/firewall/nat'),
  getNatById: (id: string) => api.get(`/firewall/nat/${id}`),
  createNat: (data: object) => api.post('/firewall/nat', data),
  updateNat: (id: string, data: object) => api.patch(`/firewall/nat/${id}`, data),
  deleteNat: (id: string) => api.delete(`/firewall/nat/${id}`),
  enableNat: (id: string) => api.post(`/firewall/nat/${id}/enable`),
  disableNat: (id: string) => api.post(`/firewall/nat/${id}/disable`),
  // Mangle Rules (只读)
  getMangles: () => api.get('/firewall/mangle'),
  getMangleById: (id: string) => api.get(`/firewall/mangle/${id}`),
  // Address List (完整 CRUD)
  getAddressList: () => api.get('/firewall/address-list'),
  createAddressEntry: (data: object) => api.post('/firewall/address-list', data),
  updateAddressEntry: (id: string, data: object) => api.patch(`/firewall/address-list/${id}`, data),
  deleteAddressEntry: (id: string) => api.delete(`/firewall/address-list/${id}`)
}

// Container API
export const containerApi = {
  // Containers
  getAll: () => api.get('/container'),
  getById: (id: string) => api.get(`/container/${id}`),
  create: (data: object) => api.post('/container', data),
  update: (id: string, data: object) => api.patch(`/container/${id}`, data),
  start: (id: string) => api.post(`/container/${id}/start`),
  stop: (id: string) => api.post(`/container/${id}/stop`),
  // Mounts
  getMounts: () => api.get('/container/mounts'),
  updateMount: (id: string, data: object) => api.patch(`/container/mounts/${id}`, data),
  deleteMount: (id: string) => api.delete(`/container/mounts/${id}`),
  // Envs
  getEnvs: () => api.get('/container/envs'),
  updateEnv: (id: string, data: object) => api.patch(`/container/envs/${id}`, data),
  deleteEnv: (id: string) => api.delete(`/container/envs/${id}`)
}

// IPv6 API
export const ipv6Api = {
  // IPv6 Addresses
  getAddresses: () => api.get('/ipv6/addresses'),
  getAddressById: (id: string) => api.get(`/ipv6/addresses/${id}`),
  addAddress: (data: object) => api.post('/ipv6/addresses', data),
  updateAddress: (id: string, data: object) => api.patch(`/ipv6/addresses/${id}`, data),
  deleteAddress: (id: string) => api.delete(`/ipv6/addresses/${id}`),

  // DHCPv6 Client
  getDhcpClients: () => api.get('/ipv6/dhcp-client'),
  getDhcpClientById: (id: string) => api.get(`/ipv6/dhcp-client/${id}`),
  addDhcpClient: (data: object) => api.post('/ipv6/dhcp-client', data),
  updateDhcpClient: (id: string, data: object) => api.patch(`/ipv6/dhcp-client/${id}`, data),
  deleteDhcpClient: (id: string) => api.delete(`/ipv6/dhcp-client/${id}`),
  releaseDhcpClient: (id: string) => api.post(`/ipv6/dhcp-client/${id}/release`),
  renewDhcpClient: (id: string) => api.post(`/ipv6/dhcp-client/${id}/renew`),

  // ND (Neighbor Discovery)
  getNd: () => api.get('/ipv6/nd'),
  getNdById: (id: string) => api.get(`/ipv6/nd/${id}`),
  addNd: (data: object) => api.post('/ipv6/nd', data),
  updateNd: (id: string, data: object) => api.patch(`/ipv6/nd/${id}`, data),
  deleteNd: (id: string) => api.delete(`/ipv6/nd/${id}`),

  // Neighbors (read-only)
  getNeighbors: () => api.get('/ipv6/neighbors'),

  // IPv6 Routes
  getRoutes: () => api.get('/ipv6/routes'),
  getRouteById: (id: string) => api.get(`/ipv6/routes/${id}`),
  addRoute: (data: object) => api.post('/ipv6/routes', data),
  updateRoute: (id: string, data: object) => api.patch(`/ipv6/routes/${id}`, data),
  deleteRoute: (id: string) => api.delete(`/ipv6/routes/${id}`),

  // IPv6 Firewall Filter
  getFirewallFilters: () => api.get('/ipv6/firewall/filter'),
  getFirewallFilterById: (id: string) => api.get(`/ipv6/firewall/filter/${id}`),
  createFirewallFilter: (data: object) => api.post('/ipv6/firewall/filter', data),
  updateFirewallFilter: (id: string, data: object) => api.patch(`/ipv6/firewall/filter/${id}`, data),
  deleteFirewallFilter: (id: string) => api.delete(`/ipv6/firewall/filter/${id}`),
  enableFirewallFilter: (id: string) => api.post(`/ipv6/firewall/filter/${id}/enable`),
  disableFirewallFilter: (id: string) => api.post(`/ipv6/firewall/filter/${id}/disable`)
}

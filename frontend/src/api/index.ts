import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
})

// Request interceptor
api.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error)
)

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || error.message || 'Request failed'
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
  runScript: (id: string) => api.post(`/system/scripts/${id}/run`)
}

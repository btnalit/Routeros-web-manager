/**
 * IP Routes
 * 定义 IP 地址、路由、DHCP、Pool、Socks 管理相关的路由
 */

import { Router } from 'express';
import {
  // IP Address
  getAllAddresses, getAddressById, addAddress, updateAddress, deleteAddress,
  // Route
  getAllRoutes, getRouteById, addRoute, updateRoute, deleteRoute,
  // IP Pool
  getAllPools, addPool, updatePool, deletePool,
  // DHCP Client
  getAllDhcpClients, addDhcpClient, updateDhcpClient, deleteDhcpClient,
  enableDhcpClient, disableDhcpClient,
  // DHCP Server
  getAllDhcpServers, addDhcpServer, updateDhcpServer, deleteDhcpServer,
  enableDhcpServer, disableDhcpServer,
  // DHCP Network
  getAllDhcpNetworks, addDhcpNetwork, updateDhcpNetwork, deleteDhcpNetwork,
  // DHCP Lease
  getAllDhcpLeases, addDhcpLease, updateDhcpLease, deleteDhcpLease, makeDhcpLeaseStatic,
  // Socks
  getAllSocks, addSocks, updateSocks, deleteSocks, enableSocks, disableSocks,
  // ARP
  getAllArp, addArp, deleteArp,
} from '../controllers/ipController';

const router = Router();

// ==================== IP Address 路由 ====================
router.get('/addresses', getAllAddresses);
router.get('/addresses/:id', getAddressById);
router.post('/addresses', addAddress);
router.patch('/addresses/:id', updateAddress);
router.delete('/addresses/:id', deleteAddress);

// ==================== Route 路由 ====================
router.get('/routes', getAllRoutes);
router.get('/routes/:id', getRouteById);
router.post('/routes', addRoute);
router.patch('/routes/:id', updateRoute);
router.delete('/routes/:id', deleteRoute);


// ==================== IP Pool 路由 ====================
router.get('/pools', getAllPools);
router.post('/pools', addPool);
router.patch('/pools/:id', updatePool);
router.delete('/pools/:id', deletePool);

// ==================== DHCP Client 路由 ====================
router.get('/dhcp-client', getAllDhcpClients);
router.post('/dhcp-client', addDhcpClient);
router.patch('/dhcp-client/:id', updateDhcpClient);
router.delete('/dhcp-client/:id', deleteDhcpClient);
router.post('/dhcp-client/:id/enable', enableDhcpClient);
router.post('/dhcp-client/:id/disable', disableDhcpClient);

// ==================== DHCP Server 路由 ====================
router.get('/dhcp-server', getAllDhcpServers);
router.post('/dhcp-server', addDhcpServer);
router.patch('/dhcp-server/:id', updateDhcpServer);
router.delete('/dhcp-server/:id', deleteDhcpServer);
router.post('/dhcp-server/:id/enable', enableDhcpServer);
router.post('/dhcp-server/:id/disable', disableDhcpServer);

// ==================== DHCP Server Network 路由 ====================
router.get('/dhcp-server/networks', getAllDhcpNetworks);
router.post('/dhcp-server/networks', addDhcpNetwork);
router.patch('/dhcp-server/networks/:id', updateDhcpNetwork);
router.delete('/dhcp-server/networks/:id', deleteDhcpNetwork);

// ==================== DHCP Server Lease 路由 ====================
router.get('/dhcp-server/leases', getAllDhcpLeases);
router.post('/dhcp-server/leases', addDhcpLease);
router.patch('/dhcp-server/leases/:id', updateDhcpLease);
router.delete('/dhcp-server/leases/:id', deleteDhcpLease);
router.post('/dhcp-server/leases/:id/make-static', makeDhcpLeaseStatic);

// ==================== Socks 路由 ====================
router.get('/socks', getAllSocks);
router.post('/socks', addSocks);
router.patch('/socks/:id', updateSocks);
router.delete('/socks/:id', deleteSocks);
router.post('/socks/:id/enable', enableSocks);
router.post('/socks/:id/disable', disableSocks);

// ==================== ARP 路由 ====================
router.get('/arp', getAllArp);
router.post('/arp', addArp);
router.delete('/arp/:id', deleteArp);

export default router;

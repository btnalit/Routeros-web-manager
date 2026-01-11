/**
 * IPv6 Routes
 * 定义 IPv6 地址、DHCPv6 客户端、ND、邻居表、路由、防火墙 Filter 管理相关的路由
 */

import { Router } from 'express';
import {
  // IPv6 Address
  getAllIPv6Addresses,
  getIPv6AddressById,
  addIPv6Address,
  updateIPv6Address,
  deleteIPv6Address,
  // DHCPv6 Client
  getAllDHCPv6Clients,
  getDHCPv6ClientById,
  addDHCPv6Client,
  updateDHCPv6Client,
  deleteDHCPv6Client,
  releaseDHCPv6Client,
  renewDHCPv6Client,
  // ND
  getAllND,
  getNDById,
  addND,
  updateND,
  deleteND,
  // Neighbor
  getAllNeighbors,
  // IPv6 Route
  getAllIPv6Routes,
  getIPv6RouteById,
  addIPv6Route,
  updateIPv6Route,
  deleteIPv6Route,
} from '../controllers/ipv6Controller';
import {
  // IPv6 Firewall Filter
  getAllIPv6FilterRules,
  getIPv6FilterRuleById,
  createIPv6FilterRule,
  updateIPv6FilterRule,
  deleteIPv6FilterRule,
  enableIPv6FilterRule,
  disableIPv6FilterRule,
} from '../controllers/ipv6FirewallController';

const router = Router();

// ==================== IPv6 Address 路由 ====================
router.get('/addresses', getAllIPv6Addresses);
router.get('/addresses/:id', getIPv6AddressById);
router.post('/addresses', addIPv6Address);
router.patch('/addresses/:id', updateIPv6Address);
router.delete('/addresses/:id', deleteIPv6Address);

// ==================== DHCPv6 Client 路由 ====================
router.get('/dhcp-client', getAllDHCPv6Clients);
router.get('/dhcp-client/:id', getDHCPv6ClientById);
router.post('/dhcp-client', addDHCPv6Client);
router.patch('/dhcp-client/:id', updateDHCPv6Client);
router.delete('/dhcp-client/:id', deleteDHCPv6Client);
router.post('/dhcp-client/:id/release', releaseDHCPv6Client);
router.post('/dhcp-client/:id/renew', renewDHCPv6Client);

// ==================== ND (Neighbor Discovery) 路由 ====================
router.get('/nd', getAllND);
router.get('/nd/:id', getNDById);
router.post('/nd', addND);
router.patch('/nd/:id', updateND);
router.delete('/nd/:id', deleteND);

// ==================== IPv6 Neighbor 路由（只读） ====================
router.get('/neighbors', getAllNeighbors);

// ==================== IPv6 Route 路由 ====================
router.get('/routes', getAllIPv6Routes);
router.get('/routes/:id', getIPv6RouteById);
router.post('/routes', addIPv6Route);
router.patch('/routes/:id', updateIPv6Route);
router.delete('/routes/:id', deleteIPv6Route);

// ==================== IPv6 Firewall Filter 路由 ====================
router.get('/firewall/filter', getAllIPv6FilterRules);
router.get('/firewall/filter/:id', getIPv6FilterRuleById);
router.post('/firewall/filter', createIPv6FilterRule);
router.patch('/firewall/filter/:id', updateIPv6FilterRule);
router.delete('/firewall/filter/:id', deleteIPv6FilterRule);
router.post('/firewall/filter/:id/enable', enableIPv6FilterRule);
router.post('/firewall/filter/:id/disable', disableIPv6FilterRule);

export default router;

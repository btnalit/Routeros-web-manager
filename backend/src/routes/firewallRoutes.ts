/**
 * Firewall 路由
 * 防火墙管理相关 API
 */

import { Router } from 'express';
import {
  getAllFilterRules,
  getFilterRuleById,
  getAllNatRules,
  getNatRuleById,
  createNatRule,
  updateNatRule,
  deleteNatRule,
  enableNatRule,
  disableNatRule,
  getAllMangleRules,
  getMangleRuleById,
  getAllAddressListEntries,
  createAddressListEntry,
  updateAddressListEntry,
  deleteAddressListEntry,
} from '../controllers/firewallController';

const router = Router();

// ==================== Filter Rules (只读) ====================
// GET /api/firewall/filter - 获取所有 Filter 规则
router.get('/filter', getAllFilterRules);

// GET /api/firewall/filter/:id - 获取单条 Filter 规则
router.get('/filter/:id', getFilterRuleById);

// ==================== NAT Rules (完整 CRUD) ====================
// GET /api/firewall/nat - 获取所有 NAT 规则
router.get('/nat', getAllNatRules);

// GET /api/firewall/nat/:id - 获取单条 NAT 规则
router.get('/nat/:id', getNatRuleById);

// POST /api/firewall/nat - 创建 NAT 规则
router.post('/nat', createNatRule);

// PATCH /api/firewall/nat/:id - 更新 NAT 规则
router.patch('/nat/:id', updateNatRule);

// DELETE /api/firewall/nat/:id - 删除 NAT 规则
router.delete('/nat/:id', deleteNatRule);

// POST /api/firewall/nat/:id/enable - 启用 NAT 规则
router.post('/nat/:id/enable', enableNatRule);

// POST /api/firewall/nat/:id/disable - 禁用 NAT 规则
router.post('/nat/:id/disable', disableNatRule);

// ==================== Mangle Rules (只读) ====================
// GET /api/firewall/mangle - 获取所有 Mangle 规则
router.get('/mangle', getAllMangleRules);

// GET /api/firewall/mangle/:id - 获取单条 Mangle 规则
router.get('/mangle/:id', getMangleRuleById);

// ==================== Address List (完整 CRUD) ====================
// GET /api/firewall/address-list - 获取所有地址列表条目
router.get('/address-list', getAllAddressListEntries);

// POST /api/firewall/address-list - 创建地址列表条目
router.post('/address-list', createAddressListEntry);

// PATCH /api/firewall/address-list/:id - 更新地址列表条目
router.patch('/address-list/:id', updateAddressListEntry);

// DELETE /api/firewall/address-list/:id - 删除地址列表条目
router.delete('/address-list/:id', deleteAddressListEntry);

export default router;

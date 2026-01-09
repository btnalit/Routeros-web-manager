/**
 * Interface Routes
 * 定义网络接口管理相关的路由
 */

import { Router } from 'express';
import {
  getAllInterfaces,
  getInterfaceById,
  updateInterface,
  enableInterface,
  disableInterface,
  getL2tpClients,
  getL2tpClientById,
  createL2tpClient,
  updateL2tpClient,
  deleteL2tpClient,
  getPppoeClients,
  getPppoeClientById,
  createPppoeClient,
  updatePppoeClient,
  deletePppoeClient,
  getVethInterfaces,
  getVethInterfaceById,
  createVethInterface,
  updateVethInterface,
  deleteVethInterface,
} from '../controllers/interfaceController';

const router = Router();

// VETH routes (must be before /:id to avoid conflicts)
// GET /api/interfaces/veth - 获取所有 VETH 接口
router.get('/veth', getVethInterfaces);

// POST /api/interfaces/veth - 创建 VETH 接口
router.post('/veth', createVethInterface);

// GET /api/interfaces/veth/:id - 获取单个 VETH 接口
router.get('/veth/:id', getVethInterfaceById);

// PATCH /api/interfaces/veth/:id - 更新 VETH 接口配置
router.patch('/veth/:id', updateVethInterface);

// DELETE /api/interfaces/veth/:id - 删除 VETH 接口
router.delete('/veth/:id', deleteVethInterface);

// L2TP Client routes (must be before /:id to avoid conflicts)
// GET /api/interfaces/l2tp-client - 获取所有 L2TP 客户端
router.get('/l2tp-client', getL2tpClients);

// POST /api/interfaces/l2tp-client - 创建 L2TP 客户端
router.post('/l2tp-client', createL2tpClient);

// GET /api/interfaces/l2tp-client/:id - 获取单个 L2TP 客户端
router.get('/l2tp-client/:id', getL2tpClientById);

// PATCH /api/interfaces/l2tp-client/:id - 更新 L2TP 客户端配置
router.patch('/l2tp-client/:id', updateL2tpClient);

// DELETE /api/interfaces/l2tp-client/:id - 删除 L2TP 客户端
router.delete('/l2tp-client/:id', deleteL2tpClient);

// PPPoE Client routes
// GET /api/interfaces/pppoe-client - 获取所有 PPPoE 客户端
router.get('/pppoe-client', getPppoeClients);

// POST /api/interfaces/pppoe-client - 创建 PPPoE 客户端
router.post('/pppoe-client', createPppoeClient);

// GET /api/interfaces/pppoe-client/:id - 获取单个 PPPoE 客户端
router.get('/pppoe-client/:id', getPppoeClientById);

// PATCH /api/interfaces/pppoe-client/:id - 更新 PPPoE 客户端配置
router.patch('/pppoe-client/:id', updatePppoeClient);

// DELETE /api/interfaces/pppoe-client/:id - 删除 PPPoE 客户端
router.delete('/pppoe-client/:id', deletePppoeClient);

// GET /api/interfaces - 获取所有网络接口
router.get('/', getAllInterfaces);

// GET /api/interfaces/:id - 获取单个网络接口
router.get('/:id', getInterfaceById);

// PATCH /api/interfaces/:id - 更新网络接口配置
router.patch('/:id', updateInterface);

// POST /api/interfaces/:id/enable - 启用网络接口
router.post('/:id/enable', enableInterface);

// POST /api/interfaces/:id/disable - 禁用网络接口
router.post('/:id/disable', disableInterface);

export default router;

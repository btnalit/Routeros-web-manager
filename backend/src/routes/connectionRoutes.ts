/**
 * Connection Routes
 * 定义连接管理相关的路由
 */

import { Router } from 'express';
import {
  getConnectionStatus,
  connect,
  disconnect,
  getConfig,
  saveConfig,
} from '../controllers/connectionController';

const router = Router();

// GET /api/connection/status - 获取连接状态
router.get('/status', getConnectionStatus);

// POST /api/connection/connect - 建立连接
router.post('/connect', connect);

// POST /api/connection/disconnect - 断开连接
router.post('/disconnect', disconnect);

// GET /api/connection/config - 获取保存的配置
router.get('/config', getConfig);

// POST /api/connection/config - 保存配置
router.post('/config', saveConfig);

export default router;

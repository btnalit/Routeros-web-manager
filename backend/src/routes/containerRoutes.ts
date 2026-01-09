/**
 * Container 路由
 * 容器管理相关 API
 */

import { Router } from 'express';
import {
  getAllContainers,
  getContainerById,
  createContainer,
  updateContainer,
  startContainer,
  stopContainer,
  getAllMounts,
  updateMount,
  deleteMount,
  getAllEnvs,
  updateEnv,
  deleteEnv,
} from '../controllers/containerController';

const router = Router();

// ==================== Containers ====================
// GET /api/container - 获取所有容器
router.get('/', getAllContainers);

// GET /api/container/mounts - 获取所有挂载点 (放在 /:id 之前避免路由冲突)
router.get('/mounts', getAllMounts);

// GET /api/container/envs - 获取所有环境变量 (放在 /:id 之前避免路由冲突)
router.get('/envs', getAllEnvs);

// GET /api/container/:id - 获取单个容器
router.get('/:id', getContainerById);

// POST /api/container - 创建容器
router.post('/', createContainer);

// PATCH /api/container/:id - 更新容器配置
router.patch('/:id', updateContainer);

// POST /api/container/:id/start - 启动容器
router.post('/:id/start', startContainer);

// POST /api/container/:id/stop - 停止容器
router.post('/:id/stop', stopContainer);

// ==================== Container Mounts ====================
// PATCH /api/container/mounts/:id - 更新挂载点
router.patch('/mounts/:id', updateMount);

// DELETE /api/container/mounts/:id - 删除挂载点
router.delete('/mounts/:id', deleteMount);

// ==================== Container Envs ====================
// PATCH /api/container/envs/:id - 更新环境变量
router.patch('/envs/:id', updateEnv);

// DELETE /api/container/envs/:id - 删除环境变量
router.delete('/envs/:id', deleteEnv);

export default router;

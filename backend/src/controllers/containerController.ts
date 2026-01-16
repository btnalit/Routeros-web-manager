/**
 * Container Controller
 * 处理 RouterOS 容器管理相关的 API 请求
 * 包括 Container、Mounts、Envs
 */

import { Request, Response } from 'express';
import { connectionPool } from '../services/connectionPool';
import { deviceService } from '../services/deviceService';
import { logger } from '../utils/logger';

// RouterOS API 路径
const CONTAINER_PATH = '/container';
const CONTAINER_MOUNTS_PATH = '/container/mounts';
const CONTAINER_ENVS_PATH = '/container/envs';

async function getClient(req: Request) {
  const deviceId = (req.query.deviceId as string) || (await deviceService.getAllDevices())[0]?.id;
  if (!deviceId) throw new Error('Device ID is required');
  return await connectionPool.getClient(deviceId);
}

// ==================== Containers ====================

/**
 * 获取所有容器
 * GET /api/container
 */
export async function getAllContainers(req: Request, res: Response): Promise<void> {
  try {
    const client = await getClient(req);
    const containers = await client.print<Record<string, unknown>>(CONTAINER_PATH);
    const data = Array.isArray(containers) ? containers : [];
    
    // logger.info(`Returning ${data.length} containers`);
    
    res.json({
      success: true,
      data: data,
    });
  } catch (error) {
    logger.error('Failed to get containers:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取容器列表失败',
    });
  }
}

/**
 * 获取单个容器
 * GET /api/container/:id
 */
export async function getContainerById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: '缺少容器 ID',
      });
      return;
    }

    const client = await getClient(req);
    const container = await client.getById<Record<string, unknown>>(CONTAINER_PATH, id);
    
    if (!container) {
      res.status(404).json({
        success: false,
        error: '容器不存在',
      });
      return;
    }
    
    res.json({
      success: true,
      data: container,
    });
  } catch (error) {
    logger.error('Failed to get container:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取容器详情失败',
    });
  }
}


/**
 * 创建容器
 * POST /api/container
 */
export async function createContainer(req: Request, res: Response): Promise<void> {
  try {
    const data = req.body;
    
    if (!data || !data.name) {
      res.status(400).json({
        success: false,
        error: '缺少必要参数：name（容器名称）',
      });
      return;
    }

    if (!data['root-dir']) {
      res.status(400).json({
        success: false,
        error: '缺少必要参数：root-dir（Root 目录）',
      });
      return;
    }

    if (!data.tag) {
      res.status(400).json({
        success: false,
        error: '缺少必要参数：tag（镜像标签）',
      });
      return;
    }

    const client = await getClient(req);
    const newContainer = await client.add<Record<string, unknown>>(
      CONTAINER_PATH,
      data
    );
    
    logger.info(`Created container: ${data.name}`);
    
    res.json({
      success: true,
      data: newContainer,
      message: '容器已创建',
    });
  } catch (error) {
    logger.error('Failed to create container:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '创建容器失败',
    });
  }
}

/**
 * 更新容器配置
 * PATCH /api/container/:id
 */
export async function updateContainer(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: '缺少容器 ID',
      });
      return;
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      res.status(400).json({
        success: false,
        error: '缺少更新数据',
      });
      return;
    }

    const client = await getClient(req);
    const updatedContainer = await client.set<Record<string, unknown>>(
      CONTAINER_PATH,
      id,
      updateData
    );
    
    logger.info(`Updated container: ${id}`);
    
    res.json({
      success: true,
      data: updatedContainer,
      message: '容器配置已更新',
    });
  } catch (error) {
    logger.error('Failed to update container:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '更新容器配置失败',
    });
  }
}

/**
 * 启动容器
 * POST /api/container/:id/start
 */
export async function startContainer(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: '缺少容器 ID',
      });
      return;
    }

    const client = await getClient(req);
    // RouterOS 使用 /container/start 命令启动容器
    await client.execute(`${CONTAINER_PATH}/start`, [`=.id=${id}`]);
    
    // 获取更新后的容器状态
    const updatedContainer = await client.getById<Record<string, unknown>>(CONTAINER_PATH, id);
    
    logger.info(`Started container: ${id}`);
    
    res.json({
      success: true,
      data: updatedContainer,
      message: '容器已启动',
    });
  } catch (error) {
    logger.error('Failed to start container:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '启动容器失败',
    });
  }
}

/**
 * 停止容器
 * POST /api/container/:id/stop
 */
export async function stopContainer(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: '缺少容器 ID',
      });
      return;
    }

    const client = await getClient(req);
    // RouterOS 使用 /container/stop 命令停止容器
    await client.execute(`${CONTAINER_PATH}/stop`, [`=.id=${id}`]);
    
    // 获取更新后的容器状态
    const updatedContainer = await client.getById<Record<string, unknown>>(CONTAINER_PATH, id);
    
    logger.info(`Stopped container: ${id}`);
    
    res.json({
      success: true,
      data: updatedContainer,
      message: '容器已停止',
    });
  } catch (error) {
    logger.error('Failed to stop container:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '停止容器失败',
    });
  }
}


// ==================== Container Mounts ====================

/**
 * 获取所有挂载点
 * GET /api/container/mounts
 */
export async function getAllMounts(req: Request, res: Response): Promise<void> {
  try {
    const client = await getClient(req);
    const mounts = await client.print<Record<string, unknown>>(CONTAINER_MOUNTS_PATH);
    const data = Array.isArray(mounts) ? mounts : [];
    
    // logger.info(`Returning ${data.length} container mounts`);
    
    res.json({
      success: true,
      data: data,
    });
  } catch (error) {
    logger.error('Failed to get container mounts:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取挂载点列表失败',
    });
  }
}

/**
 * 更新挂载点
 * PATCH /api/container/mounts/:id
 */
export async function updateMount(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: '缺少挂载点 ID',
      });
      return;
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      res.status(400).json({
        success: false,
        error: '缺少更新数据',
      });
      return;
    }

    const client = await getClient(req);
    const updatedMount = await client.set<Record<string, unknown>>(
      CONTAINER_MOUNTS_PATH,
      id,
      updateData
    );
    
    logger.info(`Updated container mount: ${id}`);
    
    res.json({
      success: true,
      data: updatedMount,
      message: '挂载点已更新',
    });
  } catch (error) {
    logger.error('Failed to update container mount:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '更新挂载点失败',
    });
  }
}

/**
 * 删除挂载点
 * DELETE /api/container/mounts/:id
 */
export async function deleteMount(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: '缺少挂载点 ID',
      });
      return;
    }

    const client = await getClient(req);
    await client.remove(CONTAINER_MOUNTS_PATH, id);
    
    logger.info(`Deleted container mount: ${id}`);
    
    res.json({
      success: true,
      message: '挂载点已删除',
    });
  } catch (error) {
    logger.error('Failed to delete container mount:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '删除挂载点失败',
    });
  }
}

// ==================== Container Envs ====================

/**
 * 获取所有环境变量
 * GET /api/container/envs
 */
export async function getAllEnvs(req: Request, res: Response): Promise<void> {
  try {
    const client = await getClient(req);
    const envs = await client.print<Record<string, unknown>>(CONTAINER_ENVS_PATH);
    const data = Array.isArray(envs) ? envs : [];
    
    // logger.info(`Returning ${data.length} container envs`);
    
    res.json({
      success: true,
      data: data,
    });
  } catch (error) {
    logger.error('Failed to get container envs:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取环境变量列表失败',
    });
  }
}

/**
 * 更新环境变量
 * PATCH /api/container/envs/:id
 */
export async function updateEnv(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: '缺少环境变量 ID',
      });
      return;
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      res.status(400).json({
        success: false,
        error: '缺少更新数据',
      });
      return;
    }

    const client = await getClient(req);
    const updatedEnv = await client.set<Record<string, unknown>>(
      CONTAINER_ENVS_PATH,
      id,
      updateData
    );
    
    logger.info(`Updated container env: ${id}`);
    
    res.json({
      success: true,
      data: updatedEnv,
      message: '环境变量已更新',
    });
  } catch (error) {
    logger.error('Failed to update container env:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '更新环境变量失败',
    });
  }
}

/**
 * 删除环境变量
 * DELETE /api/container/envs/:id
 */
export async function deleteEnv(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: '缺少环境变量 ID',
      });
      return;
    }

    const client = await getClient(req);
    await client.remove(CONTAINER_ENVS_PATH, id);
    
    logger.info(`Deleted container env: ${id}`);
    
    res.json({
      success: true,
      message: '环境变量已删除',
    });
  } catch (error) {
    logger.error('Failed to delete container env:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '删除环境变量失败',
    });
  }
}

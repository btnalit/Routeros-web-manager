/**
 * Interface Controller
 * 处理 RouterOS 网络接口管理相关的 API 请求
 */

import { Request, Response } from 'express';
import { connectionPool } from '../services/connectionPool';
import { NetworkInterface, VethInterface } from '../types';
import { logger } from '../utils/logger';
import { deviceService } from '../services/deviceService';

const INTERFACE_PATH = '/interface';
const L2TP_CLIENT_PATH = '/interface/l2tp-client';
const PPPOE_CLIENT_PATH = '/interface/pppoe-client';
const VETH_PATH = '/interface/veth';

async function getClient(req: Request) {
  const deviceId = (req.query.deviceId as string) || (await deviceService.getAllDevices())[0]?.id;
  if (!deviceId) throw new Error('Device ID is required');
  return await connectionPool.getClient(deviceId);
}

/**
 * 获取所有网络接口
 * GET /api/interfaces
 */
export async function getAllInterfaces(req: Request, res: Response): Promise<void> {
  try {
    const client = await getClient(req);
    const interfaces = await client.print<NetworkInterface>(INTERFACE_PATH);
    
    // 确保 interfaces 是数组
    const data = Array.isArray(interfaces) ? interfaces : [];
    
    // logger.info(`Returning ${data.length} interfaces`);
    
    res.json({
      success: true,
      data: data,
    });
  } catch (error) {
    logger.error('Failed to get interfaces:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取接口列表失败',
    });
  }
}

/**
 * 获取单个网络接口
 * GET /api/interfaces/:id
 */
export async function getInterfaceById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: '缺少接口 ID',
      });
      return;
    }

    const client = await getClient(req);
    const interfaceData = await client.getById<NetworkInterface>(INTERFACE_PATH, id);
    
    if (!interfaceData) {
      res.status(404).json({
        success: false,
        error: '接口不存在',
      });
      return;
    }
    
    res.json({
      success: true,
      data: interfaceData,
    });
  } catch (error) {
    logger.error('Failed to get interface:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取接口详情失败',
    });
  }
}

/**
 * 更新网络接口配置
 * PATCH /api/interfaces/:id
 */
export async function updateInterface(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: '缺少接口 ID',
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
    const updatedInterface = await client.set<NetworkInterface>(
      INTERFACE_PATH,
      id,
      updateData
    );
    
    res.json({
      success: true,
      data: updatedInterface,
      message: '接口配置已更新',
    });
  } catch (error) {
    logger.error('Failed to update interface:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '更新接口配置失败',
    });
  }
}

/**
 * 启用网络接口
 * POST /api/interfaces/:id/enable
 */
export async function enableInterface(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: '缺少接口 ID',
      });
      return;
    }

    const client = await getClient(req);
    await client.enable(INTERFACE_PATH, id);
    const updatedInterface = await client.getById<NetworkInterface>(INTERFACE_PATH, id);
    
    res.json({
      success: true,
      data: updatedInterface,
      message: '接口已启用',
    });
  } catch (error) {
    logger.error('Failed to enable interface:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '启用接口失败',
    });
  }
}

/**
 * 禁用网络接口
 * POST /api/interfaces/:id/disable
 */
export async function disableInterface(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: '缺少接口 ID',
      });
      return;
    }

    const client = await getClient(req);
    await client.disable(INTERFACE_PATH, id);
    const updatedInterface = await client.getById<NetworkInterface>(INTERFACE_PATH, id);
    
    res.json({
      success: true,
      data: updatedInterface,
      message: '接口已禁用',
    });
  } catch (error) {
    logger.error('Failed to disable interface:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '禁用接口失败',
    });
  }
}


/**
 * 获取所有 L2TP Client 接口
 * GET /api/interfaces/l2tp-client
 */
export async function getL2tpClients(req: Request, res: Response): Promise<void> {
  try {
    const client = await getClient(req);
    const clients = await client.print<Record<string, unknown>>(L2TP_CLIENT_PATH);
    const data = Array.isArray(clients) ? clients : [];
    
    // logger.info(`Returning ${data.length} L2TP clients`);
    
    res.json({
      success: true,
      data: data,
    });
  } catch (error) {
    logger.error('Failed to get L2TP clients:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取 L2TP 客户端列表失败',
    });
  }
}

/**
 * 获取单个 L2TP Client 接口
 * GET /api/interfaces/l2tp-client/:id
 */
export async function getL2tpClientById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: '缺少接口 ID',
      });
      return;
    }

    const client = await getClient(req);
    const clientData = await client.getById<Record<string, unknown>>(L2TP_CLIENT_PATH, id);
    
    if (!clientData) {
      res.status(404).json({
        success: false,
        error: 'L2TP 客户端不存在',
      });
      return;
    }
    
    res.json({
      success: true,
      data: clientData,
    });
  } catch (error) {
    logger.error('Failed to get L2TP client:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取 L2TP 客户端详情失败',
    });
  }
}

/**
 * 更新 L2TP Client 接口配置
 * PATCH /api/interfaces/l2tp-client/:id
 */
export async function updateL2tpClient(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: '缺少接口 ID',
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
    const updatedClient = await client.set<Record<string, unknown>>(
      L2TP_CLIENT_PATH,
      id,
      updateData
    );
    
    res.json({
      success: true,
      data: updatedClient,
      message: 'L2TP 客户端配置已更新',
    });
  } catch (error) {
    logger.error('Failed to update L2TP client:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '更新 L2TP 客户端配置失败',
    });
  }
}

/**
 * 获取所有 PPPoE Client 接口
 * GET /api/interfaces/pppoe-client
 */
export async function getPppoeClients(req: Request, res: Response): Promise<void> {
  try {
    const client = await getClient(req);
    const clients = await client.print<Record<string, unknown>>(PPPOE_CLIENT_PATH);
    const data = Array.isArray(clients) ? clients : [];
    
    // logger.info(`Returning ${data.length} PPPoE clients`);
    
    res.json({
      success: true,
      data: data,
    });
  } catch (error) {
    logger.error('Failed to get PPPoE clients:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取 PPPoE 客户端列表失败',
    });
  }
}

/**
 * 获取单个 PPPoE Client 接口
 * GET /api/interfaces/pppoe-client/:id
 */
export async function getPppoeClientById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: '缺少接口 ID',
      });
      return;
    }

    const client = await getClient(req);
    const clientData = await client.getById<Record<string, unknown>>(PPPOE_CLIENT_PATH, id);
    
    if (!clientData) {
      res.status(404).json({
        success: false,
        error: 'PPPoE 客户端不存在',
      });
      return;
    }
    
    res.json({
      success: true,
      data: clientData,
    });
  } catch (error) {
    logger.error('Failed to get PPPoE client:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取 PPPoE 客户端详情失败',
    });
  }
}

/**
 * 更新 PPPoE Client 接口配置
 * PATCH /api/interfaces/pppoe-client/:id
 */
export async function updatePppoeClient(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: '缺少接口 ID',
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
    const updatedClient = await client.set<Record<string, unknown>>(
      PPPOE_CLIENT_PATH,
      id,
      updateData
    );
    
    res.json({
      success: true,
      data: updatedClient,
      message: 'PPPoE 客户端配置已更新',
    });
  } catch (error) {
    logger.error('Failed to update PPPoE client:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '更新 PPPoE 客户端配置失败',
    });
  }
}


/**
 * 创建 L2TP Client 接口
 * POST /api/interfaces/l2tp-client
 */
export async function createL2tpClient(req: Request, res: Response): Promise<void> {
  try {
    const data = req.body;
    
    if (!data || !data.name) {
      res.status(400).json({
        success: false,
        error: '缺少必要参数：name',
      });
      return;
    }

    if (!data['connect-to']) {
      res.status(400).json({
        success: false,
        error: '缺少必要参数：connect-to',
      });
      return;
    }

    if (!data.user) {
      res.status(400).json({
        success: false,
        error: '缺少必要参数：user',
      });
      return;
    }

    const client = await getClient(req);
    const newClient = await client.add<Record<string, unknown>>(
      L2TP_CLIENT_PATH,
      data
    );
    
    logger.info(`Created L2TP client: ${data.name}`);
    
    res.json({
      success: true,
      data: newClient,
      message: 'L2TP 客户端已创建',
    });
  } catch (error) {
    logger.error('Failed to create L2TP client:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '创建 L2TP 客户端失败',
    });
  }
}

/**
 * 删除 L2TP Client 接口
 * DELETE /api/interfaces/l2tp-client/:id
 */
export async function deleteL2tpClient(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: '缺少接口 ID',
      });
      return;
    }

    const client = await getClient(req);
    await client.remove(L2TP_CLIENT_PATH, id);
    
    logger.info(`Deleted L2TP client: ${id}`);
    
    res.json({
      success: true,
      message: 'L2TP 客户端已删除',
    });
  } catch (error) {
    logger.error('Failed to delete L2TP client:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '删除 L2TP 客户端失败',
    });
  }
}

/**
 * 创建 PPPoE Client 接口
 * POST /api/interfaces/pppoe-client
 */
export async function createPppoeClient(req: Request, res: Response): Promise<void> {
  try {
    const data = req.body;
    
    if (!data || !data.name) {
      res.status(400).json({
        success: false,
        error: '缺少必要参数：name',
      });
      return;
    }

    if (!data.interface) {
      res.status(400).json({
        success: false,
        error: '缺少必要参数：interface',
      });
      return;
    }

    if (!data.user) {
      res.status(400).json({
        success: false,
        error: '缺少必要参数：user',
      });
      return;
    }

    const client = await getClient(req);
    const newClient = await client.add<Record<string, unknown>>(
      PPPOE_CLIENT_PATH,
      data
    );
    
    logger.info(`Created PPPoE client: ${data.name}`);
    
    res.json({
      success: true,
      data: newClient,
      message: 'PPPoE 客户端已创建',
    });
  } catch (error) {
    logger.error('Failed to create PPPoE client:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '创建 PPPoE 客户端失败',
    });
  }
}

/**
 * 删除 PPPoE Client 接口
 * DELETE /api/interfaces/pppoe-client/:id
 */
export async function deletePppoeClient(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: '缺少接口 ID',
      });
      return;
    }

    const client = await getClient(req);
    await client.remove(PPPOE_CLIENT_PATH, id);
    
    logger.info(`Deleted PPPoE client: ${id}`);
    
    res.json({
      success: true,
      message: 'PPPoE 客户端已删除',
    });
  } catch (error) {
    logger.error('Failed to delete PPPoE client:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '删除 PPPoE 客户端失败',
    });
  }
}


// ==================== VETH Interface ====================

/**
 * 获取所有 VETH 接口
 * GET /api/interfaces/veth
 */
export async function getVethInterfaces(req: Request, res: Response): Promise<void> {
  try {
    const client = await getClient(req);
    const interfaces = await client.print<VethInterface>(VETH_PATH);
    const data = Array.isArray(interfaces) ? interfaces : [];
    
    // logger.info(`Returning ${data.length} VETH interfaces`);
    
    res.json({
      success: true,
      data: data,
    });
  } catch (error) {
    logger.error('Failed to get VETH interfaces:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取 VETH 接口列表失败',
    });
  }
}

/**
 * 获取单个 VETH 接口
 * GET /api/interfaces/veth/:id
 */
export async function getVethInterfaceById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: '缺少接口 ID',
      });
      return;
    }

    const client = await getClient(req);
    const vethInterface = await client.getById<VethInterface>(VETH_PATH, id);
    
    if (!vethInterface) {
      res.status(404).json({
        success: false,
        error: 'VETH 接口不存在',
      });
      return;
    }
    
    res.json({
      success: true,
      data: vethInterface,
    });
  } catch (error) {
    logger.error('Failed to get VETH interface:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取 VETH 接口详情失败',
    });
  }
}

/**
 * 创建 VETH 接口
 * POST /api/interfaces/veth
 */
export async function createVethInterface(req: Request, res: Response): Promise<void> {
  try {
    const data = req.body;
    
    if (!data || !data.name) {
      res.status(400).json({
        success: false,
        error: '缺少必要参数：name',
      });
      return;
    }

    const client = await getClient(req);
    const newInterface = await client.add<VethInterface>(
      VETH_PATH,
      data
    );
    
    logger.info(`Created VETH interface: ${data.name}`);
    
    res.json({
      success: true,
      data: newInterface,
      message: 'VETH 接口已创建',
    });
  } catch (error) {
    logger.error('Failed to create VETH interface:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '创建 VETH 接口失败',
    });
  }
}

/**
 * 更新 VETH 接口配置
 * PATCH /api/interfaces/veth/:id
 */
export async function updateVethInterface(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: '缺少接口 ID',
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
    const updatedInterface = await client.set<VethInterface>(
      VETH_PATH,
      id,
      updateData
    );
    
    res.json({
      success: true,
      data: updatedInterface,
      message: 'VETH 接口配置已更新',
    });
  } catch (error) {
    logger.error('Failed to update VETH interface:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '更新 VETH 接口配置失败',
    });
  }
}

/**
 * 删除 VETH 接口
 * DELETE /api/interfaces/veth/:id
 */
export async function deleteVethInterface(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: '缺少接口 ID',
      });
      return;
    }

    const client = await getClient(req);
    await client.remove(VETH_PATH, id);
    
    logger.info(`Deleted VETH interface: ${id}`);
    
    res.json({
      success: true,
      message: 'VETH 接口已删除',
    });
  } catch (error) {
    logger.error('Failed to delete VETH interface:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '删除 VETH 接口失败',
    });
  }
}

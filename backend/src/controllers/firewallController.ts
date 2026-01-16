/**
 * Firewall Controller
 * 处理 RouterOS 防火墙管理相关的 API 请求
 * 包括 Filter、NAT、Mangle、Address List
 */

import { Request, Response } from 'express';
import { connectionPool } from '../services/connectionPool';
import { deviceService } from '../services/deviceService';
import { logger } from '../utils/logger';

// RouterOS API 路径
const FIREWALL_FILTER_PATH = '/ip/firewall/filter';
const FIREWALL_NAT_PATH = '/ip/firewall/nat';
const FIREWALL_MANGLE_PATH = '/ip/firewall/mangle';
const FIREWALL_ADDRESS_LIST_PATH = '/ip/firewall/address-list';

async function getClient(req: Request) {
  const deviceId = (req.query.deviceId as string) || (await deviceService.getAllDevices())[0]?.id;
  if (!deviceId) throw new Error('Device ID is required');
  return await connectionPool.getClient(deviceId);
}

// ==================== Filter Rules (只读) ====================

/**
 * 获取所有 Filter 规则
 * GET /api/firewall/filter
 */
export async function getAllFilterRules(req: Request, res: Response): Promise<void> {
  try {
    const client = await getClient(req);
    const rules = await client.print<Record<string, unknown>>(FIREWALL_FILTER_PATH);
    const data = Array.isArray(rules) ? rules : [];
    
    // logger.info(`Returning ${data.length} filter rules`);
    
    res.json({
      success: true,
      data: data,
    });
  } catch (error) {
    logger.error('Failed to get filter rules:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取 Filter 规则列表失败',
    });
  }
}

/**
 * 获取单条 Filter 规则
 * GET /api/firewall/filter/:id
 */
export async function getFilterRuleById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: '缺少规则 ID',
      });
      return;
    }

    const client = await getClient(req);
    const rule = await client.getById<Record<string, unknown>>(FIREWALL_FILTER_PATH, id);
    
    if (!rule) {
      res.status(404).json({
        success: false,
        error: 'Filter 规则不存在',
      });
      return;
    }
    
    res.json({
      success: true,
      data: rule,
    });
  } catch (error) {
    logger.error('Failed to get filter rule:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取 Filter 规则详情失败',
    });
  }
}

// ==================== NAT Rules (完整 CRUD) ====================

/**
 * 获取所有 NAT 规则
 * GET /api/firewall/nat
 */
export async function getAllNatRules(req: Request, res: Response): Promise<void> {
  try {
    const client = await getClient(req);
    const rules = await client.print<Record<string, unknown>>(FIREWALL_NAT_PATH);
    const data = Array.isArray(rules) ? rules : [];
    
    // logger.info(`Returning ${data.length} NAT rules`);
    
    res.json({
      success: true,
      data: data,
    });
  } catch (error) {
    logger.error('Failed to get NAT rules:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取 NAT 规则列表失败',
    });
  }
}

/**
 * 获取单条 NAT 规则
 * GET /api/firewall/nat/:id
 */
export async function getNatRuleById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: '缺少规则 ID',
      });
      return;
    }

    const client = await getClient(req);
    const rule = await client.getById<Record<string, unknown>>(FIREWALL_NAT_PATH, id);
    
    if (!rule) {
      res.status(404).json({
        success: false,
        error: 'NAT 规则不存在',
      });
      return;
    }
    
    res.json({
      success: true,
      data: rule,
    });
  } catch (error) {
    logger.error('Failed to get NAT rule:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取 NAT 规则详情失败',
    });
  }
}

/**
 * 创建 NAT 规则
 * POST /api/firewall/nat
 */
export async function createNatRule(req: Request, res: Response): Promise<void> {
  try {
    const data = req.body;
    
    if (!data || !data.chain) {
      res.status(400).json({
        success: false,
        error: '缺少必要参数：chain',
      });
      return;
    }

    if (!data.action) {
      res.status(400).json({
        success: false,
        error: '缺少必要参数：action',
      });
      return;
    }

    const client = await getClient(req);
    const newRule = await client.add<Record<string, unknown>>(
      FIREWALL_NAT_PATH,
      data
    );
    
    logger.info(`Created NAT rule: chain=${data.chain}, action=${data.action}`);
    
    res.json({
      success: true,
      data: newRule,
      message: 'NAT 规则已创建',
    });
  } catch (error) {
    logger.error('Failed to create NAT rule:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '创建 NAT 规则失败',
    });
  }
}

/**
 * 更新 NAT 规则
 * PATCH /api/firewall/nat/:id
 */
export async function updateNatRule(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: '缺少规则 ID',
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
    const updatedRule = await client.set<Record<string, unknown>>(
      FIREWALL_NAT_PATH,
      id,
      updateData
    );
    
    logger.info(`Updated NAT rule: ${id}`);
    
    res.json({
      success: true,
      data: updatedRule,
      message: 'NAT 规则已更新',
    });
  } catch (error) {
    logger.error('Failed to update NAT rule:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '更新 NAT 规则失败',
    });
  }
}

/**
 * 删除 NAT 规则
 * DELETE /api/firewall/nat/:id
 */
export async function deleteNatRule(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: '缺少规则 ID',
      });
      return;
    }

    const client = await getClient(req);
    await client.remove(FIREWALL_NAT_PATH, id);
    
    logger.info(`Deleted NAT rule: ${id}`);
    
    res.json({
      success: true,
      message: 'NAT 规则已删除',
    });
  } catch (error) {
    logger.error('Failed to delete NAT rule:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '删除 NAT 规则失败',
    });
  }
}

/**
 * 启用 NAT 规则
 * POST /api/firewall/nat/:id/enable
 */
export async function enableNatRule(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: '缺少规则 ID',
      });
      return;
    }

    const client = await getClient(req);
    await client.enable(FIREWALL_NAT_PATH, id);
    const updatedRule = await client.getById<Record<string, unknown>>(FIREWALL_NAT_PATH, id);
    
    logger.info(`Enabled NAT rule: ${id}`);
    
    res.json({
      success: true,
      data: updatedRule,
      message: 'NAT 规则已启用',
    });
  } catch (error) {
    logger.error('Failed to enable NAT rule:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '启用 NAT 规则失败',
    });
  }
}

/**
 * 禁用 NAT 规则
 * POST /api/firewall/nat/:id/disable
 */
export async function disableNatRule(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: '缺少规则 ID',
      });
      return;
    }

    const client = await getClient(req);
    await client.disable(FIREWALL_NAT_PATH, id);
    const updatedRule = await client.getById<Record<string, unknown>>(FIREWALL_NAT_PATH, id);
    
    logger.info(`Disabled NAT rule: ${id}`);
    
    res.json({
      success: true,
      data: updatedRule,
      message: 'NAT 规则已禁用',
    });
  } catch (error) {
    logger.error('Failed to disable NAT rule:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '禁用 NAT 规则失败',
    });
  }
}

// ==================== Mangle Rules (只读) ====================

/**
 * 获取所有 Mangle 规则
 * GET /api/firewall/mangle
 */
export async function getAllMangleRules(req: Request, res: Response): Promise<void> {
  try {
    const client = await getClient(req);
    const rules = await client.print<Record<string, unknown>>(FIREWALL_MANGLE_PATH);
    const data = Array.isArray(rules) ? rules : [];
    
    // logger.info(`Returning ${data.length} mangle rules`);
    
    res.json({
      success: true,
      data: data,
    });
  } catch (error) {
    logger.error('Failed to get mangle rules:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取 Mangle 规则列表失败',
    });
  }
}

/**
 * 获取单条 Mangle 规则
 * GET /api/firewall/mangle/:id
 */
export async function getMangleRuleById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: '缺少规则 ID',
      });
      return;
    }

    const client = await getClient(req);
    const rule = await client.getById<Record<string, unknown>>(FIREWALL_MANGLE_PATH, id);
    
    if (!rule) {
      res.status(404).json({
        success: false,
        error: 'Mangle 规则不存在',
      });
      return;
    }
    
    res.json({
      success: true,
      data: rule,
    });
  } catch (error) {
    logger.error('Failed to get mangle rule:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取 Mangle 规则详情失败',
    });
  }
}


// ==================== Address List (完整 CRUD) ====================

/**
 * 获取所有地址列表条目
 * GET /api/firewall/address-list
 */
export async function getAllAddressListEntries(req: Request, res: Response): Promise<void> {
  try {
    const client = await getClient(req);
    const entries = await client.print<Record<string, unknown>>(FIREWALL_ADDRESS_LIST_PATH);
    const data = Array.isArray(entries) ? entries : [];
    
    // logger.info(`Returning ${data.length} address list entries`);
    
    res.json({
      success: true,
      data: data,
    });
  } catch (error) {
    logger.error('Failed to get address list entries:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取地址列表失败',
    });
  }
}

/**
 * 创建地址列表条目
 * POST /api/firewall/address-list
 */
export async function createAddressListEntry(req: Request, res: Response): Promise<void> {
  try {
    const data = req.body;
    
    if (!data || !data.list) {
      res.status(400).json({
        success: false,
        error: '缺少必要参数：list（列表名称）',
      });
      return;
    }

    if (!data.address) {
      res.status(400).json({
        success: false,
        error: '缺少必要参数：address（IP 地址）',
      });
      return;
    }

    const client = await getClient(req);
    const newEntry = await client.add<Record<string, unknown>>(
      FIREWALL_ADDRESS_LIST_PATH,
      data
    );
    
    logger.info(`Created address list entry: list=${data.list}, address=${data.address}`);
    
    res.json({
      success: true,
      data: newEntry,
      message: '地址条目已创建',
    });
  } catch (error) {
    logger.error('Failed to create address list entry:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '创建地址条目失败',
    });
  }
}

/**
 * 更新地址列表条目
 * PATCH /api/firewall/address-list/:id
 */
export async function updateAddressListEntry(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: '缺少条目 ID',
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
    const updatedEntry = await client.set<Record<string, unknown>>(
      FIREWALL_ADDRESS_LIST_PATH,
      id,
      updateData
    );
    
    logger.info(`Updated address list entry: ${id}`);
    
    res.json({
      success: true,
      data: updatedEntry,
      message: '地址条目已更新',
    });
  } catch (error) {
    logger.error('Failed to update address list entry:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '更新地址条目失败',
    });
  }
}

/**
 * 删除地址列表条目
 * DELETE /api/firewall/address-list/:id
 */
export async function deleteAddressListEntry(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: '缺少条目 ID',
      });
      return;
    }

    const client = await getClient(req);
    await client.remove(FIREWALL_ADDRESS_LIST_PATH, id);
    
    logger.info(`Deleted address list entry: ${id}`);
    
    res.json({
      success: true,
      message: '地址条目已删除',
    });
  } catch (error) {
    logger.error('Failed to delete address list entry:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '删除地址条目失败',
    });
  }
}

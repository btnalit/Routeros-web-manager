/**
 * IPv6 Controller
 * 处理 RouterOS IPv6 地址、DHCPv6 客户端、ND、邻居表、路由管理相关的 API 请求
 */

import { Request, Response } from 'express';
import { routerosClient } from '../services/routerosClient';
import { IPv6Address, DHCPv6Client, ND, IPv6Neighbor, IPv6Route } from '../types';
import { logger } from '../utils/logger';

// RouterOS API 路径常量
const IPV6_ADDRESS_PATH = '/ipv6/address';
const IPV6_DHCP_CLIENT_PATH = '/ipv6/dhcp-client';
const IPV6_ND_PATH = '/ipv6/nd';
const IPV6_NEIGHBOR_PATH = '/ipv6/neighbor';
const IPV6_ROUTE_PATH = '/ipv6/route';

// ==================== IPv6 Address 相关 ====================

/**
 * 获取所有 IPv6 地址
 * GET /api/ipv6/addresses
 */
export async function getAllIPv6Addresses(_req: Request, res: Response): Promise<void> {
  try {
    const addresses = await routerosClient.print<IPv6Address>(IPV6_ADDRESS_PATH);
    res.json({ success: true, data: addresses });
  } catch (error) {
    logger.error('Failed to get IPv6 addresses:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取 IPv6 地址列表失败',
    });
  }
}

/**
 * 获取单个 IPv6 地址
 * GET /api/ipv6/addresses/:id
 */
export async function getIPv6AddressById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: '缺少 IPv6 地址 ID' });
      return;
    }

    const address = await routerosClient.getById<IPv6Address>(IPV6_ADDRESS_PATH, id);
    if (!address) {
      res.status(404).json({ success: false, error: 'IPv6 地址不存在' });
      return;
    }

    res.json({ success: true, data: address });
  } catch (error) {
    logger.error('Failed to get IPv6 address:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取 IPv6 地址详情失败',
    });
  }
}


/**
 * 添加 IPv6 地址
 * POST /api/ipv6/addresses
 */
export async function addIPv6Address(req: Request, res: Response): Promise<void> {
  try {
    const addressData = req.body;

    if (!addressData.address || !addressData.interface) {
      res.status(400).json({ success: false, error: '缺少必填字段：address, interface' });
      return;
    }

    // IPv6 CIDR 格式验证
    const ipv6CidrRegex = /^([0-9a-fA-F:]+)\/(\d{1,3})$/;
    if (!ipv6CidrRegex.test(addressData.address)) {
      res.status(400).json({
        success: false,
        error: 'IPv6 地址格式无效，请使用 CIDR 格式（如 2001:db8::1/64）',
      });
      return;
    }

    const newAddress = await routerosClient.add<IPv6Address>(IPV6_ADDRESS_PATH, addressData);
    res.status(201).json({ success: true, data: newAddress, message: 'IPv6 地址已添加' });
  } catch (error) {
    logger.error('Failed to add IPv6 address:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '添加 IPv6 地址失败',
    });
  }
}

/**
 * 更新 IPv6 地址
 * PATCH /api/ipv6/addresses/:id
 */
export async function updateIPv6Address(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!id) {
      res.status(400).json({ success: false, error: '缺少 IPv6 地址 ID' });
      return;
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      res.status(400).json({ success: false, error: '缺少更新数据' });
      return;
    }

    // 如果更新地址，验证格式
    if (updateData.address) {
      const ipv6CidrRegex = /^([0-9a-fA-F:]+)\/(\d{1,3})$/;
      if (!ipv6CidrRegex.test(updateData.address)) {
        res.status(400).json({
          success: false,
          error: 'IPv6 地址格式无效，请使用 CIDR 格式（如 2001:db8::1/64）',
        });
        return;
      }
    }

    const updatedAddress = await routerosClient.set<IPv6Address>(IPV6_ADDRESS_PATH, id, updateData);
    res.json({ success: true, data: updatedAddress, message: 'IPv6 地址已更新' });
  } catch (error) {
    logger.error('Failed to update IPv6 address:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '更新 IPv6 地址失败',
    });
  }
}

/**
 * 删除 IPv6 地址
 * DELETE /api/ipv6/addresses/:id
 */
export async function deleteIPv6Address(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: '缺少 IPv6 地址 ID' });
      return;
    }

    await routerosClient.remove(IPV6_ADDRESS_PATH, id);
    res.json({ success: true, message: 'IPv6 地址已删除' });
  } catch (error) {
    logger.error('Failed to delete IPv6 address:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '删除 IPv6 地址失败',
    });
  }
}


// ==================== DHCPv6 Client 相关 ====================

/**
 * 获取所有 DHCPv6 客户端
 * GET /api/ipv6/dhcp-client
 */
export async function getAllDHCPv6Clients(_req: Request, res: Response): Promise<void> {
  try {
    const clients = await routerosClient.print<DHCPv6Client>(IPV6_DHCP_CLIENT_PATH);
    res.json({ success: true, data: clients });
  } catch (error) {
    logger.error('Failed to get DHCPv6 clients:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取 DHCPv6 客户端列表失败',
    });
  }
}

/**
 * 获取单个 DHCPv6 客户端
 * GET /api/ipv6/dhcp-client/:id
 */
export async function getDHCPv6ClientById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: '缺少 DHCPv6 客户端 ID' });
      return;
    }

    const client = await routerosClient.getById<DHCPv6Client>(IPV6_DHCP_CLIENT_PATH, id);
    if (!client) {
      res.status(404).json({ success: false, error: 'DHCPv6 客户端不存在' });
      return;
    }

    res.json({ success: true, data: client });
  } catch (error) {
    logger.error('Failed to get DHCPv6 client:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取 DHCPv6 客户端详情失败',
    });
  }
}

/**
 * 添加 DHCPv6 客户端
 * POST /api/ipv6/dhcp-client
 */
export async function addDHCPv6Client(req: Request, res: Response): Promise<void> {
  try {
    const clientData = req.body;

    if (!clientData.interface) {
      res.status(400).json({ success: false, error: '缺少必填字段：interface' });
      return;
    }

    const newClient = await routerosClient.add<DHCPv6Client>(IPV6_DHCP_CLIENT_PATH, clientData);
    res.status(201).json({ success: true, data: newClient, message: 'DHCPv6 客户端已添加' });
  } catch (error) {
    logger.error('Failed to add DHCPv6 client:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '添加 DHCPv6 客户端失败',
    });
  }
}

/**
 * 更新 DHCPv6 客户端
 * PATCH /api/ipv6/dhcp-client/:id
 */
export async function updateDHCPv6Client(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!id) {
      res.status(400).json({ success: false, error: '缺少 DHCPv6 客户端 ID' });
      return;
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      res.status(400).json({ success: false, error: '缺少更新数据' });
      return;
    }

    const updatedClient = await routerosClient.set<DHCPv6Client>(IPV6_DHCP_CLIENT_PATH, id, updateData);
    res.json({ success: true, data: updatedClient, message: 'DHCPv6 客户端已更新' });
  } catch (error) {
    logger.error('Failed to update DHCPv6 client:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '更新 DHCPv6 客户端失败',
    });
  }
}

/**
 * 删除 DHCPv6 客户端
 * DELETE /api/ipv6/dhcp-client/:id
 */
export async function deleteDHCPv6Client(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: '缺少 DHCPv6 客户端 ID' });
      return;
    }

    await routerosClient.remove(IPV6_DHCP_CLIENT_PATH, id);
    res.json({ success: true, message: 'DHCPv6 客户端已删除' });
  } catch (error) {
    logger.error('Failed to delete DHCPv6 client:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '删除 DHCPv6 客户端失败',
    });
  }
}

/**
 * 释放 DHCPv6 客户端租约
 * POST /api/ipv6/dhcp-client/:id/release
 */
export async function releaseDHCPv6Client(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: '缺少 DHCPv6 客户端 ID' });
      return;
    }

    await routerosClient.execute(`${IPV6_DHCP_CLIENT_PATH}/release`, [`=.id=${id}`]);
    res.json({ success: true, message: 'DHCPv6 客户端租约已释放' });
  } catch (error) {
    logger.error('Failed to release DHCPv6 client:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '释放 DHCPv6 客户端租约失败',
    });
  }
}

/**
 * 续约 DHCPv6 客户端租约
 * POST /api/ipv6/dhcp-client/:id/renew
 */
export async function renewDHCPv6Client(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: '缺少 DHCPv6 客户端 ID' });
      return;
    }

    await routerosClient.execute(`${IPV6_DHCP_CLIENT_PATH}/renew`, [`=.id=${id}`]);
    res.json({ success: true, message: 'DHCPv6 客户端租约已续约' });
  } catch (error) {
    logger.error('Failed to renew DHCPv6 client:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '续约 DHCPv6 客户端租约失败',
    });
  }
}


// ==================== ND (Neighbor Discovery) 相关 ====================

/**
 * 获取所有 ND 配置
 * GET /api/ipv6/nd
 */
export async function getAllND(_req: Request, res: Response): Promise<void> {
  try {
    const ndList = await routerosClient.print<ND>(IPV6_ND_PATH);
    res.json({ success: true, data: ndList });
  } catch (error) {
    logger.error('Failed to get ND configurations:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取 ND 配置列表失败',
    });
  }
}

/**
 * 获取单个 ND 配置
 * GET /api/ipv6/nd/:id
 */
export async function getNDById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: '缺少 ND 配置 ID' });
      return;
    }

    const nd = await routerosClient.getById<ND>(IPV6_ND_PATH, id);
    if (!nd) {
      res.status(404).json({ success: false, error: 'ND 配置不存在' });
      return;
    }

    res.json({ success: true, data: nd });
  } catch (error) {
    logger.error('Failed to get ND configuration:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取 ND 配置详情失败',
    });
  }
}

/**
 * 添加 ND 配置
 * POST /api/ipv6/nd
 */
export async function addND(req: Request, res: Response): Promise<void> {
  try {
    const ndData = req.body;

    if (!ndData.interface) {
      res.status(400).json({ success: false, error: '缺少必填字段：interface' });
      return;
    }

    const newND = await routerosClient.add<ND>(IPV6_ND_PATH, ndData);
    res.status(201).json({ success: true, data: newND, message: 'ND 配置已添加' });
  } catch (error) {
    logger.error('Failed to add ND configuration:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '添加 ND 配置失败',
    });
  }
}

/**
 * 更新 ND 配置
 * PATCH /api/ipv6/nd/:id
 */
export async function updateND(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!id) {
      res.status(400).json({ success: false, error: '缺少 ND 配置 ID' });
      return;
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      res.status(400).json({ success: false, error: '缺少更新数据' });
      return;
    }

    const updatedND = await routerosClient.set<ND>(IPV6_ND_PATH, id, updateData);
    res.json({ success: true, data: updatedND, message: 'ND 配置已更新' });
  } catch (error) {
    logger.error('Failed to update ND configuration:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '更新 ND 配置失败',
    });
  }
}

/**
 * 删除 ND 配置
 * DELETE /api/ipv6/nd/:id
 */
export async function deleteND(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: '缺少 ND 配置 ID' });
      return;
    }

    await routerosClient.remove(IPV6_ND_PATH, id);
    res.json({ success: true, message: 'ND 配置已删除' });
  } catch (error) {
    logger.error('Failed to delete ND configuration:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '删除 ND 配置失败',
    });
  }
}

// ==================== IPv6 Neighbor 相关（只读） ====================

/**
 * 获取所有 IPv6 邻居
 * GET /api/ipv6/neighbors
 */
export async function getAllNeighbors(_req: Request, res: Response): Promise<void> {
  try {
    const neighbors = await routerosClient.print<IPv6Neighbor>(IPV6_NEIGHBOR_PATH);
    res.json({ success: true, data: neighbors });
  } catch (error) {
    logger.error('Failed to get IPv6 neighbors:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取 IPv6 邻居列表失败',
    });
  }
}


// ==================== IPv6 Route 相关 ====================

/**
 * 获取所有 IPv6 路由
 * GET /api/ipv6/routes
 */
export async function getAllIPv6Routes(_req: Request, res: Response): Promise<void> {
  try {
    const routes = await routerosClient.print<IPv6Route>(IPV6_ROUTE_PATH);
    res.json({ success: true, data: routes });
  } catch (error) {
    logger.error('Failed to get IPv6 routes:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取 IPv6 路由列表失败',
    });
  }
}

/**
 * 获取单个 IPv6 路由
 * GET /api/ipv6/routes/:id
 */
export async function getIPv6RouteById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: '缺少 IPv6 路由 ID' });
      return;
    }

    const route = await routerosClient.getById<IPv6Route>(IPV6_ROUTE_PATH, id);
    if (!route) {
      res.status(404).json({ success: false, error: 'IPv6 路由不存在' });
      return;
    }

    res.json({ success: true, data: route });
  } catch (error) {
    logger.error('Failed to get IPv6 route:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取 IPv6 路由详情失败',
    });
  }
}

/**
 * 添加 IPv6 路由
 * POST /api/ipv6/routes
 */
export async function addIPv6Route(req: Request, res: Response): Promise<void> {
  try {
    const routeData = req.body;

    if (!routeData['dst-address']) {
      res.status(400).json({ success: false, error: '缺少必填字段：dst-address' });
      return;
    }

    // IPv6 CIDR 格式验证（目标地址）
    const ipv6CidrRegex = /^([0-9a-fA-F:]+)\/(\d{1,3})$/;
    if (!ipv6CidrRegex.test(routeData['dst-address'])) {
      res.status(400).json({
        success: false,
        error: 'IPv6 目标地址格式无效，请使用 CIDR 格式（如 2001:db8::/32 或 ::/0）',
      });
      return;
    }

    const newRoute = await routerosClient.add<IPv6Route>(IPV6_ROUTE_PATH, routeData);
    res.status(201).json({ success: true, data: newRoute, message: 'IPv6 路由已添加' });
  } catch (error) {
    logger.error('Failed to add IPv6 route:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '添加 IPv6 路由失败',
    });
  }
}

/**
 * 更新 IPv6 路由
 * PATCH /api/ipv6/routes/:id
 */
export async function updateIPv6Route(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!id) {
      res.status(400).json({ success: false, error: '缺少 IPv6 路由 ID' });
      return;
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      res.status(400).json({ success: false, error: '缺少更新数据' });
      return;
    }

    // 如果更新目标地址，验证格式
    if (updateData['dst-address']) {
      const ipv6CidrRegex = /^([0-9a-fA-F:]+)\/(\d{1,3})$/;
      if (!ipv6CidrRegex.test(updateData['dst-address'])) {
        res.status(400).json({
          success: false,
          error: 'IPv6 目标地址格式无效，请使用 CIDR 格式（如 2001:db8::/32 或 ::/0）',
        });
        return;
      }
    }

    const updatedRoute = await routerosClient.set<IPv6Route>(IPV6_ROUTE_PATH, id, updateData);
    res.json({ success: true, data: updatedRoute, message: 'IPv6 路由已更新' });
  } catch (error) {
    logger.error('Failed to update IPv6 route:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '更新 IPv6 路由失败',
    });
  }
}

/**
 * 删除 IPv6 路由
 * DELETE /api/ipv6/routes/:id
 */
export async function deleteIPv6Route(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: '缺少 IPv6 路由 ID' });
      return;
    }

    await routerosClient.remove(IPV6_ROUTE_PATH, id);
    res.json({ success: true, message: 'IPv6 路由已删除' });
  } catch (error) {
    logger.error('Failed to delete IPv6 route:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '删除 IPv6 路由失败',
    });
  }
}

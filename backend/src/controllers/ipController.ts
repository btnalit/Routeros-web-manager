/**
 * IP Controller
 * 处理 RouterOS IP 地址、路由、DHCP、Pool、Socksify 管理相关的 API 请求
 */

import { Request, Response } from 'express';
import { routerosClient } from '../services/routerosClient';
import { IpAddress, Route } from '../types';
import { logger } from '../utils/logger';

const IP_ADDRESS_PATH = '/ip/address';
const IP_ROUTE_PATH = '/ip/route';
const IP_POOL_PATH = '/ip/pool';
const IP_DHCP_CLIENT_PATH = '/ip/dhcp-client';
const IP_DHCP_SERVER_PATH = '/ip/dhcp-server';
const IP_DHCP_SERVER_NETWORK_PATH = '/ip/dhcp-server/network';
const IP_DHCP_SERVER_LEASE_PATH = '/ip/dhcp-server/lease';
const IP_SOCKS_PATH = '/ip/socks';

// ==================== IP Address 相关 ====================

/**
 * 获取所有 IP 地址
 * GET /api/ip/addresses
 */
export async function getAllAddresses(_req: Request, res: Response): Promise<void> {
  try {
    const addresses = await routerosClient.print<IpAddress>(IP_ADDRESS_PATH);
    
    res.json({
      success: true,
      data: addresses,
    });
  } catch (error) {
    logger.error('Failed to get IP addresses:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取 IP 地址列表失败',
    });
  }
}


/**
 * 获取单个 IP 地址
 * GET /api/ip/addresses/:id
 */
export async function getAddressById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({ success: false, error: '缺少 IP 地址 ID' });
      return;
    }

    const address = await routerosClient.getById<IpAddress>(IP_ADDRESS_PATH, id);
    
    if (!address) {
      res.status(404).json({ success: false, error: 'IP 地址不存在' });
      return;
    }
    
    res.json({ success: true, data: address });
  } catch (error) {
    logger.error('Failed to get IP address:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取 IP 地址详情失败',
    });
  }
}

/**
 * 添加 IP 地址
 * POST /api/ip/addresses
 */
export async function addAddress(req: Request, res: Response): Promise<void> {
  try {
    const addressData = req.body;
    
    if (!addressData.address || !addressData.interface) {
      res.status(400).json({ success: false, error: '缺少必填字段：address, interface' });
      return;
    }

    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
    if (!cidrRegex.test(addressData.address)) {
      res.status(400).json({
        success: false,
        error: 'IP 地址格式无效，请使用 CIDR 格式（如 192.168.1.1/24）',
      });
      return;
    }

    const newAddress = await routerosClient.add<IpAddress>(IP_ADDRESS_PATH, addressData);
    res.status(201).json({ success: true, data: newAddress, message: 'IP 地址已添加' });
  } catch (error) {
    logger.error('Failed to add IP address:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '添加 IP 地址失败',
    });
  }
}


/**
 * 更新 IP 地址
 * PATCH /api/ip/addresses/:id
 */
export async function updateAddress(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    if (!id) {
      res.status(400).json({ success: false, error: '缺少 IP 地址 ID' });
      return;
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      res.status(400).json({ success: false, error: '缺少更新数据' });
      return;
    }

    if (updateData.address) {
      const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
      if (!cidrRegex.test(updateData.address)) {
        res.status(400).json({
          success: false,
          error: 'IP 地址格式无效，请使用 CIDR 格式（如 192.168.1.1/24）',
        });
        return;
      }
    }

    const updatedAddress = await routerosClient.set<IpAddress>(IP_ADDRESS_PATH, id, updateData);
    res.json({ success: true, data: updatedAddress, message: 'IP 地址已更新' });
  } catch (error) {
    logger.error('Failed to update IP address:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '更新 IP 地址失败',
    });
  }
}

/**
 * 删除 IP 地址
 * DELETE /api/ip/addresses/:id
 */
export async function deleteAddress(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({ success: false, error: '缺少 IP 地址 ID' });
      return;
    }

    await routerosClient.remove(IP_ADDRESS_PATH, id);
    res.json({ success: true, message: 'IP 地址已删除' });
  } catch (error) {
    logger.error('Failed to delete IP address:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '删除 IP 地址失败',
    });
  }
}


// ==================== Route 相关 ====================

/**
 * 获取所有路由
 * GET /api/ip/routes
 */
export async function getAllRoutes(_req: Request, res: Response): Promise<void> {
  try {
    const routes = await routerosClient.print<Route>(IP_ROUTE_PATH);
    res.json({ success: true, data: routes });
  } catch (error) {
    logger.error('Failed to get routes:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取路由列表失败',
    });
  }
}

/**
 * 获取单个路由
 * GET /api/ip/routes/:id
 */
export async function getRouteById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: '缺少路由 ID' });
      return;
    }

    const route = await routerosClient.getById<Route>(IP_ROUTE_PATH, id);
    if (!route) {
      res.status(404).json({ success: false, error: '路由不存在' });
      return;
    }
    
    res.json({ success: true, data: route });
  } catch (error) {
    logger.error('Failed to get route:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取路由详情失败',
    });
  }
}

/**
 * 添加路由
 * POST /api/ip/routes
 */
export async function addRoute(req: Request, res: Response): Promise<void> {
  try {
    const routeData = req.body;
    
    if (!routeData['dst-address']) {
      res.status(400).json({ success: false, error: '缺少必填字段：dst-address' });
      return;
    }

    const newRoute = await routerosClient.add<Route>(IP_ROUTE_PATH, routeData);
    res.status(201).json({ success: true, data: newRoute, message: '路由已添加' });
  } catch (error) {
    logger.error('Failed to add route:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '添加路由失败',
    });
  }
}


/**
 * 更新路由
 * PATCH /api/ip/routes/:id
 */
export async function updateRoute(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    if (!id) {
      res.status(400).json({ success: false, error: '缺少路由 ID' });
      return;
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      res.status(400).json({ success: false, error: '缺少更新数据' });
      return;
    }

    const updatedRoute = await routerosClient.set<Route>(IP_ROUTE_PATH, id, updateData);
    res.json({ success: true, data: updatedRoute, message: '路由已更新' });
  } catch (error) {
    logger.error('Failed to update route:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '更新路由失败',
    });
  }
}

/**
 * 删除路由
 * DELETE /api/ip/routes/:id
 */
export async function deleteRoute(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: '缺少路由 ID' });
      return;
    }

    await routerosClient.remove(IP_ROUTE_PATH, id);
    res.json({ success: true, message: '路由已删除' });
  } catch (error) {
    logger.error('Failed to delete route:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '删除路由失败',
    });
  }
}


// ==================== IP Pool 相关 ====================

/**
 * 获取所有 IP Pool
 * GET /api/ip/pools
 */
export async function getAllPools(_req: Request, res: Response): Promise<void> {
  try {
    const pools = await routerosClient.print<any>(IP_POOL_PATH);
    res.json({ success: true, data: pools });
  } catch (error) {
    logger.error('Failed to get IP pools:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取 IP Pool 列表失败',
    });
  }
}

/**
 * 添加 IP Pool
 * POST /api/ip/pools
 */
export async function addPool(req: Request, res: Response): Promise<void> {
  try {
    const poolData = req.body;
    
    if (!poolData.name || !poolData.ranges) {
      res.status(400).json({ success: false, error: '缺少必填字段：name, ranges' });
      return;
    }

    const newPool = await routerosClient.add<any>(IP_POOL_PATH, poolData);
    res.status(201).json({ success: true, data: newPool, message: 'IP Pool 已添加' });
  } catch (error) {
    logger.error('Failed to add IP pool:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '添加 IP Pool 失败',
    });
  }
}

/**
 * 更新 IP Pool
 * PATCH /api/ip/pools/:id
 */
export async function updatePool(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    if (!id) {
      res.status(400).json({ success: false, error: '缺少 IP Pool ID' });
      return;
    }

    const updatedPool = await routerosClient.set<any>(IP_POOL_PATH, id, updateData);
    res.json({ success: true, data: updatedPool, message: 'IP Pool 已更新' });
  } catch (error) {
    logger.error('Failed to update IP pool:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '更新 IP Pool 失败',
    });
  }
}

/**
 * 删除 IP Pool
 * DELETE /api/ip/pools/:id
 */
export async function deletePool(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: '缺少 IP Pool ID' });
      return;
    }

    await routerosClient.remove(IP_POOL_PATH, id);
    res.json({ success: true, message: 'IP Pool 已删除' });
  } catch (error) {
    logger.error('Failed to delete IP pool:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '删除 IP Pool 失败',
    });
  }
}


// ==================== DHCP Client 相关 ====================

/**
 * 获取所有 DHCP Client
 * GET /api/ip/dhcp-client
 */
export async function getAllDhcpClients(_req: Request, res: Response): Promise<void> {
  try {
    const clients = await routerosClient.print<any>(IP_DHCP_CLIENT_PATH);
    res.json({ success: true, data: clients });
  } catch (error) {
    logger.error('Failed to get DHCP clients:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取 DHCP Client 列表失败',
    });
  }
}

/**
 * 添加 DHCP Client
 * POST /api/ip/dhcp-client
 */
export async function addDhcpClient(req: Request, res: Response): Promise<void> {
  try {
    const clientData = req.body;
    
    if (!clientData.interface) {
      res.status(400).json({ success: false, error: '缺少必填字段：interface' });
      return;
    }

    const newClient = await routerosClient.add<any>(IP_DHCP_CLIENT_PATH, clientData);
    res.status(201).json({ success: true, data: newClient, message: 'DHCP Client 已添加' });
  } catch (error) {
    logger.error('Failed to add DHCP client:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '添加 DHCP Client 失败',
    });
  }
}

/**
 * 更新 DHCP Client
 * PATCH /api/ip/dhcp-client/:id
 */
export async function updateDhcpClient(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    if (!id) {
      res.status(400).json({ success: false, error: '缺少 DHCP Client ID' });
      return;
    }

    const updatedClient = await routerosClient.set<any>(IP_DHCP_CLIENT_PATH, id, updateData);
    res.json({ success: true, data: updatedClient, message: 'DHCP Client 已更新' });
  } catch (error) {
    logger.error('Failed to update DHCP client:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '更新 DHCP Client 失败',
    });
  }
}

/**
 * 删除 DHCP Client
 * DELETE /api/ip/dhcp-client/:id
 */
export async function deleteDhcpClient(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: '缺少 DHCP Client ID' });
      return;
    }

    await routerosClient.remove(IP_DHCP_CLIENT_PATH, id);
    res.json({ success: true, message: 'DHCP Client 已删除' });
  } catch (error) {
    logger.error('Failed to delete DHCP client:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '删除 DHCP Client 失败',
    });
  }
}

/**
 * 启用 DHCP Client
 * POST /api/ip/dhcp-client/:id/enable
 */
export async function enableDhcpClient(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: '缺少 DHCP Client ID' });
      return;
    }

    await routerosClient.enable(IP_DHCP_CLIENT_PATH, id);
    res.json({ success: true, message: 'DHCP Client 已启用' });
  } catch (error) {
    logger.error('Failed to enable DHCP client:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '启用 DHCP Client 失败',
    });
  }
}

/**
 * 禁用 DHCP Client
 * POST /api/ip/dhcp-client/:id/disable
 */
export async function disableDhcpClient(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: '缺少 DHCP Client ID' });
      return;
    }

    await routerosClient.disable(IP_DHCP_CLIENT_PATH, id);
    res.json({ success: true, message: 'DHCP Client 已禁用' });
  } catch (error) {
    logger.error('Failed to disable DHCP client:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '禁用 DHCP Client 失败',
    });
  }
}


// ==================== DHCP Server 相关 ====================

/**
 * 获取所有 DHCP Server
 * GET /api/ip/dhcp-server
 */
export async function getAllDhcpServers(_req: Request, res: Response): Promise<void> {
  try {
    const servers = await routerosClient.print<any>(IP_DHCP_SERVER_PATH);
    res.json({ success: true, data: servers });
  } catch (error) {
    logger.error('Failed to get DHCP servers:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取 DHCP Server 列表失败',
    });
  }
}

/**
 * 添加 DHCP Server
 * POST /api/ip/dhcp-server
 */
export async function addDhcpServer(req: Request, res: Response): Promise<void> {
  try {
    const serverData = req.body;
    
    if (!serverData.name || !serverData.interface) {
      res.status(400).json({ success: false, error: '缺少必填字段：name, interface' });
      return;
    }

    const newServer = await routerosClient.add<any>(IP_DHCP_SERVER_PATH, serverData);
    res.status(201).json({ success: true, data: newServer, message: 'DHCP Server 已添加' });
  } catch (error) {
    logger.error('Failed to add DHCP server:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '添加 DHCP Server 失败',
    });
  }
}

/**
 * 更新 DHCP Server
 * PATCH /api/ip/dhcp-server/:id
 */
export async function updateDhcpServer(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    if (!id) {
      res.status(400).json({ success: false, error: '缺少 DHCP Server ID' });
      return;
    }

    const updatedServer = await routerosClient.set<any>(IP_DHCP_SERVER_PATH, id, updateData);
    res.json({ success: true, data: updatedServer, message: 'DHCP Server 已更新' });
  } catch (error) {
    logger.error('Failed to update DHCP server:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '更新 DHCP Server 失败',
    });
  }
}

/**
 * 删除 DHCP Server
 * DELETE /api/ip/dhcp-server/:id
 */
export async function deleteDhcpServer(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: '缺少 DHCP Server ID' });
      return;
    }

    await routerosClient.remove(IP_DHCP_SERVER_PATH, id);
    res.json({ success: true, message: 'DHCP Server 已删除' });
  } catch (error) {
    logger.error('Failed to delete DHCP server:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '删除 DHCP Server 失败',
    });
  }
}

/**
 * 启用 DHCP Server
 * POST /api/ip/dhcp-server/:id/enable
 */
export async function enableDhcpServer(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: '缺少 DHCP Server ID' });
      return;
    }

    await routerosClient.enable(IP_DHCP_SERVER_PATH, id);
    res.json({ success: true, message: 'DHCP Server 已启用' });
  } catch (error) {
    logger.error('Failed to enable DHCP server:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '启用 DHCP Server 失败',
    });
  }
}

/**
 * 禁用 DHCP Server
 * POST /api/ip/dhcp-server/:id/disable
 */
export async function disableDhcpServer(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: '缺少 DHCP Server ID' });
      return;
    }

    await routerosClient.disable(IP_DHCP_SERVER_PATH, id);
    res.json({ success: true, message: 'DHCP Server 已禁用' });
  } catch (error) {
    logger.error('Failed to disable DHCP server:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '禁用 DHCP Server 失败',
    });
  }
}


// ==================== DHCP Server Network 相关 ====================

/**
 * 获取所有 DHCP Server Network
 * GET /api/ip/dhcp-server/networks
 */
export async function getAllDhcpNetworks(_req: Request, res: Response): Promise<void> {
  try {
    const networks = await routerosClient.print<any>(IP_DHCP_SERVER_NETWORK_PATH);
    res.json({ success: true, data: networks });
  } catch (error) {
    logger.error('Failed to get DHCP networks:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取 DHCP Network 列表失败',
    });
  }
}

/**
 * 添加 DHCP Server Network
 * POST /api/ip/dhcp-server/networks
 */
export async function addDhcpNetwork(req: Request, res: Response): Promise<void> {
  try {
    const networkData = req.body;
    
    if (!networkData.address) {
      res.status(400).json({ success: false, error: '缺少必填字段：address' });
      return;
    }

    const newNetwork = await routerosClient.add<any>(IP_DHCP_SERVER_NETWORK_PATH, networkData);
    res.status(201).json({ success: true, data: newNetwork, message: 'DHCP Network 已添加' });
  } catch (error) {
    logger.error('Failed to add DHCP network:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '添加 DHCP Network 失败',
    });
  }
}

/**
 * 更新 DHCP Server Network
 * PATCH /api/ip/dhcp-server/networks/:id
 */
export async function updateDhcpNetwork(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    if (!id) {
      res.status(400).json({ success: false, error: '缺少 DHCP Network ID' });
      return;
    }

    const updatedNetwork = await routerosClient.set<any>(IP_DHCP_SERVER_NETWORK_PATH, id, updateData);
    res.json({ success: true, data: updatedNetwork, message: 'DHCP Network 已更新' });
  } catch (error) {
    logger.error('Failed to update DHCP network:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '更新 DHCP Network 失败',
    });
  }
}

/**
 * 删除 DHCP Server Network
 * DELETE /api/ip/dhcp-server/networks/:id
 */
export async function deleteDhcpNetwork(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: '缺少 DHCP Network ID' });
      return;
    }

    await routerosClient.remove(IP_DHCP_SERVER_NETWORK_PATH, id);
    res.json({ success: true, message: 'DHCP Network 已删除' });
  } catch (error) {
    logger.error('Failed to delete DHCP network:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '删除 DHCP Network 失败',
    });
  }
}


// ==================== DHCP Server Lease 相关 ====================

/**
 * 获取所有 DHCP Server Lease
 * GET /api/ip/dhcp-server/leases
 */
export async function getAllDhcpLeases(_req: Request, res: Response): Promise<void> {
  try {
    const leases = await routerosClient.print<any>(IP_DHCP_SERVER_LEASE_PATH);
    res.json({ success: true, data: leases });
  } catch (error) {
    logger.error('Failed to get DHCP leases:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取 DHCP Lease 列表失败',
    });
  }
}

/**
 * 添加 DHCP Server Lease (静态绑定)
 * POST /api/ip/dhcp-server/leases
 */
export async function addDhcpLease(req: Request, res: Response): Promise<void> {
  try {
    const leaseData = req.body;
    
    if (!leaseData.address || !leaseData['mac-address']) {
      res.status(400).json({ success: false, error: '缺少必填字段：address, mac-address' });
      return;
    }

    const newLease = await routerosClient.add<any>(IP_DHCP_SERVER_LEASE_PATH, leaseData);
    res.status(201).json({ success: true, data: newLease, message: 'DHCP Lease 已添加' });
  } catch (error) {
    logger.error('Failed to add DHCP lease:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '添加 DHCP Lease 失败',
    });
  }
}

/**
 * 更新 DHCP Server Lease
 * PATCH /api/ip/dhcp-server/leases/:id
 */
export async function updateDhcpLease(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    if (!id) {
      res.status(400).json({ success: false, error: '缺少 DHCP Lease ID' });
      return;
    }

    const updatedLease = await routerosClient.set<any>(IP_DHCP_SERVER_LEASE_PATH, id, updateData);
    res.json({ success: true, data: updatedLease, message: 'DHCP Lease 已更新' });
  } catch (error) {
    logger.error('Failed to update DHCP lease:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '更新 DHCP Lease 失败',
    });
  }
}

/**
 * 删除 DHCP Server Lease
 * DELETE /api/ip/dhcp-server/leases/:id
 */
export async function deleteDhcpLease(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: '缺少 DHCP Lease ID' });
      return;
    }

    await routerosClient.remove(IP_DHCP_SERVER_LEASE_PATH, id);
    res.json({ success: true, message: 'DHCP Lease 已删除' });
  } catch (error) {
    logger.error('Failed to delete DHCP lease:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '删除 DHCP Lease 失败',
    });
  }
}

/**
 * 将动态 Lease 转为静态
 * POST /api/ip/dhcp-server/leases/:id/make-static
 */
export async function makeDhcpLeaseStatic(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: '缺少 DHCP Lease ID' });
      return;
    }

    await routerosClient.set<any>(IP_DHCP_SERVER_LEASE_PATH, id, { dynamic: 'false' });
    res.json({ success: true, message: 'DHCP Lease 已转为静态' });
  } catch (error) {
    logger.error('Failed to make DHCP lease static:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '转换 DHCP Lease 失败',
    });
  }
}


// ==================== Socks (Socksify) 相关 ====================

/**
 * 获取所有 Socks 配置
 * GET /api/ip/socks
 */
export async function getAllSocks(_req: Request, res: Response): Promise<void> {
  try {
    const socks = await routerosClient.print<any>(IP_SOCKS_PATH);
    res.json({ success: true, data: socks });
  } catch (error) {
    logger.error('Failed to get socks:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取 Socks 列表失败',
    });
  }
}

/**
 * 添加 Socks 配置
 * POST /api/ip/socks
 */
export async function addSocks(req: Request, res: Response): Promise<void> {
  try {
    const socksData = req.body;
    
    if (!socksData.name) {
      res.status(400).json({ success: false, error: '缺少必填字段：name' });
      return;
    }

    const newSocks = await routerosClient.add<any>(IP_SOCKS_PATH, socksData);
    res.status(201).json({ success: true, data: newSocks, message: 'Socks 已添加' });
  } catch (error) {
    logger.error('Failed to add socks:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '添加 Socks 失败',
    });
  }
}

/**
 * 更新 Socks 配置
 * PATCH /api/ip/socks/:id
 */
export async function updateSocks(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    if (!id) {
      res.status(400).json({ success: false, error: '缺少 Socks ID' });
      return;
    }

    const updatedSocks = await routerosClient.set<any>(IP_SOCKS_PATH, id, updateData);
    res.json({ success: true, data: updatedSocks, message: 'Socks 已更新' });
  } catch (error) {
    logger.error('Failed to update socks:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '更新 Socks 失败',
    });
  }
}

/**
 * 删除 Socks 配置
 * DELETE /api/ip/socks/:id
 */
export async function deleteSocks(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: '缺少 Socks ID' });
      return;
    }

    await routerosClient.remove(IP_SOCKS_PATH, id);
    res.json({ success: true, message: 'Socks 已删除' });
  } catch (error) {
    logger.error('Failed to delete socks:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '删除 Socks 失败',
    });
  }
}

/**
 * 启用 Socks
 * POST /api/ip/socks/:id/enable
 */
export async function enableSocks(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: '缺少 Socks ID' });
      return;
    }

    await routerosClient.enable(IP_SOCKS_PATH, id);
    res.json({ success: true, message: 'Socks 已启用' });
  } catch (error) {
    logger.error('Failed to enable socks:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '启用 Socks 失败',
    });
  }
}

/**
 * 禁用 Socks
 * POST /api/ip/socks/:id/disable
 */
export async function disableSocks(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: '缺少 Socks ID' });
      return;
    }

    await routerosClient.disable(IP_SOCKS_PATH, id);
    res.json({ success: true, message: 'Socks 已禁用' });
  } catch (error) {
    logger.error('Failed to disable socks:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '禁用 Socks 失败',
    });
  }
}

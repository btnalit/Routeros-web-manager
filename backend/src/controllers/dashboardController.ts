/**
 * Dashboard Controller
 * 处理系统资源监控相关的 API 请求
 */

import { Request, Response } from 'express';
import { routerosClient } from '../services/routerosClient';
import { logger } from '../utils/logger';

const RESOURCE_PATH = '/system/resource';

/**
 * 系统资源数据接口
 */
interface SystemResource {
  '.id'?: string;
  'cpu': string;
  'cpu-count': string;
  'cpu-frequency': string;
  'cpu-load': string;
  'architecture-name': string;
  'board-name': string;
  'version': string;
  'build-time': string;
  'uptime': string;
  'total-memory': string;
  'free-memory': string;
  'total-hdd-space': string;
  'free-hdd-space': string;
  'sector-writes-since-reboot'?: string;
  'total-sector-writes'?: string;
}

/**
 * 获取系统资源信息
 * GET /api/dashboard/resource
 */
export async function getSystemResource(_req: Request, res: Response): Promise<void> {
  try {
    const resources = await routerosClient.print<SystemResource>(RESOURCE_PATH);
    
    if (!resources || resources.length === 0) {
      res.status(404).json({
        success: false,
        error: '无法获取系统资源信息',
      });
      return;
    }

    // RouterOS 返回单条记录
    const resource = resources[0];
    
    res.json({
      success: true,
      data: resource,
    });
  } catch (error) {
    logger.error('Failed to get system resource:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取系统资源信息失败',
    });
  }
}

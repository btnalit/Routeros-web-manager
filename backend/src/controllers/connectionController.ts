/**
 * Connection Controller
 * 处理 RouterOS 连接管理相关的 API 请求
 */

import { Request, Response } from 'express';
import { routerosClient } from '../services/routerosClient';
import { configService } from '../services/configService';
import { RouterOSConfig, ConnectionStatus } from '../types';
import { logger } from '../utils/logger';

/**
 * 获取连接状态
 * GET /api/connection/status
 */
export async function getConnectionStatus(_req: Request, res: Response): Promise<void> {
  try {
    const connected = routerosClient.isConnected();
    const config = routerosClient.getConfig();
    
    const status: ConnectionStatus = {
      connected,
      host: config?.host,
      lastConnected: connected ? new Date().toISOString() : undefined,
      config: config || undefined,
    };

    res.json({ success: true, data: status });
  } catch (error) {
    logger.error('Failed to get connection status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取连接状态失败',
    });
  }
}

/**
 * 建立连接
 * POST /api/connection/connect
 */
export async function connect(req: Request, res: Response): Promise<void> {
  try {
    const config: RouterOSConfig = req.body;

    // 验证必填字段
    if (!config.host || !config.username || !config.password) {
      res.status(400).json({
        success: false,
        error: '缺少必填字段：host, username, password',
      });
      return;
    }

    // 设置默认值 - RouterOS API 端口 8728 (普通) / 8729 (SSL)
    config.port = config.port || (config.useTLS ? 8729 : 8728);
    config.useTLS = config.useTLS === true;

    // 尝试连接
    await routerosClient.connect(config);

    // 获取安全配置（不含密码）
    const safeConfig = routerosClient.getConfig();

    res.json({
      success: true,
      data: {
        connected: true,
        host: safeConfig?.host,
        message: '连接成功',
      },
    });
  } catch (error) {
    logger.error('Failed to connect:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : '连接失败',
    });
  }
}


/**
 * 断开连接
 * POST /api/connection/disconnect
 */
export async function disconnect(_req: Request, res: Response): Promise<void> {
  try {
    await routerosClient.disconnect();

    res.json({
      success: true,
      data: {
        connected: false,
        message: '已断开连接',
      },
    });
  } catch (error) {
    logger.error('Failed to disconnect:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '断开连接失败',
    });
  }
}

/**
 * 获取保存的配置
 * GET /api/connection/config
 */
export async function getConfig(_req: Request, res: Response): Promise<void> {
  try {
    const config = await configService.loadConfig();

    if (!config) {
      res.json({
        success: true,
        data: null,
      });
      return;
    }

    // 返回完整配置（包含密码，因为这是本地应用，用于缓存连接配置）
    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    logger.error('Failed to get config:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取配置失败',
    });
  }
}

/**
 * 保存配置
 * POST /api/connection/config
 */
export async function saveConfig(req: Request, res: Response): Promise<void> {
  try {
    const config: RouterOSConfig = req.body;

    // 验证必填字段
    if (!config.host || !config.username || !config.password) {
      res.status(400).json({
        success: false,
        error: '缺少必填字段：host, username, password',
      });
      return;
    }

    // 设置默认值 - RouterOS API 端口 8728 (普通) / 8729 (SSL)
    config.port = config.port || (config.useTLS ? 8729 : 8728);
    config.useTLS = config.useTLS === true;

    // 保存配置
    await configService.saveConfig(config);

    // 返回配置（不含密码）
    const { password, ...safeConfig } = config;
    res.json({
      success: true,
      data: safeConfig,
      message: '配置已保存',
    });
  } catch (error) {
    logger.error('Failed to save config:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '保存配置失败',
    });
  }
}

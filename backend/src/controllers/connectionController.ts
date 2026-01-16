/**
 * Connection Controller (Legacy / Adapter)
 * 适配旧的连接管理 API 到新的 ConnectionPool 和 DeviceService
 */

import { Request, Response } from 'express';
import { connectionPool } from '../services/connectionPool';
import { deviceService } from '../services/deviceService';
import { logger } from '../utils/logger';

// 兼容性辅助函数：获取默认设备 ID
// 如果请求中没有指定 deviceId，且系统中只有一个设备，则使用该设备
// 如果有多个设备，尝试使用 "default" 或列表中的第一个
async function getDefaultDeviceId(): Promise<string | undefined> {
  const devices = await deviceService.getAllDevices();
  if (devices.length === 0) return undefined;
  // 简单策略：返回第一个设备
  // 在实际多设备场景中，这只是一个临时回退机制
  return devices[0].id;
}

/**
 * 获取连接状态
 * GET /api/connection/status
 */
export async function getConnectionStatus(req: Request, res: Response): Promise<void> {
  try {
    const deviceId = (req.query.deviceId as string) || await getDefaultDeviceId();
    
    if (!deviceId) {
      res.json({ success: true, data: { connected: false, error: 'No devices configured' } });
      return;
    }

    const status = await connectionPool.getStatus(deviceId);
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
 *
 * 旧逻辑：接收 { host, user... } 并连接单例
 * 新逻辑：如果是纯连接请求，需要 deviceId。如果是为了临时连接（不保存），则暂不支持或作为临时设备处理。
 * 为了兼容，如果收到完整配置，我们可能需要创建一个临时设备或查找匹配设备。
 * 但更简单的做法是：此接口现在仅支持通过 deviceId 连接已保存的设备。
 *
 * 如果请求体包含 host/user/password，我们可以尝试查找匹配的设备，或者将其添加为新设备并连接。
 */
export async function connect(req: Request, res: Response): Promise<void> {
  try {
    const { deviceId, host, username, password, port, useTLS } = req.body;
    let targetDeviceId = deviceId;

    // 兼容旧前端行为：如果传了 host/user/pass 但没传 deviceId
    if (!targetDeviceId && host && username && password) {
      // 检查是否存在相同的设备
      const devices = await deviceService.getAllDevices();
      const existing = devices.find(d => d.host === host && d.username === username);

      if (existing) {
        targetDeviceId = existing.id;
      } else {
        // 自动创建新设备
        const newDevice = await deviceService.addDevice({
          name: host,
          host,
          port: port || (useTLS ? 8729 : 8728),
          username,
          password,
          useTLS: !!useTLS
        });
        targetDeviceId = newDevice.id;
      }
    }

    if (!targetDeviceId) {
      targetDeviceId = await getDefaultDeviceId();
    }

    if (!targetDeviceId) {
      res.status(400).json({ success: false, error: 'Cannot determine device to connect' });
      return;
    }

    const client = await connectionPool.getClient(targetDeviceId);
    const connected = client.isConnected();
    const config = client.getConfig();

    res.json({
      success: true,
      data: {
        connected,
        host: config?.host,
        message: connected ? '连接成功' : '连接失败',
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
export async function disconnect(req: Request, res: Response): Promise<void> {
  try {
    const deviceId = req.body.deviceId || await getDefaultDeviceId();

    if (deviceId) {
      await connectionPool.disconnect(deviceId);
    }

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
 * @deprecated 建议使用 /api/devices/:id
 */
export async function getConfig(req: Request, res: Response): Promise<void> {
  try {
    const deviceId = (req.query.deviceId as string) || await getDefaultDeviceId();

    if (!deviceId) {
      res.json({ success: true, data: null });
      return;
    }

    const device = await deviceService.getDeviceById(deviceId);
    res.json({ success: true, data: device });
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
 * @deprecated 建议使用 POST /api/devices
 */
export async function saveConfig(req: Request, res: Response): Promise<void> {
  try {
    // 转发给 connect 处理，connect 会自动保存
    await connect(req, res);
  } catch (error) {
    logger.error('Failed to save config:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '保存配置失败',
    });
  }
}

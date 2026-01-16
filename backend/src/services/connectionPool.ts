/**
 * Connection Pool
 * 管理多设备连接池
 */

import { RouterOSClient } from './routerosClient';
import { deviceService } from './deviceService';
import { logger } from '../utils/logger';

export class ConnectionPool {
  private clients: Map<string, RouterOSClient> = new Map();
  private lastActivity: Map<string, number> = new Map();
  private readonly IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // 启动定时清理任务
    setInterval(() => this.cleanupIdleConnections(), this.CLEANUP_INTERVAL);
  }

  /**
   * 获取设备连接客户端
   * 如果连接不存在或已断开，会自动尝试重新连接
   */
  async getClient(deviceId: string): Promise<RouterOSClient> {
    this.lastActivity.set(deviceId, Date.now());

    let client = this.clients.get(deviceId);

    // 如果客户端不存在，创建新实例
    if (!client) {
      client = new RouterOSClient(deviceId);
      this.clients.set(deviceId, client);
    }

    // 如果未连接，尝试连接
    if (!client.isConnected()) {
      const device = await deviceService.getDeviceById(deviceId);
      if (!device) {
        throw new Error(`Device not found: ${deviceId}`);
      }

      logger.info(`Connecting to device ${device.name} (${device.host})...`);
      await client.connect({
        host: device.host,
        port: device.port,
        username: device.username,
        password: device.password,
        useTLS: device.useTLS,
      });
    }

    return client;
  }

  /**
   * 强制断开指定设备的连接
   */
  async disconnect(deviceId: string): Promise<void> {
    const client = this.clients.get(deviceId);
    if (client) {
      await client.disconnect();
      this.clients.delete(deviceId);
      this.lastActivity.delete(deviceId);
      logger.info(`Forced disconnect for device ${deviceId}`);
    }
  }

  /**
   * 断开所有连接
   */
  async disconnectAll(): Promise<void> {
    for (const [deviceId, client] of this.clients.entries()) {
      try {
        await client.disconnect();
      } catch (error) {
        logger.error(`Error disconnecting device ${deviceId}:`, error);
      }
    }
    this.clients.clear();
    this.lastActivity.clear();
  }

  /**
   * 获取连接状态
   */
  async getStatus(deviceId: string) {
    const client = this.clients.get(deviceId);
    const device = await deviceService.getDeviceById(deviceId);

    if (!device) return { connected: false, error: 'Device not found' };

    const connected = client ? client.isConnected() : false;

    return {
      connected,
      deviceId,
      host: device.host,
      lastConnected: connected ? new Date().toISOString() : undefined,
      config: {
        host: device.host,
        port: device.port,
        username: device.username,
        useTLS: device.useTLS,
      }
    };
  }

  /**
   * 清理空闲连接
   */
  private async cleanupIdleConnections() {
    const now = Date.now();
    for (const [deviceId, lastTime] of this.lastActivity.entries()) {
      if (now - lastTime > this.IDLE_TIMEOUT) {
        logger.info(`Closing idle connection for device ${deviceId}`);
        await this.disconnect(deviceId);
      }
    }
  }
}

// 导出单例
export const connectionPool = new ConnectionPool();

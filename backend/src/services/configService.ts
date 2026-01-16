/**
 * Config Service
 * 处理设备配置的持久化存储
 * 支持从旧的单配置模式迁移到多设备模式
 */

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Device, RouterOSConfig } from '../types';
import { logger } from '../utils/logger';

const CONFIG_DIR = path.join(process.cwd(), 'data');
const CONFIG_FILE = path.join(CONFIG_DIR, 'devices.json');
const OLD_CONFIG_FILE = path.join(CONFIG_DIR, 'connection.json');

export class ConfigService {
  /**
   * 确保配置目录存在
   */
  private async ensureConfigDir(): Promise<void> {
    try {
      await fs.access(CONFIG_DIR);
    } catch {
      await fs.mkdir(CONFIG_DIR, { recursive: true });
      logger.info(`Created config directory: ${CONFIG_DIR}`);
    }
  }

  /**
   * 加载设备列表
   * 自动处理从旧 connection.json 的迁移
   */
  async loadDevices(): Promise<Device[]> {
    await this.ensureConfigDir();

    // 1. 尝试读取 devices.json
    try {
      const data = await fs.readFile(CONFIG_FILE, 'utf-8');
      const devices = JSON.parse(data) as Device[];
      return devices;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.error('Failed to load devices config:', error);
        throw new Error('加载设备配置失败');
      }
    }

    // 2. 如果 devices.json 不存在，尝试迁移 connection.json
    try {
      const oldData = await fs.readFile(OLD_CONFIG_FILE, 'utf-8');
      const oldConfig = JSON.parse(oldData) as RouterOSConfig;

      logger.info('Migrating old connection config to devices format...');

      const newDevice: Device = {
        id: uuidv4(),
        name: oldConfig.host || 'Default Router',
        host: oldConfig.host,
        port: oldConfig.port,
        username: oldConfig.username,
        password: oldConfig.password,
        useTLS: oldConfig.useTLS,
      };

      const devices = [newDevice];
      await this.saveDevices(devices);

      // 也可以选择重命名旧文件以备份
      // await fs.rename(OLD_CONFIG_FILE, `${OLD_CONFIG_FILE}.migrated`);

      return devices;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // 两个文件都不存在，返回空列表
        return [];
      }
      logger.error('Failed to migrate old config:', error);
    }

    return [];
  }

  /**
   * 保存设备列表
   */
  async saveDevices(devices: Device[]): Promise<void> {
    try {
      await this.ensureConfigDir();
      const data = JSON.stringify(devices, null, 2);
      await fs.writeFile(CONFIG_FILE, data, 'utf-8');
      logger.info(`Saved ${devices.length} devices to file`);
    } catch (error) {
      logger.error('Failed to save devices config:', error);
      throw new Error('保存设备配置失败');
    }
  }

  /**
   * 获取单个设备配置
   */
  async getDevice(id: string): Promise<Device | undefined> {
    const devices = await this.loadDevices();
    return devices.find(d => d.id === id);
  }

  /**
   * 添加或更新设备
   */
  async upsertDevice(device: Device): Promise<void> {
    const devices = await this.loadDevices();
    const index = devices.findIndex(d => d.id === device.id);

    if (index >= 0) {
      devices[index] = device;
    } else {
      devices.push(device);
    }

    await this.saveDevices(devices);
  }

  /**
   * 删除设备
   */
  async removeDevice(id: string): Promise<void> {
    const devices = await this.loadDevices();
    const filtered = devices.filter(d => d.id !== id);
    await this.saveDevices(filtered);
  }
}

// 导出单例
export const configService = new ConfigService();

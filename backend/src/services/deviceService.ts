/**
 * Device Service
 * 设备管理的业务逻辑层
 */

import { v4 as uuidv4 } from 'uuid';
import { Device } from '../types';
import { configService } from './configService';
import { logger } from '../utils/logger';

export class DeviceService {
  /**
   * 获取所有设备
   */
  async getAllDevices(): Promise<Omit<Device, 'password'>[]> {
    const devices = await configService.loadDevices();
    return devices.map(({ password, ...rest }) => rest);
  }

  /**
   * 获取指定设备（包含密码，仅内部使用）
   */
  async getDeviceById(id: string): Promise<Device | undefined> {
    return await configService.getDevice(id);
  }

  /**
   * 添加设备
   */
  async addDevice(deviceData: Omit<Device, 'id'>): Promise<Device> {
    const newDevice: Device = {
      ...deviceData,
      id: uuidv4(),
    };

    await configService.upsertDevice(newDevice);
    logger.info(`Added new device: ${newDevice.name} (${newDevice.host})`);
    return newDevice;
  }

  /**
   * 更新设备
   */
  async updateDevice(id: string, deviceData: Partial<Device>): Promise<Device | null> {
    const existing = await configService.getDevice(id);
    if (!existing) {
      return null;
    }

    const updatedDevice: Device = {
      ...existing,
      ...deviceData,
      id, // 确保 ID 不变
    };

    // 如果密码为空字符串，保留原密码（假设前端不传密码表示不修改）
    if (deviceData.password === '') {
      updatedDevice.password = existing.password;
    }

    await configService.upsertDevice(updatedDevice);
    logger.info(`Updated device: ${updatedDevice.name}`);
    return updatedDevice;
  }

  /**
   * 删除设备
   */
  async deleteDevice(id: string): Promise<boolean> {
    const existing = await configService.getDevice(id);
    if (!existing) {
      return false;
    }

    await configService.removeDevice(id);
    logger.info(`Deleted device: ${existing.name}`);
    return true;
  }
}

export const deviceService = new DeviceService();

/**
 * Config Service
 * 处理连接配置的持久化存储
 */

import fs from 'fs/promises';
import path from 'path';
import { RouterOSConfig } from '../types';
import { logger } from '../utils/logger';

const CONFIG_DIR = path.join(process.cwd(), 'data');
const CONFIG_FILE = path.join(CONFIG_DIR, 'connection.json');

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
   * 加载保存的配置
   * @returns 配置对象或 null
   */
  async loadConfig(): Promise<RouterOSConfig | null> {
    try {
      await this.ensureConfigDir();
      const data = await fs.readFile(CONFIG_FILE, 'utf-8');
      const config = JSON.parse(data) as RouterOSConfig;
      logger.info('Loaded connection config from file');
      return config;
    } catch (error) {
      // 文件不存在是正常情况
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.info('No saved connection config found');
        return null;
      }
      logger.error('Failed to load config:', error);
      throw new Error('加载配置失败');
    }
  }

  /**
   * 保存配置到文件
   * @param config 配置对象
   */
  async saveConfig(config: RouterOSConfig): Promise<void> {
    try {
      await this.ensureConfigDir();
      const data = JSON.stringify(config, null, 2);
      await fs.writeFile(CONFIG_FILE, data, 'utf-8');
      logger.info('Saved connection config to file');
    } catch (error) {
      logger.error('Failed to save config:', error);
      throw new Error('保存配置失败');
    }
  }

  /**
   * 删除保存的配置
   */
  async deleteConfig(): Promise<void> {
    try {
      await fs.unlink(CONFIG_FILE);
      logger.info('Deleted connection config file');
    } catch (error) {
      // 文件不存在是正常情况
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.error('Failed to delete config:', error);
        throw new Error('删除配置失败');
      }
    }
  }
}

// 导出单例实例
export const configService = new ConfigService();

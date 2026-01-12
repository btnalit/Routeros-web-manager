/**
 * APIConfigService - API 配置管理服务
 *
 * 管理 AI 提供商的 API 配置，包括：
 * - CRUD 操作（创建、读取、更新、删除）
 * - 默认提供商管理
 * - API Key 加密存储和掩码显示
 *
 * Requirements: 1.1, 1.4, 1.5, 1.6, 1.7
 */

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  APIConfig,
  CreateAPIConfigInput,
  UpdateAPIConfigInput,
  APIConfigDisplay,
  IAPIConfigService,
  AIAgentData,
  AIAgentSettings,
  AIProvider,
} from '../../types/ai';
import { CryptoService, cryptoService } from './cryptoService';
import { logger } from '../../utils/logger';

/**
 * 数据文件路径配置
 */
const DATA_DIR = path.join(process.cwd(), 'data');
const AI_DATA_FILE = path.join(DATA_DIR, 'ai-agent.json');

/**
 * 默认 AI Agent 设置
 */
const DEFAULT_SETTINGS: AIAgentSettings = {
  rateLimitPerMinute: 60,
  maxContextTokens: 4096,
};

/**
 * 默认 AI Agent 数据结构
 */
const DEFAULT_AI_DATA: AIAgentData = {
  apiConfigs: [],
  sessions: [],
  scriptHistory: [],
  settings: DEFAULT_SETTINGS,
};

/**
 * APIConfigService 实现类
 *
 * 提供 API 配置的完整 CRUD 功能和默认提供商管理
 */
export class APIConfigService implements IAPIConfigService {
  private readonly crypto: CryptoService;

  /**
   * 创建 APIConfigService 实例
   * @param cryptoService 加密服务实例（可选，默认使用全局单例）
   */
  constructor(cryptoServiceInstance?: CryptoService) {
    this.crypto = cryptoServiceInstance || cryptoService;
  }

  /**
   * 确保数据目录存在
   */
  private async ensureDataDir(): Promise<void> {
    try {
      await fs.access(DATA_DIR);
    } catch {
      await fs.mkdir(DATA_DIR, { recursive: true });
      logger.info(`Created AI data directory: ${DATA_DIR}`);
    }
  }

  /**
   * 加载 AI Agent 数据
   */
  private async loadData(): Promise<AIAgentData> {
    try {
      await this.ensureDataDir();
      const data = await fs.readFile(AI_DATA_FILE, 'utf-8');
      const parsed = JSON.parse(data) as AIAgentData;
      
      // 转换日期字符串为 Date 对象
      parsed.apiConfigs = parsed.apiConfigs.map(config => ({
        ...config,
        createdAt: new Date(config.createdAt),
        updatedAt: new Date(config.updatedAt),
      }));
      
      return parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.info('No AI agent data file found, using defaults');
        return { ...DEFAULT_AI_DATA };
      }
      logger.error('Failed to load AI agent data:', error);
      throw new Error('加载 AI 配置数据失败');
    }
  }

  /**
   * 保存 AI Agent 数据
   */
  private async saveData(data: AIAgentData): Promise<void> {
    try {
      await this.ensureDataDir();
      const jsonData = JSON.stringify(data, null, 2);
      await fs.writeFile(AI_DATA_FILE, jsonData, 'utf-8');
      logger.info('Saved AI agent data to file');
    } catch (error) {
      logger.error('Failed to save AI agent data:', error);
      throw new Error('保存 AI 配置数据失败');
    }
  }

  /**
   * 掩码 API Key，只显示最后 4 个字符
   *
   * @param apiKey 原始 API Key
   * @returns 掩码后的 API Key
   */
  maskApiKey(apiKey: string): string {
    if (!apiKey || apiKey.length < 4) {
      return '****';
    }
    const lastFour = apiKey.slice(-4);
    const maskedLength = apiKey.length - 4;
    return '*'.repeat(maskedLength) + lastFour;
  }

  /**
   * 将 APIConfig 转换为显示格式（API Key 已掩码）
   */
  private toDisplayFormat(config: APIConfig): APIConfigDisplay {
    // 解密 API Key 以获取掩码版本
    let decryptedKey: string;
    try {
      decryptedKey = this.crypto.decrypt(config.apiKey);
    } catch {
      decryptedKey = '';
    }

    const { apiKey, ...rest } = config;
    return {
      ...rest,
      apiKeyMasked: this.maskApiKey(decryptedKey),
    };
  }

  /**
   * 创建新的 API 配置
   *
   * @param input 配置输入数据
   * @returns 创建的配置（包含生成的 ID 和时间戳）
   */
  async create(input: CreateAPIConfigInput): Promise<APIConfig> {
    const data = await this.loadData();
    const now = new Date();

    // 加密 API Key
    const encryptedApiKey = this.crypto.encrypt(input.apiKey);

    // 如果设置为默认，清除其他配置的默认状态
    if (input.isDefault) {
      data.apiConfigs = data.apiConfigs.map(config => ({
        ...config,
        isDefault: false,
        updatedAt: now,
      }));
    }

    const newConfig: APIConfig = {
      ...input,
      id: uuidv4(),
      apiKey: encryptedApiKey,
      createdAt: now,
      updatedAt: now,
    };

    data.apiConfigs.push(newConfig);

    // 如果是默认配置，更新设置
    if (input.isDefault) {
      data.settings.defaultProviderId = newConfig.id;
    }

    await this.saveData(data);
    logger.info(`Created API config: ${newConfig.id} (${newConfig.provider})`);

    return newConfig;
  }

  /**
   * 更新现有的 API 配置
   *
   * @param id 配置 ID
   * @param updates 要更新的字段
   * @returns 更新后的配置
   * @throws Error 如果配置不存在
   */
  async update(id: string, updates: UpdateAPIConfigInput): Promise<APIConfig> {
    const data = await this.loadData();
    const index = data.apiConfigs.findIndex(config => config.id === id);

    if (index === -1) {
      throw new Error(`API 配置不存在: ${id}`);
    }

    const now = new Date();

    // 如果更新 API Key，需要加密
    let processedUpdates = { ...updates };
    if (updates.apiKey) {
      processedUpdates.apiKey = this.crypto.encrypt(updates.apiKey);
    }

    // 如果设置为默认，清除其他配置的默认状态
    if (updates.isDefault) {
      data.apiConfigs = data.apiConfigs.map(config => ({
        ...config,
        isDefault: config.id === id ? true : false,
        updatedAt: config.id === id ? now : config.updatedAt,
      }));
      data.settings.defaultProviderId = id;
    }

    // 更新配置
    const updatedConfig: APIConfig = {
      ...data.apiConfigs[index],
      ...processedUpdates,
      updatedAt: now,
    };

    data.apiConfigs[index] = updatedConfig;
    await this.saveData(data);
    logger.info(`Updated API config: ${id}`);

    return updatedConfig;
  }

  /**
   * 删除 API 配置
   *
   * @param id 配置 ID
   * @throws Error 如果配置不存在
   */
  async delete(id: string): Promise<void> {
    const data = await this.loadData();
    const index = data.apiConfigs.findIndex(config => config.id === id);

    if (index === -1) {
      throw new Error(`API 配置不存在: ${id}`);
    }

    // 如果删除的是默认配置，清除默认设置
    if (data.apiConfigs[index].isDefault) {
      data.settings.defaultProviderId = undefined;
    }

    data.apiConfigs.splice(index, 1);
    await this.saveData(data);
    logger.info(`Deleted API config: ${id}`);
  }

  /**
   * 获取所有 API 配置（显示格式，API Key 已掩码）
   *
   * @returns 所有配置的数组
   */
  async getAll(): Promise<APIConfig[]> {
    const data = await this.loadData();
    return data.apiConfigs;
  }

  /**
   * 获取所有 API 配置的显示格式
   *
   * @returns 所有配置的显示格式数组
   */
  async getAllDisplay(): Promise<APIConfigDisplay[]> {
    const data = await this.loadData();
    return data.apiConfigs.map(config => this.toDisplayFormat(config));
  }

  /**
   * 根据 ID 获取 API 配置
   *
   * @param id 配置 ID
   * @returns 配置对象或 null
   */
  async getById(id: string): Promise<APIConfig | null> {
    const data = await this.loadData();
    return data.apiConfigs.find(config => config.id === id) || null;
  }

  /**
   * 根据 ID 获取 API 配置的显示格式
   *
   * @param id 配置 ID
   * @returns 配置显示对象或 null
   */
  async getByIdDisplay(id: string): Promise<APIConfigDisplay | null> {
    const config = await this.getById(id);
    return config ? this.toDisplayFormat(config) : null;
  }

  /**
   * 获取默认 API 配置
   *
   * @returns 默认配置或 null
   */
  async getDefault(): Promise<APIConfig | null> {
    const data = await this.loadData();
    
    // 首先尝试通过设置中的 defaultProviderId 查找
    if (data.settings.defaultProviderId) {
      const config = data.apiConfigs.find(
        c => c.id === data.settings.defaultProviderId
      );
      if (config) return config;
    }

    // 否则查找 isDefault 为 true 的配置
    return data.apiConfigs.find(config => config.isDefault) || null;
  }

  /**
   * 设置默认 API 配置
   *
   * @param id 要设为默认的配置 ID
   * @throws Error 如果配置不存在
   */
  async setDefault(id: string): Promise<void> {
    const data = await this.loadData();
    const targetConfig = data.apiConfigs.find(config => config.id === id);

    if (!targetConfig) {
      throw new Error(`API 配置不存在: ${id}`);
    }

    const now = new Date();

    // 清除所有配置的默认状态，然后设置目标配置为默认
    data.apiConfigs = data.apiConfigs.map(config => ({
      ...config,
      isDefault: config.id === id,
      updatedAt: config.id === id ? now : config.updatedAt,
    }));

    data.settings.defaultProviderId = id;
    await this.saveData(data);
    logger.info(`Set default API config: ${id}`);
  }

  /**
   * 测试 API 配置的连接
   *
   * 注意：实际的连接测试需要对应的适配器实现
   * 此方法目前只验证配置是否存在且 API Key 可解密
   *
   * @param id 配置 ID
   * @returns 连接是否成功
   */
  async testConnection(id: string): Promise<boolean> {
    const config = await this.getById(id);
    
    if (!config) {
      throw new Error(`API 配置不存在: ${id}`);
    }

    try {
      // 验证 API Key 可以解密
      this.crypto.decrypt(config.apiKey);
      
      // TODO: 实际的 API 连接测试将在适配器实现后添加
      // 目前只返回 true 表示配置有效
      logger.info(`Tested API config connection: ${id} - success`);
      return true;
    } catch (error) {
      logger.error(`API config connection test failed: ${id}`, error);
      return false;
    }
  }

  /**
   * 获取解密后的 API Key
   *
   * @param id 配置 ID
   * @returns 解密后的 API Key
   * @throws Error 如果配置不存在或解密失败
   */
  async getDecryptedApiKey(id: string): Promise<string> {
    const config = await this.getById(id);
    
    if (!config) {
      throw new Error(`API 配置不存在: ${id}`);
    }

    return this.crypto.decrypt(config.apiKey);
  }

  /**
   * 根据提供商类型获取配置列表
   *
   * @param provider 提供商类型
   * @returns 该提供商的所有配置
   */
  async getByProvider(provider: AIProvider): Promise<APIConfig[]> {
    const data = await this.loadData();
    return data.apiConfigs.filter(config => config.provider === provider);
  }
}

/**
 * 默认 APIConfigService 单例实例
 */
export const apiConfigService = new APIConfigService();

export default apiConfigService;

/**
 * RouterOS API Client
 * 使用 node-routeros 库通过 RouterOS API 协议通信
 * 端口 8728 (普通) / 8729 (SSL)
 */

import { RouterOSAPI, RosException } from 'node-routeros';
import { RouterOSConfig } from '../types';
import { logger } from '../utils/logger';

export class RouterOSClient {
  private api: RouterOSAPI | null = null;
  private config: RouterOSConfig | null = null;
  private connected: boolean = false;

  /**
   * 建立与 RouterOS 的连接
   * @param config 连接配置
   * @returns 连接是否成功
   */
  async connect(config: RouterOSConfig): Promise<boolean> {
    try {
      // 如果已有连接，先断开
      if (this.api) {
        try {
          this.api.close();
        } catch {
          // 忽略
        }
      }

      // 创建 RouterOS API 客户端 - 不设置 timeout，使用网络自然超时
      this.api = new RouterOSAPI({
        host: config.host,
        port: config.port,
        user: config.username,
        password: config.password,
        tls: config.useTLS ? {
          rejectUnauthorized: false,
        } : undefined,
        keepalive: true,
      });

      // 监听连接关闭事件
      this.api.on('close', () => {
        logger.warn('RouterOS connection closed');
        this.connected = false;
      });

      this.api.on('error', (err) => {
        logger.error('RouterOS connection error:', err);
        this.connected = false;
      });

      // 建立连接
      await this.api.connect();

      // 测试连接 - 获取系统资源信息
      const result = await this.api.write('/system/resource/print');
      logger.info('Connection test successful, resources:', result?.length || 0);

      this.config = config;
      this.connected = true;
      logger.info(`Connected to RouterOS at ${config.host}:${config.port}`);
      return true;
    } catch (error) {
      this.connected = false;
      if (this.api) {
        try {
          this.api.close();
        } catch {
          // 忽略关闭错误
        }
      }
      this.api = null;
      this.config = null;
      
      const errorMessage = this.parseError(error);
      logger.error(`Failed to connect to RouterOS: ${errorMessage}`);
      throw new Error(errorMessage);
    }
  }

  /**
   * 断开与 RouterOS 的连接
   */
  async disconnect(): Promise<void> {
    if (this.api) {
      try {
        this.api.close();
      } catch {
        // 忽略关闭错误
      }
    }
    this.api = null;
    this.config = null;
    this.connected = false;
    logger.info('Disconnected from RouterOS');
  }

  /**
   * 检查是否已连接
   * @returns 连接状态
   */
  isConnected(): boolean {
    if (!this.api || !this.connected) {
      return false;
    }
    // 检查 api 的 connected 属性（如果存在）
    try {
      return this.api.connected === true;
    } catch {
      return this.connected;
    }
  }

  /**
   * 获取当前连接配置
   * @returns 连接配置（不含密码）
   */
  getConfig(): Omit<RouterOSConfig, 'password'> | null {
    if (!this.config) return null;
    const { password, ...safeConfig } = this.config;
    return safeConfig;
  }

  /**
   * 执行 print 命令获取资源列表
   * @param path API 路径，如 /interface
   * @param query 可选的查询参数
   * @returns 响应数据数组
   */
  async print<T>(path: string, query?: Record<string, string>): Promise<T[]> {
    this.ensureConnected();
    try {
      const command = `${path}/print`;
      const params: string[] = [];
      
      if (query) {
        Object.entries(query).forEach(([key, value]) => {
          params.push(`?${key}=${value}`);
        });
      }

      logger.info(`Executing command: ${command}, params: ${JSON.stringify(params)}`);
      const response = await this.api!.write(command, params);
      
      // 详细记录响应信息用于调试
      logger.info(`Response raw: ${JSON.stringify(response)}`);
      logger.info(`Response type: ${typeof response}, isArray: ${Array.isArray(response)}`);
      
      // node-routeros 返回的是数组
      if (!response) {
        logger.warn('Response is null/undefined, returning empty array');
        return [];
      }
      
      // 确保返回数组
      let result: T[];
      if (Array.isArray(response)) {
        result = response as T[];
      } else if (typeof response === 'object') {
        // 如果是单个对象，包装成数组
        logger.warn('Response is object, wrapping in array');
        result = [response as T];
      } else {
        logger.warn(`Unexpected response type: ${typeof response}, returning empty array`);
        return [];
      }
      
      logger.info(`Returning ${result.length} items`);
      return result;
    } catch (error: any) {
      // 处理 RouterOS 返回 !empty 的情况（表示没有数据）
      // RosException 或普通 Error 都可能包含这个信息
      const errorMessage = error?.message || String(error);
      if (errorMessage.includes('!empty') || 
          errorMessage.includes('UNKNOWNREPLY') ||
          error?.errno === 'UNKNOWNREPLY') {
        logger.info('RouterOS returned empty result, returning empty array');
        return [];
      }
      
      const errMsg = this.parseError(error);
      logger.error(`Print command failed: ${errMsg}`);
      
      // 如果是连接断开，更新状态
      if (errMsg.includes('连接') || errMsg.includes('connect') || errMsg.includes('closed') || errMsg.includes('socket')) {
        this.connected = false;
      }
      throw new Error(errMsg);
    }
  }

  /**
   * 获取单个资源
   * @param path API 路径
   * @param id 资源 ID
   * @returns 响应数据
   */
  async getById<T>(path: string, id: string): Promise<T | null> {
    this.ensureConnected();
    try {
      const command = `${path}/print`;
      // RouterOS API 查询语法：?.id=*1
      const response = await this.api!.write(command, [`?.id=${id}`]);
      
      if (!response) return null;
      if (Array.isArray(response) && response.length > 0) {
        return response[0] as T;
      }
      return null;
    } catch (error: any) {
      // 处理 RouterOS 返回 !empty 的情况（表示没有数据）
      const errorMessage = error?.message || String(error);
      if (errorMessage.includes('!empty') || 
          errorMessage.includes('UNKNOWNREPLY') ||
          error?.errno === 'UNKNOWNREPLY') {
        return null;
      }
      throw new Error(this.parseError(error));
    }
  }

  /**
   * 添加新资源
   * @param path API 路径
   * @param data 资源数据
   * @returns 新资源
   */
  async add<T>(path: string, data: Record<string, unknown>): Promise<T> {
    this.ensureConnected();
    try {
      const command = `${path}/add`;
      const params = this.objectToParams(data);
      logger.info(`Add command: ${command}, params: ${JSON.stringify(params)}`);
      const response = await this.api!.write(command, params);
      logger.info(`Add response: ${JSON.stringify(response)}`);
      
      // 返回新创建的资源
      if (response && Array.isArray(response) && response.length > 0 && response[0].ret) {
        const newId = response[0].ret;
        const created = await this.getById<T>(path, newId);
        if (created) return created;
      }
      
      // 如果没有返回 ID，尝试返回响应
      if (response && Array.isArray(response) && response.length > 0) {
        return response[0] as T;
      }
      
      return {} as T;
    } catch (error) {
      throw new Error(this.parseError(error));
    }
  }

  /**
   * 更新资源
   * @param path API 路径
   * @param id 资源 ID
   * @param data 更新数据
   * @returns 更新后的资源
   */
  async set<T>(path: string, id: string, data: Record<string, unknown>): Promise<T> {
    this.ensureConnected();
    try {
      const command = `${path}/set`;
      const params = [`=.id=${id}`, ...this.objectToParams(data)];
      await this.api!.write(command, params);
      
      // 返回更新后的资源
      const updated = await this.getById<T>(path, id);
      if (!updated) {
        throw new Error('资源不存在或已被删除');
      }
      return updated;
    } catch (error) {
      throw new Error(this.parseError(error));
    }
  }

  /**
   * 删除资源
   * @param path API 路径
   * @param id 资源 ID
   */
  async remove(path: string, id: string): Promise<void> {
    this.ensureConnected();
    try {
      const command = `${path}/remove`;
      await this.api!.write(command, [`=.id=${id}`]);
    } catch (error) {
      throw new Error(this.parseError(error));
    }
  }

  /**
   * 启用资源
   * @param path API 路径
   * @param id 资源 ID
   */
  async enable(path: string, id: string): Promise<void> {
    this.ensureConnected();
    try {
      const command = `${path}/enable`;
      await this.api!.write(command, [`=.id=${id}`]);
    } catch (error) {
      throw new Error(this.parseError(error));
    }
  }

  /**
   * 禁用资源
   * @param path API 路径
   * @param id 资源 ID
   */
  async disable(path: string, id: string): Promise<void> {
    this.ensureConnected();
    try {
      const command = `${path}/disable`;
      await this.api!.write(command, [`=.id=${id}`]);
    } catch (error) {
      throw new Error(this.parseError(error));
    }
  }

  /**
   * 运行脚本
   * @param id 脚本 ID
   */
  async runScript(id: string): Promise<void> {
    this.ensureConnected();
    try {
      await this.api!.write('/system/script/run', [`=.id=${id}`]);
    } catch (error) {
      throw new Error(this.parseError(error));
    }
  }

  /**
   * 确保已连接
   */
  private ensureConnected(): void {
    if (!this.api || !this.connected) {
      this.connected = false;
      throw new Error('Not connected to RouterOS');
    }
    // 额外检查 api.connected
    try {
      if (this.api.connected === false) {
        this.connected = false;
        throw new Error('Not connected to RouterOS');
      }
    } catch {
      // 忽略属性访问错误
    }
  }

  /**
   * 将对象转换为 API 参数格式
   */
  private objectToParams(data: Record<string, unknown>): string[] {
    const params: string[] = [];
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        // 保持原始 key 格式（RouterOS 使用 kebab-case）
        params.push(`=${key}=${String(value)}`);
      }
    });
    return params;
  }

  /**
   * 解析错误信息
   * @param error 错误对象
   * @returns 错误消息
   */
  private parseError(error: unknown): string {
    if (error instanceof RosException) {
      const message = error.message.toLowerCase();
      
      if (message.includes('cannot log in') || message.includes('invalid user')) {
        return '用户名或密码错误';
      }
      if (message.includes('no such command') || message.includes('no such item')) {
        return '命令不存在或资源未找到';
      }
      
      return error.message;
    }
    
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      if (message.includes('econnrefused')) {
        return '无法连接到 RouterOS，请检查网络和端口';
      }
      if (message.includes('etimedout') || message.includes('timeout')) {
        return '连接超时，请检查地址和端口';
      }
      if (message.includes('enotfound')) {
        return '无法解析主机地址';
      }
      if (message.includes('cannot log in') || message.includes('invalid user') || message.includes('login failure')) {
        return '用户名或密码错误';
      }
      if (message.includes('handshake') || message.includes('ssl') || message.includes('tls') || message.includes('eproto')) {
        return 'TLS 握手失败，请检查 SSL 配置';
      }
      if (message.includes('not connected') || message.includes('socket') || message.includes('closed')) {
        return '连接已断开，请重新连接';
      }
      
      return error.message;
    }

    return '未知错误';
  }
}

// 导出单例实例
export const routerosClient = new RouterOSClient();

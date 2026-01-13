/**
 * MetricsCollector 指标采集服务
 * 负责周期性采集 RouterOS 设备的运行指标
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10
 * - 1.1: 按配置的采集间隔周期性采集指标
 * - 1.2: 获取 CPU 使用率百分比
 * - 1.3: 获取已用内存、可用内存和使用率
 * - 1.4: 获取磁盘总容量、已用容量和使用率
 * - 1.5: 获取每个接口的收发流量、包数和错误数
 * - 1.6: 获取接口的运行状态（up/down）和连接状态
 * - 1.7: 将指标数据持久化存储
 * - 1.8: 保留最近 7 天的历史数据
 * - 1.9: 自动清理过期数据
 * - 1.10: 采集错误时记录日志并在下一周期重试
 */

import fs from 'fs/promises';
import path from 'path';
import {
  IMetricsCollector,
  MetricsCollectorConfig,
  MetricPoint,
  SystemMetrics,
  InterfaceMetrics,
} from '../../types/ai-ops';
import { routerosClient } from '../routerosClient';
import { logger } from '../../utils/logger';

const METRICS_DIR = path.join(process.cwd(), 'data', 'ai-ops', 'metrics');
const SYSTEM_METRICS_DIR = path.join(METRICS_DIR, 'system');
const INTERFACE_METRICS_DIR = path.join(METRICS_DIR, 'interfaces');
const CONFIG_FILE = path.join(process.cwd(), 'data', 'ai-ops', 'metrics-config.json');

const DEFAULT_CONFIG: MetricsCollectorConfig = {
  intervalMs: 60000, // 1 minute
  retentionDays: 7,
  enabled: true,
};

/**
 * 获取日期字符串 (YYYY-MM-DD)
 */
function getDateString(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toISOString().split('T')[0];
}

/**
 * 获取系统指标文件路径
 */
function getSystemMetricsFilePath(dateStr: string): string {
  return path.join(SYSTEM_METRICS_DIR, `${dateStr}.json`);
}

/**
 * 获取接口指标文件路径
 */
function getInterfaceMetricsFilePath(dateStr: string): string {
  return path.join(INTERFACE_METRICS_DIR, `${dateStr}.json`);
}


/**
 * 存储的系统指标数据点
 */
interface StoredSystemMetrics {
  timestamp: number;
  metrics: SystemMetrics;
}

/**
 * 存储的接口指标数据点
 */
interface StoredInterfaceMetrics {
  timestamp: number;
  interfaces: InterfaceMetrics[];
}

export class MetricsCollector implements IMetricsCollector {
  private config: MetricsCollectorConfig = DEFAULT_CONFIG;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private latestMetrics: { system: SystemMetrics; interfaces: InterfaceMetrics[] } | null = null;
  private consecutiveErrors: number = 0;
  private readonly MAX_CONSECUTIVE_ERRORS = 3;

  /**
   * 确保目录存在
   */
  private async ensureDirectories(): Promise<void> {
    try {
      await fs.mkdir(SYSTEM_METRICS_DIR, { recursive: true });
      await fs.mkdir(INTERFACE_METRICS_DIR, { recursive: true });
    } catch (error) {
      logger.error('Failed to create metrics directories:', error);
    }
  }

  /**
   * 加载配置
   */
  private async loadConfig(): Promise<void> {
    try {
      const data = await fs.readFile(CONFIG_FILE, 'utf-8');
      this.config = { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.error('Failed to load metrics config:', error);
      }
      this.config = DEFAULT_CONFIG;
    }
  }

  /**
   * 保存配置
   */
  async saveConfig(config: Partial<MetricsCollectorConfig>): Promise<MetricsCollectorConfig> {
    await this.ensureDirectories();
    this.config = { ...this.config, ...config };
    await fs.writeFile(CONFIG_FILE, JSON.stringify(this.config, null, 2), 'utf-8');
    return this.config;
  }

  /**
   * 获取配置
   */
  getConfig(): MetricsCollectorConfig {
    return { ...this.config };
  }

  /**
   * 读取指定日期的系统指标文件
   */
  private async readSystemMetricsFile(dateStr: string): Promise<StoredSystemMetrics[]> {
    const filePath = getSystemMetricsFilePath(dateStr);
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) as StoredSystemMetrics[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      logger.error(`Failed to read system metrics file ${dateStr}:`, error);
      return [];
    }
  }

  /**
   * 写入系统指标文件
   */
  private async writeSystemMetricsFile(dateStr: string, data: StoredSystemMetrics[]): Promise<void> {
    const filePath = getSystemMetricsFilePath(dateStr);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * 读取指定日期的接口指标文件
   */
  private async readInterfaceMetricsFile(dateStr: string): Promise<StoredInterfaceMetrics[]> {
    const filePath = getInterfaceMetricsFilePath(dateStr);
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) as StoredInterfaceMetrics[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      logger.error(`Failed to read interface metrics file ${dateStr}:`, error);
      return [];
    }
  }

  /**
   * 写入接口指标文件
   */
  private async writeInterfaceMetricsFile(dateStr: string, data: StoredInterfaceMetrics[]): Promise<void> {
    const filePath = getInterfaceMetricsFilePath(dateStr);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }


  /**
   * 从 RouterOS 采集系统指标
   */
  private async collectSystemMetrics(): Promise<SystemMetrics> {
    // 获取系统资源信息
    const resources = await routerosClient.print<{
      'cpu-load': string;
      'free-memory': string;
      'total-memory': string;
      'free-hdd-space': string;
      'total-hdd-space': string;
      uptime: string;
    }>('/system/resource');

    if (!resources || resources.length === 0) {
      throw new Error('Failed to get system resources');
    }

    const resource = resources[0];

    // 解析 CPU 使用率
    const cpuUsage = parseInt(resource['cpu-load'] || '0', 10);

    // 解析内存信息 (bytes)
    const totalMemory = parseInt(resource['total-memory'] || '0', 10);
    const freeMemory = parseInt(resource['free-memory'] || '0', 10);
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = totalMemory > 0 ? Math.round((usedMemory / totalMemory) * 100) : 0;

    // 解析磁盘信息 (bytes)
    const totalDisk = parseInt(resource['total-hdd-space'] || '0', 10);
    const freeDisk = parseInt(resource['free-hdd-space'] || '0', 10);
    const usedDisk = totalDisk - freeDisk;
    const diskUsage = totalDisk > 0 ? Math.round((usedDisk / totalDisk) * 100) : 0;

    // 解析运行时间 (RouterOS 格式: 1w2d3h4m5s)
    const uptimeStr = resource.uptime || '0s';
    const uptime = this.parseUptime(uptimeStr);

    return {
      cpu: { usage: cpuUsage },
      memory: {
        total: totalMemory,
        used: usedMemory,
        free: freeMemory,
        usage: memoryUsage,
      },
      disk: {
        total: totalDisk,
        used: usedDisk,
        free: freeDisk,
        usage: diskUsage,
      },
      uptime,
    };
  }

  /**
   * 解析 RouterOS 运行时间格式
   * 格式: 1w2d3h4m5s
   */
  private parseUptime(uptimeStr: string): number {
    let seconds = 0;
    const regex = /(\d+)([wdhms])/g;
    let match;

    while ((match = regex.exec(uptimeStr)) !== null) {
      const value = parseInt(match[1], 10);
      const unit = match[2];

      switch (unit) {
        case 'w':
          seconds += value * 7 * 24 * 60 * 60;
          break;
        case 'd':
          seconds += value * 24 * 60 * 60;
          break;
        case 'h':
          seconds += value * 60 * 60;
          break;
        case 'm':
          seconds += value * 60;
          break;
        case 's':
          seconds += value;
          break;
      }
    }

    return seconds;
  }

  /**
   * 从 RouterOS 采集接口指标
   */
  private async collectInterfaceMetrics(): Promise<InterfaceMetrics[]> {
    // 获取接口列表
    const interfaces = await routerosClient.print<{
      name: string;
      running: string;
      disabled: string;
      'rx-byte': string;
      'tx-byte': string;
      'rx-packet': string;
      'tx-packet': string;
      'rx-error': string;
      'tx-error': string;
    }>('/interface');

    if (!interfaces || interfaces.length === 0) {
      return [];
    }

    return interfaces.map((iface) => ({
      name: iface.name,
      status: iface.running === 'true' && iface.disabled !== 'true' ? 'up' : 'down',
      rxBytes: parseInt(iface['rx-byte'] || '0', 10),
      txBytes: parseInt(iface['tx-byte'] || '0', 10),
      rxPackets: parseInt(iface['rx-packet'] || '0', 10),
      txPackets: parseInt(iface['tx-packet'] || '0', 10),
      rxErrors: parseInt(iface['rx-error'] || '0', 10),
      txErrors: parseInt(iface['tx-error'] || '0', 10),
    }));
  }


  /**
   * 存储指标数据
   */
  private async storeMetrics(
    system: SystemMetrics,
    interfaces: InterfaceMetrics[]
  ): Promise<void> {
    const timestamp = Date.now();
    const dateStr = getDateString(timestamp);

    // 存储系统指标
    const systemData = await this.readSystemMetricsFile(dateStr);
    systemData.push({ timestamp, metrics: system });
    await this.writeSystemMetricsFile(dateStr, systemData);

    // 存储接口指标
    const interfaceData = await this.readInterfaceMetricsFile(dateStr);
    interfaceData.push({ timestamp, interfaces });
    await this.writeInterfaceMetricsFile(dateStr, interfaceData);

    logger.debug(`Metrics stored for ${dateStr}`);
  }

  /**
   * 执行一次采集
   */
  private async doCollect(): Promise<void> {
    try {
      // 检查 RouterOS 连接
      if (!routerosClient.isConnected()) {
        logger.warn('RouterOS not connected, skipping metrics collection');
        this.consecutiveErrors++;
        return;
      }

      const system = await this.collectSystemMetrics();
      const interfaces = await this.collectInterfaceMetrics();

      // 更新最新指标缓存
      this.latestMetrics = { system, interfaces };

      // 持久化存储
      await this.storeMetrics(system, interfaces);

      // 重置错误计数
      this.consecutiveErrors = 0;

      logger.debug('Metrics collection completed successfully');
    } catch (error) {
      this.consecutiveErrors++;
      logger.error(`Metrics collection failed (attempt ${this.consecutiveErrors}):`, error);

      // 连续错误超过阈值时记录警告
      if (this.consecutiveErrors >= this.MAX_CONSECUTIVE_ERRORS) {
        logger.warn(
          `Metrics collection has failed ${this.consecutiveErrors} consecutive times`
        );
      }
    }
  }

  /**
   * 启动指标采集
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('MetricsCollector is already running');
      return;
    }

    this.loadConfig().then(() => {
      if (!this.config.enabled) {
        logger.info('MetricsCollector is disabled');
        return;
      }

      this.ensureDirectories().then(() => {
        // 立即执行一次采集
        this.doCollect();

        // 设置定时采集
        this.intervalId = setInterval(() => {
          this.doCollect();
        }, this.config.intervalMs);

        this.isRunning = true;
        logger.info(
          `MetricsCollector started with interval ${this.config.intervalMs}ms`
        );

        // 启动时清理过期数据
        this.cleanupExpiredData();
      });
    });
  }

  /**
   * 停止指标采集
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info('MetricsCollector stopped');
  }

  /**
   * 立即执行一次采集
   */
  async collectNow(): Promise<{ system: SystemMetrics; interfaces: InterfaceMetrics[] }> {
    await this.ensureDirectories();

    const system = await this.collectSystemMetrics();
    const interfaces = await this.collectInterfaceMetrics();

    // 更新最新指标缓存
    this.latestMetrics = { system, interfaces };

    // 持久化存储
    await this.storeMetrics(system, interfaces);

    return { system, interfaces };
  }

  /**
   * 获取最新指标
   */
  async getLatest(): Promise<{ system: SystemMetrics; interfaces: InterfaceMetrics[] } | null> {
    // 如果有缓存，直接返回
    if (this.latestMetrics) {
      return this.latestMetrics;
    }

    // 否则从文件读取最新数据
    const today = getDateString(Date.now());
    const systemData = await this.readSystemMetricsFile(today);
    const interfaceData = await this.readInterfaceMetricsFile(today);

    if (systemData.length > 0 && interfaceData.length > 0) {
      const latestSystem = systemData[systemData.length - 1];
      const latestInterface = interfaceData[interfaceData.length - 1];

      this.latestMetrics = {
        system: latestSystem.metrics,
        interfaces: latestInterface.interfaces,
      };

      return this.latestMetrics;
    }

    return null;
  }


  /**
   * 获取历史指标数据
   * @param metric 指标类型: 'cpu', 'memory', 'disk', 'interface:{name}'
   * @param from 开始时间戳
   * @param to 结束时间戳
   */
  async getHistory(metric: string, from: number, to: number): Promise<MetricPoint[]> {
    await this.ensureDirectories();

    const points: MetricPoint[] = [];
    const dates = this.getDateRange(from, to);

    // 判断是系统指标还是接口指标
    if (metric.startsWith('interface:')) {
      const interfaceName = metric.substring('interface:'.length);
      
      for (const dateStr of dates) {
        const data = await this.readInterfaceMetricsFile(dateStr);
        
        for (const entry of data) {
          if (entry.timestamp >= from && entry.timestamp <= to) {
            const iface = entry.interfaces.find((i) => i.name === interfaceName);
            if (iface) {
              // 返回接口流量作为值
              points.push({
                timestamp: entry.timestamp,
                value: iface.rxBytes + iface.txBytes,
                labels: {
                  name: iface.name,
                  status: iface.status,
                  rxBytes: String(iface.rxBytes),
                  txBytes: String(iface.txBytes),
                },
              });
            }
          }
        }
      }
    } else {
      // 系统指标
      for (const dateStr of dates) {
        const data = await this.readSystemMetricsFile(dateStr);
        
        for (const entry of data) {
          if (entry.timestamp >= from && entry.timestamp <= to) {
            let value: number;
            
            switch (metric) {
              case 'cpu':
                value = entry.metrics.cpu.usage;
                break;
              case 'memory':
                value = entry.metrics.memory.usage;
                break;
              case 'disk':
                value = entry.metrics.disk.usage;
                break;
              default:
                continue;
            }
            
            points.push({
              timestamp: entry.timestamp,
              value,
            });
          }
        }
      }
    }

    // 按时间戳排序
    points.sort((a, b) => a.timestamp - b.timestamp);

    return points;
  }

  /**
   * 获取日期范围内的所有日期字符串 (使用 UTC 时间)
   */
  private getDateRange(from: number, to: number): string[] {
    const dates: string[] = [];
    
    // 使用 UTC 时间计算日期范围
    const fromDate = new Date(from);
    const toDate = new Date(to);
    
    // 获取 UTC 日期的开始
    const currentDate = new Date(Date.UTC(
      fromDate.getUTCFullYear(),
      fromDate.getUTCMonth(),
      fromDate.getUTCDate()
    ));
    
    // 获取 UTC 日期的结束
    const endDate = new Date(Date.UTC(
      toDate.getUTCFullYear(),
      toDate.getUTCMonth(),
      toDate.getUTCDate(),
      23, 59, 59, 999
    ));

    while (currentDate <= endDate) {
      dates.push(getDateString(currentDate.getTime()));
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    return dates;
  }

  /**
   * 列出所有指标文件
   */
  private async listMetricsFiles(dir: string): Promise<string[]> {
    try {
      const files = await fs.readdir(dir);
      return files
        .filter((f) => f.endsWith('.json') && f !== '.gitkeep')
        .map((f) => f.replace('.json', ''))
        .sort();
    } catch {
      return [];
    }
  }

  /**
   * 清理过期数据
   */
  async cleanupExpiredData(): Promise<{ systemDeleted: number; interfaceDeleted: number }> {
    await this.ensureDirectories();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
    cutoffDate.setHours(0, 0, 0, 0);
    const cutoffDateStr = getDateString(cutoffDate.getTime());

    let systemDeleted = 0;
    let interfaceDeleted = 0;

    // 清理系统指标
    const systemFiles = await this.listMetricsFiles(SYSTEM_METRICS_DIR);
    for (const dateStr of systemFiles) {
      if (dateStr < cutoffDateStr) {
        const filePath = getSystemMetricsFilePath(dateStr);
        try {
          const data = await this.readSystemMetricsFile(dateStr);
          systemDeleted += data.length;
          await fs.unlink(filePath);
          logger.info(`Deleted expired system metrics file: ${dateStr}`);
        } catch (error) {
          logger.error(`Failed to delete system metrics file ${dateStr}:`, error);
        }
      }
    }

    // 清理接口指标
    const interfaceFiles = await this.listMetricsFiles(INTERFACE_METRICS_DIR);
    for (const dateStr of interfaceFiles) {
      if (dateStr < cutoffDateStr) {
        const filePath = getInterfaceMetricsFilePath(dateStr);
        try {
          const data = await this.readInterfaceMetricsFile(dateStr);
          interfaceDeleted += data.length;
          await fs.unlink(filePath);
          logger.info(`Deleted expired interface metrics file: ${dateStr}`);
        } catch (error) {
          logger.error(`Failed to delete interface metrics file ${dateStr}:`, error);
        }
      }
    }

    if (systemDeleted > 0 || interfaceDeleted > 0) {
      logger.info(
        `Metrics cleanup completed: ${systemDeleted} system records, ${interfaceDeleted} interface records deleted`
      );
    }

    return { systemDeleted, interfaceDeleted };
  }

  /**
   * 获取指定日期范围内的系统指标
   */
  async getSystemMetricsHistory(from: number, to: number): Promise<StoredSystemMetrics[]> {
    await this.ensureDirectories();

    const results: StoredSystemMetrics[] = [];
    const dates = this.getDateRange(from, to);

    logger.info(`getSystemMetricsHistory: from=${new Date(from).toISOString()}, to=${new Date(to).toISOString()}`);
    logger.info(`getSystemMetricsHistory: dates to query: ${dates.join(', ')}`);

    for (const dateStr of dates) {
      const data = await this.readSystemMetricsFile(dateStr);
      logger.info(`getSystemMetricsHistory: read ${data.length} records from ${dateStr}`);
      
      let matchedCount = 0;
      for (const entry of data) {
        if (entry.timestamp >= from && entry.timestamp <= to) {
          results.push(entry);
          matchedCount++;
        }
      }
      logger.info(`getSystemMetricsHistory: ${matchedCount} records matched time range from ${dateStr}`);
      
      if (data.length > 0 && matchedCount === 0) {
        // 输出第一条和最后一条记录的时间戳，帮助调试
        logger.info(`getSystemMetricsHistory: first record timestamp: ${data[0].timestamp} (${new Date(data[0].timestamp).toISOString()})`);
        logger.info(`getSystemMetricsHistory: last record timestamp: ${data[data.length - 1].timestamp} (${new Date(data[data.length - 1].timestamp).toISOString()})`);
      }
    }

    results.sort((a, b) => a.timestamp - b.timestamp);
    logger.info(`getSystemMetricsHistory: total ${results.length} records found`);
    return results;
  }

  /**
   * 获取指定日期范围内的接口指标
   */
  async getInterfaceMetricsHistory(from: number, to: number): Promise<StoredInterfaceMetrics[]> {
    await this.ensureDirectories();

    const results: StoredInterfaceMetrics[] = [];
    const dates = this.getDateRange(from, to);

    for (const dateStr of dates) {
      const data = await this.readInterfaceMetricsFile(dateStr);
      for (const entry of data) {
        if (entry.timestamp >= from && entry.timestamp <= to) {
          results.push(entry);
        }
      }
    }

    results.sort((a, b) => a.timestamp - b.timestamp);
    return results;
  }

  /**
   * 检查服务是否正在运行
   */
  isServiceRunning(): boolean {
    return this.isRunning;
  }
}

// 导出单例实例
export const metricsCollector = new MetricsCollector();

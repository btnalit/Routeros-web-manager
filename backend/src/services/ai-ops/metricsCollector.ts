/**
 * MetricsCollector 指标采集服务
 * 负责周期性采集 RouterOS 设备的运行指标
 * 支持多设备采集
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
import { connectionPool } from '../connectionPool';
import { deviceService } from '../deviceService';
import { RouterOSClient } from '../routerosClient';
import { logger } from '../../utils/logger';

// 告警评估回调类型
type AlertEvaluationCallback = (deviceId: string, metrics: { system: SystemMetrics; interfaces: InterfaceMetrics[] }) => Promise<void>;

const METRICS_BASE_DIR = path.join(process.cwd(), 'data', 'ai-ops', 'metrics');
const CONFIG_FILE = path.join(process.cwd(), 'data', 'ai-ops', 'metrics-config.json');

const DEFAULT_CONFIG: MetricsCollectorConfig = {
  intervalMs: 60000, // 1 minute
  retentionDays: 7,
  enabled: true,
};

// Traffic collection configuration
const TRAFFIC_COLLECTION_INTERVAL_MS = 10000; // 10 seconds
const TRAFFIC_MAX_INTERFACES = 50; // Maximum interfaces to track per device

/**
 * 获取日期字符串 (YYYY-MM-DD)
 */
function getDateString(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toISOString().split('T')[0];
}

/**
 * 获取设备指标目录
 */
function getDeviceMetricsDir(deviceId: string, type: 'system' | 'interfaces' | 'traffic'): string {
  return path.join(METRICS_BASE_DIR, deviceId, type);
}

/**
 * 获取系统指标文件路径
 */
function getSystemMetricsFilePath(deviceId: string, dateStr: string): string {
  return path.join(getDeviceMetricsDir(deviceId, 'system'), `${dateStr}.json`);
}

/**
 * 获取接口指标文件路径
 */
function getInterfaceMetricsFilePath(deviceId: string, dateStr: string): string {
  return path.join(getDeviceMetricsDir(deviceId, 'interfaces'), `${dateStr}.json`);
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

/**
 * 流量速率数据点
 */
export interface TrafficRatePoint {
  timestamp: number;
  rxRate: number; // bytes per second
  txRate: number; // bytes per second
}

/**
 * 接口流量历史数据
 */
interface InterfaceTrafficHistory {
  name: string;
  points: TrafficRatePoint[];
  lastBytes: {
    rx: number;
    tx: number;
    timestamp: number;
  } | null;
}

export class MetricsCollector {
  private config: MetricsCollectorConfig = DEFAULT_CONFIG;
  private intervalId: NodeJS.Timeout | null = null;
  private trafficIntervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  // 缓存最新指标: Map<deviceId, metrics>
  private latestMetrics: Map<string, { system: SystemMetrics; interfaces: InterfaceMetrics[] }> = new Map();

  private consecutiveErrors: Map<string, number> = new Map();
  private readonly MAX_CONSECUTIVE_ERRORS = 3;
  
  // Traffic rate tracking: Map<deviceId, Map<interfaceName, history>>
  private trafficHistory: Map<string, Map<string, InterfaceTrafficHistory>> = new Map();
  
  // 告警评估回调
  private alertEvaluationCallback: AlertEvaluationCallback | null = null;

  /**
   * 确保设备目录存在
   */
  private async ensureDeviceDirectories(deviceId: string): Promise<void> {
    try {
      await fs.mkdir(getDeviceMetricsDir(deviceId, 'system'), { recursive: true });
      await fs.mkdir(getDeviceMetricsDir(deviceId, 'interfaces'), { recursive: true });
      await fs.mkdir(getDeviceMetricsDir(deviceId, 'traffic'), { recursive: true });
    } catch (error) {
      logger.error(`Failed to create metrics directories for device ${deviceId}:`, error);
    }
  }

  /**
   * 加载配置
   */
  private async loadConfig(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(CONFIG_FILE), { recursive: true });
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
  private async readSystemMetricsFile(deviceId: string, dateStr: string): Promise<StoredSystemMetrics[]> {
    const filePath = getSystemMetricsFilePath(deviceId, dateStr);
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) as StoredSystemMetrics[];
    } catch (error) {
      return [];
    }
  }

  /**
   * 写入系统指标文件
   */
  private async writeSystemMetricsFile(deviceId: string, dateStr: string, data: StoredSystemMetrics[]): Promise<void> {
    const filePath = getSystemMetricsFilePath(deviceId, dateStr);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * 读取指定日期的接口指标文件
   */
  private async readInterfaceMetricsFile(deviceId: string, dateStr: string): Promise<StoredInterfaceMetrics[]> {
    const filePath = getInterfaceMetricsFilePath(deviceId, dateStr);
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) as StoredInterfaceMetrics[];
    } catch (error) {
      return [];
    }
  }

  /**
   * 写入接口指标文件
   */
  private async writeInterfaceMetricsFile(deviceId: string, dateStr: string, data: StoredInterfaceMetrics[]): Promise<void> {
    const filePath = getInterfaceMetricsFilePath(deviceId, dateStr);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }


  /**
   * 从 RouterOS 采集系统指标
   */
  private async collectSystemMetrics(client: RouterOSClient): Promise<SystemMetrics> {
    const resources = await client.print<{
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
    const cpuUsage = parseInt(resource['cpu-load'] || '0', 10);
    const totalMemory = parseInt(resource['total-memory'] || '0', 10);
    const freeMemory = parseInt(resource['free-memory'] || '0', 10);
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = totalMemory > 0 ? Math.round((usedMemory / totalMemory) * 100) : 0;
    const totalDisk = parseInt(resource['total-hdd-space'] || '0', 10);
    const freeDisk = parseInt(resource['free-hdd-space'] || '0', 10);
    const usedDisk = totalDisk - freeDisk;
    const diskUsage = totalDisk > 0 ? Math.round((usedDisk / totalDisk) * 100) : 0;
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
   */
  private parseUptime(uptimeStr: string): number {
    let seconds = 0;
    const regex = /(\d+)([wdhms])/g;
    let match;

    while ((match = regex.exec(uptimeStr)) !== null) {
      const value = parseInt(match[1], 10);
      const unit = match[2];
      switch (unit) {
        case 'w': seconds += value * 7 * 24 * 60 * 60; break;
        case 'd': seconds += value * 24 * 60 * 60; break;
        case 'h': seconds += value * 60 * 60; break;
        case 'm': seconds += value * 60; break;
        case 's': seconds += value; break;
      }
    }
    return seconds;
  }

  /**
   * 从 RouterOS 采集接口指标
   */
  private async collectInterfaceMetrics(client: RouterOSClient): Promise<InterfaceMetrics[]> {
    const interfaces = await client.print<{
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
    deviceId: string,
    system: SystemMetrics,
    interfaces: InterfaceMetrics[]
  ): Promise<void> {
    const timestamp = Date.now();
    const dateStr = getDateString(timestamp);

    // 存储系统指标
    const systemData = await this.readSystemMetricsFile(deviceId, dateStr);
    systemData.push({ timestamp, metrics: system });
    await this.writeSystemMetricsFile(deviceId, dateStr, systemData);

    // 存储接口指标
    const interfaceData = await this.readInterfaceMetricsFile(deviceId, dateStr);
    interfaceData.push({ timestamp, interfaces });
    await this.writeInterfaceMetricsFile(deviceId, dateStr, interfaceData);
  }

  /**
   * 执行一次采集（所有设备）
   */
  private async doCollect(): Promise<void> {
    const devices = await deviceService.getAllDevices();

    for (const device of devices) {
      await this.collectForDevice(device.id);
    }
  }

  /**
   * 为单个设备采集指标
   */
  private async collectForDevice(deviceId: string): Promise<void> {
    try {
      await this.ensureDeviceDirectories(deviceId);

      const client = await connectionPool.getClient(deviceId);
      if (!client.isConnected()) {
        // Skip logging if expected (handled by pool)
        return;
      }

      const system = await this.collectSystemMetrics(client);
      const interfaces = await this.collectInterfaceMetrics(client);

      // 更新最新指标缓存
      this.latestMetrics.set(deviceId, { system, interfaces });

      // 持久化存储
      await this.storeMetrics(deviceId, system, interfaces);

      // 重置错误计数
      this.consecutiveErrors.set(deviceId, 0);

      // 触发告警评估
      if (this.alertEvaluationCallback) {
        try {
          await this.alertEvaluationCallback(deviceId, { system, interfaces });
        } catch (error) {
          logger.error(`Alert evaluation failed for ${deviceId}:`, error);
        }
      }

    } catch (error) {
      const currentErrors = (this.consecutiveErrors.get(deviceId) || 0) + 1;
      this.consecutiveErrors.set(deviceId, currentErrors);

      if (currentErrors <= this.MAX_CONSECUTIVE_ERRORS) {
        logger.error(`Metrics collection failed for ${deviceId}:`, error);
      }
    }
  }

  /**
   * 启动指标采集
   */
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.loadConfig().then(async () => {
      // 执行数据迁移 (Phase 1 补充)
      await this.migrateLegacyData();

      if (!this.config.enabled) {
        return;
      }

      // 立即执行一次采集
      this.doCollect();

      // 设置定时采集（系统指标）
      this.intervalId = setInterval(() => {
        this.doCollect();
      }, this.config.intervalMs);

      // 启动流量速率采集
      this.startTrafficCollection();

      this.isRunning = true;
      logger.info('MetricsCollector started');
    });
  }

  /**
   * 迁移旧的指标数据到默认设备目录
   */
  private async migrateLegacyData(): Promise<void> {
    try {
      const devices = await deviceService.getAllDevices();
      if (devices.length === 0) return;
      const defaultDeviceId = devices[0].id;

      const oldSystemDir = path.join(METRICS_BASE_DIR, 'system');
      const oldInterfaceDir = path.join(METRICS_BASE_DIR, 'interfaces');
      const oldTrafficDir = path.join(METRICS_BASE_DIR, 'traffic');

      // 检查旧目录是否存在
      try {
        await fs.access(oldSystemDir);
      } catch {
        return; // 旧目录不存在，无需迁移
      }

      logger.info(`Migrating legacy metrics data to device ${defaultDeviceId}...`);
      await this.ensureDeviceDirectories(defaultDeviceId);

      // Helper to move files
      const moveFiles = async (srcDir: string, destDir: string) => {
        try {
          const files = await fs.readdir(srcDir);
          for (const file of files) {
            const srcPath = path.join(srcDir, file);
            const destPath = path.join(destDir, file);
            try {
              // Check if dest exists to avoid overwrite? Or overwrite?
              // Overwrite is safer for "moving into place" semantics if we assume device ID logic is new.
              await fs.rename(srcPath, destPath);
            } catch (err) {
              logger.warn(`Failed to move file ${file}:`, err);
            }
          }
          // Remove empty source dir
          await fs.rmdir(srcDir);
        } catch (err) {
          logger.warn(`Failed to migrate directory ${srcDir}:`, err);
        }
      };

      await moveFiles(oldSystemDir, getDeviceMetricsDir(defaultDeviceId, 'system'));
      await moveFiles(oldInterfaceDir, getDeviceMetricsDir(defaultDeviceId, 'interfaces'));
      await moveFiles(oldTrafficDir, getDeviceMetricsDir(defaultDeviceId, 'traffic'));

      logger.info('Legacy metrics data migration completed');
    } catch (error) {
      logger.error('Failed to migrate legacy metrics data:', error);
    }
  }

  /**
   * 停止指标采集
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.trafficIntervalId) {
      clearInterval(this.trafficIntervalId);
      this.trafficIntervalId = null;
    }
    this.isRunning = false;
    logger.info('MetricsCollector stopped');
  }

  /**
   * 立即执行一次采集 (指定设备)
   */
  async collectNow(deviceId?: string): Promise<{ system: SystemMetrics; interfaces: InterfaceMetrics[] } | null> {
    // 如果没有指定设备，默认使用第一个
    if (!deviceId) {
      const devices = await deviceService.getAllDevices();
      if (devices.length > 0) {
        deviceId = devices[0].id;
      } else {
        throw new Error('No devices configured');
      }
    }

    await this.collectForDevice(deviceId);
    return this.latestMetrics.get(deviceId) || null;
  }

  /**
   * 获取最新指标
   * @param deviceId 设备ID (可选，若不传则返回第一个设备的指标)
   */
  async getLatest(deviceId?: string): Promise<{ system: SystemMetrics; interfaces: InterfaceMetrics[] } | null> {
    if (!deviceId) {
      const devices = await deviceService.getAllDevices();
      if (devices.length === 0) return null;
      deviceId = devices[0].id;
    }

    if (this.latestMetrics.has(deviceId)) {
      return this.latestMetrics.get(deviceId)!;
    }

    // 尝试从文件读取
    const today = getDateString(Date.now());
    const systemData = await this.readSystemMetricsFile(deviceId, today);
    const interfaceData = await this.readInterfaceMetricsFile(deviceId, today);

    if (systemData.length > 0 && interfaceData.length > 0) {
      return {
        system: systemData[systemData.length - 1].metrics,
        interfaces: interfaceData[interfaceData.length - 1].interfaces,
      };
    }

    return null;
  }


  /**
   * 获取历史指标数据
   */
  async getHistory(metric: string, from: number, to: number, deviceId?: string): Promise<MetricPoint[]> {
    if (!deviceId) {
      const devices = await deviceService.getAllDevices();
      if (devices.length === 0) return [];
      deviceId = devices[0].id;
    }

    const points: MetricPoint[] = [];
    const dates = this.getDateRange(from, to);

    if (metric.startsWith('interface:')) {
      const interfaceName = metric.substring('interface:'.length);
      
      for (const dateStr of dates) {
        const data = await this.readInterfaceMetricsFile(deviceId, dateStr);
        for (const entry of data) {
          if (entry.timestamp >= from && entry.timestamp <= to) {
            const iface = entry.interfaces.find((i) => i.name === interfaceName);
            if (iface) {
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
      for (const dateStr of dates) {
        const data = await this.readSystemMetricsFile(deviceId, dateStr);
        for (const entry of data) {
          if (entry.timestamp >= from && entry.timestamp <= to) {
            let value: number = 0;
            switch (metric) {
              case 'cpu': value = entry.metrics.cpu.usage; break;
              case 'memory': value = entry.metrics.memory.usage; break;
              case 'disk': value = entry.metrics.disk.usage; break;
            }
            points.push({ timestamp: entry.timestamp, value });
          }
        }
      }
    }

    points.sort((a, b) => a.timestamp - b.timestamp);
    return points;
  }

  /**
   * 获取指定日期范围内的系统指标
   * @deprecated 兼容旧代码，默认使用第一个设备
   */
  async getSystemMetricsHistory(from: number, to: number, deviceId?: string): Promise<StoredSystemMetrics[]> {
    if (!deviceId) {
      const devices = await deviceService.getAllDevices();
      if (devices.length === 0) return [];
      deviceId = devices[0].id;
    }

    const results: StoredSystemMetrics[] = [];
    const dates = this.getDateRange(from, to);

    for (const dateStr of dates) {
      const data = await this.readSystemMetricsFile(deviceId, dateStr);
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
   * 获取指定日期范围内的接口指标
   * @deprecated 兼容旧代码，默认使用第一个设备
   */
  async getInterfaceMetricsHistory(from: number, to: number, deviceId?: string): Promise<StoredInterfaceMetrics[]> {
    if (!deviceId) {
      const devices = await deviceService.getAllDevices();
      if (devices.length === 0) return [];
      deviceId = devices[0].id;
    }

    const results: StoredInterfaceMetrics[] = [];
    const dates = this.getDateRange(from, to);

    for (const dateStr of dates) {
      const data = await this.readInterfaceMetricsFile(deviceId, dateStr);
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
   * 获取日期范围内的所有日期字符串
   */
  private getDateRange(from: number, to: number): string[] {
    const dates: string[] = [];
    const fromDate = new Date(from);
    const toDate = new Date(to);
    
    const currentDate = new Date(Date.UTC(
      fromDate.getUTCFullYear(),
      fromDate.getUTCMonth(),
      fromDate.getUTCDate()
    ));
    
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
   * 清理过期数据
   */
  async cleanupExpiredData(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
    const cutoffDateStr = getDateString(cutoffDate.getTime());

    // 遍历所有设备目录
    try {
      const deviceDirs = await fs.readdir(METRICS_BASE_DIR);
      for (const deviceId of deviceDirs) {
        const deviceDir = path.join(METRICS_BASE_DIR, deviceId);

        // Cleanup System
        await this.cleanupDir(path.join(deviceDir, 'system'), cutoffDateStr);
        // Cleanup Interfaces
        await this.cleanupDir(path.join(deviceDir, 'interfaces'), cutoffDateStr);
        // Cleanup Traffic
        await this.cleanupDir(path.join(deviceDir, 'traffic'), cutoffDateStr);
      }
    } catch {
      // ignore
    }
  }

  private async cleanupDir(dir: string, cutoffDateStr: string) {
    try {
      const files = await fs.readdir(dir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const dateStr = file.replace('.json', '');
          if (dateStr < cutoffDateStr && dateStr !== 'last-bytes') {
            await fs.unlink(path.join(dir, file));
          }
        }
      }
    } catch {
      // ignore
    }
  }

  /**
   * 启动流量速率采集
   */
  private startTrafficCollection(): void {
    // 定时采集
    this.trafficIntervalId = setInterval(async () => {
      const devices = await deviceService.getAllDevices();
      for (const device of devices) {
        await this.collectTrafficRatesForDevice(device.id);
      }
    }, TRAFFIC_COLLECTION_INTERVAL_MS);
  }

  /**
   * 采集单个设备的流量速率
   */
  private async collectTrafficRatesForDevice(deviceId: string): Promise<void> {
    try {
      const client = await connectionPool.getClient(deviceId);
      if (!client.isConnected()) return;

      const interfaces = await client.print<{
        name: string;
        'rx-byte': string;
        'tx-byte': string;
      }>('/interface');

      if (!interfaces || interfaces.length === 0) return;

      // 初始化设备的历史记录 Map
      if (!this.trafficHistory.has(deviceId)) {
        this.trafficHistory.set(deviceId, new Map());
      }
      const deviceHistory = this.trafficHistory.get(deviceId)!;

      const now = Date.now();
      const dateStr = getDateString(now);
      const trafficPoints: { name: string; rxRate: number; txRate: number }[] = [];

      for (const iface of interfaces) {
        const name = iface.name;
        const rxBytes = parseInt(iface['rx-byte'] || '0', 10);
        const txBytes = parseInt(iface['tx-byte'] || '0', 10);

        let history = deviceHistory.get(name);
        if (!history) {
          history = { name, points: [], lastBytes: null };
          deviceHistory.set(name, history);
        }

        // 计算速率
        if (history.lastBytes) {
          const timeDiff = (now - history.lastBytes.timestamp) / 1000;
          
          if (timeDiff > 0 && timeDiff < 120) {
            const rxDiff = rxBytes - history.lastBytes.rx;
            const txDiff = txBytes - history.lastBytes.tx;

            let rxRate = 0;
            let txRate = 0;

            if (rxDiff >= 0 && txDiff >= 0) {
              rxRate = rxDiff / timeDiff;
              txRate = txDiff / timeDiff;
            } else {
              // 计数器重置
              const lastPoint = history.points.length > 0 ? history.points[history.points.length - 1] : null;
              if (lastPoint) {
                rxRate = lastPoint.rxRate;
                txRate = lastPoint.txRate;
              }
            }

            history.points.push({ timestamp: now, rxRate, txRate });

            // 内存中保留 1 小时
            const oneHourAgo = now - 3600000;
            history.points = history.points.filter(p => p.timestamp >= oneHourAgo);

            trafficPoints.push({ name, rxRate, txRate });
          }
        }

        history.lastBytes = { rx: rxBytes, tx: txBytes, timestamp: now };
      }

      // 持久化
      if (trafficPoints.length > 0) {
        await this.appendTrafficData(deviceId, dateStr, now, trafficPoints);
      }

    } catch (error) {
      // ignore
    }
  }

  private async appendTrafficData(
    deviceId: string,
    dateStr: string,
    timestamp: number,
    points: { name: string; rxRate: number; txRate: number }[]
  ): Promise<void> {
    const dir = getDeviceMetricsDir(deviceId, 'traffic');
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${dateStr}.json`);
    
    try {
      let data: any[] = [];
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        data = JSON.parse(content);
      } catch { }

      data.push({ timestamp, interfaces: points });
      await fs.writeFile(filePath, JSON.stringify(data), 'utf-8');
    } catch { }
  }

  /**
   * 获取接口流量历史 (内存)
   */
  getTrafficHistory(interfaceName: string, duration: number = 3600000, deviceId?: string): TrafficRatePoint[] {
    // TODO: 如果没传 deviceId，目前只能返回空，或者遍历所有？
    // 为了兼容性，如果没有 deviceId，我们尝试获取第一个有数据的设备？
    // 暂定：必须传 deviceId，或者我们在外部 controller 处理了默认值
    if (!deviceId) return [];

    const deviceHistory = this.trafficHistory.get(deviceId);
    if (!deviceHistory) return [];

    const history = deviceHistory.get(interfaceName);
    if (!history) return [];

    const cutoff = Date.now() - duration;
    return history.points.filter(p => p.timestamp >= cutoff);
  }

  /**
   * 获取所有接口流量历史
   */
  getAllTrafficHistory(duration: number = 3600000, deviceId?: string): Record<string, TrafficRatePoint[]> {
    if (!deviceId) return {}; // 必须指定设备

    const result: Record<string, TrafficRatePoint[]> = {};
    const deviceHistory = this.trafficHistory.get(deviceId);
    if (!deviceHistory) return {};

    const cutoff = Date.now() - duration;

    for (const [name, history] of deviceHistory) {
      const filtered = history.points.filter(p => p.timestamp >= cutoff);
      if (filtered.length > 0) {
        result[name] = filtered;
      }
    }

    return result;
  }

  /**
   * 获取可用接口列表
   */
  getAvailableTrafficInterfaces(deviceId?: string): string[] {
    if (!deviceId) return [];
    const deviceHistory = this.trafficHistory.get(deviceId);
    if (!deviceHistory) return [];
    return Array.from(deviceHistory.keys());
  }

  registerAlertEvaluationCallback(callback: AlertEvaluationCallback): void {
    this.alertEvaluationCallback = callback;
  }
}

export const metricsCollector = new MetricsCollector();

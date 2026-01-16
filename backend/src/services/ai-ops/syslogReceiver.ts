/**
 * SyslogReceiver - Syslog 接收服务
 * 负责监听 UDP 端口接收 RouterOS 设备推送的 Syslog 日志
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7
 * - 1.1: 绑定 UDP 端口监听传入消息
 * - 1.2: 解析 Syslog 消息，提取 facility、severity、timestamp 和消息内容
 * - 1.3: 正确识别 RouterOS 特定格式，包括 topic 和消息体
 * - 1.4: 将有效的 Syslog 消息转换为内部事件格式
 * - 1.5: 处理格式错误的消息，记录错误并继续处理后续消息
 * - 1.7: 支持通过配置设置监听端口
 */

import dgram from 'dgram';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  SyslogMessage,
  SyslogReceiverConfig,
  SyslogEvent,
  AlertSeverity,
  ISyslogReceiver,
} from '../../types/ai-ops';
import { logger } from '../../utils/logger';

const DATA_DIR = path.join(process.cwd(), 'data', 'ai-ops', 'enhancement', 'syslog');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const EVENTS_DIR = path.join(DATA_DIR, 'events');

/**
 * Syslog Facility 名称映射
 */
const FACILITY_NAMES: Record<number, string> = {
  0: 'kern',
  1: 'user',
  2: 'mail',
  3: 'daemon',
  4: 'auth',
  5: 'syslog',
  6: 'lpr',
  7: 'news',
  8: 'uucp',
  9: 'cron',
  10: 'authpriv',
  11: 'ftp',
  12: 'ntp',
  13: 'security',
  14: 'console',
  15: 'solaris-cron',
  16: 'local0',
  17: 'local1',
  18: 'local2',
  19: 'local3',
  20: 'local4',
  21: 'local5',
  22: 'local6',
  23: 'local7',
};

/**
 * Syslog Severity 到 AlertSeverity 的映射
 * Syslog severity: 0=Emergency, 1=Alert, 2=Critical, 3=Error, 4=Warning, 5=Notice, 6=Info, 7=Debug
 */
function mapSyslogSeverityToAlertSeverity(syslogSeverity: number): AlertSeverity {
  switch (syslogSeverity) {
    case 0: // Emergency
      return 'emergency';
    case 1: // Alert
    case 2: // Critical
      return 'critical';
    case 3: // Error
    case 4: // Warning
      return 'warning';
    case 5: // Notice
    case 6: // Informational
    case 7: // Debug
    default:
      return 'info';
  }
}

/**
 * 获取日期字符串 (YYYY-MM-DD)
 */
function getDateString(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toISOString().split('T')[0];
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: SyslogReceiverConfig = {
  port: 514,
  enabled: false,
};

export class SyslogReceiver implements ISyslogReceiver {
  private config: SyslogReceiverConfig = { ...DEFAULT_CONFIG };
  private socket: dgram.Socket | null = null;
  private running = false;
  private messageHandlers: Array<(event: SyslogEvent) => void> = [];
  private initialized = false;

  /**
   * 确保数据目录存在
   */
  private async ensureDataDir(): Promise<void> {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.mkdir(EVENTS_DIR, { recursive: true });
    } catch (error) {
      logger.error('Failed to create syslog directories:', error);
    }
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.ensureDataDir();
    await this.loadConfig();
    this.initialized = true;
    logger.info('SyslogReceiver initialized');
  }

  /**
   * 加载配置
   */
  private async loadConfig(): Promise<void> {
    try {
      const data = await fs.readFile(CONFIG_FILE, 'utf-8');
      this.config = { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.config = { ...DEFAULT_CONFIG };
        await this.saveConfig();
      } else {
        logger.error('Failed to load syslog config:', error);
        this.config = { ...DEFAULT_CONFIG };
      }
    }
  }

  /**
   * 保存配置
   */
  private async saveConfig(): Promise<void> {
    await this.ensureDataDir();
    await fs.writeFile(CONFIG_FILE, JSON.stringify(this.config, null, 2), 'utf-8');
  }

  /**
   * 解析 RFC 3164 格式的 Syslog 消息
   * 格式: <PRI>TIMESTAMP HOSTNAME MESSAGE
   * 例如: <134>Jan 15 10:30:00 router1 system,info,account user admin logged in
   */
  private parseRFC3164(raw: string): SyslogMessage | null {
    // 匹配 PRI 部分 <数字>
    const priMatch = raw.match(/^<(\d{1,3})>/);
    if (!priMatch) {
      return null;
    }

    const pri = parseInt(priMatch[1], 10);
    const facility = Math.floor(pri / 8);
    const severity = pri % 8;

    // 剩余部分
    const remaining = raw.substring(priMatch[0].length);

    // 尝试解析时间戳 (RFC 3164 格式: MMM DD HH:MM:SS 或 MMM  D HH:MM:SS)
    const timestampMatch = remaining.match(
      /^([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})\s+/i
    );

    let timestamp: Date;
    let afterTimestamp: string;

    if (timestampMatch) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthIndex = monthNames.findIndex(
        (m) => m.toLowerCase() === timestampMatch[1].toLowerCase()
      );
      const day = parseInt(timestampMatch[2], 10);
      const hour = parseInt(timestampMatch[3], 10);
      const minute = parseInt(timestampMatch[4], 10);
      const second = parseInt(timestampMatch[5], 10);

      const now = new Date();
      timestamp = new Date(now.getFullYear(), monthIndex >= 0 ? monthIndex : 0, day, hour, minute, second);

      // 如果解析出的日期在未来，可能是去年的日志
      if (timestamp > now) {
        timestamp.setFullYear(now.getFullYear() - 1);
      }

      afterTimestamp = remaining.substring(timestampMatch[0].length);
    } else {
      // 没有时间戳，使用当前时间
      timestamp = new Date();
      afterTimestamp = remaining;
    }

    // 解析 hostname 和消息
    const parts = afterTimestamp.split(/\s+/, 2);
    const hostname = parts[0] || 'unknown';
    const messageStart = afterTimestamp.indexOf(parts[1] || '');
    const fullMessage = messageStart >= 0 ? afterTimestamp.substring(messageStart) : afterTimestamp;

    // 解析 RouterOS 特定格式的 topic
    const { topic, message } = this.parseRouterOSMessage(fullMessage);

    return {
      facility,
      severity,
      timestamp,
      hostname,
      topic,
      message,
      raw,
    };
  }

  /**
   * 解析 RFC 5424 格式的 Syslog 消息
   * 格式: <PRI>VERSION TIMESTAMP HOSTNAME APP-NAME PROCID MSGID STRUCTURED-DATA MSG
   * 例如: <134>1 2026-01-15T10:30:00.000Z router1 routeros - - - system,info user admin logged in
   */
  private parseRFC5424(raw: string): SyslogMessage | null {
    // 匹配 PRI 和 VERSION
    const headerMatch = raw.match(/^<(\d{1,3})>(\d+)\s+/);
    if (!headerMatch) {
      return null;
    }

    const pri = parseInt(headerMatch[1], 10);
    const facility = Math.floor(pri / 8);
    const severity = pri % 8;

    const remaining = raw.substring(headerMatch[0].length);

    // 解析 ISO 8601 时间戳
    const timestampMatch = remaining.match(
      /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)\s+/
    );

    let timestamp: Date;
    let afterTimestamp: string;

    if (timestampMatch) {
      timestamp = new Date(timestampMatch[1]);
      if (isNaN(timestamp.getTime())) {
        timestamp = new Date();
      }
      afterTimestamp = remaining.substring(timestampMatch[0].length);
    } else if (remaining.startsWith('-')) {
      // NILVALUE for timestamp
      timestamp = new Date();
      afterTimestamp = remaining.substring(2); // Skip "- "
    } else {
      timestamp = new Date();
      afterTimestamp = remaining;
    }

    // 解析 HOSTNAME APP-NAME PROCID MSGID
    const headerParts = afterTimestamp.split(/\s+/, 4);
    const hostname = headerParts[0] !== '-' ? headerParts[0] : 'unknown';

    // 找到消息部分（跳过 STRUCTURED-DATA）
    let messageStart = 0;
    for (let i = 0; i < 4 && messageStart < afterTimestamp.length; i++) {
      const spaceIndex = afterTimestamp.indexOf(' ', messageStart);
      if (spaceIndex === -1) break;
      messageStart = spaceIndex + 1;
    }

    // 跳过 STRUCTURED-DATA
    let fullMessage = afterTimestamp.substring(messageStart);
    if (fullMessage.startsWith('-')) {
      fullMessage = fullMessage.substring(2); // Skip "- "
    } else if (fullMessage.startsWith('[')) {
      // 跳过结构化数据
      const sdEnd = fullMessage.lastIndexOf(']');
      if (sdEnd !== -1) {
        fullMessage = fullMessage.substring(sdEnd + 1).trim();
      }
    }

    // 解析 RouterOS 特定格式的 topic
    const { topic, message } = this.parseRouterOSMessage(fullMessage);

    return {
      facility,
      severity,
      timestamp,
      hostname,
      topic,
      message,
      raw,
    };
  }

  /**
   * 解析 RouterOS 特定格式的消息
   * RouterOS 日志格式通常为: topic1,topic2,... message
   * 例如: system,info,account user admin logged in
   */
  private parseRouterOSMessage(fullMessage: string): { topic: string; message: string } {
    // RouterOS topic 格式: 逗号分隔的关键词，后跟空格和消息
    // 常见 topics: system, info, warning, error, critical, firewall, dhcp, wireless, etc.
    const topicMatch = fullMessage.match(/^([a-z,]+)\s+(.*)$/i);

    if (topicMatch) {
      const potentialTopic = topicMatch[1];
      // 验证是否看起来像 RouterOS topic（包含常见关键词）
      const routerOSTopics = [
        'system', 'info', 'warning', 'error', 'critical', 'debug',
        'firewall', 'dhcp', 'wireless', 'interface', 'ppp', 'l2tp',
        'pptp', 'sstp', 'ovpn', 'ipsec', 'ospf', 'bgp', 'rip',
        'account', 'hotspot', 'radius', 'snmp', 'ntp', 'dns',
        'web-proxy', 'script', 'scheduler', 'backup', 'certificate',
        'caps', 'capsman', 'lte', 'gps', 'ups', 'health', 'calc',
        'async', 'bfd', 'bridge', 'e-mail', 'event', 'igmp-proxy',
        'isdn', 'iscsi', 'kidcontrol', 'ldp', 'manager', 'mme',
        'mpls', 'pim', 'queue', 'raw', 'read', 'route', 'rsvp',
        'sertcp', 'smb', 'ssh', 'state', 'store', 'telephony',
        'tftp', 'timer', 'tr069-client', 'upnp', 'vrrp', 'watchdog',
        'write', 'gsm', 'lora', 'container', 'dot1x', 'eoip',
        'gre', 'ipip', 'l2mtu', 'mac-server', 'mac-winbox', 'mlag',
        'netwatch', 'poe', 'profiler', 'romon', 'rose-storage',
        'sms', 'sntp', 'ssh-server', 'swos', 'trafficgen', 'user',
        'vlan', 'wifiwave2', 'zerotier'
      ];

      const topics = potentialTopic.toLowerCase().split(',');
      const isRouterOSTopic = topics.some((t) => routerOSTopics.includes(t));

      if (isRouterOSTopic) {
        return {
          topic: potentialTopic.toLowerCase(),
          message: topicMatch[2],
        };
      }
    }

    // 如果不是 RouterOS 格式，返回默认 topic
    return {
      topic: 'unknown',
      message: fullMessage,
    };
  }

  /**
   * 解析 Syslog 消息（自动检测格式）
   */
  parseSyslogMessage(raw: string): SyslogMessage | null {
    const trimmed = raw.trim();

    if (!trimmed.startsWith('<')) {
      logger.debug('Invalid syslog message: does not start with PRI');
      return null;
    }

    // 尝试 RFC 5424 格式（有版本号）
    if (/^<\d{1,3}>\d+\s/.test(trimmed)) {
      const result = this.parseRFC5424(trimmed);
      if (result) return result;
    }

    // 尝试 RFC 3164 格式
    return this.parseRFC3164(trimmed);
  }

  /**
   * 将 SyslogMessage 转换为 SyslogEvent
   */
  convertToSyslogEvent(syslogMessage: SyslogMessage): SyslogEvent {
    const alertSeverity = mapSyslogSeverityToAlertSeverity(syslogMessage.severity);

    // 根据 topic 确定 category
    let category = 'system';
    const topics = syslogMessage.topic.split(',');
    
    // 优先使用第一个非 severity 相关的 topic 作为 category
    for (const topic of topics) {
      if (!['info', 'warning', 'error', 'critical', 'debug'].includes(topic)) {
        category = topic;
        break;
      }
    }

    return {
      id: uuidv4(),
      source: 'syslog',
      timestamp: syslogMessage.timestamp.getTime(),
      severity: alertSeverity,
      category,
      message: syslogMessage.message,
      rawData: syslogMessage,
      metadata: {
        hostname: syslogMessage.hostname,
        facility: syslogMessage.facility,
        syslogSeverity: syslogMessage.severity,
      },
    };
  }

  /**
   * 保存 Syslog 事件到文件
   */
  private async saveEvent(event: SyslogEvent): Promise<void> {
    const dateStr = getDateString(event.timestamp);
    const filePath = path.join(EVENTS_DIR, `${dateStr}.json`);

    try {
      let events: SyslogEvent[] = [];
      try {
        const data = await fs.readFile(filePath, 'utf-8');
        events = JSON.parse(data);
      } catch {
        // 文件不存在，使用空数组
      }

      events.push(event);
      await fs.writeFile(filePath, JSON.stringify(events, null, 2), 'utf-8');
    } catch (error) {
      logger.error('Failed to save syslog event:', error);
    }
  }

  /**
   * 处理接收到的 UDP 消息
   */
  private handleMessage(msg: Buffer, rinfo: dgram.RemoteInfo): void {
    const raw = msg.toString('utf-8');
    
    logger.debug(`Received syslog message from ${rinfo.address}:${rinfo.port}: ${raw.substring(0, 100)}...`);

    try {
      const syslogMessage = this.parseSyslogMessage(raw);

      if (!syslogMessage) {
        logger.warn(`Failed to parse syslog message from ${rinfo.address}: ${raw.substring(0, 100)}...`);
        return;
      }

      const event = this.convertToSyslogEvent(syslogMessage);

      // 保存事件
      this.saveEvent(event).catch((error) => {
        logger.error('Failed to save syslog event:', error);
      });

      // 通知所有处理器
      for (const handler of this.messageHandlers) {
        try {
          handler(event);
        } catch (error) {
          logger.error('Syslog message handler error:', error);
        }
      }
    } catch (error) {
      // 记录错误但继续处理后续消息 (Requirement 1.5)
      logger.error(`Error processing syslog message from ${rinfo.address}:`, error);
    }
  }

  /**
   * 启动 Syslog 接收服务
   */
  start(): void {
    if (this.running) {
      logger.warn('SyslogReceiver is already running');
      return;
    }

    if (!this.config.enabled) {
      logger.info('SyslogReceiver is disabled in config');
      return;
    }

    this.socket = dgram.createSocket('udp4');

    this.socket.on('message', (msg, rinfo) => {
      this.handleMessage(msg, rinfo);
    });

    this.socket.on('error', (error) => {
      logger.error('SyslogReceiver socket error:', error);
      this.stop();
    });

    this.socket.on('listening', () => {
      const address = this.socket?.address();
      logger.info(`SyslogReceiver listening on ${address?.address}:${address?.port}`);
    });

    try {
      this.socket.bind(this.config.port);
      this.running = true;
    } catch (error) {
      logger.error(`Failed to bind SyslogReceiver to port ${this.config.port}:`, error);
      this.socket = null;
      throw error;
    }
  }

  /**
   * 停止 Syslog 接收服务
   */
  stop(): void {
    if (!this.running || !this.socket) {
      return;
    }

    try {
      this.socket.close();
    } catch (error) {
      logger.error('Error closing SyslogReceiver socket:', error);
    }

    this.socket = null;
    this.running = false;
    logger.info('SyslogReceiver stopped');
  }

  /**
   * 检查服务是否正在运行
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * 注册消息处理回调
   */
  onMessage(handler: (event: SyslogEvent) => void): void {
    this.messageHandlers.push(handler);
  }

  /**
   * 移除消息处理回调
   */
  offMessage(handler: (event: SyslogEvent) => void): void {
    const index = this.messageHandlers.indexOf(handler);
    if (index !== -1) {
      this.messageHandlers.splice(index, 1);
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): SyslogReceiverConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  async updateConfig(updates: Partial<SyslogReceiverConfig>): Promise<void> {
    const wasRunning = this.running;
    const oldPort = this.config.port;

    // 更新配置
    this.config = { ...this.config, ...updates };
    await this.saveConfig();

    // 如果端口改变或启用状态改变，需要重启服务
    if (wasRunning && (updates.port !== undefined && updates.port !== oldPort)) {
      this.stop();
      if (this.config.enabled) {
        this.start();
      }
    } else if (updates.enabled !== undefined) {
      if (updates.enabled && !wasRunning) {
        this.start();
      } else if (!updates.enabled && wasRunning) {
        this.stop();
      }
    }

    logger.info('SyslogReceiver config updated:', this.config);
  }

  /**
   * 获取 Syslog 事件历史
   */
  async getEvents(from?: number, to?: number, limit?: number): Promise<SyslogEvent[]> {
    await this.initialize();

    const now = Date.now();
    const fromTime = from || now - 24 * 60 * 60 * 1000; // 默认最近 24 小时
    const toTime = to || now;
    const maxLimit = limit || 1000;

    const events: SyslogEvent[] = [];
    const dates = this.getDateRange(fromTime, toTime);

    for (const dateStr of dates) {
      const filePath = path.join(EVENTS_DIR, `${dateStr}.json`);
      try {
        const data = await fs.readFile(filePath, 'utf-8');
        const dayEvents = JSON.parse(data) as SyslogEvent[];
        
        for (const event of dayEvents) {
          if (event.timestamp >= fromTime && event.timestamp <= toTime) {
            events.push(event);
          }
        }
      } catch {
        // 文件不存在，跳过
      }

      if (events.length >= maxLimit) {
        break;
      }
    }

    // 按时间倒序排列，取最新的
    events.sort((a, b) => b.timestamp - a.timestamp);
    return events.slice(0, maxLimit);
  }

  /**
   * 获取日期范围内的所有日期字符串
   */
  private getDateRange(from: number, to: number): string[] {
    const dates: string[] = [];
    const fromDate = new Date(from);
    const toDate = new Date(to);

    const currentDate = new Date(
      Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate())
    );
    const endDate = new Date(
      Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth(), toDate.getUTCDate(), 23, 59, 59, 999)
    );

    while (currentDate <= endDate) {
      dates.push(getDateString(currentDate.getTime()));
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    return dates;
  }

  /**
   * 获取服务状态
   */
  getStatus(): { running: boolean; port: number; enabled: boolean; handlersCount: number } {
    return {
      running: this.running,
      port: this.config.port,
      enabled: this.config.enabled,
      handlersCount: this.messageHandlers.length,
    };
  }
}

// 导出单例实例
export const syslogReceiver = new SyslogReceiver();

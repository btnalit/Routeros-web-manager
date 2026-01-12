/**
 * Context Builder Service
 * 构建 RouterOS 上下文信息，注入到 AI 对话中
 * 
 * 功能：
 * - 生成系统提示词
 * - 获取 RouterOS 连接状态和系统信息
 * - 获取指定配置段
 * - 脱敏处理敏感信息
 */

import { routerosClient } from '../routerosClient';
import {
  IContextBuilder,
  RouterOSContext,
  RouterOSConnectionContext,
  RouterOSSystemInfo,
  SelectedConfig,
  ROUTEROS_SYSTEM_PROMPT
} from '../../types/ai';
import { logger } from '../../utils/logger';

/**
 * 敏感字段列表 - 这些字段的值将被脱敏处理
 */
const SENSITIVE_FIELDS = [
  'password',
  'secret',
  'key',
  'api-key',
  'apikey',
  'api_key',
  'private-key',
  'privatekey',
  'private_key',
  'psk',
  'pre-shared-key',
  'passphrase',
  'auth-key',
  'authentication-key',
  'certificate-key',
  'wpa-pre-shared-key',
  'wpa2-pre-shared-key',
  'radius-secret',
  'shared-secret',
  'l2tp-secret',
  'pptp-secret',
  'ipsec-secret',
  'token',
  'access-token',
  'refresh-token',
  'bearer',
  'credential',
  'credentials'
];

/**
 * 敏感字段正则模式 - 用于匹配包含敏感关键词的字段名
 */
const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /key$/i,
  /^key/i,
  /token/i,
  /credential/i,
  /psk/i,
  /passphrase/i
];

/**
 * 脱敏后的占位符
 */
const SANITIZED_PLACEHOLDER = '***REDACTED***';

/**
 * RouterOS 配置路径映射
 */
const CONFIG_PATHS: Record<string, string> = {
  'interface': '/interface',
  'ip-address': '/ip/address',
  'ip-route': '/ip/route',
  'ip-firewall-filter': '/ip/firewall/filter',
  'ip-firewall-nat': '/ip/firewall/nat',
  'ip-firewall-mangle': '/ip/firewall/mangle',
  'ip-firewall-address-list': '/ip/firewall/address-list',
  'ip-dhcp-server': '/ip/dhcp-server',
  'ip-dhcp-client': '/ip/dhcp-client',
  'ip-pool': '/ip/pool',
  'ipv6-address': '/ipv6/address',
  'ipv6-route': '/ipv6/route',
  'ipv6-firewall-filter': '/ipv6/firewall/filter',
  'ipv6-nd': '/ipv6/nd',
  'ipv6-dhcp-client': '/ipv6/dhcp-client',
  'system-identity': '/system/identity',
  'system-resource': '/system/resource',
  'system-routerboard': '/system/routerboard',
  'system-script': '/system/script',
  'system-scheduler': '/system/scheduler',
  'wireless': '/interface/wireless',
  'bridge': '/interface/bridge',
  'vlan': '/interface/vlan',
  'ppp-secret': '/ppp/secret',
  'user': '/user',
  'queue': '/queue/simple',
  'dns': '/ip/dns',
  'snmp': '/snmp',
  'radius': '/radius'
};

/**
 * 系统资源接口
 */
interface SystemResource {
  '.id'?: string;
  'cpu'?: string;
  'cpu-count'?: string;
  'cpu-frequency'?: string;
  'cpu-load'?: string;
  'architecture-name'?: string;
  'board-name'?: string;
  'version'?: string;
  'build-time'?: string;
  'uptime'?: string;
  'total-memory'?: string;
  'free-memory'?: string;
  'total-hdd-space'?: string;
  'free-hdd-space'?: string;
}

/**
 * 系统身份接口
 */
interface SystemIdentity {
  name?: string;
}

export class ContextBuilderService implements IContextBuilder {
  /**
   * 构建系统提示词
   * 将 RouterOS 连接上下文注入到系统提示词模板中
   */
  buildSystemPrompt(): string {
    return ROUTEROS_SYSTEM_PROMPT;
  }

  /**
   * 构建带有上下文的系统提示词
   * @param context RouterOS 上下文信息
   */
  buildSystemPromptWithContext(context: RouterOSContext): string {
    const contextStr = this.formatContextForPrompt(context);
    return ROUTEROS_SYSTEM_PROMPT.replace('{connectionContext}', contextStr);
  }

  /**
   * 格式化上下文信息为提示词字符串
   */
  private formatContextForPrompt(context: RouterOSContext): string {
    const lines: string[] = [];

    // 连接状态
    if (context.connectionStatus.connected) {
      lines.push(`- 已连接到: ${context.connectionStatus.host}`);
      if (context.connectionStatus.version) {
        lines.push(`- RouterOS 版本: ${context.connectionStatus.version}`);
      }
    } else {
      lines.push('- 未连接到 RouterOS 设备');
    }

    // 系统信息
    if (context.systemInfo) {
      lines.push(`- 设备名称: ${context.systemInfo.identity}`);
      lines.push(`- 设备型号: ${context.systemInfo.boardName}`);
      lines.push(`- 运行时间: ${context.systemInfo.uptime}`);
    }

    // 选中的配置
    if (context.selectedConfigs && context.selectedConfigs.length > 0) {
      lines.push('\n当前选中的配置:');
      for (const config of context.selectedConfigs) {
        lines.push(`\n[${config.type}]`);
        lines.push('```json');
        lines.push(JSON.stringify(config.data, null, 2));
        lines.push('```');
      }
    }

    return lines.join('\n');
  }

  /**
   * 获取 RouterOS 连接上下文
   * 包括连接状态、系统信息等
   */
  async getConnectionContext(): Promise<RouterOSContext> {
    const connectionStatus = this.getConnectionStatus();
    
    // 如果未连接，直接返回基本状态
    if (!connectionStatus.connected) {
      return {
        connectionStatus
      };
    }

    // 获取系统信息
    let systemInfo: RouterOSSystemInfo | undefined;
    try {
      systemInfo = await this.getSystemInfo();
    } catch (error) {
      logger.warn('Failed to get system info for context:', error);
    }

    return {
      connectionStatus: {
        ...connectionStatus,
        version: systemInfo?.version
      },
      systemInfo
    };
  }

  /**
   * 获取连接状态
   */
  private getConnectionStatus(): RouterOSConnectionContext {
    const connected = routerosClient.isConnected();
    const config = routerosClient.getConfig();

    return {
      connected,
      host: config?.host || ''
    };
  }

  /**
   * 获取系统信息
   */
  private async getSystemInfo(): Promise<RouterOSSystemInfo | undefined> {
    try {
      // 获取系统资源
      const resources = await routerosClient.print<SystemResource>('/system/resource');
      const resource = resources?.[0];

      // 获取系统身份
      const identities = await routerosClient.print<SystemIdentity>('/system/identity');
      const identity = identities?.[0];

      if (!resource) {
        return undefined;
      }

      return {
        identity: identity?.name || 'Unknown',
        boardName: resource['board-name'] || 'Unknown',
        version: resource['version'] || 'Unknown',
        uptime: resource['uptime'] || 'Unknown'
      };
    } catch (error) {
      logger.error('Failed to get system info:', error);
      return undefined;
    }
  }

  /**
   * 获取指定配置段
   * @param section 配置段名称，如 'interface', 'ip-address' 等
   */
  async getConfigSection(section: string): Promise<unknown> {
    const path = CONFIG_PATHS[section];
    
    if (!path) {
      throw new Error(`Unknown config section: ${section}`);
    }

    if (!routerosClient.isConnected()) {
      throw new Error('Not connected to RouterOS');
    }

    try {
      const data = await routerosClient.print(path);
      // 对获取的配置进行脱敏处理
      return this.sanitizeConfig(data);
    } catch (error) {
      logger.error(`Failed to get config section ${section}:`, error);
      throw error;
    }
  }

  /**
   * 获取多个配置段
   * @param sections 配置段名称数组
   */
  async getMultipleConfigSections(sections: string[]): Promise<SelectedConfig[]> {
    const results: SelectedConfig[] = [];

    for (const section of sections) {
      try {
        const data = await this.getConfigSection(section);
        results.push({
          type: section,
          data
        });
      } catch (error) {
        logger.warn(`Failed to get config section ${section}:`, error);
        // 继续获取其他配置段
      }
    }

    return results;
  }

  /**
   * 脱敏处理配置数据
   * 移除或掩码敏感信息（密码、密钥、令牌等）
   * @param config 原始配置数据
   */
  sanitizeConfig(config: unknown): unknown {
    if (config === null || config === undefined) {
      return config;
    }

    // 处理数组
    if (Array.isArray(config)) {
      return config.map(item => this.sanitizeConfig(item));
    }

    // 处理对象
    if (typeof config === 'object') {
      const sanitized: Record<string, unknown> = {};
      
      for (const [key, value] of Object.entries(config as Record<string, unknown>)) {
        if (this.isSensitiveField(key)) {
          // 敏感字段使用占位符替换
          sanitized[key] = SANITIZED_PLACEHOLDER;
        } else if (typeof value === 'object' && value !== null) {
          // 递归处理嵌套对象
          sanitized[key] = this.sanitizeConfig(value);
        } else if (typeof value === 'string' && this.containsSensitivePattern(value)) {
          // 检查值是否包含敏感模式（如内嵌的密码字符串）
          sanitized[key] = this.sanitizeString(value);
        } else {
          sanitized[key] = value;
        }
      }
      
      return sanitized;
    }

    // 处理字符串 - 检查是否包含敏感模式
    if (typeof config === 'string') {
      return this.sanitizeString(config);
    }

    // 其他类型直接返回
    return config;
  }

  /**
   * 检查字段名是否为敏感字段
   */
  private isSensitiveField(fieldName: string): boolean {
    const lowerFieldName = fieldName.toLowerCase();
    
    // 精确匹配
    if (SENSITIVE_FIELDS.includes(lowerFieldName)) {
      return true;
    }

    // 模式匹配
    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.test(fieldName)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 检查字符串值是否包含敏感模式
   * 用于检测内嵌的敏感信息
   */
  private containsSensitivePattern(value: string): boolean {
    // 检查是否包含类似 password=xxx 或 key=xxx 的模式
    const inlinePatterns = [
      /password\s*[=:]\s*\S+/i,
      /secret\s*[=:]\s*\S+/i,
      /key\s*[=:]\s*\S+/i,
      /token\s*[=:]\s*\S+/i,
      /credential\s*[=:]\s*\S+/i
    ];

    for (const pattern of inlinePatterns) {
      if (pattern.test(value)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 脱敏字符串中的敏感信息
   */
  private sanitizeString(value: string): string {
    let sanitized = value;

    // 替换内嵌的敏感信息
    const replacements = [
      { pattern: /(password\s*[=:]\s*)\S+/gi, replacement: `$1${SANITIZED_PLACEHOLDER}` },
      { pattern: /(secret\s*[=:]\s*)\S+/gi, replacement: `$1${SANITIZED_PLACEHOLDER}` },
      { pattern: /(key\s*[=:]\s*)\S+/gi, replacement: `$1${SANITIZED_PLACEHOLDER}` },
      { pattern: /(token\s*[=:]\s*)\S+/gi, replacement: `$1${SANITIZED_PLACEHOLDER}` },
      { pattern: /(credential\s*[=:]\s*)\S+/gi, replacement: `$1${SANITIZED_PLACEHOLDER}` },
      { pattern: /(psk\s*[=:]\s*)\S+/gi, replacement: `$1${SANITIZED_PLACEHOLDER}` }
    ];

    for (const { pattern, replacement } of replacements) {
      sanitized = sanitized.replace(pattern, replacement);
    }

    return sanitized;
  }

  /**
   * 获取可用的配置段列表
   */
  getAvailableConfigSections(): string[] {
    return Object.keys(CONFIG_PATHS);
  }
}

// 导出单例实例
export const contextBuilderService = new ContextBuilderService();

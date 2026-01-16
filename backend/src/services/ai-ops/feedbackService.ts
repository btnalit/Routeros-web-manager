/**
 * FeedbackService 用户反馈服务
 * 负责收集和管理用户对告警的反馈
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 * - 10.1: 记录用户对告警的有用/无用反馈，包含时间戳和用户标识
 * - 10.2: 记录用户标记的漏报（false negative）
 * - 10.3: 记录用户标记的误报（false positive/noise）
 * - 10.4: 聚合每个告警规则的反馈统计
 * - 10.5: 标记高误报率的规则以供审查
 * - 10.6: 提供 API 查询反馈统计
 */

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  AlertFeedback,
  CreateAlertFeedbackInput,
  FeedbackStats,
  IFeedbackService,
} from '../../types/ai-ops';
import { logger } from '../../utils/logger';

const DATA_DIR = path.join(process.cwd(), 'data', 'ai-ops');
const FEEDBACK_DIR = path.join(DATA_DIR, 'feedback');
const ALERTS_FEEDBACK_DIR = path.join(FEEDBACK_DIR, 'alerts');
const STATS_FILE = path.join(FEEDBACK_DIR, 'stats.json');

// 默认高误报率阈值（30%）
const DEFAULT_FALSE_POSITIVE_THRESHOLD = 0.3;

/**
 * 获取日期字符串 (YYYY-MM-DD) - 使用 UTC 时间
 */
function getDateString(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toISOString().split('T')[0];
}

/**
 * 获取反馈文件路径
 */
function getFeedbackFilePath(dateStr: string): string {
  return path.join(ALERTS_FEEDBACK_DIR, `${dateStr}.json`);
}

export class FeedbackService implements IFeedbackService {
  private initialized = false;
  private statsCache: Map<string, FeedbackStats> = new Map();

  /**
   * 确保数据目录存在
   */
  private async ensureDataDir(): Promise<void> {
    try {
      await fs.mkdir(FEEDBACK_DIR, { recursive: true });
      await fs.mkdir(ALERTS_FEEDBACK_DIR, { recursive: true });
    } catch (error) {
      logger.error('Failed to create feedback directories:', error);
    }
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.ensureDataDir();
    await this.loadStats();
    this.initialized = true;
    logger.info('FeedbackService initialized');
  }

  /**
   * 加载统计数据
   */
  private async loadStats(): Promise<void> {
    try {
      const data = await fs.readFile(STATS_FILE, 'utf-8');
      const stats = JSON.parse(data) as FeedbackStats[];
      this.statsCache.clear();
      for (const stat of stats) {
        this.statsCache.set(stat.ruleId, stat);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // 文件不存在，使用空缓存
        this.statsCache.clear();
      } else {
        logger.error('Failed to load feedback stats:', error);
        this.statsCache.clear();
      }
    }
  }

  /**
   * 保存统计数据
   */
  private async saveStats(): Promise<void> {
    await this.ensureDataDir();
    const stats = Array.from(this.statsCache.values());
    await fs.writeFile(STATS_FILE, JSON.stringify(stats, null, 2), 'utf-8');
  }

  /**
   * 读取指定日期的反馈文件
   */
  private async readFeedbackFile(dateStr: string): Promise<AlertFeedback[]> {
    const filePath = getFeedbackFilePath(dateStr);
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) as AlertFeedback[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      logger.error(`Failed to read feedback file ${dateStr}:`, error);
      return [];
    }
  }

  /**
   * 写入指定日期的反馈文件
   */
  private async writeFeedbackFile(dateStr: string, feedbacks: AlertFeedback[]): Promise<void> {
    const filePath = getFeedbackFilePath(dateStr);
    await fs.writeFile(filePath, JSON.stringify(feedbacks, null, 2), 'utf-8');
  }

  /**
   * 列出所有反馈文件
   */
  private async listFeedbackFiles(): Promise<string[]> {
    try {
      await this.ensureDataDir();
      const files = await fs.readdir(ALERTS_FEEDBACK_DIR);
      return files
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.replace('.json', ''))
        .sort();
    } catch {
      return [];
    }
  }

  /**
   * 从告警 ID 中提取规则 ID
   * 告警 ID 格式通常包含规则信息，这里简化处理
   */
  private extractRuleIdFromAlertId(alertId: string): string {
    // 如果告警 ID 包含规则 ID 前缀，提取它
    // 否则返回 'unknown'
    // 实际实现中可能需要查询告警事件来获取规则 ID
    return alertId.split('-')[0] || 'unknown';
  }

  /**
   * 更新规则统计
   * Requirements: 10.4
   */
  private async updateRuleStats(
    ruleId: string,
    useful: boolean,
    tags?: string[]
  ): Promise<void> {
    let stats = this.statsCache.get(ruleId);
    
    if (!stats) {
      stats = {
        ruleId,
        totalAlerts: 0,
        usefulCount: 0,
        notUsefulCount: 0,
        falsePositiveRate: 0,
        lastUpdated: Date.now(),
      };
    }

    stats.totalAlerts++;
    
    if (useful) {
      stats.usefulCount++;
    } else {
      stats.notUsefulCount++;
    }

    // 检查是否标记为误报
    const isFalsePositive = tags?.includes('false_positive') || tags?.includes('noise');
    
    // 计算误报率
    // 误报 = 标记为无用且带有 false_positive 或 noise 标签
    // 简化处理：将所有 notUseful 视为潜在误报
    if (stats.totalAlerts > 0) {
      stats.falsePositiveRate = stats.notUsefulCount / stats.totalAlerts;
    }

    stats.lastUpdated = Date.now();
    this.statsCache.set(ruleId, stats);
    
    await this.saveStats();
  }

  /**
   * 记录反馈
   * Requirements: 10.1, 10.2, 10.3
   * 
   * @param feedback 反馈输入（不含 id 和 timestamp）
   * @returns 完整的反馈记录
   */
  async recordFeedback(feedback: CreateAlertFeedbackInput): Promise<AlertFeedback> {
    await this.ensureDataDir();

    const timestamp = Date.now();
    const alertFeedback: AlertFeedback = {
      id: uuidv4(),
      timestamp,
      ...feedback,
    };

    // 保存到日期分片文件
    const dateStr = getDateString(timestamp);
    const feedbacks = await this.readFeedbackFile(dateStr);
    feedbacks.push(alertFeedback);
    await this.writeFeedbackFile(dateStr, feedbacks);

    // 更新规则统计
    const ruleId = this.extractRuleIdFromAlertId(feedback.alertId);
    await this.updateRuleStats(ruleId, feedback.useful, feedback.tags);

    logger.debug(`Feedback recorded for alert ${feedback.alertId}: useful=${feedback.useful}`);
    return alertFeedback;
  }

  /**
   * 获取告警的反馈
   * Requirements: 10.6
   * 
   * @param alertId 告警 ID
   * @returns 该告警的所有反馈
   */
  async getFeedback(alertId: string): Promise<AlertFeedback[]> {
    await this.ensureDataDir();

    const allFiles = await this.listFeedbackFiles();
    const result: AlertFeedback[] = [];

    for (const dateStr of allFiles) {
      const feedbacks = await this.readFeedbackFile(dateStr);
      const matching = feedbacks.filter((f) => f.alertId === alertId);
      result.push(...matching);
    }

    // 按时间戳降序排序
    result.sort((a, b) => b.timestamp - a.timestamp);
    return result;
  }

  /**
   * 获取规则的反馈统计
   * Requirements: 10.4, 10.6
   * 
   * @param ruleId 规则 ID
   * @returns 规则的反馈统计
   */
  async getRuleStats(ruleId: string): Promise<FeedbackStats> {
    // 确保统计已加载
    if (!this.initialized) {
      await this.initialize();
    }

    const stats = this.statsCache.get(ruleId);
    
    if (!stats) {
      // 返回空统计
      return {
        ruleId,
        totalAlerts: 0,
        usefulCount: 0,
        notUsefulCount: 0,
        falsePositiveRate: 0,
        lastUpdated: Date.now(),
      };
    }

    return stats;
  }

  /**
   * 获取所有规则的反馈统计
   * Requirements: 10.4, 10.6
   * 
   * @returns 所有规则的反馈统计列表
   */
  async getAllRuleStats(): Promise<FeedbackStats[]> {
    // 确保统计已加载
    if (!this.initialized) {
      await this.initialize();
    }

    return Array.from(this.statsCache.values());
  }

  /**
   * 获取需要审查的规则（高误报率）
   * Requirements: 10.5
   * 
   * @param threshold 误报率阈值，默认 30%
   * @returns 高误报率的规则统计列表
   */
  async getRulesNeedingReview(threshold: number = DEFAULT_FALSE_POSITIVE_THRESHOLD): Promise<FeedbackStats[]> {
    // 确保统计已加载
    if (!this.initialized) {
      await this.initialize();
    }

    const allStats = Array.from(this.statsCache.values());
    
    // 过滤出高误报率的规则
    // 要求至少有一定数量的反馈才能判断
    const minFeedbackCount = 3;
    
    return allStats.filter((stats) => 
      stats.totalAlerts >= minFeedbackCount && 
      stats.falsePositiveRate >= threshold
    ).sort((a, b) => b.falsePositiveRate - a.falsePositiveRate);
  }

  /**
   * 导出反馈数据
   * Requirements: 10.6
   * 
   * @param from 开始时间戳（可选）
   * @param to 结束时间戳（可选）
   * @returns 时间范围内的所有反馈
   */
  async exportFeedback(from?: number, to?: number): Promise<AlertFeedback[]> {
    await this.ensureDataDir();

    const allFiles = await this.listFeedbackFiles();
    let result: AlertFeedback[] = [];

    for (const dateStr of allFiles) {
      const feedbacks = await this.readFeedbackFile(dateStr);
      result.push(...feedbacks);
    }

    // 应用时间过滤
    if (from !== undefined) {
      result = result.filter((f) => f.timestamp >= from);
    }
    if (to !== undefined) {
      result = result.filter((f) => f.timestamp <= to);
    }

    // 按时间戳升序排序（导出时通常按时间顺序）
    result.sort((a, b) => a.timestamp - b.timestamp);
    return result;
  }

  /**
   * 重新计算所有规则的统计数据
   * 用于数据修复或初始化
   */
  async recalculateAllStats(): Promise<void> {
    await this.ensureDataDir();

    const allFiles = await this.listFeedbackFiles();
    const statsMap = new Map<string, FeedbackStats>();

    for (const dateStr of allFiles) {
      const feedbacks = await this.readFeedbackFile(dateStr);
      
      for (const feedback of feedbacks) {
        const ruleId = this.extractRuleIdFromAlertId(feedback.alertId);
        
        let stats = statsMap.get(ruleId);
        if (!stats) {
          stats = {
            ruleId,
            totalAlerts: 0,
            usefulCount: 0,
            notUsefulCount: 0,
            falsePositiveRate: 0,
            lastUpdated: 0,
          };
          statsMap.set(ruleId, stats);
        }

        stats.totalAlerts++;
        if (feedback.useful) {
          stats.usefulCount++;
        } else {
          stats.notUsefulCount++;
        }
        
        if (feedback.timestamp > stats.lastUpdated) {
          stats.lastUpdated = feedback.timestamp;
        }
      }
    }

    // 计算误报率
    for (const stats of statsMap.values()) {
      if (stats.totalAlerts > 0) {
        stats.falsePositiveRate = stats.notUsefulCount / stats.totalAlerts;
      }
    }

    this.statsCache = statsMap;
    await this.saveStats();
    
    logger.info(`Recalculated stats for ${statsMap.size} rules`);
  }
}

// 导出单例实例
export const feedbackService = new FeedbackService();

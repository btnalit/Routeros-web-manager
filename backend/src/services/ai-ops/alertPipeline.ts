/**
 * AlertPipeline 告警处理流水线服务
 * 实现统一的告警处理流水线：归一化 → 去重 → 过滤 → 分析 → 决策
 *
 * Requirements: 4.1, 5.1, 6.1, 8.1
 * - 4.1: 将不同来源的事件归一化为统一格式
 * - 5.1: 过滤维护窗口期间的告警
 * - 6.1: 分析告警的潜在根因
 * - 8.1: 根据决策矩阵评估告警并确定处理动作
 *
 * 流水线阶段：
 * 1. normalize - 归一化：将 Syslog/AlertEvent 转换为 UnifiedEvent
 * 2. deduplicate - 去重：使用指纹缓存检查重复告警
 * 3. filter - 过滤：维护窗口、已知问题、瞬态抖动过滤
 * 4. analyze - 分析：根因分析和影响评估
 * 5. decide - 决策：智能决策引擎确定处理方式
 */

import {
  AlertEvent,
  SyslogEvent,
  UnifiedEvent,
  CompositeEvent,
  PipelineResult,
  PipelineStage,
  IAlertPipeline,
  FilterResult,
  RootCauseAnalysis,
  Decision,
  RemediationPlan,
} from '../../types/ai-ops';
import { logger } from '../../utils/logger';
import { alertPreprocessor } from './alertPreprocessor';
import { fingerprintCache } from './fingerprintCache';
import { noiseFilter } from './noiseFilter';
import { rootCauseAnalyzer } from './rootCauseAnalyzer';
import { decisionEngine } from './decisionEngine';
import { remediationAdvisor } from './remediationAdvisor';
import { auditLogger } from './auditLogger';

/**
 * 流水线配置
 */
interface PipelineConfig {
  /** 是否启用去重 */
  enableDeduplication: boolean;
  /** 是否启用过滤 */
  enableFiltering: boolean;
  /** 是否启用根因分析 */
  enableAnalysis: boolean;
  /** 是否启用决策引擎 */
  enableDecision: boolean;
  /** 是否自动执行决策 */
  autoExecuteDecision: boolean;
  /** 是否生成修复方案 */
  generateRemediationPlan: boolean;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: PipelineConfig = {
  enableDeduplication: true,
  enableFiltering: true,
  enableAnalysis: true,
  enableDecision: true,
  autoExecuteDecision: true,
  generateRemediationPlan: true,
};

/**
 * 流水线统计信息
 */
interface PipelineStats {
  processed: number;
  filtered: number;
  deduplicated: number;
  analyzed: number;
  decided: number;
  errors: number;
}


export class AlertPipeline implements IAlertPipeline {
  private config: PipelineConfig;
  private stats: PipelineStats = {
    processed: 0,
    filtered: 0,
    deduplicated: 0,
    analyzed: 0,
    decided: 0,
    errors: 0,
  };
  private initialized = false;

  constructor(config?: Partial<PipelineConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    logger.info('AlertPipeline initialized', { config: this.config });
  }

  /**
   * 初始化流水线
   * 性能优化：并行初始化依赖服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // 并行初始化依赖服务（这些服务之间没有依赖关系）
    const startTime = Date.now();
    await Promise.all([
      noiseFilter.initialize(),
      rootCauseAnalyzer.initialize(),
      decisionEngine.initialize(),
    ]);

    this.initialized = true;
    logger.info(`AlertPipeline dependencies initialized in ${Date.now() - startTime}ms`);
  }

  /**
   * 处理告警事件
   * 完整流水线：归一化 → 去重 → 过滤 → 分析 → 决策
   *
   * @param event Syslog 事件或告警事件
   * @returns 流水线处理结果
   */
  async process(event: SyslogEvent | AlertEvent): Promise<PipelineResult> {
    await this.initialize();

    const startTime = Date.now();
    this.stats.processed++;

    try {
      // Stage 1: Normalize - 归一化
      const normalizedEvent = await this.stageNormalize(event);
      
      // Stage 2: Deduplicate - 去重
      if (this.config.enableDeduplication) {
        const isDuplicate = await this.stageDeduplicate(normalizedEvent);
        if (isDuplicate) {
          this.stats.deduplicated++;
          return this.createResult(normalizedEvent, 'deduplicate', true, {
            filtered: true,
            reason: undefined, // Deduplication is not a FilterReason, handled separately
            details: 'Alert suppressed by fingerprint deduplication',
          });
        }
      }

      // Stage 3: Filter - 过滤
      if (this.config.enableFiltering) {
        const filterResult = await this.stageFilter(normalizedEvent);
        if (filterResult.filtered) {
          this.stats.filtered++;
          return this.createResult(normalizedEvent, 'filter', true, filterResult);
        }
      }

      // Stage 4: Analyze - 根因分析
      let analysis: RootCauseAnalysis | undefined;
      if (this.config.enableAnalysis) {
        analysis = await this.stageAnalyze(normalizedEvent);
        this.stats.analyzed++;
      }

      // Stage 5: Decide - 智能决策
      let decision: Decision | undefined;
      let plan: RemediationPlan | undefined;

      if (this.config.enableDecision) {
        decision = await this.stageDecide(normalizedEvent, analysis);
        this.stats.decided++;

        // 生成修复方案（如果启用且有分析结果）
        if (this.config.generateRemediationPlan && analysis) {
          try {
            plan = await remediationAdvisor.generatePlan(analysis);
          } catch (error) {
            logger.warn('Failed to generate remediation plan:', error);
          }
        }

        // 自动执行决策（如果启用）
        // 传递原始事件信息以便发送更详细的通知
        if (this.config.autoExecuteDecision && decision) {
          try {
            // 将 CompositeEvent 转换为 UnifiedEvent（如果需要）
            const eventForDecision = 'isComposite' in normalizedEvent && normalizedEvent.isComposite
              ? normalizedEvent as UnifiedEvent  // CompositeEvent extends UnifiedEvent
              : normalizedEvent;
            await decisionEngine.executeDecision(decision, plan, eventForDecision);
          } catch (error) {
            logger.warn('Failed to execute decision:', error);
          }
        }
      }

      const duration = Date.now() - startTime;
      logger.info(`Pipeline processed event ${normalizedEvent.id} in ${duration}ms`, {
        stage: 'decide',
        filtered: false,
        hasAnalysis: !!analysis,
        hasDecision: !!decision,
        hasPlan: !!plan,
      });

      return this.createResult(normalizedEvent, 'decide', false, undefined, analysis, decision, plan);

    } catch (error) {
      this.stats.errors++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Pipeline processing error:', error);

      // 记录错误到审计日志
      await auditLogger.log({
        action: 'alert_trigger',
        actor: 'system',
        details: {
          trigger: 'pipeline_error',
          error: errorMessage,
          metadata: {
            eventId: this.getEventId(event),
          },
        },
      });

      // 返回错误结果，但仍然尝试归一化事件
      const normalizedEvent = alertPreprocessor.normalize(event);
      return this.createResult(normalizedEvent, 'normalize', false, {
        filtered: false,
        reason: undefined,
        details: `Pipeline error: ${errorMessage}`,
      });
    }
  }


  /**
   * Stage 1: 归一化
   * 将不同来源的事件转换为统一格式
   */
  private async stageNormalize(event: SyslogEvent | AlertEvent): Promise<UnifiedEvent | CompositeEvent> {
    logger.debug('Pipeline stage: normalize');
    return alertPreprocessor.process(event);
  }

  /**
   * Stage 2: 去重
   * 使用指纹缓存检查是否为重复告警
   * 
   * 注意：对于来自 AlertEngine 的告警，已经在 evaluate() 中做过指纹检查
   * 这里主要处理来自 Syslog 等其他来源的事件
   */
  private async stageDeduplicate(event: UnifiedEvent | CompositeEvent): Promise<boolean> {
    logger.debug('Pipeline stage: deduplicate');

    // 复合事件不进行去重（已经是聚合后的）
    if ('isComposite' in event && event.isComposite) {
      return false;
    }

    // 来自 metrics（AlertEngine）的事件已经在 AlertEngine.evaluate() 中做过去重
    // 跳过重复检查，避免双重去重导致的问题
    if (event.source === 'metrics') {
      logger.debug(`Skipping deduplication for metrics event ${event.id} (already checked in AlertEngine)`);
      return false;
    }

    // 为 UnifiedEvent 生成指纹
    // 需要将 UnifiedEvent 转换为 AlertEvent 格式用于指纹生成
    const alertLikeEvent = this.convertToAlertLike(event);
    const fingerprint = fingerprintCache.generateFingerprint(alertLikeEvent);

    if (fingerprintCache.exists(fingerprint)) {
      // 更新指纹缓存
      fingerprintCache.set(fingerprint);
      logger.info(`Event deduplicated: ${event.id}, fingerprint: ${fingerprint}`);
      return true;
    }

    // 添加新指纹
    fingerprintCache.set(fingerprint);
    return false;
  }

  /**
   * Stage 3: 过滤
   * 检查维护窗口、已知问题、瞬态抖动
   */
  private async stageFilter(event: UnifiedEvent | CompositeEvent): Promise<FilterResult> {
    logger.debug('Pipeline stage: filter');
    return noiseFilter.filter(event);
  }

  /**
   * Stage 4: 根因分析
   * 分析告警的根本原因
   */
  private async stageAnalyze(event: UnifiedEvent | CompositeEvent): Promise<RootCauseAnalysis> {
    logger.debug('Pipeline stage: analyze');
    return rootCauseAnalyzer.analyzeSingle(event);
  }

  /**
   * Stage 5: 智能决策
   * 根据决策矩阵确定处理方式
   */
  private async stageDecide(
    event: UnifiedEvent | CompositeEvent,
    analysis?: RootCauseAnalysis
  ): Promise<Decision> {
    logger.debug('Pipeline stage: decide');
    return decisionEngine.decide(event, analysis);
  }

  /**
   * 将 UnifiedEvent 转换为 AlertEvent 格式（用于指纹生成）
   */
  private convertToAlertLike(event: UnifiedEvent): AlertEvent {
    // 确保 metric 是有效的 MetricType，否则使用默认值
    const validMetrics = ['cpu', 'memory', 'disk', 'interface_status', 'interface_traffic'];
    const metric = event.alertRuleInfo?.metric;
    const validMetric = metric && validMetrics.includes(metric) 
      ? metric as 'cpu' | 'memory' | 'disk' | 'interface_status' | 'interface_traffic'
      : 'cpu'; // 默认使用 cpu 作为 fallback

    return {
      id: event.id,
      ruleId: event.alertRuleInfo?.ruleId || event.category,
      ruleName: event.alertRuleInfo?.ruleName || event.category,
      severity: event.severity,
      metric: validMetric,
      currentValue: event.alertRuleInfo?.currentValue || 0,
      threshold: event.alertRuleInfo?.threshold || 0,
      message: event.message,
      status: 'active',
      triggeredAt: event.timestamp,
    };
  }

  /**
   * 获取事件 ID
   */
  private getEventId(event: SyslogEvent | AlertEvent): string {
    if ('source' in event && event.source === 'syslog') {
      return (event as SyslogEvent).id;
    }
    return (event as AlertEvent).id;
  }

  /**
   * 创建流水线结果
   */
  private createResult(
    event: UnifiedEvent | CompositeEvent,
    stage: PipelineStage,
    filtered: boolean,
    filterResult?: FilterResult,
    analysis?: RootCauseAnalysis,
    decision?: Decision,
    plan?: RemediationPlan
  ): PipelineResult {
    return {
      event,
      stage,
      filtered,
      filterResult,
      analysis,
      decision,
      plan,
    };
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    processed: number;
    filtered: number;
    analyzed: number;
    decided: number;
  } {
    return {
      processed: this.stats.processed,
      filtered: this.stats.filtered + this.stats.deduplicated,
      analyzed: this.stats.analyzed,
      decided: this.stats.decided,
    };
  }

  /**
   * 获取详细统计信息
   */
  getDetailedStats(): PipelineStats {
    return { ...this.stats };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      processed: 0,
      filtered: 0,
      deduplicated: 0,
      analyzed: 0,
      decided: 0,
      errors: 0,
    };
    logger.info('Pipeline stats reset');
  }

  /**
   * 获取配置
   */
  getConfig(): PipelineConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<PipelineConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Pipeline config updated', { config: this.config });
  }
}

// 导出单例实例
export const alertPipeline = new AlertPipeline();

/**
 * 初始化告警处理流水线并集成到 SyslogReceiver
 * 调用此函数后，所有 Syslog 事件将自动通过流水线处理
 */
export function initializeAlertPipeline(): void {
  // 延迟导入以避免循环依赖
  const { syslogReceiver } = require('./syslogReceiver');
  
  // 注册 Syslog 事件处理器
  syslogReceiver.onMessage(async (event: SyslogEvent) => {
    try {
      const result = await alertPipeline.process(event);
      logger.debug(`Syslog event processed through pipeline: ${event.id}, filtered: ${result.filtered}`);
    } catch (error) {
      logger.error('Failed to process syslog event through pipeline:', error);
    }
  });
  
  logger.info('AlertPipeline integrated with SyslogReceiver');
}

/**
 * DecisionEngine 智能决策引擎服务
 * 根据多种因素决定告警的处理方式
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9
 * - 8.1: 根据决策矩阵评估告警并确定处理动作
 * - 8.2: 支持决策类型：auto_execute, notify_and_wait, escalate, silence
 * - 8.3: 决策考虑因素：严重级别、时间、历史成功率、影响范围
 * - 8.4: auto_execute 决策触发自动修复
 * - 8.5: notify_and_wait 决策发送通知并等待确认
 * - 8.6: escalate 决策通知更高级别人员并提升优先级
 * - 8.7: silence 决策抑制告警但记录审计日志
 * - 8.8: 支持通过配置接口配置决策矩阵
 * - 8.9: 决策时记录决策推理用于审计
 */

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  UnifiedEvent,
  RootCauseAnalysis,
  RemediationPlan,
  Decision,
  DecisionType,
  DecisionRule,
  DecisionFactor,
  DecisionContext,
  DecisionCondition,
  DecisionFactorScore,
  ImpactAssessment,
  ImpactScope,
  IDecisionEngine,
  CreateDecisionRuleInput,
  UpdateDecisionRuleInput,
} from '../../types/ai-ops';
import { logger } from '../../utils/logger';
import { auditLogger } from './auditLogger';
import { notificationService } from './notificationService';
import { remediationAdvisor } from './remediationAdvisor';

const DATA_DIR = path.join(process.cwd(), 'data', 'ai-ops');
const DECISIONS_DIR = path.join(DATA_DIR, 'decisions');
const RULES_FILE = path.join(DECISIONS_DIR, 'rules.json');
const HISTORY_DIR = path.join(DECISIONS_DIR, 'history');

/**
 * Get date string (YYYY-MM-DD)
 */
function getDateString(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toISOString().split('T')[0];
}

/**
 * Get decision history file path for a date
 */
function getHistoryFilePath(dateStr: string): string {
  return path.join(HISTORY_DIR, `${dateStr}.json`);
}


/**
 * Default decision factors
 * Requirements: 8.3 - 决策考虑因素
 */
const DEFAULT_FACTORS: DecisionFactor[] = [
  {
    name: 'severity',
    weight: 0.35,
    evaluate: (event: UnifiedEvent): number => {
      // Map severity to score (0-1)
      const severityScores: Record<string, number> = {
        info: 0.1,
        warning: 0.4,
        critical: 0.8,
        emergency: 1.0,
      };
      return severityScores[event.severity] || 0.5;
    },
  },
  {
    name: 'time_of_day',
    weight: 0.15,
    evaluate: (_event: UnifiedEvent, context: DecisionContext): number => {
      // Business hours (9-18) get lower score (more likely to wait for human)
      // Off-hours get higher score (more likely to auto-execute)
      const hour = context.currentTime.getHours();
      if (hour >= 9 && hour < 18) {
        return 0.3; // Business hours - prefer human intervention
      } else if (hour >= 0 && hour < 6) {
        return 0.9; // Night - prefer auto-execution
      }
      return 0.6; // Evening/early morning
    },
  },
  {
    name: 'historical_success_rate',
    weight: 0.25,
    evaluate: (_event: UnifiedEvent, context: DecisionContext): number => {
      // Higher success rate = higher score for auto-execution
      return context.historicalSuccessRate;
    },
  },
  {
    name: 'affected_scope',
    weight: 0.25,
    evaluate: (_event: UnifiedEvent, context: DecisionContext): number => {
      // Larger scope = lower score (more caution needed)
      const scopeScores: Record<ImpactScope, number> = {
        local: 0.8,
        partial: 0.5,
        widespread: 0.2,
      };
      return scopeScores[context.affectedScope.scope] || 0.5;
    },
  },
];

/**
 * Default decision rules
 * Requirements: 8.8 - 支持配置决策矩阵
 */
const DEFAULT_RULES: DecisionRule[] = [
  {
    id: 'rule-emergency-escalate',
    name: 'Emergency Escalation',
    priority: 1,
    conditions: [
      { factor: 'severity', operator: 'gte', value: 0.95 },
    ],
    action: 'escalate',
    enabled: true,
  },
  {
    id: 'rule-critical-notify',
    name: 'Critical Notification',
    priority: 2,
    conditions: [
      { factor: 'severity', operator: 'gte', value: 0.7 },
      { factor: 'affected_scope', operator: 'lt', value: 0.5 },
    ],
    action: 'notify_and_wait',
    enabled: true,
  },
  {
    id: 'rule-low-severity-auto',
    name: 'Low Severity Auto-Execute',
    priority: 3,
    conditions: [
      { factor: 'severity', operator: 'lt', value: 0.3 },
      { factor: 'historical_success_rate', operator: 'gte', value: 0.8 },
    ],
    action: 'auto_execute',
    enabled: true,
  },
  {
    id: 'rule-off-hours-auto',
    name: 'Off-Hours Auto-Execute',
    priority: 4,
    conditions: [
      { factor: 'time_of_day', operator: 'gte', value: 0.7 },
      { factor: 'severity', operator: 'lt', value: 0.6 },
      { factor: 'historical_success_rate', operator: 'gte', value: 0.7 },
    ],
    action: 'auto_execute',
    enabled: true,
  },
  {
    id: 'rule-info-silence',
    name: 'Info Level Silence',
    priority: 5,
    conditions: [
      { factor: 'severity', operator: 'lte', value: 0.15 },
    ],
    action: 'silence',
    enabled: true,
  },
  {
    id: 'rule-default-notify',
    name: 'Default Notification',
    priority: 100,
    conditions: [], // Always matches as fallback
    action: 'notify_and_wait',
    enabled: true,
  },
];


export class DecisionEngine implements IDecisionEngine {
  private initialized = false;
  private rules: DecisionRule[] = [];
  private factors: Map<string, DecisionFactor> = new Map();
  private decisionCache: Map<string, Decision> = new Map();

  constructor() {
    // Register default factors
    for (const factor of DEFAULT_FACTORS) {
      this.factors.set(factor.name, factor);
    }
  }

  /**
   * Ensure data directories exist
   */
  private async ensureDataDirs(): Promise<void> {
    try {
      await fs.mkdir(DECISIONS_DIR, { recursive: true });
      await fs.mkdir(HISTORY_DIR, { recursive: true });
    } catch (error) {
      logger.error('Failed to create decision directories:', error);
    }
  }

  /**
   * Initialize service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.ensureDataDirs();
    await this.loadRules();
    this.initialized = true;
    logger.info('DecisionEngine initialized');
  }

  /**
   * Load decision rules from disk
   */
  private async loadRules(): Promise<void> {
    try {
      const data = await fs.readFile(RULES_FILE, 'utf-8');
      this.rules = JSON.parse(data) as DecisionRule[];
      logger.info(`Loaded ${this.rules.length} decision rules`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Initialize with default rules
        this.rules = [...DEFAULT_RULES];
        await this.saveRules();
        logger.info('Initialized with default decision rules');
      } else {
        logger.error('Failed to load decision rules:', error);
        this.rules = [...DEFAULT_RULES];
      }
    }
  }

  /**
   * Save decision rules to disk
   */
  private async saveRules(): Promise<void> {
    await this.ensureDataDirs();
    await fs.writeFile(RULES_FILE, JSON.stringify(this.rules, null, 2), 'utf-8');
  }

  /**
   * Read decision history for a date
   */
  private async readHistoryFile(dateStr: string): Promise<Decision[]> {
    const filePath = getHistoryFilePath(dateStr);
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) as Decision[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      logger.error(`Failed to read decision history ${dateStr}:`, error);
      return [];
    }
  }

  /**
   * Write decision history for a date
   */
  private async writeHistoryFile(dateStr: string, decisions: Decision[]): Promise<void> {
    await this.ensureDataDirs();
    const filePath = getHistoryFilePath(dateStr);
    await fs.writeFile(filePath, JSON.stringify(decisions, null, 2), 'utf-8');
  }

  /**
   * Save a decision to history
   */
  private async saveDecision(decision: Decision): Promise<void> {
    const dateStr = getDateString(decision.timestamp);
    const decisions = await this.readHistoryFile(dateStr);
    
    const existingIndex = decisions.findIndex((d) => d.id === decision.id);
    if (existingIndex >= 0) {
      decisions[existingIndex] = decision;
    } else {
      decisions.push(decision);
    }
    
    await this.writeHistoryFile(dateStr, decisions);
    this.decisionCache.set(decision.id, decision);
  }


  // ==================== Decision Making ====================

  /**
   * Make a decision for an event
   * Requirements: 8.1, 8.2, 8.3, 8.9
   */
  async decide(event: UnifiedEvent, analysis?: RootCauseAnalysis): Promise<Decision> {
    await this.initialize();

    const now = Date.now();
    const decisionId = uuidv4();

    // Build decision context
    const context = await this.buildDecisionContext(event, analysis);

    // Evaluate all factors
    const factorScores = this.evaluateFactors(event, context);

    // Find matching rule
    const matchedRule = this.findMatchingRule(factorScores);

    // Determine action
    const action = matchedRule?.action || 'notify_and_wait';

    // Build reasoning
    const reasoning = this.buildReasoning(event, factorScores, matchedRule, action);

    const decision: Decision = {
      id: decisionId,
      alertId: event.id,
      timestamp: now,
      action,
      reasoning,
      factors: factorScores,
      matchedRule: matchedRule?.id,
      executed: false,
    };

    // Save decision
    await this.saveDecision(decision);

    // Log audit
    // Requirements: 8.9 - 决策时记录决策推理用于审计
    await auditLogger.log({
      action: 'alert_trigger',
      actor: 'system',
      details: {
        trigger: 'decision_made',
        metadata: {
          decisionId: decision.id,
          alertId: event.id,
          action: decision.action,
          matchedRule: decision.matchedRule,
          reasoning: decision.reasoning,
          factors: decision.factors,
        },
      },
    });

    logger.info(`Decision made for event ${event.id}: ${action} (rule: ${matchedRule?.name || 'default'})`);
    return decision;
  }

  /**
   * Build decision context
   */
  private async buildDecisionContext(
    event: UnifiedEvent,
    analysis?: RootCauseAnalysis
  ): Promise<DecisionContext> {
    // Get recent decisions for historical success rate
    const recentDecisions = await this.getDecisionHistory(undefined, 100);
    
    // Calculate historical success rate
    const executedDecisions = recentDecisions.filter((d) => d.executed && d.executionResult);
    const successfulDecisions = executedDecisions.filter((d) => d.executionResult?.success);
    const historicalSuccessRate = executedDecisions.length > 0
      ? successfulDecisions.length / executedDecisions.length
      : 0.5; // Default to 50% if no history

    // Get affected scope from analysis or estimate
    const affectedScope: ImpactAssessment = analysis?.impact || {
      scope: this.estimateScope(event),
      affectedResources: [event.category],
      estimatedUsers: this.estimateUsers(event),
      services: [],
      networkSegments: [],
    };

    return {
      currentTime: new Date(),
      historicalSuccessRate,
      affectedScope,
      recentDecisions: recentDecisions.slice(0, 10),
    };
  }

  /**
   * Estimate impact scope from event
   */
  private estimateScope(event: UnifiedEvent): ImpactScope {
    if (event.severity === 'emergency') return 'widespread';
    if (event.severity === 'critical') return 'partial';
    return 'local';
  }

  /**
   * Estimate affected users from event
   */
  private estimateUsers(event: UnifiedEvent): number {
    const baseEstimates: Record<string, number> = {
      emergency: 100,
      critical: 50,
      warning: 10,
      info: 1,
    };
    return baseEstimates[event.severity] || 5;
  }

  /**
   * Evaluate all factors for an event
   * Requirements: 8.3 - 决策考虑因素
   */
  private evaluateFactors(event: UnifiedEvent, context: DecisionContext): DecisionFactorScore[] {
    const scores: DecisionFactorScore[] = [];

    for (const [name, factor] of this.factors) {
      try {
        const score = factor.evaluate(event, context);
        scores.push({
          name,
          score: Math.max(0, Math.min(1, score)), // Clamp to [0, 1]
          weight: factor.weight,
        });
      } catch (error) {
        logger.warn(`Failed to evaluate factor ${name}:`, error);
        scores.push({
          name,
          score: 0.5, // Default to neutral
          weight: factor.weight,
        });
      }
    }

    return scores;
  }


  /**
   * Find matching rule based on factor scores
   */
  private findMatchingRule(factorScores: DecisionFactorScore[]): DecisionRule | null {
    // Sort rules by priority (lower number = higher priority)
    const sortedRules = [...this.rules]
      .filter((r) => r.enabled)
      .sort((a, b) => a.priority - b.priority);

    // Create score map for easy lookup
    const scoreMap = new Map<string, number>();
    for (const fs of factorScores) {
      scoreMap.set(fs.name, fs.score);
    }

    // Find first matching rule
    for (const rule of sortedRules) {
      if (this.ruleMatches(rule, scoreMap)) {
        return rule;
      }
    }

    return null;
  }

  /**
   * Check if a rule matches the current factor scores
   */
  private ruleMatches(rule: DecisionRule, scoreMap: Map<string, number>): boolean {
    // Empty conditions = always matches (fallback rule)
    if (rule.conditions.length === 0) {
      return true;
    }

    // All conditions must match
    return rule.conditions.every((condition) => {
      const score = scoreMap.get(condition.factor);
      if (score === undefined) {
        return false;
      }
      return this.evaluateCondition(score, condition);
    });
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(score: number, condition: DecisionCondition): boolean {
    switch (condition.operator) {
      case 'gt':
        return score > condition.value;
      case 'lt':
        return score < condition.value;
      case 'eq':
        return Math.abs(score - condition.value) < 0.001;
      case 'gte':
        return score >= condition.value;
      case 'lte':
        return score <= condition.value;
      default:
        return false;
    }
  }

  /**
   * Build reasoning string for audit
   * Requirements: 8.9 - 决策时记录决策推理用于审计
   */
  private buildReasoning(
    event: UnifiedEvent,
    factorScores: DecisionFactorScore[],
    matchedRule: DecisionRule | null,
    action: DecisionType
  ): string {
    const parts: string[] = [];

    // Event summary
    parts.push(`Event: ${event.category} - ${event.severity} severity`);

    // Factor scores summary
    const factorSummary = factorScores
      .map((f) => `${f.name}=${f.score.toFixed(2)}`)
      .join(', ');
    parts.push(`Factors: ${factorSummary}`);

    // Rule match
    if (matchedRule) {
      parts.push(`Matched rule: "${matchedRule.name}" (priority ${matchedRule.priority})`);
    } else {
      parts.push('No rule matched, using default action');
    }

    // Action explanation
    const actionExplanations: Record<DecisionType, string> = {
      auto_execute: 'Automatic remediation will be triggered',
      notify_and_wait: 'Notification sent, awaiting human confirmation',
      escalate: 'Escalating to higher-level personnel',
      silence: 'Alert suppressed but logged for audit',
    };
    parts.push(`Decision: ${action} - ${actionExplanations[action]}`);

    return parts.join('. ');
  }


  // ==================== Decision Execution ====================

  /**
   * Execute a decision
   * Requirements: 8.4, 8.5, 8.6, 8.7
   * 
   * @param decision 决策对象
   * @param plan 可选的修复方案
   * @param event 可选的原始事件（用于发送更详细的通知）
   */
  async executeDecision(
    decision: Decision, 
    plan?: RemediationPlan,
    event?: UnifiedEvent
  ): Promise<void> {
    await this.initialize();

    try {
      switch (decision.action) {
        case 'auto_execute':
          // Requirements: 8.4 - auto_execute 决策触发自动修复
          await this.executeAutoExecute(decision, plan);
          break;

        case 'notify_and_wait':
          // Requirements: 8.5 - notify_and_wait 决策发送通知并等待确认
          await this.executeNotifyAndWait(decision, event);
          break;

        case 'escalate':
          // Requirements: 8.6 - escalate 决策通知更高级别人员并提升优先级
          await this.executeEscalate(decision, event);
          break;

        case 'silence':
          // Requirements: 8.7 - silence 决策抑制告警但记录审计日志
          await this.executeSilence(decision);
          break;

        default:
          logger.warn(`Unknown decision action: ${decision.action}`);
      }

      // Update decision as executed
      decision.executed = true;
      decision.executionResult = {
        success: true,
        details: `Decision ${decision.action} executed successfully`,
      };
      await this.saveDecision(decision);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to execute decision ${decision.id}:`, error);

      decision.executed = true;
      decision.executionResult = {
        success: false,
        details: `Execution failed: ${errorMessage}`,
      };
      await this.saveDecision(decision);

      // Log failure
      await auditLogger.log({
        action: 'alert_trigger',
        actor: 'system',
        details: {
          trigger: 'decision_execution_failed',
          error: errorMessage,
          metadata: {
            decisionId: decision.id,
            action: decision.action,
          },
        },
      });
    }
  }

  /**
   * Execute auto_execute decision
   * Requirements: 8.4
   */
  private async executeAutoExecute(decision: Decision, plan?: RemediationPlan): Promise<void> {
    logger.info(`Executing auto_execute decision ${decision.id}`);

    if (plan) {
      // Execute auto-executable steps from the plan
      try {
        const results = await remediationAdvisor.executeAutoSteps(plan.id);
        const allSucceeded = results.every((r) => r.success);
        
        logger.info(
          `Auto-execution completed for plan ${plan.id}: ${results.length} steps, ` +
          `success: ${allSucceeded}`
        );
      } catch (error) {
        logger.error(`Auto-execution failed for plan ${plan.id}:`, error);
        throw error;
      }
    } else {
      // No plan provided, just log the decision
      logger.info(`Auto-execute decision ${decision.id} - no remediation plan provided`);
    }

    // Log audit
    await auditLogger.log({
      action: 'remediation_execute',
      actor: 'system',
      details: {
        trigger: 'auto_execute_decision',
        metadata: {
          decisionId: decision.id,
          alertId: decision.alertId,
          planId: plan?.id,
        },
      },
    });
  }

  /**
   * Execute notify_and_wait decision
   * Requirements: 8.5
   */
  private async executeNotifyAndWait(decision: Decision, event?: UnifiedEvent): Promise<void> {
    logger.info(`Executing notify_and_wait decision ${decision.id}`);

    // Get all enabled notification channels
    const channels = await notificationService.getChannels();
    const enabledChannelIds = channels
      .filter((c) => c.enabled)
      .map((c) => c.id);

    if (enabledChannelIds.length > 0) {
      // 构建通知标题和内容
      const severityEmoji: Record<string, string> = {
        info: '📢',
        warning: '⚠️',
        critical: '🔴',
        emergency: '🚨',
      };
      
      const severity = event?.severity || 'warning';
      const emoji = severityEmoji[severity] || '⚠️';
      const category = event?.category || 'Unknown';
      const message = event?.message || decision.reasoning;
      
      const title = `${emoji} ${severity.toUpperCase()} - ${category}`;
      const body = `${message}\n\n` +
            `决策: ${decision.action}\n` +
            `原因: ${decision.reasoning}`;

      await notificationService.send(enabledChannelIds, {
        type: 'alert',
        title,
        body,
        data: {
          decisionId: decision.id,
          alertId: decision.alertId,
          action: decision.action,
          severity,
          category,
          factors: decision.factors,
        },
      });
    }

    // Log audit
    await auditLogger.log({
      action: 'alert_trigger',
      actor: 'system',
      details: {
        trigger: 'notify_and_wait_decision',
        metadata: {
          decisionId: decision.id,
          alertId: decision.alertId,
          notifiedChannels: enabledChannelIds.length,
        },
      },
    });
  }


  /**
   * Execute escalate decision
   * Requirements: 8.6
   */
  private async executeEscalate(decision: Decision, event?: UnifiedEvent): Promise<void> {
    logger.info(`Executing escalate decision ${decision.id}`);

    // Get all enabled notification channels
    const channels = await notificationService.getChannels();
    const enabledChannelIds = channels
      .filter((c) => c.enabled)
      .map((c) => c.id);

    if (enabledChannelIds.length > 0) {
      const category = event?.category || 'Unknown';
      const message = event?.message || decision.reasoning;
      const severity = event?.severity || 'emergency';
      
      await notificationService.send(enabledChannelIds, {
        type: 'alert',
        title: `🚨 紧急升级: ${category}`,
        body: `此告警已升级，需要立即处理！\n\n` +
              `${message}\n\n` +
              `严重级别: ${severity.toUpperCase()}\n` +
              `决策原因: ${decision.reasoning}\n\n` +
              `优先级: 高 - 请立即响应！`,
        data: {
          decisionId: decision.id,
          alertId: decision.alertId,
          action: decision.action,
          priority: 'high',
          escalated: true,
          severity,
          category,
          factors: decision.factors,
        },
      });
    }

    // Log audit
    await auditLogger.log({
      action: 'alert_trigger',
      actor: 'system',
      details: {
        trigger: 'escalate_decision',
        metadata: {
          decisionId: decision.id,
          alertId: decision.alertId,
          escalatedTo: enabledChannelIds,
        },
      },
    });
  }

  /**
   * Execute silence decision
   * Requirements: 8.7
   */
  private async executeSilence(decision: Decision): Promise<void> {
    logger.info(`Executing silence decision ${decision.id}`);

    // Silence means we suppress the alert but still log it
    // No notification is sent, but audit log is recorded

    await auditLogger.log({
      action: 'alert_trigger',
      actor: 'system',
      details: {
        trigger: 'silence_decision',
        metadata: {
          decisionId: decision.id,
          alertId: decision.alertId,
          reasoning: decision.reasoning,
          silenced: true,
        },
      },
    });
  }

  // ==================== Rule Management ====================

  /**
   * Add a decision rule
   * Requirements: 8.8
   */
  addRule(rule: DecisionRule): void {
    const existingIndex = this.rules.findIndex((r) => r.id === rule.id);
    if (existingIndex >= 0) {
      this.rules[existingIndex] = rule;
      logger.info(`Decision rule updated: ${rule.name}`);
    } else {
      this.rules.push(rule);
      logger.info(`Decision rule added: ${rule.name}`);
    }
    this.saveRules().catch((err) => logger.error('Failed to save rules:', err));
  }

  /**
   * Create a new decision rule
   * Requirements: 8.8
   */
  async createRule(input: CreateDecisionRuleInput): Promise<DecisionRule> {
    await this.initialize();

    const now = Date.now();
    const rule: DecisionRule = {
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      ...input,
    };

    this.rules.push(rule);
    await this.saveRules();

    logger.info(`Decision rule created: ${rule.name}`);
    return rule;
  }

  /**
   * Update a decision rule
   * Requirements: 8.8
   */
  updateRule(id: string, updates: Partial<DecisionRule>): void {
    const index = this.rules.findIndex((r) => r.id === id);
    if (index === -1) {
      throw new Error(`Decision rule not found: ${id}`);
    }

    const rule = this.rules[index];
    this.rules[index] = {
      ...rule,
      ...updates,
      id: rule.id, // Preserve ID
      updatedAt: Date.now(),
    };

    logger.info(`Decision rule updated: ${this.rules[index].name}`);
    this.saveRules().catch((err) => logger.error('Failed to save rules:', err));
  }

  /**
   * Update a decision rule (async version)
   * Requirements: 8.8
   */
  async updateRuleAsync(id: string, updates: UpdateDecisionRuleInput): Promise<DecisionRule> {
    await this.initialize();

    const index = this.rules.findIndex((r) => r.id === id);
    if (index === -1) {
      throw new Error(`Decision rule not found: ${id}`);
    }

    const rule = this.rules[index];
    const updatedRule: DecisionRule = {
      ...rule,
      ...updates,
      id: rule.id,
      updatedAt: Date.now(),
    };

    this.rules[index] = updatedRule;
    await this.saveRules();

    logger.info(`Decision rule updated: ${updatedRule.name}`);
    return updatedRule;
  }

  /**
   * Remove a decision rule
   * Requirements: 8.8
   */
  removeRule(id: string): void {
    const index = this.rules.findIndex((r) => r.id === id);
    if (index === -1) {
      throw new Error(`Decision rule not found: ${id}`);
    }

    const rule = this.rules[index];
    this.rules.splice(index, 1);

    logger.info(`Decision rule removed: ${rule.name}`);
    this.saveRules().catch((err) => logger.error('Failed to save rules:', err));
  }

  /**
   * Delete a decision rule (async version)
   * Requirements: 8.8
   */
  async deleteRule(id: string): Promise<void> {
    await this.initialize();

    const index = this.rules.findIndex((r) => r.id === id);
    if (index === -1) {
      throw new Error(`Decision rule not found: ${id}`);
    }

    const rule = this.rules[index];
    this.rules.splice(index, 1);
    await this.saveRules();

    logger.info(`Decision rule deleted: ${rule.name}`);
  }

  /**
   * Get all decision rules
   * Requirements: 8.8
   */
  getRules(): DecisionRule[] {
    return [...this.rules];
  }

  /**
   * Get a decision rule by ID
   */
  async getRuleById(id: string): Promise<DecisionRule | null> {
    await this.initialize();
    return this.rules.find((r) => r.id === id) || null;
  }


  // ==================== Factor Management ====================

  /**
   * Register a decision factor
   */
  registerFactor(factor: DecisionFactor): void {
    this.factors.set(factor.name, factor);
    logger.info(`Decision factor registered: ${factor.name}`);
  }

  /**
   * Get all registered factors
   */
  getFactors(): DecisionFactor[] {
    return Array.from(this.factors.values());
  }

  /**
   * Get factor names (for serialization)
   */
  getFactorNames(): string[] {
    return Array.from(this.factors.keys());
  }

  // ==================== Decision History ====================

  /**
   * Get decision history
   */
  async getDecisionHistory(alertId?: string, limit: number = 100): Promise<Decision[]> {
    await this.initialize();

    // List all history files
    let files: string[];
    try {
      files = await fs.readdir(HISTORY_DIR);
      files = files
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.replace('.json', ''))
        .sort()
        .reverse(); // Most recent first
    } catch {
      return [];
    }

    // Collect decisions
    let allDecisions: Decision[] = [];

    for (const dateStr of files) {
      if (allDecisions.length >= limit) break;

      const decisions = await this.readHistoryFile(dateStr);
      allDecisions = allDecisions.concat(decisions);
    }

    // Filter by alertId if provided
    if (alertId) {
      allDecisions = allDecisions.filter((d) => d.alertId === alertId);
    }

    // Sort by timestamp (descending)
    allDecisions.sort((a, b) => b.timestamp - a.timestamp);

    // Apply limit
    return allDecisions.slice(0, limit);
  }

  /**
   * Get a decision by ID
   */
  async getDecisionById(id: string): Promise<Decision | null> {
    // Check cache first
    if (this.decisionCache.has(id)) {
      return this.decisionCache.get(id) || null;
    }

    // Search in history files
    const decisions = await this.getDecisionHistory(undefined, 1000);
    return decisions.find((d) => d.id === id) || null;
  }

  /**
   * Get decisions for a specific alert
   */
  async getDecisionsForAlert(alertId: string): Promise<Decision[]> {
    return this.getDecisionHistory(alertId);
  }

  // ==================== Statistics ====================

  /**
   * Get decision statistics
   */
  async getStatistics(): Promise<{
    totalDecisions: number;
    byAction: Record<DecisionType, number>;
    successRate: number;
    avgFactorScores: Record<string, number>;
  }> {
    const decisions = await this.getDecisionHistory(undefined, 1000);

    const byAction: Record<DecisionType, number> = {
      auto_execute: 0,
      notify_and_wait: 0,
      escalate: 0,
      silence: 0,
    };

    const factorSums: Record<string, number> = {};
    const factorCounts: Record<string, number> = {};
    let executedCount = 0;
    let successCount = 0;

    for (const decision of decisions) {
      byAction[decision.action]++;

      if (decision.executed && decision.executionResult) {
        executedCount++;
        if (decision.executionResult.success) {
          successCount++;
        }
      }

      for (const factor of decision.factors) {
        factorSums[factor.name] = (factorSums[factor.name] || 0) + factor.score;
        factorCounts[factor.name] = (factorCounts[factor.name] || 0) + 1;
      }
    }

    const avgFactorScores: Record<string, number> = {};
    for (const name of Object.keys(factorSums)) {
      avgFactorScores[name] = factorSums[name] / factorCounts[name];
    }

    return {
      totalDecisions: decisions.length,
      byAction,
      successRate: executedCount > 0 ? successCount / executedCount : 0,
      avgFactorScores,
    };
  }

  /**
   * Cleanup old decision history
   */
  async cleanup(retentionDays: number = 90): Promise<number> {
    await this.ensureDataDirs();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    cutoffDate.setHours(0, 0, 0, 0);
    const cutoffDateStr = getDateString(cutoffDate.getTime());

    let files: string[];
    try {
      files = await fs.readdir(HISTORY_DIR);
      files = files
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.replace('.json', ''));
    } catch {
      return 0;
    }

    let deletedCount = 0;

    for (const dateStr of files) {
      if (dateStr < cutoffDateStr) {
        const filePath = getHistoryFilePath(dateStr);
        try {
          const decisions = await this.readHistoryFile(dateStr);
          deletedCount += decisions.length;
          await fs.unlink(filePath);
          logger.info(`Deleted expired decision history: ${dateStr} (${decisions.length} records)`);
        } catch (error) {
          logger.error(`Failed to delete decision history ${dateStr}:`, error);
        }
      }
    }

    return deletedCount;
  }
}

// Export singleton instance
export const decisionEngine = new DecisionEngine();

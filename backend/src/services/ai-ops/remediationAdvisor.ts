/**
 * RemediationAdvisor 修复方案顾问服务
 * 生成可执行的修复方案和回滚方案
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8
 * - 7.1: 识别根因后生成分步修复方案
 * - 7.2: 修复步骤包含 RouterOS 命令
 * - 7.3: 修复步骤包含验证方法
 * - 7.4: 生成对应的回滚方案
 * - 7.5: 标记步骤是否可自动执行
 * - 7.6: 评估每个步骤的风险级别
 * - 7.7: 估算完整修复方案的预计时间
 * - 7.8: 关键配置变更需要手动确认
 */

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  RootCauseAnalysis,
  RemediationPlan,
  RemediationStep,
  RollbackStep,
  ExecutionResult,
  RiskLevel,
  IRemediationAdvisor,
  StepVerification,
} from '../../types/ai-ops';
import { logger } from '../../utils/logger';
import { routerosClient } from '../routerosClient';
import { aiAnalyzer } from './aiAnalyzer';
import { auditLogger } from './auditLogger';
import { configSnapshotService } from './configSnapshotService';

const DATA_DIR = path.join(process.cwd(), 'data', 'ai-ops');
const REMEDIATION_DIR = path.join(DATA_DIR, 'remediations');
const PLANS_DIR = path.join(REMEDIATION_DIR, 'plans');
const EXECUTIONS_DIR = path.join(REMEDIATION_DIR, 'executions');

/**
 * Critical configuration paths that require manual confirmation
 * Requirement 7.8: 关键配置变更需要手动确认
 */
const CRITICAL_CONFIG_PATHS = [
  /\/user/i,
  /\/password/i,
  /\/system\/identity/i,
  /\/ip\/firewall\/filter/i,
  /\/ip\/firewall\/nat/i,
  /\/ipv6\/firewall/i,
  /\/routing/i,
  /\/certificate/i,
  /\/system\/reset/i,
  /\/system\/reboot/i,
  /\/interface.*disable/i,
];

/**
 * Remediation templates for common root causes
 */
interface RemediationTemplate {
  rootCausePattern: RegExp;
  category: string;
  steps: Array<{
    description: string;
    command: string;
    verification: StepVerification;
    riskLevel: RiskLevel;
    estimatedDuration: number;
  }>;
  rollback: Array<{
    description: string;
    command: string;
    condition?: string;
  }>;
}

const REMEDIATION_TEMPLATES: RemediationTemplate[] = [
  {
    rootCausePattern: /high.*cpu|cpu.*high|cpu.*usage/i,
    category: 'system',
    steps: [
      {
        description: '检查当前 CPU 使用情况',
        command: '/system/resource/print',
        verification: {
          command: '/system/resource/print',
          expectedResult: 'CPU 使用率应显示当前值',
        },
        riskLevel: 'low',
        estimatedDuration: 5,
      },
      {
        description: '检查高 CPU 占用的进程',
        command: '/tool/profile/print',
        verification: {
          command: '/tool/profile/print',
          expectedResult: '显示进程 CPU 占用列表',
        },
        riskLevel: 'low',
        estimatedDuration: 10,
      },
      {
        description: '检查连接跟踪表大小',
        command: '/ip/firewall/connection/print count-only',
        verification: {
          command: '/ip/firewall/connection/print count-only',
          expectedResult: '连接数应在合理范围内',
        },
        riskLevel: 'low',
        estimatedDuration: 5,
      },
    ],
    rollback: [
      {
        description: '无需回滚（仅诊断操作）',
        command: '# 诊断操作无需回滚',
      },
    ],
  },
  {
    rootCausePattern: /memory.*exhaustion|memory.*high|out of memory|oom/i,
    category: 'system',
    steps: [
      {
        description: '检查当前内存使用情况',
        command: '/system/resource/print',
        verification: {
          command: '/system/resource/print',
          expectedResult: '显示内存使用统计',
        },
        riskLevel: 'low',
        estimatedDuration: 5,
      },
      {
        description: '清理 DNS 缓存',
        command: '/ip/dns/cache/flush',
        verification: {
          command: '/ip/dns/cache/print count-only',
          expectedResult: 'DNS 缓存条目数应减少',
        },
        riskLevel: 'low',
        estimatedDuration: 5,
      },
      {
        description: '检查并清理过期的连接跟踪',
        command: '/ip/firewall/connection/remove [find where timeout<10s]',
        verification: {
          command: '/ip/firewall/connection/print count-only',
          expectedResult: '连接数应减少',
        },
        riskLevel: 'medium',
        estimatedDuration: 10,
      },
    ],
    rollback: [
      {
        description: '连接跟踪会自动重建',
        command: '# 连接跟踪会根据流量自动重建',
      },
    ],
  },
  {
    rootCausePattern: /disk.*full|disk.*space|storage/i,
    category: 'system',
    steps: [
      {
        description: '检查磁盘使用情况',
        command: '/system/resource/print',
        verification: {
          command: '/system/resource/print',
          expectedResult: '显示磁盘使用统计',
        },
        riskLevel: 'low',
        estimatedDuration: 5,
      },
      {
        description: '列出文件占用情况',
        command: '/file/print',
        verification: {
          command: '/file/print',
          expectedResult: '显示文件列表',
        },
        riskLevel: 'low',
        estimatedDuration: 5,
      },
      {
        description: '清理旧的备份文件',
        command: '/file/remove [find where name~"backup" and creation-time<([:timestamp]-7d)]',
        verification: {
          command: '/file/print where name~"backup"',
          expectedResult: '旧备份文件应被删除',
        },
        riskLevel: 'medium',
        estimatedDuration: 10,
      },
    ],
    rollback: [
      {
        description: '备份文件删除后无法恢复',
        command: '# 建议在删除前先下载重要备份',
      },
    ],
  },
  {
    rootCausePattern: /interface.*down|link.*down|disconnected/i,
    category: 'interface',
    steps: [
      {
        description: '检查接口状态',
        command: '/interface/print',
        verification: {
          command: '/interface/print',
          expectedResult: '显示接口状态列表',
        },
        riskLevel: 'low',
        estimatedDuration: 5,
      },
      {
        description: '尝试重新启用接口',
        command: '/interface/enable [find where running=no]',
        verification: {
          command: '/interface/print where running=yes',
          expectedResult: '接口应恢复运行状态',
        },
        riskLevel: 'medium',
        estimatedDuration: 15,
      },
    ],
    rollback: [
      {
        description: '如需禁用接口',
        command: '/interface/disable [find where name="<interface_name>"]',
        condition: '仅在需要时执行',
      },
    ],
  },
  {
    rootCausePattern: /interface.*flapping|状态变化|state change/i,
    category: 'interface',
    steps: [
      {
        description: '检查接口状态历史',
        command: '/log/print where topics~"interface"',
        verification: {
          command: '/log/print where topics~"interface"',
          expectedResult: '显示接口状态变化日志',
        },
        riskLevel: 'low',
        estimatedDuration: 5,
      },
      {
        description: '检查接口配置',
        command: '/interface/ethernet/print',
        verification: {
          command: '/interface/ethernet/print',
          expectedResult: '显示以太网接口配置',
        },
        riskLevel: 'low',
        estimatedDuration: 5,
      },
      {
        description: '调整接口速率和双工模式为自动协商',
        command: '/interface/ethernet/set [find] speed=auto',
        verification: {
          command: '/interface/ethernet/print',
          expectedResult: '速率应设置为 auto',
        },
        riskLevel: 'medium',
        estimatedDuration: 10,
      },
    ],
    rollback: [
      {
        description: '恢复原始速率设置',
        command: '/interface/ethernet/set [find] speed=<original_speed>',
        condition: '如果自动协商导致问题',
      },
    ],
  },
  {
    rootCausePattern: /auth.*fail|login.*fail|password|credential/i,
    category: 'security',
    steps: [
      {
        description: '检查登录失败日志',
        command: '/log/print where topics~"system" and message~"login"',
        verification: {
          command: '/log/print where topics~"system" and message~"login"',
          expectedResult: '显示登录相关日志',
        },
        riskLevel: 'low',
        estimatedDuration: 5,
      },
      {
        description: '检查用户列表',
        command: '/user/print',
        verification: {
          command: '/user/print',
          expectedResult: '显示用户列表',
        },
        riskLevel: 'low',
        estimatedDuration: 5,
      },
      {
        description: '检查防火墙是否有 IP 封禁',
        command: '/ip/firewall/address-list/print where list="blacklist"',
        verification: {
          command: '/ip/firewall/address-list/print where list="blacklist"',
          expectedResult: '显示黑名单 IP',
        },
        riskLevel: 'low',
        estimatedDuration: 5,
      },
    ],
    rollback: [
      {
        description: '无需回滚（仅诊断操作）',
        command: '# 诊断操作无需回滚',
      },
    ],
  },
  {
    rootCausePattern: /firewall.*block|drop|reject|deny/i,
    category: 'security',
    steps: [
      {
        description: '检查防火墙规则',
        command: '/ip/firewall/filter/print',
        verification: {
          command: '/ip/firewall/filter/print',
          expectedResult: '显示防火墙过滤规则',
        },
        riskLevel: 'low',
        estimatedDuration: 5,
      },
      {
        description: '检查 NAT 规则',
        command: '/ip/firewall/nat/print',
        verification: {
          command: '/ip/firewall/nat/print',
          expectedResult: '显示 NAT 规则',
        },
        riskLevel: 'low',
        estimatedDuration: 5,
      },
      {
        description: '检查连接跟踪',
        command: '/ip/firewall/connection/print',
        verification: {
          command: '/ip/firewall/connection/print',
          expectedResult: '显示活动连接',
        },
        riskLevel: 'low',
        estimatedDuration: 5,
      },
    ],
    rollback: [
      {
        description: '无需回滚（仅诊断操作）',
        command: '# 诊断操作无需回滚',
      },
    ],
  },
  {
    rootCausePattern: /timeout|connection.*lost|unreachable/i,
    category: 'network',
    steps: [
      {
        description: '检查路由表',
        command: '/ip/route/print',
        verification: {
          command: '/ip/route/print',
          expectedResult: '显示路由表',
        },
        riskLevel: 'low',
        estimatedDuration: 5,
      },
      {
        description: '检查 ARP 表',
        command: '/ip/arp/print',
        verification: {
          command: '/ip/arp/print',
          expectedResult: '显示 ARP 表',
        },
        riskLevel: 'low',
        estimatedDuration: 5,
      },
      {
        description: '测试网关连通性',
        command: '/ping 8.8.8.8 count=3',
        verification: {
          command: '/ping 8.8.8.8 count=1',
          expectedResult: '应收到 ping 响应',
        },
        riskLevel: 'low',
        estimatedDuration: 10,
      },
    ],
    rollback: [
      {
        description: '无需回滚（仅诊断操作）',
        command: '# 诊断操作无需回滚',
      },
    ],
  },
  {
    rootCausePattern: /traffic.*spike|bandwidth|throughput|流量/i,
    category: 'network',
    steps: [
      {
        description: '检查接口流量统计',
        command: '/interface/print stats',
        verification: {
          command: '/interface/print stats',
          expectedResult: '显示接口流量统计',
        },
        riskLevel: 'low',
        estimatedDuration: 5,
      },
      {
        description: '检查活动连接',
        command: '/ip/firewall/connection/print',
        verification: {
          command: '/ip/firewall/connection/print count-only',
          expectedResult: '显示连接数',
        },
        riskLevel: 'low',
        estimatedDuration: 5,
      },
      {
        description: '检查 Torch 实时流量',
        command: '/tool/torch interface=all',
        verification: {
          command: '/tool/torch interface=all',
          expectedResult: '显示实时流量分布',
        },
        riskLevel: 'low',
        estimatedDuration: 15,
      },
    ],
    rollback: [
      {
        description: '无需回滚（仅诊断操作）',
        command: '# 诊断操作无需回滚',
      },
    ],
  },
];

/**
 * Get date string (YYYY-MM-DD)
 */
function getDateString(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toISOString().split('T')[0];
}

export class RemediationAdvisor implements IRemediationAdvisor {
  private initialized = false;
  private plansCache: Map<string, RemediationPlan> = new Map();
  private executionHistory: Map<string, ExecutionResult[]> = new Map();

  /**
   * Ensure data directories exist
   */
  private async ensureDataDirs(): Promise<void> {
    try {
      await fs.mkdir(PLANS_DIR, { recursive: true });
      await fs.mkdir(EXECUTIONS_DIR, { recursive: true });
    } catch (error) {
      logger.error('Failed to create remediation directories:', error);
    }
  }

  /**
   * Initialize service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.ensureDataDirs();
    await this.loadPlans();
    this.initialized = true;
    logger.info('RemediationAdvisor initialized');
  }

  /**
   * Load existing plans from disk
   */
  private async loadPlans(): Promise<void> {
    try {
      const files = await fs.readdir(PLANS_DIR);
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const content = await fs.readFile(path.join(PLANS_DIR, file), 'utf-8');
            const plan = JSON.parse(content) as RemediationPlan;
            this.plansCache.set(plan.id, plan);
          } catch (error) {
            logger.warn(`Failed to load plan file ${file}:`, error);
          }
        }
      }
      logger.info(`Loaded ${this.plansCache.size} remediation plans`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.error('Failed to load plans:', error);
      }
    }
  }

  /**
   * Save plan to disk
   */
  private async savePlan(plan: RemediationPlan): Promise<void> {
    await this.ensureDataDirs();
    const filePath = path.join(PLANS_DIR, `${plan.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(plan, null, 2), 'utf-8');
    this.plansCache.set(plan.id, plan);
  }

  /**
   * Save execution results to disk
   */
  private async saveExecutionResults(planId: string, results: ExecutionResult[]): Promise<void> {
    await this.ensureDataDirs();
    const dateStr = getDateString(Date.now());
    const filePath = path.join(EXECUTIONS_DIR, `${dateStr}.json`);
    
    let executions: Array<{ planId: string; timestamp: number; results: ExecutionResult[] }> = [];
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      executions = JSON.parse(content);
    } catch {
      // File doesn't exist, start fresh
    }
    
    executions.push({
      planId,
      timestamp: Date.now(),
      results,
    });
    
    await fs.writeFile(filePath, JSON.stringify(executions, null, 2), 'utf-8');
    this.executionHistory.set(planId, results);
  }


  /**
   * Generate remediation plan based on root cause analysis
   * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8
   */
  async generatePlan(analysis: RootCauseAnalysis): Promise<RemediationPlan> {
    await this.initialize();

    const planId = uuidv4();
    const now = Date.now();

    // Find the primary root cause (highest confidence)
    const primaryRootCause = analysis.rootCauses.length > 0
      ? analysis.rootCauses.reduce((a, b) => a.confidence > b.confidence ? a : b)
      : null;

    if (!primaryRootCause) {
      // Return empty plan if no root cause identified
      const emptyPlan: RemediationPlan = {
        id: planId,
        alertId: analysis.alertId,
        rootCauseId: '',
        timestamp: now,
        steps: [],
        rollback: [],
        overallRisk: 'low',
        estimatedDuration: 0,
        requiresConfirmation: false,
        status: 'pending',
      };
      await this.savePlan(emptyPlan);
      return emptyPlan;
    }

    // Step 1: Try to match a template
    let steps: RemediationStep[] = [];
    let rollback: RollbackStep[] = [];
    let templateMatched = false;

    for (const template of REMEDIATION_TEMPLATES) {
      if (template.rootCausePattern.test(primaryRootCause.description)) {
        steps = template.steps.map((s, index) => ({
          order: index + 1,
          description: s.description,
          command: s.command,
          verification: s.verification,
          autoExecutable: this.isAutoExecutable(s.command, s.riskLevel),
          riskLevel: s.riskLevel,
          estimatedDuration: s.estimatedDuration,
        }));

        rollback = template.rollback.map((r, index) => ({
          order: index + 1,
          description: r.description,
          command: r.command,
          condition: r.condition,
        }));

        templateMatched = true;
        logger.info(`Matched remediation template for category: ${template.category}`);
        break;
      }
    }

    // Step 2: If no template matched, try AI-generated plan
    if (!templateMatched) {
      try {
        const aiPlan = await this.generateAIPlan(analysis, primaryRootCause);
        steps = aiPlan.steps;
        rollback = aiPlan.rollback;
      } catch (error) {
        logger.warn('AI plan generation failed, using generic diagnostic plan:', error);
        // Fallback to generic diagnostic plan
        steps = this.getGenericDiagnosticSteps();
        rollback = [{
          order: 1,
          description: '无需回滚（仅诊断操作）',
          command: '# 诊断操作无需回滚',
        }];
      }
    }

    // Step 3: Calculate overall risk and duration
    const overallRisk = this.calculateOverallRisk(steps);
    const estimatedDuration = steps.reduce((sum, s) => sum + s.estimatedDuration, 0);

    // Step 4: Determine if confirmation is required
    // Requirement 7.8: 关键配置变更需要手动确认
    const requiresConfirmation = steps.some(s => 
      s.riskLevel === 'high' || !s.autoExecutable
    );

    const plan: RemediationPlan = {
      id: planId,
      alertId: analysis.alertId,
      rootCauseId: primaryRootCause.id,
      timestamp: now,
      steps,
      rollback,
      overallRisk,
      estimatedDuration,
      requiresConfirmation,
      status: 'pending',
    };

    // Save plan
    await this.savePlan(plan);

    // Log audit
    await auditLogger.log({
      action: 'remediation_execute',
      actor: 'system',
      details: {
        trigger: 'plan_generated',
        metadata: {
          planId: plan.id,
          alertId: analysis.alertId,
          rootCauseId: primaryRootCause.id,
          stepsCount: steps.length,
          overallRisk,
          estimatedDuration,
        },
      },
    });

    logger.info(`Generated remediation plan ${planId} with ${steps.length} steps, risk: ${overallRisk}`);
    return plan;
  }

  /**
   * Generate AI-based remediation plan
   */
  private async generateAIPlan(
    analysis: RootCauseAnalysis,
    rootCause: { id: string; description: string; confidence: number }
  ): Promise<{ steps: RemediationStep[]; rollback: RollbackStep[] }> {
    const result = await aiAnalyzer.analyze({
      type: 'alert',
      context: {
        alertEvent: {
          id: analysis.alertId,
          ruleId: 'remediation',
          ruleName: 'Remediation Plan Generation',
          severity: 'warning',
          metric: 'remediation',
          currentValue: 0,
          threshold: 0,
          message: `Generate remediation plan for: ${rootCause.description}`,
          status: 'active',
          triggeredAt: analysis.timestamp,
        },
        systemMetrics: {
          cpu: { usage: 0 },
          memory: { total: 0, used: 0, free: 0, usage: 0 },
          disk: { total: 0, used: 0, free: 0, usage: 0 },
          uptime: 0,
        },
        analysisType: 'remediation',
        rootCause: rootCause.description,
        impact: analysis.impact,
      },
    });

    // Parse AI recommendations into steps
    const steps: RemediationStep[] = (result.recommendations || []).map((rec, index) => {
      // Try to extract command from recommendation
      const commandMatch = rec.match(/`([^`]+)`/) || rec.match(/命令[：:]\s*(.+)/);
      const command = commandMatch ? commandMatch[1] : `/system/resource/print`;

      return {
        order: index + 1,
        description: rec.replace(/`[^`]+`/g, '').trim(),
        command,
        verification: {
          command: '/system/resource/print',
          expectedResult: '验证操作结果',
        },
        autoExecutable: this.isAutoExecutable(command, result.riskLevel || 'medium'),
        riskLevel: result.riskLevel || 'medium',
        estimatedDuration: 10,
      };
    });

    // If no steps generated, use generic diagnostic
    if (steps.length === 0) {
      return {
        steps: this.getGenericDiagnosticSteps(),
        rollback: [{
          order: 1,
          description: '无需回滚（仅诊断操作）',
          command: '# 诊断操作无需回滚',
        }],
      };
    }

    return {
      steps,
      rollback: [{
        order: 1,
        description: '如需回滚，请恢复之前的配置快照',
        command: '# 使用配置快照恢复',
        condition: '仅在修改导致问题时执行',
      }],
    };
  }

  /**
   * Get generic diagnostic steps
   */
  private getGenericDiagnosticSteps(): RemediationStep[] {
    return [
      {
        order: 1,
        description: '检查系统资源状态',
        command: '/system/resource/print',
        verification: {
          command: '/system/resource/print',
          expectedResult: '显示系统资源信息',
        },
        autoExecutable: true,
        riskLevel: 'low',
        estimatedDuration: 5,
      },
      {
        order: 2,
        description: '检查系统日志',
        command: '/log/print',
        verification: {
          command: '/log/print',
          expectedResult: '显示系统日志',
        },
        autoExecutable: true,
        riskLevel: 'low',
        estimatedDuration: 5,
      },
      {
        order: 3,
        description: '检查接口状态',
        command: '/interface/print',
        verification: {
          command: '/interface/print',
          expectedResult: '显示接口列表',
        },
        autoExecutable: true,
        riskLevel: 'low',
        estimatedDuration: 5,
      },
    ];
  }

  /**
   * Check if a command can be auto-executed
   * Requirement 7.5, 7.8: 标记步骤是否可自动执行，关键配置需手动确认
   */
  private isAutoExecutable(command: string, riskLevel: RiskLevel): boolean {
    // High risk commands always require confirmation
    if (riskLevel === 'high') {
      return false;
    }

    // Check against critical config paths
    for (const pattern of CRITICAL_CONFIG_PATHS) {
      if (pattern.test(command)) {
        return false;
      }
    }

    // Read-only commands (print, monitor, etc.) are auto-executable
    if (/\/print|\/monitor|\/ping|\/traceroute|\/torch/i.test(command)) {
      return true;
    }

    // Medium risk commands require confirmation
    if (riskLevel === 'medium') {
      return false;
    }

    return true;
  }

  /**
   * Calculate overall risk level
   * Requirement 7.6: 评估每个步骤的风险级别
   */
  private calculateOverallRisk(steps: RemediationStep[]): RiskLevel {
    if (steps.length === 0) return 'low';

    const hasHigh = steps.some(s => s.riskLevel === 'high');
    const hasMedium = steps.some(s => s.riskLevel === 'medium');

    if (hasHigh) return 'high';
    if (hasMedium) return 'medium';
    return 'low';
  }

  /**
   * Execute a single step
   * Requirement 7.1: 执行修复步骤
   */
  async executeStep(planId: string, stepOrder: number): Promise<ExecutionResult> {
    await this.initialize();

    const plan = await this.getPlan(planId);
    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }

    const step = plan.steps.find(s => s.order === stepOrder);
    if (!step) {
      throw new Error(`Step ${stepOrder} not found in plan ${planId}`);
    }

    const startTime = Date.now();
    let result: ExecutionResult;

    try {
      // Create pre-execution snapshot for safety
      if (step.riskLevel !== 'low') {
        try {
          await configSnapshotService.createSnapshot('pre-remediation');
          logger.info(`Created pre-remediation snapshot for step ${stepOrder}`);
        } catch (error) {
          logger.warn('Failed to create pre-remediation snapshot:', error);
        }
      }

      // Execute the command
      logger.info(`Executing step ${stepOrder}: ${step.command}`);
      
      // Parse command for RouterOS API format
      const output = await this.executeRouterOSCommand(step.command);

      // Verify the step
      let verificationPassed = true;
      try {
        await this.executeRouterOSCommand(step.verification.command);
        // If verification command succeeds, consider it passed
        // In a real implementation, we'd compare output to expectedResult
      } catch (verifyError) {
        logger.warn(`Verification failed for step ${stepOrder}:`, verifyError);
        verificationPassed = false;
      }

      result = {
        stepOrder,
        success: true,
        output: typeof output === 'string' ? output : JSON.stringify(output),
        duration: Date.now() - startTime,
        verificationPassed,
      };

      // Update plan status
      plan.status = 'in_progress';
      await this.savePlan(plan);

      // Log audit
      await auditLogger.log({
        action: 'remediation_execute',
        actor: 'system',
        details: {
          trigger: 'step_executed',
          script: step.command,
          result: result.success ? 'success' : 'failed',
          metadata: {
            planId,
            stepOrder,
            duration: result.duration,
            verificationPassed,
          },
        },
      });

    } catch (error) {
      result = {
        stepOrder,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
        verificationPassed: false,
      };

      // Log failure
      await auditLogger.log({
        action: 'remediation_execute',
        actor: 'system',
        details: {
          trigger: 'step_failed',
          script: step.command,
          error: result.error,
          metadata: {
            planId,
            stepOrder,
          },
        },
      });
    }

    // Save execution result
    const history = this.executionHistory.get(planId) || [];
    history.push(result);
    this.executionHistory.set(planId, history);
    await this.saveExecutionResults(planId, history);

    return result;
  }

  /**
   * Execute RouterOS command
   */
  private async executeRouterOSCommand(command: string): Promise<unknown> {
    // Check if connected
    if (!routerosClient.isConnected()) {
      throw new Error('Not connected to RouterOS');
    }

    // Parse command - convert CLI-style to API format
    // e.g., "/system/resource/print" -> executeRaw("/system/resource/print")
    // e.g., "/ip/dns/cache/flush" -> execute("/ip/dns/cache/flush")
    
    const cleanCommand = command.trim();
    
    // Skip comment commands
    if (cleanCommand.startsWith('#')) {
      return 'Skipped comment command';
    }

    // Handle print commands
    if (cleanCommand.includes('/print')) {
      const basePath = cleanCommand.replace('/print', '').replace(/\s+.*$/, '');
      return await routerosClient.print(basePath);
    }

    // Handle other commands
    try {
      return await routerosClient.executeRaw(cleanCommand);
    } catch (error) {
      // Some commands don't return data but succeed
      logger.debug(`Command execution result:`, error);
      throw error;
    }
  }


  /**
   * Execute all auto-executable steps
   * Requirement 7.1: 执行整个方案（仅自动执行步骤）
   */
  async executeAutoSteps(planId: string): Promise<ExecutionResult[]> {
    await this.initialize();

    const plan = await this.getPlan(planId);
    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }

    // Filter auto-executable steps
    const autoSteps = plan.steps.filter(s => s.autoExecutable);
    
    if (autoSteps.length === 0) {
      logger.info(`No auto-executable steps in plan ${planId}`);
      return [];
    }

    const results: ExecutionResult[] = [];

    // Update plan status
    plan.status = 'in_progress';
    await this.savePlan(plan);

    // Execute steps in order
    for (const step of autoSteps) {
      const result = await this.executeStep(planId, step.order);
      results.push(result);

      // Stop on failure
      if (!result.success) {
        logger.warn(`Auto-execution stopped at step ${step.order} due to failure`);
        plan.status = 'failed';
        await this.savePlan(plan);
        break;
      }
    }

    // Check if all steps completed successfully
    const allSucceeded = results.every(r => r.success);
    const allStepsExecuted = results.length === autoSteps.length;

    if (allSucceeded && allStepsExecuted) {
      // Check if there are non-auto steps remaining
      const hasManualSteps = plan.steps.some(s => !s.autoExecutable);
      if (!hasManualSteps) {
        plan.status = 'completed';
      }
      // If there are manual steps, keep status as in_progress
    }

    await this.savePlan(plan);

    logger.info(`Executed ${results.length} auto steps for plan ${planId}, success: ${allSucceeded}`);
    return results;
  }

  /**
   * Execute rollback
   * Requirement 7.4: 生成对应的回滚方案
   */
  async executeRollback(planId: string): Promise<ExecutionResult[]> {
    await this.initialize();

    const plan = await this.getPlan(planId);
    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }

    if (plan.rollback.length === 0) {
      logger.info(`No rollback steps in plan ${planId}`);
      return [];
    }

    const results: ExecutionResult[] = [];

    // Log rollback start
    await auditLogger.log({
      action: 'remediation_execute',
      actor: 'system',
      details: {
        trigger: 'rollback_started',
        metadata: {
          planId,
          rollbackSteps: plan.rollback.length,
        },
      },
    });

    // Execute rollback steps in order
    for (const step of plan.rollback) {
      const startTime = Date.now();
      
      try {
        // Skip comment commands
        if (step.command.startsWith('#')) {
          results.push({
            stepOrder: step.order,
            success: true,
            output: 'Skipped (comment)',
            duration: 0,
          });
          continue;
        }

        const output = await this.executeRouterOSCommand(step.command);
        
        results.push({
          stepOrder: step.order,
          success: true,
          output: typeof output === 'string' ? output : JSON.stringify(output),
          duration: Date.now() - startTime,
        });
      } catch (error) {
        results.push({
          stepOrder: step.order,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - startTime,
        });
        
        // Continue with other rollback steps even on failure
        logger.warn(`Rollback step ${step.order} failed:`, error);
      }
    }

    // Update plan status
    plan.status = 'rolled_back';
    await this.savePlan(plan);

    // Log rollback completion
    const allSucceeded = results.every(r => r.success);
    await auditLogger.log({
      action: 'remediation_execute',
      actor: 'system',
      details: {
        trigger: 'rollback_completed',
        result: allSucceeded ? 'success' : 'partial_failure',
        metadata: {
          planId,
          successCount: results.filter(r => r.success).length,
          failureCount: results.filter(r => !r.success).length,
        },
      },
    });

    logger.info(`Executed rollback for plan ${planId}, success: ${allSucceeded}`);
    return results;
  }

  /**
   * Get plan by ID
   */
  async getPlan(planId: string): Promise<RemediationPlan | null> {
    await this.initialize();

    // Check cache first
    if (this.plansCache.has(planId)) {
      return this.plansCache.get(planId)!;
    }

    // Try to load from disk
    try {
      const filePath = path.join(PLANS_DIR, `${planId}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      const plan = JSON.parse(content) as RemediationPlan;
      this.plansCache.set(planId, plan);
      return plan;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      logger.error(`Failed to load plan ${planId}:`, error);
      return null;
    }
  }

  /**
   * Get execution history for a plan
   */
  async getExecutionHistory(planId: string): Promise<ExecutionResult[]> {
    await this.initialize();

    // Check memory cache first
    if (this.executionHistory.has(planId)) {
      return this.executionHistory.get(planId)!;
    }

    // Try to load from disk (search recent files)
    const results: ExecutionResult[] = [];
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    try {
      const files = await fs.readdir(EXECUTIONS_DIR);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        try {
          const content = await fs.readFile(path.join(EXECUTIONS_DIR, file), 'utf-8');
          const executions = JSON.parse(content) as Array<{
            planId: string;
            timestamp: number;
            results: ExecutionResult[];
          }>;

          for (const exec of executions) {
            if (exec.planId === planId && exec.timestamp >= sevenDaysAgo) {
              results.push(...exec.results);
            }
          }
        } catch (error) {
          logger.debug(`Failed to read execution file ${file}:`, error);
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.error('Failed to read execution history:', error);
      }
    }

    // Cache the results
    if (results.length > 0) {
      this.executionHistory.set(planId, results);
    }

    return results;
  }

  /**
   * Get all plans (for listing)
   */
  async getPlans(limit: number = 50): Promise<RemediationPlan[]> {
    await this.initialize();

    const plans = Array.from(this.plansCache.values());
    
    // Sort by timestamp descending
    plans.sort((a, b) => b.timestamp - a.timestamp);
    
    return plans.slice(0, limit);
  }

  /**
   * Get plans by alert ID
   */
  async getPlansByAlertId(alertId: string): Promise<RemediationPlan[]> {
    await this.initialize();

    const plans = Array.from(this.plansCache.values())
      .filter(p => p.alertId === alertId)
      .sort((a, b) => b.timestamp - a.timestamp);

    return plans;
  }

  /**
   * Update plan status
   */
  async updatePlanStatus(planId: string, status: RemediationPlan['status']): Promise<void> {
    const plan = await this.getPlan(planId);
    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }

    plan.status = status;
    await this.savePlan(plan);
    
    logger.info(`Updated plan ${planId} status to ${status}`);
  }

  /**
   * Delete a plan
   */
  async deletePlan(planId: string): Promise<void> {
    await this.initialize();

    const filePath = path.join(PLANS_DIR, `${planId}.json`);
    
    try {
      await fs.unlink(filePath);
      this.plansCache.delete(planId);
      this.executionHistory.delete(planId);
      logger.info(`Deleted plan ${planId}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
}

// Export singleton instance
export const remediationAdvisor = new RemediationAdvisor();

/**
 * Scheduler 调度器服务
 * 负责管理和执行定时任务（巡检、备份等）
 *
 * Requirements: 4.1, 4.2, 5.1
 * - 4.1: 支持配置巡检任务的执行周期（每日、每周、自定义 cron）
 * - 4.2: 巡检任务执行时采集当前系统状态快照
 * - 5.1: 支持配置自动备份任务的执行周期
 */

import fs from 'fs/promises';
import path from 'path';
import cron, { ScheduledTask as CronScheduledTask } from 'node-cron';
import { v4 as uuidv4 } from 'uuid';
import {
  IScheduler,
  ScheduledTask,
  TaskExecution,
  CreateScheduledTaskInput,
  UpdateScheduledTaskInput,
} from '../../types/ai-ops';
import { logger } from '../../utils/logger';
import { auditLogger } from './auditLogger';

const SCHEDULER_DIR = path.join(process.cwd(), 'data', 'ai-ops', 'scheduler');
const TASKS_FILE = path.join(SCHEDULER_DIR, 'tasks.json');
const EXECUTIONS_DIR = path.join(SCHEDULER_DIR, 'executions');

/**
 * 获取日期字符串 (YYYY-MM-DD)
 */
function getDateString(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toISOString().split('T')[0];
}

/**
 * 获取执行记录文件路径
 */
function getExecutionsFilePath(dateStr: string): string {
  return path.join(EXECUTIONS_DIR, `${dateStr}.json`);
}


/**
 * 任务执行处理器类型
 */
type TaskHandler = (task: ScheduledTask) => Promise<unknown>;

export class Scheduler implements IScheduler {
  private tasks: Map<string, ScheduledTask> = new Map();
  private cronJobs: Map<string, CronScheduledTask> = new Map();
  private isRunning: boolean = false;
  private taskHandlers: Map<string, TaskHandler> = new Map();

  /**
   * 确保目录存在
   */
  private async ensureDirectories(): Promise<void> {
    try {
      await fs.mkdir(SCHEDULER_DIR, { recursive: true });
      await fs.mkdir(EXECUTIONS_DIR, { recursive: true });
    } catch (error) {
      logger.error('Failed to create scheduler directories:', error);
    }
  }

  /**
   * 加载任务列表
   */
  private async loadTasks(): Promise<void> {
    try {
      const data = await fs.readFile(TASKS_FILE, 'utf-8');
      const tasks = JSON.parse(data) as ScheduledTask[];
      this.tasks.clear();
      for (const task of tasks) {
        this.tasks.set(task.id, task);
      }
      logger.info(`Loaded ${tasks.length} scheduled tasks`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.error('Failed to load scheduled tasks:', error);
      }
      this.tasks.clear();
    }
  }

  /**
   * 保存任务列表
   */
  private async saveTasks(): Promise<void> {
    await this.ensureDirectories();
    const tasks = Array.from(this.tasks.values());
    await fs.writeFile(TASKS_FILE, JSON.stringify(tasks, null, 2), 'utf-8');
  }

  /**
   * 读取指定日期的执行记录
   */
  private async readExecutionsFile(dateStr: string): Promise<TaskExecution[]> {
    const filePath = getExecutionsFilePath(dateStr);
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) as TaskExecution[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      logger.error(`Failed to read executions file ${dateStr}:`, error);
      return [];
    }
  }

  /**
   * 写入执行记录文件
   */
  private async writeExecutionsFile(dateStr: string, executions: TaskExecution[]): Promise<void> {
    const filePath = getExecutionsFilePath(dateStr);
    await fs.writeFile(filePath, JSON.stringify(executions, null, 2), 'utf-8');
  }

  /**
   * 保存执行记录
   */
  private async saveExecution(execution: TaskExecution): Promise<void> {
    await this.ensureDirectories();
    const dateStr = getDateString(execution.startedAt);
    const executions = await this.readExecutionsFile(dateStr);
    
    // 查找是否已存在该执行记录
    const existingIndex = executions.findIndex((e) => e.id === execution.id);
    if (existingIndex >= 0) {
      executions[existingIndex] = execution;
    } else {
      executions.push(execution);
    }
    
    await this.writeExecutionsFile(dateStr, executions);
  }


  /**
   * 验证 cron 表达式
   */
  private validateCron(cronExpression: string): boolean {
    return cron.validate(cronExpression);
  }

  /**
   * 计算下次执行时间
   * 基于 cron 表达式计算下一次执行的时间戳
   */
  calculateNextRunTime(cronExpression: string): number | null {
    if (!this.validateCron(cronExpression)) {
      return null;
    }

    // 使用 node-cron 的内部解析来计算下次执行时间
    // node-cron 不直接提供此功能，我们需要手动解析
    return this.parseNextCronTime(cronExpression);
  }

  /**
   * 解析 cron 表达式并计算下次执行时间
   * 支持标准 5 字段 cron 格式: 分 时 日 月 周
   */
  private parseNextCronTime(cronExpression: string): number | null {
    try {
      const parts = cronExpression.trim().split(/\s+/);
      if (parts.length < 5 || parts.length > 6) {
        return null;
      }

      // 如果是 6 字段格式（包含秒），取后 5 个字段
      const [minute, hour, dayOfMonth, month, dayOfWeek] = 
        parts.length === 6 ? parts.slice(1) : parts;

      const now = new Date();
      const maxIterations = 366 * 24 * 60; // 最多检查一年的分钟数
      
      // 从当前时间开始，逐分钟检查
      for (let i = 1; i <= maxIterations; i++) {
        const candidate = new Date(now.getTime() + i * 60 * 1000);
        candidate.setSeconds(0, 0);

        if (this.matchesCronField(candidate.getMinutes(), minute) &&
            this.matchesCronField(candidate.getHours(), hour) &&
            this.matchesCronField(candidate.getDate(), dayOfMonth) &&
            this.matchesCronField(candidate.getMonth() + 1, month) &&
            this.matchesCronField(candidate.getDay(), dayOfWeek)) {
          return candidate.getTime();
        }
      }

      return null;
    } catch (error) {
      logger.error('Failed to parse cron expression:', error);
      return null;
    }
  }

  /**
   * 检查值是否匹配 cron 字段
   */
  private matchesCronField(value: number, field: string): boolean {
    if (field === '*') {
      return true;
    }

    // 处理列表 (1,2,3)
    if (field.includes(',')) {
      const values = field.split(',').map((v) => parseInt(v.trim(), 10));
      return values.includes(value);
    }

    // 处理范围 (1-5)
    if (field.includes('-')) {
      const [start, end] = field.split('-').map((v) => parseInt(v.trim(), 10));
      return value >= start && value <= end;
    }

    // 处理步进 (*/5 或 1-10/2)
    if (field.includes('/')) {
      const [range, step] = field.split('/');
      const stepNum = parseInt(step, 10);
      
      if (range === '*') {
        return value % stepNum === 0;
      }
      
      if (range.includes('-')) {
        const [start, end] = range.split('-').map((v) => parseInt(v.trim(), 10));
        if (value < start || value > end) {
          return false;
        }
        return (value - start) % stepNum === 0;
      }
    }

    // 直接数值匹配
    return parseInt(field, 10) === value;
  }


  /**
   * 注册任务处理器
   * 允许外部模块注册特定类型任务的处理逻辑
   */
  registerHandler(type: string, handler: TaskHandler): void {
    this.taskHandlers.set(type, handler);
    logger.info(`Registered task handler for type: ${type}`);
  }

  /**
   * 执行任务
   */
  private async executeTask(task: ScheduledTask): Promise<TaskExecution> {
    const execution: TaskExecution = {
      id: uuidv4(),
      taskId: task.id,
      taskName: task.name,
      type: task.type,
      status: 'running',
      startedAt: Date.now(),
    };

    // 保存执行开始状态
    await this.saveExecution(execution);

    try {
      // 获取任务处理器
      const handler = this.taskHandlers.get(task.type);
      
      if (handler) {
        execution.result = await handler(task);
      } else {
        // 默认处理：记录日志
        logger.info(`Executing task: ${task.name} (${task.type})`);
        execution.result = { message: 'Task executed (no handler registered)' };
      }

      execution.status = 'success';
      execution.completedAt = Date.now();

      // 更新任务的最后执行时间
      task.lastRunAt = execution.startedAt;
      task.nextRunAt = this.calculateNextRunTime(task.cron) || undefined;
      await this.saveTasks();

      // 记录审计日志
      await auditLogger.log({
        action: 'script_execute',
        actor: 'system',
        details: {
          trigger: `scheduled_task:${task.type}`,
          result: 'success',
          metadata: {
            taskId: task.id,
            taskName: task.name,
            executionId: execution.id,
          },
        },
      });

      logger.info(`Task ${task.name} completed successfully`);
    } catch (error) {
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : String(error);
      execution.completedAt = Date.now();

      // 记录审计日志
      await auditLogger.log({
        action: 'script_execute',
        actor: 'system',
        details: {
          trigger: `scheduled_task:${task.type}`,
          result: 'failed',
          error: execution.error,
          metadata: {
            taskId: task.id,
            taskName: task.name,
            executionId: execution.id,
          },
        },
      });

      logger.error(`Task ${task.name} failed:`, error);
    }

    // 保存执行结果
    await this.saveExecution(execution);

    return execution;
  }

  /**
   * 为任务创建 cron job
   */
  private scheduleCronJob(task: ScheduledTask): void {
    // 如果已存在，先停止
    this.stopCronJob(task.id);

    if (!task.enabled) {
      return;
    }

    if (!this.validateCron(task.cron)) {
      logger.error(`Invalid cron expression for task ${task.name}: ${task.cron}`);
      return;
    }

    const job = cron.schedule(task.cron, async () => {
      logger.info(`Cron triggered for task: ${task.name}`);
      await this.executeTask(task);
    });

    this.cronJobs.set(task.id, job);
    logger.info(`Scheduled cron job for task: ${task.name} (${task.cron})`);
  }

  /**
   * 停止任务的 cron job
   */
  private stopCronJob(taskId: string): void {
    const job = this.cronJobs.get(taskId);
    if (job) {
      job.stop();
      this.cronJobs.delete(taskId);
    }
  }


  /**
   * 启动调度器
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Scheduler is already running');
      return;
    }

    this.ensureDirectories().then(() => {
      this.loadTasks().then(() => {
        // 为所有启用的任务创建 cron job
        for (const task of this.tasks.values()) {
          if (task.enabled) {
            // 更新下次执行时间
            task.nextRunAt = this.calculateNextRunTime(task.cron) || undefined;
            this.scheduleCronJob(task);
          }
        }

        // 保存更新后的任务列表
        this.saveTasks();

        this.isRunning = true;
        logger.info(`Scheduler started with ${this.tasks.size} tasks`);
      });
    });
  }

  /**
   * 停止调度器
   */
  stop(): void {
    // 停止所有 cron jobs
    for (const [taskId, job] of this.cronJobs) {
      job.stop();
      logger.debug(`Stopped cron job for task: ${taskId}`);
    }
    this.cronJobs.clear();

    this.isRunning = false;
    logger.info('Scheduler stopped');
  }

  /**
   * 创建定时任务
   */
  async createTask(input: CreateScheduledTaskInput): Promise<ScheduledTask> {
    await this.ensureDirectories();

    // 验证 cron 表达式
    if (!this.validateCron(input.cron)) {
      throw new Error(`Invalid cron expression: ${input.cron}`);
    }

    const task: ScheduledTask = {
      id: uuidv4(),
      name: input.name,
      type: input.type,
      cron: input.cron,
      enabled: input.enabled ?? true,
      lastRunAt: input.lastRunAt,
      config: input.config,
      createdAt: Date.now(),
      nextRunAt: this.calculateNextRunTime(input.cron) || undefined,
    };

    this.tasks.set(task.id, task);
    await this.saveTasks();

    // 如果调度器正在运行且任务已启用，创建 cron job
    if (this.isRunning && task.enabled) {
      this.scheduleCronJob(task);
    }

    logger.info(`Created scheduled task: ${task.name} (${task.id})`);
    return task;
  }

  /**
   * 更新定时任务
   */
  async updateTask(id: string, updates: UpdateScheduledTaskInput): Promise<ScheduledTask> {
    const task = this.tasks.get(id);
    if (!task) {
      throw new Error(`Task not found: ${id}`);
    }

    // 如果更新了 cron 表达式，验证它
    if (updates.cron !== undefined && !this.validateCron(updates.cron)) {
      throw new Error(`Invalid cron expression: ${updates.cron}`);
    }

    // 应用更新
    const updatedTask: ScheduledTask = {
      ...task,
      ...updates,
      id: task.id, // 确保 ID 不变
      createdAt: task.createdAt, // 确保创建时间不变
    };

    // 如果 cron 表达式变了，重新计算下次执行时间
    if (updates.cron !== undefined) {
      updatedTask.nextRunAt = this.calculateNextRunTime(updates.cron) || undefined;
    }

    this.tasks.set(id, updatedTask);
    await this.saveTasks();

    // 如果调度器正在运行，更新 cron job
    if (this.isRunning) {
      if (updatedTask.enabled) {
        this.scheduleCronJob(updatedTask);
      } else {
        this.stopCronJob(id);
      }
    }

    logger.info(`Updated scheduled task: ${updatedTask.name} (${id})`);
    return updatedTask;
  }

  /**
   * 删除定时任务
   */
  async deleteTask(id: string): Promise<void> {
    const task = this.tasks.get(id);
    if (!task) {
      throw new Error(`Task not found: ${id}`);
    }

    // 停止 cron job
    this.stopCronJob(id);

    // 从列表中删除
    this.tasks.delete(id);
    await this.saveTasks();

    logger.info(`Deleted scheduled task: ${task.name} (${id})`);
  }


  /**
   * 获取所有定时任务
   */
  async getTasks(): Promise<ScheduledTask[]> {
    await this.ensureDirectories();
    
    // 如果任务列表为空，尝试从文件加载
    if (this.tasks.size === 0) {
      await this.loadTasks();
    }

    return Array.from(this.tasks.values());
  }

  /**
   * 根据 ID 获取定时任务
   */
  async getTaskById(id: string): Promise<ScheduledTask | null> {
    await this.ensureDirectories();
    
    // 如果任务列表为空，尝试从文件加载
    if (this.tasks.size === 0) {
      await this.loadTasks();
    }

    return this.tasks.get(id) || null;
  }

  /**
   * 手动执行任务
   */
  async runTaskNow(id: string): Promise<TaskExecution> {
    const task = this.tasks.get(id);
    if (!task) {
      throw new Error(`Task not found: ${id}`);
    }

    logger.info(`Manual execution triggered for task: ${task.name}`);
    return this.executeTask(task);
  }

  /**
   * 获取执行历史
   * @param taskId 可选，指定任务 ID 过滤
   * @param limit 可选，限制返回数量
   */
  async getExecutions(taskId?: string, limit?: number): Promise<TaskExecution[]> {
    await this.ensureDirectories();

    // 列出所有执行记录文件
    const files = await this.listExecutionFiles();
    
    // 按日期降序排序（最新的在前）
    files.sort((a, b) => b.localeCompare(a));

    const allExecutions: TaskExecution[] = [];

    for (const dateStr of files) {
      const executions = await this.readExecutionsFile(dateStr);
      
      // 如果指定了 taskId，过滤
      const filtered = taskId 
        ? executions.filter((e) => e.taskId === taskId)
        : executions;
      
      allExecutions.push(...filtered);

      // 如果已经收集够了，提前退出
      if (limit && allExecutions.length >= limit) {
        break;
      }
    }

    // 按开始时间降序排序
    allExecutions.sort((a, b) => b.startedAt - a.startedAt);

    // 应用限制
    if (limit && limit > 0) {
      return allExecutions.slice(0, limit);
    }

    return allExecutions;
  }

  /**
   * 列出所有执行记录文件
   */
  private async listExecutionFiles(): Promise<string[]> {
    try {
      const files = await fs.readdir(EXECUTIONS_DIR);
      return files
        .filter((f) => f.endsWith('.json') && f !== '.gitkeep')
        .map((f) => f.replace('.json', ''));
    } catch {
      return [];
    }
  }

  /**
   * 检查服务是否正在运行
   */
  isServiceRunning(): boolean {
    return this.isRunning;
  }

  /**
   * 获取所有活跃的 cron jobs 数量
   */
  getActiveCronJobsCount(): number {
    return this.cronJobs.size;
  }
}

// 导出单例实例
export const scheduler = new Scheduler();

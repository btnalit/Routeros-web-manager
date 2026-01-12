/**
 * ChatSessionService - 聊天会话管理服务
 *
 * 管理聊天会话的持久化，包括：
 * - 会话 CRUD 操作（创建、读取、更新、删除）
 * - 消息管理
 * - Markdown 导出
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  IChatSessionService,
  ChatSession,
  ChatMessage,
  UpdateSessionInput,
  AIAgentData,
  AIAgentSettings,
  AIProvider,
} from '../../types/ai';
import { logger } from '../../utils/logger';

/**
 * 数据文件路径配置
 */
const DATA_DIR = path.join(process.cwd(), 'data');
const AI_DATA_FILE = path.join(DATA_DIR, 'ai-agent.json');

/**
 * 默认 AI Agent 设置
 */
const DEFAULT_SETTINGS: AIAgentSettings = {
  rateLimitPerMinute: 60,
  maxContextTokens: 4096,
};

/**
 * 默认 AI Agent 数据结构
 */
const DEFAULT_AI_DATA: AIAgentData = {
  apiConfigs: [],
  sessions: [],
  scriptHistory: [],
  settings: DEFAULT_SETTINGS,
};

/**
 * 默认会话标题
 */
const DEFAULT_SESSION_TITLE = '新会话';

/**
 * 最大会话数量限制
 */
const MAX_SESSIONS = 100;


/**
 * ChatSessionService 实现类
 *
 * 提供会话的完整 CRUD 功能和消息管理
 */
export class ChatSessionService implements IChatSessionService {
  /**
   * 确保数据目录存在
   */
  private async ensureDataDir(): Promise<void> {
    try {
      await fs.access(DATA_DIR);
    } catch {
      await fs.mkdir(DATA_DIR, { recursive: true });
      logger.info(`Created AI data directory: ${DATA_DIR}`);
    }
  }

  /**
   * 加载 AI Agent 数据
   */
  private async loadData(): Promise<AIAgentData> {
    try {
      await this.ensureDataDir();
      const data = await fs.readFile(AI_DATA_FILE, 'utf-8');
      const parsed = JSON.parse(data) as AIAgentData;

      // 确保 sessions 数组存在
      if (!parsed.sessions) {
        parsed.sessions = [];
      }

      // 转换日期字符串为 Date 对象
      parsed.sessions = parsed.sessions.map(session => ({
        ...session,
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt),
      }));

      return parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.info('No AI agent data file found, using defaults');
        return { ...DEFAULT_AI_DATA };
      }
      logger.error('Failed to load AI agent data:', error);
      throw new Error('加载 AI 配置数据失败');
    }
  }

  /**
   * 保存 AI Agent 数据
   */
  private async saveData(data: AIAgentData): Promise<void> {
    try {
      await this.ensureDataDir();
      const jsonData = JSON.stringify(data, null, 2);
      await fs.writeFile(AI_DATA_FILE, jsonData, 'utf-8');
      logger.info('Saved AI agent data to file');
    } catch (error) {
      logger.error('Failed to save AI agent data:', error);
      throw new Error('保存 AI 配置数据失败');
    }
  }

  /**
   * 根据第一条用户消息生成会话标题
   *
   * @param messages 消息列表
   * @returns 生成的标题
   */
  private generateTitle(messages: ChatMessage[]): string {
    const firstUserMessage = messages.find(m => m.role === 'user');
    if (!firstUserMessage) {
      return DEFAULT_SESSION_TITLE;
    }

    // 截取前 30 个字符作为标题
    const content = firstUserMessage.content.trim();
    if (content.length <= 30) {
      return content;
    }
    return content.substring(0, 30) + '...';
  }

  /**
   * 创建新的聊天会话
   *
   * @param provider AI 提供商
   * @param model 模型名称
   * @returns 创建的会话
   */
  async create(provider: AIProvider, model: string): Promise<ChatSession> {
    const data = await this.loadData();
    const now = new Date();

    const newSession: ChatSession = {
      id: uuidv4(),
      title: DEFAULT_SESSION_TITLE,
      provider,
      model,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };

    data.sessions.push(newSession);

    // 限制会话数量
    if (data.sessions.length > MAX_SESSIONS) {
      // 按更新时间排序，删除最旧的会话
      data.sessions.sort((a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      data.sessions = data.sessions.slice(0, MAX_SESSIONS);
    }

    await this.saveData(data);
    logger.info(`Created chat session: ${newSession.id}`);

    return newSession;
  }

  /**
   * 更新会话信息
   *
   * @param id 会话 ID
   * @param updates 要更新的字段
   * @returns 更新后的会话
   * @throws Error 如果会话不存在
   */
  async update(id: string, updates: UpdateSessionInput): Promise<ChatSession> {
    const data = await this.loadData();
    const index = data.sessions.findIndex(session => session.id === id);

    if (index === -1) {
      throw new Error(`会话不存在: ${id}`);
    }

    const now = new Date();

    const updatedSession: ChatSession = {
      ...data.sessions[index],
      ...updates,
      updatedAt: now,
    };

    data.sessions[index] = updatedSession;
    await this.saveData(data);
    logger.info(`Updated chat session: ${id}`);

    return updatedSession;
  }

  /**
   * 删除会话
   *
   * @param id 会话 ID
   * @throws Error 如果会话不存在
   */
  async delete(id: string): Promise<void> {
    const data = await this.loadData();
    const index = data.sessions.findIndex(session => session.id === id);

    if (index === -1) {
      throw new Error(`会话不存在: ${id}`);
    }

    data.sessions.splice(index, 1);
    await this.saveData(data);
    logger.info(`Deleted chat session: ${id}`);
  }

  /**
   * 根据 ID 获取会话
   *
   * @param id 会话 ID
   * @returns 会话对象或 null
   */
  async getById(id: string): Promise<ChatSession | null> {
    const data = await this.loadData();
    return data.sessions.find(session => session.id === id) || null;
  }

  /**
   * 获取所有会话
   *
   * @returns 所有会话的数组（按更新时间倒序）
   */
  async getAll(): Promise<ChatSession[]> {
    const data = await this.loadData();
    return data.sessions.sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  /**
   * 向会话添加消息
   *
   * @param sessionId 会话 ID
   * @param message 要添加的消息
   * @throws Error 如果会话不存在
   */
  async addMessage(sessionId: string, message: ChatMessage): Promise<void> {
    const data = await this.loadData();
    const index = data.sessions.findIndex(session => session.id === sessionId);

    if (index === -1) {
      throw new Error(`会话不存在: ${sessionId}`);
    }

    const now = new Date();
    data.sessions[index].messages.push(message);
    data.sessions[index].updatedAt = now;

    // 如果是第一条用户消息，自动生成标题
    if (data.sessions[index].title === DEFAULT_SESSION_TITLE) {
      data.sessions[index].title = this.generateTitle(data.sessions[index].messages);
    }

    await this.saveData(data);
    logger.info(`Added message to session: ${sessionId}, role: ${message.role}`);
  }

  /**
   * 批量添加消息
   *
   * @param sessionId 会话 ID
   * @param messages 要添加的消息数组
   * @throws Error 如果会话不存在
   */
  async addMessages(sessionId: string, messages: ChatMessage[]): Promise<void> {
    const data = await this.loadData();
    const index = data.sessions.findIndex(session => session.id === sessionId);

    if (index === -1) {
      throw new Error(`会话不存在: ${sessionId}`);
    }

    const now = new Date();
    data.sessions[index].messages.push(...messages);
    data.sessions[index].updatedAt = now;

    // 如果是第一条用户消息，自动生成标题
    if (data.sessions[index].title === DEFAULT_SESSION_TITLE) {
      data.sessions[index].title = this.generateTitle(data.sessions[index].messages);
    }

    await this.saveData(data);
    logger.info(`Added ${messages.length} messages to session: ${sessionId}`);
  }

  /**
   * 获取会话的所有消息
   *
   * @param sessionId 会话 ID
   * @returns 消息数组
   * @throws Error 如果会话不存在
   */
  async getMessages(sessionId: string): Promise<ChatMessage[]> {
    const session = await this.getById(sessionId);
    if (!session) {
      throw new Error(`会话不存在: ${sessionId}`);
    }
    return session.messages;
  }

  /**
   * 清除会话的所有消息
   *
   * @param sessionId 会话 ID
   * @throws Error 如果会话不存在
   */
  async clearMessages(sessionId: string): Promise<void> {
    const data = await this.loadData();
    const index = data.sessions.findIndex(session => session.id === sessionId);

    if (index === -1) {
      throw new Error(`会话不存在: ${sessionId}`);
    }

    const now = new Date();
    data.sessions[index].messages = [];
    data.sessions[index].title = DEFAULT_SESSION_TITLE;
    data.sessions[index].updatedAt = now;

    await this.saveData(data);
    logger.info(`Cleared messages for session: ${sessionId}`);
  }

  /**
   * 导出会话为 Markdown 格式
   *
   * @param id 会话 ID
   * @returns Markdown 格式的会话内容
   * @throws Error 如果会话不存在
   */
  async exportAsMarkdown(id: string): Promise<string> {
    const session = await this.getById(id);
    if (!session) {
      throw new Error(`会话不存在: ${id}`);
    }

    const lines: string[] = [];

    // 标题
    lines.push(`# ${session.title}`);
    lines.push('');

    // 元信息
    lines.push(`**提供商**: ${session.provider}`);
    lines.push(`**模型**: ${session.model}`);
    lines.push(`**创建时间**: ${session.createdAt.toLocaleString()}`);
    lines.push(`**更新时间**: ${session.updatedAt.toLocaleString()}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    // 消息内容
    for (const message of session.messages) {
      const roleLabel = this.getRoleLabel(message.role);
      lines.push(`## ${roleLabel}`);
      lines.push('');
      lines.push(message.content);
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * 获取角色的显示标签
   *
   * @param role 角色
   * @returns 显示标签
   */
  private getRoleLabel(role: ChatMessage['role']): string {
    switch (role) {
      case 'user':
        return '👤 用户';
      case 'assistant':
        return '🤖 助手';
      case 'system':
        return '⚙️ 系统';
      default:
        return role;
    }
  }

  /**
   * 重命名会话
   *
   * @param id 会话 ID
   * @param title 新标题
   * @returns 更新后的会话
   * @throws Error 如果会话不存在
   */
  async rename(id: string, title: string): Promise<ChatSession> {
    return this.update(id, { title });
  }

  /**
   * 复制会话
   *
   * @param id 要复制的会话 ID
   * @returns 新创建的会话副本
   * @throws Error 如果原会话不存在
   */
  async duplicate(id: string): Promise<ChatSession> {
    const original = await this.getById(id);
    if (!original) {
      throw new Error(`会话不存在: ${id}`);
    }

    const data = await this.loadData();
    const now = new Date();

    const newSession: ChatSession = {
      id: uuidv4(),
      title: `${original.title} (副本)`,
      provider: original.provider,
      model: original.model,
      messages: [...original.messages],
      createdAt: now,
      updatedAt: now,
    };

    data.sessions.push(newSession);
    await this.saveData(data);
    logger.info(`Duplicated session ${id} to ${newSession.id}`);

    return newSession;
  }

  /**
   * 获取会话数量
   *
   * @returns 会话总数
   */
  async count(): Promise<number> {
    const data = await this.loadData();
    return data.sessions.length;
  }

  /**
   * 搜索会话
   *
   * @param query 搜索关键词
   * @returns 匹配的会话列表
   */
  async search(query: string): Promise<ChatSession[]> {
    const data = await this.loadData();
    const lowerQuery = query.toLowerCase();

    return data.sessions.filter(session => {
      // 搜索标题
      if (session.title.toLowerCase().includes(lowerQuery)) {
        return true;
      }
      // 搜索消息内容
      return session.messages.some(msg =>
        msg.content.toLowerCase().includes(lowerQuery)
      );
    }).sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  /**
   * 删除所有会话
   */
  async deleteAll(): Promise<void> {
    const data = await this.loadData();
    const count = data.sessions.length;
    data.sessions = [];
    await this.saveData(data);
    logger.info(`Deleted all ${count} chat sessions`);
  }
}

/**
 * 默认 ChatSessionService 单例实例
 */
export const chatSessionService = new ChatSessionService();

export default chatSessionService;

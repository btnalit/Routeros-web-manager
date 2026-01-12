/**
 * AI Agent Client 类型定义
 * 定义与 AI 服务提供商 API 交互所需的所有接口类型
 */

// ==================== 提供商枚举 ====================

/**
 * AI 服务提供商类型
 */
export enum AIProvider {
  OPENAI = 'openai',
  GEMINI = 'gemini',
  DEEPSEEK = 'deepseek',
  QWEN = 'qwen',
  DOUBAO = 'doubao'
}

// ==================== 消息类型 ====================

/**
 * 聊天消息角色
 */
export type ChatRole = 'system' | 'user' | 'assistant';

/**
 * 聊天消息
 */
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

// ==================== 请求/响应类型 ====================

/**
 * 聊天请求接口
 */
export interface ChatRequest {
  provider: AIProvider;
  model: string;
  messages: ChatMessage[];
  stream: boolean;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Token 使用统计
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * 聊天响应接口
 */
export interface ChatResponse {
  content: string;
  finishReason: string;
  usage?: TokenUsage;
}

// ==================== API 配置类型 ====================

/**
 * API 配置接口
 */
export interface APIConfig {
  id: string;
  provider: AIProvider;
  name: string;
  apiKey: string;  // 加密存储
  endpoint?: string;  // 自定义端点
  model: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 创建 API 配置的输入类型（不包含自动生成的字段）
 */
export type CreateAPIConfigInput = Omit<APIConfig, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * 更新 API 配置的输入类型
 */
export type UpdateAPIConfigInput = Partial<Omit<APIConfig, 'id' | 'createdAt' | 'updatedAt'>>;

/**
 * API 配置显示类型（API Key 已掩码）
 */
export interface APIConfigDisplay extends Omit<APIConfig, 'apiKey'> {
  apiKeyMasked: string;
}

// ==================== 上下文类型 ====================

/**
 * RouterOS 连接上下文
 */
export interface RouterOSConnectionContext {
  connected: boolean;
  host: string;
  version?: string;
}

/**
 * RouterOS 系统信息
 */
export interface RouterOSSystemInfo {
  identity: string;
  boardName: string;
  version: string;
  uptime: string;
}

/**
 * 选中的配置项
 */
export interface SelectedConfig {
  type: string;
  data: unknown;
}

/**
 * RouterOS 上下文
 */
export interface RouterOSContext {
  connectionStatus: RouterOSConnectionContext;
  systemInfo?: RouterOSSystemInfo;
  selectedConfigs?: SelectedConfig[];
}

// ==================== 脚本执行类型 ====================

/**
 * 脚本执行请求
 */
export interface ScriptExecuteRequest {
  script: string;
  dryRun?: boolean;  // 仅验证不执行
}

/**
 * 脚本执行结果
 */
export interface ScriptExecuteResult {
  success: boolean;
  output?: string;
  error?: string;
  executedAt: Date;
}

/**
 * 脚本验证结果
 */
export interface ScriptValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * 脚本执行历史记录
 */
export interface ScriptHistory {
  id: string;
  script: string;
  result: ScriptExecuteResult;
  sessionId: string;
  createdAt: Date;
}

// ==================== 会话类型 ====================

/**
 * 聊天会话
 */
export interface ChatSession {
  id: string;
  title: string;
  provider: AIProvider;
  model: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 创建会话的输入类型
 */
export type CreateSessionInput = Pick<ChatSession, 'provider' | 'model'>;

/**
 * 更新会话的输入类型
 */
export type UpdateSessionInput = Partial<Pick<ChatSession, 'title' | 'provider' | 'model'>>;

// ==================== 数据存储类型 ====================

/**
 * AI Agent 设置
 */
export interface AIAgentSettings {
  defaultProviderId?: string;
  rateLimitPerMinute: number;
  maxContextTokens: number;
}

/**
 * AI Agent 数据存储结构
 */
export interface AIAgentData {
  apiConfigs: APIConfig[];
  sessions: ChatSession[];
  scriptHistory: ScriptHistory[];
  settings: AIAgentSettings;
}

// ==================== 错误类型 ====================

/**
 * AI 错误响应
 */
export interface AIErrorResponse {
  code: string;
  message: string;
  details?: unknown;
  retryable: boolean;
  retryAfter?: number;  // 秒
}

/**
 * AI 错误代码
 */
export enum AIErrorCode {
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  INVALID_API_KEY = 'INVALID_API_KEY',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  MODEL_UNAVAILABLE = 'MODEL_UNAVAILABLE',
  RATE_LIMITED = 'RATE_LIMITED',
  SCRIPT_SYNTAX_ERROR = 'SCRIPT_SYNTAX_ERROR',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  CONNECTION_LOST = 'CONNECTION_LOST',
  EXECUTION_TIMEOUT = 'EXECUTION_TIMEOUT',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

// ==================== 适配器接口 ====================

/**
 * AI 提供商适配器接口
 */
export interface IAIProviderAdapter {
  /**
   * 发送聊天请求（非流式）
   */
  chat(request: ChatRequest): Promise<ChatResponse>;
  
  /**
   * 发送聊天请求（流式）
   */
  chatStream(request: ChatRequest): AsyncGenerator<string>;
  
  /**
   * 验证 API Key 是否有效
   */
  validateApiKey(apiKey: string): Promise<boolean>;
  
  /**
   * 获取可用模型列表
   */
  listModels(): Promise<string[]>;
}

// ==================== 服务接口 ====================

/**
 * API 配置服务接口
 */
export interface IAPIConfigService {
  create(config: CreateAPIConfigInput): Promise<APIConfig>;
  update(id: string, config: UpdateAPIConfigInput): Promise<APIConfig>;
  delete(id: string): Promise<void>;
  getAll(): Promise<APIConfig[]>;
  getById(id: string): Promise<APIConfig | null>;
  getDefault(): Promise<APIConfig | null>;
  setDefault(id: string): Promise<void>;
  testConnection(id: string): Promise<boolean>;
}

/**
 * 上下文构建器接口
 */
export interface IContextBuilder {
  buildSystemPrompt(): string;
  getConnectionContext(): Promise<RouterOSContext>;
  getConfigSection(section: string): Promise<unknown>;
  sanitizeConfig(config: unknown): unknown;
}

/**
 * 脚本执行器接口
 */
export interface IScriptExecutor {
  execute(request: ScriptExecuteRequest): Promise<ScriptExecuteResult>;
  validate(script: string): Promise<ScriptValidationResult>;
  getHistory(sessionId?: string): Promise<ScriptHistory[]>;
}

/**
 * 会话服务接口
 */
export interface IChatSessionService {
  create(provider: AIProvider, model: string): Promise<ChatSession>;
  update(id: string, updates: UpdateSessionInput): Promise<ChatSession>;
  delete(id: string): Promise<void>;
  getById(id: string): Promise<ChatSession | null>;
  getAll(): Promise<ChatSession[]>;
  addMessage(sessionId: string, message: ChatMessage): Promise<void>;
  exportAsMarkdown(id: string): Promise<string>;
}

/**
 * 加密服务接口
 */
export interface ICryptoService {
  encrypt(plainText: string): string;
  decrypt(cipherText: string): string;
}

/**
 * 速率限制服务接口
 */
export interface IRateLimiterService {
  checkLimit(key: string): boolean;
  getRemainingRequests(key: string): number;
  resetLimit(key: string): void;
}

// ==================== 常量配置 ====================

/**
 * 默认 API 端点
 */
export const DEFAULT_ENDPOINTS: Record<AIProvider, string> = {
  [AIProvider.OPENAI]: 'https://api.openai.com/v1',
  [AIProvider.GEMINI]: 'https://generativelanguage.googleapis.com/v1beta',
  [AIProvider.DEEPSEEK]: 'https://api.deepseek.com/v1',
  [AIProvider.QWEN]: 'https://dashscope.aliyuncs.com/api/v1',
  [AIProvider.DOUBAO]: 'https://ark.cn-beijing.volces.com/api/v3'
};

/**
 * 默认模型列表 (2025年1月更新)
 */
export const DEFAULT_MODELS: Record<AIProvider, string[]> = {
  [AIProvider.OPENAI]: [
    'gpt-5',
    'gpt-5-mini',
    'gpt-5.1',
    'gpt-4.1',
    'gpt-4.1-mini',
    'gpt-4o',
    'gpt-4o-mini',
    'o3',
    'o4-mini'
  ],
  [AIProvider.GEMINI]: [
    'gemini-3-pro',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash'
  ],
  [AIProvider.DEEPSEEK]: [
    'deepseek-chat',
    'deepseek-reasoner'
  ],
  [AIProvider.QWEN]: [
    'qwen3-max',
    'qwen3-plus',
    'qwen3-turbo',
    'qwen-max',
    'qwen-plus',
    'qwen-turbo'
  ],
  [AIProvider.DOUBAO]: [
    'doubao-seed-1-8-251228',
    'doubao-seed-1.6',
    'doubao-seed-1.8',
    'doubao-seed-1.6-thinking',
    'doubao-seed-1.6-vision',
    'doubao-seedance-1.0-pro',
    'doubao-1.5-ui-tars'
  ]
};

/**
 * RouterOS 系统提示词模板
 */
export const ROUTEROS_SYSTEM_PROMPT = `你是一个专业的 RouterOS 网络配置专家。你的职责是：

1. 帮助用户理解和配置 MikroTik RouterOS 设备
2. 生成准确、安全的 RouterOS 配置脚本
3. 解释网络概念和 RouterOS 特定功能
4. 提供最佳实践建议

重要规则：
- 所有 RouterOS 命令必须使用代码块格式（\`\`\`routeros）
- 在执行危险操作前提醒用户备份配置
- 不要假设用户的网络拓扑，需要时请询问
- 优先使用安全的配置方式
- 解释每个命令的作用

【严格禁止】：
- 绝对不要假装已经执行了命令
- 绝对不要编造或虚构任何配置数据、IP地址、接口名称等信息
- 绝对不要生成假的命令输出结果
- 如果用户想查看配置，只提供命令，让用户点击"执行"按钮来获取真实数据
- 你无法直接访问或执行 RouterOS 命令，只能生成命令供用户执行

正确的回复方式：
- 当用户想查看配置时，说"您可以执行以下命令查看"，然后提供命令
- 不要在命令后面添加假的输出结果
- 等用户执行命令后，根据真实输出来回答问题

当前连接状态：
{connectionContext}
`;

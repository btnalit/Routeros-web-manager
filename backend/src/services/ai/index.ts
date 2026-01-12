/**
 * AI 服务模块导出
 *
 * 本模块提供 AI Agent Client 的所有后端服务：
 * - CryptoService: API Key 加密解密
 * - APIConfigService: API 配置管理
 * - ContextBuilderService: RouterOS 上下文构建
 * - ScriptExecutorService: 脚本执行
 * - ChatSessionService: 会话管理
 * - RateLimiterService: 速率限制
 * - AI Provider Adapters: 各 AI 提供商适配器
 */

// CryptoService - API Key 加密解密
export { CryptoService, cryptoService } from './cryptoService';

// APIConfigService - API 配置管理
export { APIConfigService, apiConfigService } from './apiConfigService';

// ContextBuilderService - RouterOS 上下文构建
export { ContextBuilderService, contextBuilderService } from './contextBuilderService';

// AI Provider Adapters - 各 AI 提供商适配器
export {
  BaseAdapter,
  AdapterConfig,
  AIAdapterError,
  AdapterFactory,
  OpenAIAdapter,
  GeminiAdapter,
  DeepSeekAdapter,
  QwenAdapter,
  DoubaoAdapter
} from './adapters';

// ScriptExecutorService - 脚本执行服务
export { ScriptExecutorService, scriptExecutorService } from './scriptExecutorService';

// ChatSessionService - 会话管理服务
export { ChatSessionService, chatSessionService } from './chatSessionService';

// RateLimiterService - 速率限制服务
export { RateLimiterService, RateLimiterConfig, rateLimiterService } from './rateLimiterService';

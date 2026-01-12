/**
 * AI Agent Client API
 * 前端 AI 服务 API 客户端，实现与后端 AI 服务的通信
 *
 * 功能：
 * - API 配置管理（CRUD、默认提供商、连接测试）
 * - 聊天功能（流式/非流式响应）
 * - 脚本执行（执行、验证、历史记录）
 * - 会话管理（CRUD、消息、导出）
 *
 * Requirements: 2.3
 */

import api from './index'

// ==================== 类型定义 ====================

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

/**
 * 聊天消息角色
 */
export type ChatRole = 'system' | 'user' | 'assistant'

/**
 * 聊天消息
 */
export interface ChatMessage {
  role: ChatRole
  content: string
}

/**
 * API 配置显示类型（API Key 已掩码）
 */
export interface APIConfigDisplay {
  id: string
  provider: AIProvider
  name: string
  apiKeyMasked: string
  endpoint?: string
  model: string
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * 创建 API 配置的输入类型
 */
export interface CreateAPIConfigInput {
  provider: AIProvider
  name: string
  apiKey: string
  endpoint?: string
  model: string
  isDefault?: boolean
}

/**
 * 更新 API 配置的输入类型
 */
export interface UpdateAPIConfigInput {
  provider?: AIProvider
  name?: string
  apiKey?: string
  endpoint?: string
  model?: string
  isDefault?: boolean
}

/**
 * 提供商信息
 */
export interface ProviderInfo {
  id: AIProvider
  name: string
  defaultEndpoint: string
  defaultModels: string[]
}

/**
 * 聊天会话
 */
export interface ChatSession {
  id: string
  title: string
  provider: AIProvider
  model: string
  messages: ChatMessage[]
  createdAt: Date
  updatedAt: Date
}

/**
 * 脚本执行结果
 */
export interface ScriptExecuteResult {
  success: boolean
  output?: string
  error?: string
  executedAt: Date
}

/**
 * 脚本执行历史记录
 */
export interface ScriptHistory {
  id: string
  script: string
  result: ScriptExecuteResult
  sessionId: string
  createdAt: Date
}

/**
 * 脚本验证结果
 */
export interface ScriptValidationResult {
  valid: boolean
  errors?: string[]
  dangerousCommands?: string[]
  hasDangerousCommands?: boolean
}

/**
 * RouterOS 上下文
 */
export interface RouterOSContext {
  connectionStatus: {
    connected: boolean
    host: string
    version?: string
  }
  systemInfo?: {
    identity: string
    boardName: string
    version: string
    uptime: string
  }
  selectedConfigs?: {
    type: string
    data: unknown
  }[]
}

/**
 * Token 使用统计
 */
export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

/**
 * 聊天响应
 */
export interface ChatResponseData {
  content: string
  usage?: TokenUsage
}

/**
 * 连接测试结果
 */
export interface ConnectionTestResult {
  connected: boolean
  message: string
}

/**
 * SSE 流式响应数据
 */
export interface StreamChunk {
  content?: string
  done?: boolean
  fullContent?: string
  error?: string
}

/**
 * SSE 流式响应回调
 */
export interface StreamCallbacks {
  onChunk?: (chunk: string) => void
  onComplete?: (fullContent: string) => void
  onError?: (error: string) => void
}

// ==================== API 响应类型 ====================

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
  retryAfter?: number
}

// ==================== 提供商 API ====================

export const providerApi = {
  /**
   * 获取所有支持的提供商
   */
  getAll: () => api.get<ApiResponse<ProviderInfo[]>>('/ai/providers')
}

// ==================== API 配置管理 ====================

export const configApi = {
  /**
   * 获取所有配置
   */
  getAll: () => api.get<ApiResponse<APIConfigDisplay[]>>('/ai/configs'),

  /**
   * 获取单个配置
   */
  getById: (id: string) => api.get<ApiResponse<APIConfigDisplay>>(`/ai/configs/${id}`),

  /**
   * 创建配置
   */
  create: (data: CreateAPIConfigInput) => api.post<ApiResponse<APIConfigDisplay>>('/ai/configs', data),

  /**
   * 更新配置
   */
  update: (id: string, data: UpdateAPIConfigInput) =>
    api.put<ApiResponse<APIConfigDisplay>>(`/ai/configs/${id}`, data),

  /**
   * 删除配置
   */
  delete: (id: string) => api.delete<ApiResponse<void>>(`/ai/configs/${id}`),

  /**
   * 获取默认配置
   */
  getDefault: () => api.get<ApiResponse<APIConfigDisplay | null>>('/ai/configs/default'),

  /**
   * 设置为默认配置
   */
  setDefault: (id: string) => api.post<ApiResponse<void>>(`/ai/configs/${id}/default`),

  /**
   * 测试配置连接
   */
  testConnection: (id: string) =>
    api.post<ApiResponse<ConnectionTestResult>>(`/ai/configs/${id}/test`)
}

// ==================== 聊天功能 ====================

export const chatApi = {
  /**
   * 发送聊天消息（非流式）
   */
  send: (data: {
    configId?: string
    sessionId?: string
    message: string
    includeContext?: boolean
  }) => api.post<ApiResponse<ChatResponseData>>('/ai/chat', data),

  /**
   * 发送聊天消息（流式 SSE）
   * 返回一个 AbortController 用于取消请求
   */
  sendStream: (
    data: {
      configId?: string
      sessionId?: string
      message: string
      includeContext?: boolean
    },
    callbacks: StreamCallbacks
  ): AbortController => {
    const controller = new AbortController()

    // 使用 fetch 发送 POST 请求并处理 SSE 响应
    fetch('/api/ai/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data),
      signal: controller.signal
    })
      .then(async (response) => {
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: '请求失败' }))
          callbacks.onError?.(errorData.error || `HTTP ${response.status}`)
          return
        }

        const reader = response.body?.getReader()
        if (!reader) {
          callbacks.onError?.('无法读取响应流')
          return
        }

        const decoder = new TextDecoder()
        let buffer = ''

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })

            // 解析 SSE 数据
            const lines = buffer.split('\n')
            buffer = lines.pop() || '' // 保留未完成的行

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const jsonStr = line.slice(6).trim()
                if (!jsonStr) continue

                try {
                  const chunk: StreamChunk = JSON.parse(jsonStr)

                  if (chunk.error) {
                    callbacks.onError?.(chunk.error)
                    return
                  }

                  if (chunk.done && chunk.fullContent !== undefined) {
                    callbacks.onComplete?.(chunk.fullContent)
                  } else if (chunk.content) {
                    callbacks.onChunk?.(chunk.content)
                  }
                } catch {
                  // 忽略解析错误，可能是不完整的 JSON
                }
              }
            }
          }
        } catch (error) {
          if ((error as Error).name !== 'AbortError') {
            callbacks.onError?.((error as Error).message || '流式响应错误')
          }
        }
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          callbacks.onError?.(error.message || '网络请求失败')
        }
      })

    return controller
  }
}

// ==================== RouterOS 上下文 ====================

export const contextApi = {
  /**
   * 获取当前上下文
   */
  get: () => api.get<ApiResponse<RouterOSContext>>('/ai/context'),

  /**
   * 获取可用配置段列表
   */
  getSections: () => api.get<ApiResponse<string[]>>('/ai/context/sections'),

  /**
   * 获取指定配置段
   */
  getSection: (section: string) => api.get<ApiResponse<unknown>>(`/ai/context/sections/${section}`)
}

// ==================== 脚本执行 ====================

export const scriptApi = {
  /**
   * 执行脚本
   */
  execute: (data: { script: string; sessionId: string; dryRun?: boolean }) =>
    api.post<ApiResponse<{ result: ScriptExecuteResult; historyId: string }>>(
      '/ai/scripts/execute',
      data
    ),

  /**
   * 验证脚本
   */
  validate: (script: string) =>
    api.post<ApiResponse<ScriptValidationResult>>('/ai/scripts/validate', { script }),

  /**
   * 获取执行历史
   */
  getHistory: (sessionId?: string) =>
    api.get<ApiResponse<ScriptHistory[]>>('/ai/scripts/history', {
      params: sessionId ? { sessionId } : undefined
    }),

  /**
   * 删除单条执行历史
   */
  deleteHistory: (id: string) => api.delete<ApiResponse<void>>(`/ai/scripts/history/${id}`),

  /**
   * 清除会话的执行历史
   */
  clearSessionHistory: (sessionId: string) =>
    api.delete<ApiResponse<void>>(`/ai/scripts/history/session/${sessionId}`)
}

// ==================== 会话管理 ====================

export const sessionApi = {
  /**
   * 获取所有会话
   */
  getAll: () => api.get<ApiResponse<ChatSession[]>>('/ai/sessions'),

  /**
   * 获取单个会话
   */
  getById: (id: string) => api.get<ApiResponse<ChatSession>>(`/ai/sessions/${id}`),

  /**
   * 创建会话
   */
  create: (data?: { provider?: AIProvider; model?: string; configId?: string }) =>
    api.post<ApiResponse<ChatSession>>('/ai/sessions', data || {}),

  /**
   * 更新会话
   */
  update: (id: string, data: { title?: string; provider?: AIProvider; model?: string }) =>
    api.put<ApiResponse<ChatSession>>(`/ai/sessions/${id}`, data),

  /**
   * 删除会话
   */
  delete: (id: string) => api.delete<ApiResponse<void>>(`/ai/sessions/${id}`),

  /**
   * 删除所有会话
   */
  deleteAll: () => api.delete<ApiResponse<void>>('/ai/sessions'),

  /**
   * 重命名会话
   */
  rename: (id: string, title: string) =>
    api.put<ApiResponse<ChatSession>>(`/ai/sessions/${id}/rename`, { title }),

  /**
   * 清除会话消息
   */
  clearMessages: (id: string) => api.post<ApiResponse<void>>(`/ai/sessions/${id}/clear`),

  /**
   * 导出会话为 Markdown
   * 返回 Blob 用于下载
   */
  export: async (id: string): Promise<Blob> => {
    const response = await api.get(`/ai/sessions/${id}/export`, {
      responseType: 'blob'
    })
    return response.data
  },

  /**
   * 复制会话
   */
  duplicate: (id: string) => api.post<ApiResponse<ChatSession>>(`/ai/sessions/${id}/duplicate`),

  /**
   * 搜索会话
   */
  search: (query: string) =>
    api.get<ApiResponse<ChatSession[]>>('/ai/sessions/search', {
      params: { q: query }
    })
}

// ==================== 导出统一 API 对象 ====================

export const aiApi = {
  providers: providerApi,
  configs: configApi,
  chat: chatApi,
  context: contextApi,
  scripts: scriptApi,
  sessions: sessionApi
}

export default aiApi

<template>
  <div class="ai-chat-view">
    <!-- Session Sidebar -->
    <SessionSidebar
      ref="sessionSidebar"
      :active-session-id="currentSession?.id"
      v-model:collapsed="sidebarCollapsed"
      @select="handleSelectSession"
      @new-session="handleNewSessionFromSidebar"
      @delete="handleSessionDeleted"
      @clear-all="handleAllSessionsCleared"
    />

    <!-- Chat Container -->
    <div class="chat-container">
      <!-- Chat Header -->
      <div class="chat-header">
        <div class="header-left">
          <el-icon :size="24" color="#409eff"><ChatDotRound /></el-icon>
          <span class="header-title">AI 助手</span>
          <el-tag v-if="currentConfig" type="success" size="small">
            {{ getProviderDisplayName(currentConfig.provider) }} - {{ currentConfig.model }}
          </el-tag>
        </div>
        <div class="header-actions">
          <el-select
            v-model="selectedConfigId"
            placeholder="选择 AI 配置"
            size="small"
            style="width: 180px"
            @change="handleConfigChange"
          >
            <el-option
              v-for="config in configs"
              :key="config.id"
              :label="`${config.name} (${getProviderDisplayName(config.provider)})`"
              :value="config.id"
            />
          </el-select>
          <el-tooltip content="包含 RouterOS 上下文" placement="top">
            <el-switch
              v-model="includeContext"
              active-text="上下文"
              size="small"
            />
          </el-tooltip>
          <el-button
            :icon="Delete"
            size="small"
            @click="handleClearMessages"
            :disabled="messages.length === 0"
          >
            清空对话
          </el-button>
        </div>
      </div>

      <!-- Messages Area -->
      <div ref="messagesContainer" class="messages-container">
        <!-- Empty State -->
        <div v-if="messages.length === 0 && !isLoading" class="empty-state">
          <el-icon :size="64" color="#c0c4cc"><ChatLineSquare /></el-icon>
          <p>开始与 AI 助手对话</p>
          <p class="empty-hint">AI 助手可以帮助您配置 RouterOS，生成脚本，解答网络问题</p>
        </div>

        <!-- Message List -->
        <div
          v-for="(message, index) in messages"
          :key="index"
          :class="['message-item', message.role]"
        >
          <div class="message-avatar">
            <el-icon v-if="message.role === 'user'" :size="20"><User /></el-icon>
            <el-icon v-else :size="20"><Monitor /></el-icon>
          </div>
          <div class="message-content">
            <div class="message-role">{{ message.role === 'user' ? '您' : 'AI 助手' }}</div>
            <div
              v-if="message.role === 'assistant'"
              class="message-text markdown-body"
              v-html="renderMarkdown(message.content)"
            ></div>
            <div v-else class="message-text">{{ message.content }}</div>
          </div>
        </div>

        <!-- Streaming Response -->
        <div v-if="isLoading && streamingContent" class="message-item assistant">
          <div class="message-avatar">
            <el-icon :size="20"><Monitor /></el-icon>
          </div>
          <div class="message-content">
            <div class="message-role">AI 助手</div>
            <div class="message-text markdown-body" v-html="renderMarkdown(streamingContent)"></div>
            <span class="typing-cursor"></span>
          </div>
        </div>

        <!-- Loading Indicator -->
        <div v-if="isLoading && !streamingContent" class="loading-indicator">
          <el-icon class="is-loading" :size="20"><Loading /></el-icon>
          <span>AI 正在思考...</span>
        </div>
      </div>

      <!-- Error Alert -->
      <el-alert
        v-if="error"
        :title="error"
        type="error"
        show-icon
        closable
        class="error-alert"
        @close="error = ''"
      >
        <template #default>
          <el-button type="primary" size="small" @click="handleRetry">
            重试
          </el-button>
        </template>
      </el-alert>

      <!-- Input Area -->
      <div class="input-area">
        <el-input
          v-model="inputMessage"
          type="textarea"
          :rows="3"
          placeholder="输入您的问题，按 Enter 发送，Shift+Enter 换行..."
          :disabled="isLoading || !selectedConfigId"
          @keydown="handleKeydown"
          resize="none"
        />
        <div class="input-actions">
          <span class="input-hint">
            <template v-if="!selectedConfigId">请先选择 AI 配置</template>
            <template v-else>Enter 发送 | Shift+Enter 换行</template>
          </span>
          <div class="action-buttons">
            <el-button
              v-if="isLoading"
              type="danger"
              :icon="Close"
              @click="handleStopGeneration"
            >
              停止生成
            </el-button>
            <el-button
              v-else
              type="primary"
              :icon="Promotion"
              :disabled="!inputMessage.trim() || !selectedConfigId"
              @click="handleSend"
            >
              发送
            </el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ChatDotRound,
  ChatLineSquare,
  User,
  Monitor,
  Delete,
  Promotion,
  Close,
  Loading
} from '@element-plus/icons-vue'
import {
  configApi,
  chatApi,
  sessionApi,
  AIProvider,
  type APIConfigDisplay,
  type ChatMessage,
  type ChatSession
} from '@/api/ai'
import { scriptApi } from '@/api/ai'
import SessionSidebar from '@/components/SessionSidebar.vue'

// 动态导入 marked 和 highlight.js 以优化首屏加载
let marked: typeof import('marked').marked | null = null
let hljs: typeof import('highlight.js').default | null = null
const markdownReady = ref(false)

// 异步加载 markdown 相关库
const loadMarkdownLibs = async () => {
  if (marked && hljs) {
    markdownReady.value = true
    return
  }
  
  try {
    const [markedModule, hljsModule] = await Promise.all([
      import('marked'),
      import('highlight.js')
    ])
    marked = markedModule.marked
    hljs = hljsModule.default
    markdownReady.value = true
    configureMarked()
  } catch (err) {
    console.error('Failed to load markdown libraries:', err)
  }
}

// ==================== 常量 ====================

const PROVIDER_DISPLAY_NAMES: Record<AIProvider, string> = {
  [AIProvider.OPENAI]: 'OpenAI',
  [AIProvider.GEMINI]: 'Gemini',
  [AIProvider.DEEPSEEK]: 'DeepSeek',
  [AIProvider.QWEN]: 'Qwen',
  [AIProvider.DOUBAO]: '豆包'
}

// ==================== 状态 ====================

const configs = ref<APIConfigDisplay[]>([])
const selectedConfigId = ref<string>('')
const currentSession = ref<ChatSession | null>(null)
const messages = ref<ChatMessage[]>([])
const inputMessage = ref('')
const isLoading = ref(false)
const streamingContent = ref('')
const error = ref('')
const includeContext = ref(true)
const messagesContainer = ref<HTMLElement | null>(null)
const lastMessage = ref('')
const sidebarCollapsed = ref(false)
const sessionSidebar = ref<InstanceType<typeof SessionSidebar> | null>(null)

// AbortController for canceling streaming requests
let abortController: AbortController | null = null

// ==================== 计算属性 ====================

const currentConfig = computed(() => {
  return configs.value.find(c => c.id === selectedConfigId.value) || null
})

// ==================== 生命周期 ====================

onMounted(async () => {
  // 先加载配置，让页面快速显示
  await loadConfigs()
  // 然后异步加载 markdown 库
  loadMarkdownLibs()
  // 设置事件委托（只需要设置一次）
  nextTick(() => {
    setupCodeBlockEventDelegation()
  })
})

// Watch for messages changes to scroll to bottom
watch(messages, () => {
  scrollToBottom()
}, { deep: true })

watch(streamingContent, () => {
  scrollToBottom()
})

// ==================== 方法 ====================

// Configure marked for markdown rendering
const configureMarked = () => {
  if (!marked || !hljs) return
  
  marked.setOptions({
    breaks: true,
    gfm: true
  })

  // Custom renderer for code blocks
  const renderer = new marked.Renderer()
  
  renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
    const language = lang || 'plaintext'
    const validLanguage = hljs!.getLanguage(language) ? language : 'plaintext'
    const highlighted = hljs!.highlight(text, { language: validLanguage }).value
    const isRouterOS = language.toLowerCase() === 'routeros'
    
    return `<div class="code-block${isRouterOS ? ' routeros-block' : ''}">
      <div class="code-header">
        <span class="code-language">${language}</span>
        <div class="code-actions">
          <button class="code-action-btn copy-btn" data-code="${encodeURIComponent(text)}" title="复制代码">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
            </svg>
            复制
          </button>
          ${isRouterOS ? `<button class="code-action-btn execute-btn" data-script="${encodeURIComponent(text)}" title="执行脚本">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
            执行
          </button>` : ''}
        </div>
      </div>
      <pre><code class="hljs language-${validLanguage}">${highlighted}</code></pre>
    </div>`
  }

  marked.use({ renderer })
}

// Render markdown content
const renderMarkdown = (content: string): string => {
  if (!content) return ''
  if (!marked || !markdownReady.value) {
    // 如果 markdown 库还没加载完，返回纯文本
    return content.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
  }
  try {
    return marked.parse(content) as string
  } catch {
    return content
  }
}

// Load API configurations
const loadConfigs = async () => {
  try {
    const response = await configApi.getAll()
    const result = response.data
    if (result.success && Array.isArray(result.data)) {
      configs.value = result.data
      // Auto-select default config
      const defaultConfig = configs.value.find(c => c.isDefault)
      if (defaultConfig) {
        selectedConfigId.value = defaultConfig.id
      } else if (configs.value.length > 0) {
        selectedConfigId.value = configs.value[0].id
      }
    }
  } catch (err) {
    console.error('加载配置失败:', err)
    ElMessage.error('加载 AI 配置失败')
  }
}

// Get provider display name
const getProviderDisplayName = (provider: AIProvider): string => {
  return PROVIDER_DISPLAY_NAMES[provider] || provider
}

// Handle config change
const handleConfigChange = () => {
  // Optionally clear messages when switching providers
}

// Handle keyboard events
const handleKeydown = (event: Event | KeyboardEvent) => {
  const keyEvent = event as KeyboardEvent
  if (keyEvent.key === 'Enter' && !keyEvent.shiftKey) {
    event.preventDefault()
    handleSend()
  }
}

// Send message
const handleSend = async () => {
  const message = inputMessage.value.trim()
  if (!message || !selectedConfigId.value || isLoading.value) return

  // Add user message
  messages.value.push({
    role: 'user',
    content: message
  })
  lastMessage.value = message
  inputMessage.value = ''
  error.value = ''
  isLoading.value = true
  streamingContent.value = ''

  try {
    // Create session if not exists
    if (!currentSession.value) {
      const sessionResponse = await sessionApi.create({
        configId: selectedConfigId.value
      })
      if (sessionResponse.data.success && sessionResponse.data.data) {
        currentSession.value = sessionResponse.data.data
        // Update sidebar with new session
        sessionSidebar.value?.addSession(sessionResponse.data.data)
      }
    }

    // Send streaming request
    abortController = chatApi.sendStream(
      {
        configId: selectedConfigId.value,
        sessionId: currentSession.value?.id,
        message,
        includeContext: includeContext.value
      },
      {
        onChunk: (chunk) => {
          streamingContent.value += chunk
        },
        onComplete: (fullContent) => {
          // Add assistant message
          messages.value.push({
            role: 'assistant',
            content: fullContent
          })
          streamingContent.value = ''
          isLoading.value = false
          abortController = null
          
          // Setup code block event listeners after render
          nextTick(() => {
            setupCodeBlockListeners()
          })
        },
        onError: (errorMsg) => {
          error.value = errorMsg
          isLoading.value = false
          streamingContent.value = ''
          abortController = null
        }
      }
    )
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : '发送消息失败'
    error.value = errorMsg
    isLoading.value = false
    streamingContent.value = ''
  }
}

// Stop generation
const handleStopGeneration = () => {
  if (abortController) {
    abortController.abort()
    abortController = null
  }
  
  // Save partial content if any
  if (streamingContent.value) {
    messages.value.push({
      role: 'assistant',
      content: streamingContent.value + '\n\n[生成已停止]'
    })
  }
  
  streamingContent.value = ''
  isLoading.value = false
}

// Retry last message
const handleRetry = () => {
  if (lastMessage.value) {
    // Remove the last user message if it exists
    if (messages.value.length > 0 && messages.value[messages.value.length - 1].role === 'user') {
      messages.value.pop()
    }
    inputMessage.value = lastMessage.value
    error.value = ''
    handleSend()
  }
}

// Clear messages
const handleClearMessages = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要清空当前对话吗？',
      '清空确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    messages.value = []
    streamingContent.value = ''
    error.value = ''
    currentSession.value = null
    ElMessage.success('对话已清空')
  } catch {
    // User cancelled
  }
}

// Scroll to bottom of messages
const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

// Setup event delegation for code block buttons (called once on mount)
const setupCodeBlockEventDelegation = () => {
  const container = messagesContainer.value
  if (!container) return

  // Use event delegation to handle dynamically created buttons
  container.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    
    // Check if clicked element or its parent is a copy button
    const copyBtn = target.closest('.copy-btn') as HTMLElement
    if (copyBtn) {
      e.preventDefault()
      e.stopPropagation()
      const code = decodeURIComponent(copyBtn.dataset.code || '')
      navigator.clipboard.writeText(code).then(() => {
        ElMessage.success('代码已复制到剪贴板')
      }).catch(() => {
        ElMessage.error('复制失败')
      })
      return
    }

    // Check if clicked element or its parent is an execute button
    const executeBtn = target.closest('.execute-btn') as HTMLElement
    if (executeBtn) {
      e.preventDefault()
      e.stopPropagation()
      const script = decodeURIComponent(executeBtn.dataset.script || '')
      handleExecuteScript(script)
      return
    }
  })
}

// Setup event listeners for code block buttons (legacy, kept for compatibility)
const setupCodeBlockListeners = () => {
  // Event delegation is now used instead, this function is kept for compatibility
  // but does nothing to avoid duplicate listeners
}

// Handle script execution
const handleExecuteScript = async (script: string) => {
  try {
    await ElMessageBox.confirm(
      `确定要执行以下脚本吗？\n\n${script}`,
      '执行确认',
      {
        confirmButtonText: '执行',
        cancelButtonText: '取消',
        type: 'warning',
        customClass: 'script-confirm-dialog'
      }
    )
    
    // Execute the script
    const response = await scriptApi.execute({
      script,
      sessionId: currentSession.value?.id || 'default'
    })
    
    if (response.data.success && response.data.data) {
      const result = response.data.data.result
      
      if (result.success && result.output) {
        // 执行成功且有输出，自动发送给 AI 分析
        const userMessage = `我执行了命令 \`${script}\`，以下是输出结果，请帮我整理和分析：\n\n\`\`\`\n${result.output}\n\`\`\``
        
        // 添加用户消息（显示执行结果）
        messages.value.push({
          role: 'user',
          content: userMessage
        })
        
        scrollToBottom()
        ElMessage.success('脚本执行成功，正在分析结果...')
        
        // 自动发送给 AI 分析
        await sendMessageToAI(userMessage)
      } else if (result.success) {
        // 执行成功但无输出
        messages.value.push({
          role: 'assistant',
          content: `✅ **脚本执行成功**\n\n命令已成功执行，无输出内容。`
        })
        scrollToBottom()
        ElMessage.success('脚本执行成功')
      } else {
        // 执行失败
        messages.value.push({
          role: 'assistant',
          content: `❌ **脚本执行失败**\n\n**错误信息:**\n\`\`\`\n${result.error || '未知错误'}\n\`\`\``
        })
        scrollToBottom()
        ElMessage.error('脚本执行失败')
      }
    } else {
      const errorMsg = response.data.error || '执行失败'
      messages.value.push({
        role: 'assistant',
        content: `❌ **执行请求失败**\n\n${errorMsg}`
      })
      scrollToBottom()
      ElMessage.error(errorMsg)
    }
  } catch (err) {
    // User cancelled or error occurred
    if (err !== 'cancel' && (err as Error).message !== 'cancel') {
      const errorMsg = err instanceof Error ? err.message : '执行失败'
      ElMessage.error(errorMsg)
    }
  }
}

// Send message to AI (used for auto-analysis of script output)
const sendMessageToAI = async (message: string) => {
  if (!selectedConfigId.value || isLoading.value) return
  
  error.value = ''
  isLoading.value = true
  streamingContent.value = ''

  try {
    // Create session if not exists
    if (!currentSession.value) {
      const sessionResponse = await sessionApi.create({
        configId: selectedConfigId.value
      })
      if (sessionResponse.data.success && sessionResponse.data.data) {
        currentSession.value = sessionResponse.data.data
        sessionSidebar.value?.addSession(sessionResponse.data.data)
      }
    }

    // Send streaming request
    abortController = chatApi.sendStream(
      {
        configId: selectedConfigId.value,
        sessionId: currentSession.value?.id,
        message,
        includeContext: includeContext.value
      },
      {
        onChunk: (chunk) => {
          streamingContent.value += chunk
        },
        onComplete: (fullContent) => {
          messages.value.push({
            role: 'assistant',
            content: fullContent
          })
          streamingContent.value = ''
          isLoading.value = false
          abortController = null
          
          nextTick(() => {
            setupCodeBlockListeners()
          })
        },
        onError: (errorMsg) => {
          error.value = errorMsg
          isLoading.value = false
          streamingContent.value = ''
          abortController = null
        }
      }
    )
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : '发送消息失败'
    error.value = errorMsg
    isLoading.value = false
    streamingContent.value = ''
  }
}

// Handle session selection from sidebar
const handleSelectSession = async (session: ChatSession) => {
  try {
    // Load full session data
    const response = await sessionApi.getById(session.id)
    if (response.data.success && response.data.data) {
      currentSession.value = response.data.data
      messages.value = response.data.data.messages || []
      
      // Update selected config if session has a different provider
      const matchingConfig = configs.value.find(c => 
        c.provider === session.provider && c.model === session.model
      )
      if (matchingConfig) {
        selectedConfigId.value = matchingConfig.id
      }
      
      error.value = ''
      streamingContent.value = ''
    }
  } catch (err) {
    console.error('加载会话失败:', err)
    ElMessage.error('加载会话失败')
  }
}

// Handle new session from sidebar
const handleNewSessionFromSidebar = () => {
  currentSession.value = null
  messages.value = []
  error.value = ''
  streamingContent.value = ''
  inputMessage.value = ''
}

// Handle session deleted from sidebar
const handleSessionDeleted = (sessionId: string) => {
  if (currentSession.value?.id === sessionId) {
    currentSession.value = null
    messages.value = []
    error.value = ''
    streamingContent.value = ''
  }
}

// Handle all sessions cleared from sidebar
const handleAllSessionsCleared = () => {
  currentSession.value = null
  messages.value = []
  error.value = ''
  streamingContent.value = ''
}
</script>


<style scoped>
.ai-chat-view {
  height: 100%;
  display: flex;
  flex-direction: row;
}

.chat-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  margin-left: 0;
}

/* Header */
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #ebeef5;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e7ed 100%);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* Messages Container */
.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: #f5f7fa;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #909399;
}

.empty-state p {
  margin: 8px 0;
  font-size: 16px;
}

.empty-hint {
  font-size: 14px !important;
  color: #c0c4cc;
}

/* Message Item */
.message-item {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-item.user {
  flex-direction: row-reverse;
}

.message-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.message-item.user .message-avatar {
  background: linear-gradient(135deg, #409eff 0%, #66b1ff 100%);
  color: #fff;
}

.message-item.assistant .message-avatar {
  background: linear-gradient(135deg, #67c23a 0%, #85ce61 100%);
  color: #fff;
}

.message-content {
  max-width: 80%;
  min-width: 100px;
}

.message-role {
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}

.message-item.user .message-role {
  text-align: right;
}

.message-text {
  padding: 12px 16px;
  border-radius: 12px;
  line-height: 1.6;
  word-break: break-word;
}

.message-item.user .message-text {
  background: linear-gradient(135deg, #409eff 0%, #66b1ff 100%);
  color: #fff;
  border-bottom-right-radius: 4px;
}

.message-item.assistant .message-text {
  background: #fff;
  color: #303133;
  border-bottom-left-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

/* Typing Cursor */
.typing-cursor {
  display: inline-block;
  width: 8px;
  height: 16px;
  background: #409eff;
  margin-left: 2px;
  animation: blink 1s infinite;
  vertical-align: middle;
}

@keyframes blink {
  0%, 50% {
    opacity: 1;
  }
  51%, 100% {
    opacity: 0;
  }
}

/* Loading Indicator */
.loading-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px;
  color: #909399;
}

/* Error Alert */
.error-alert {
  margin: 0 20px 10px;
}

/* Input Area */
.input-area {
  padding: 16px 20px;
  border-top: 1px solid #ebeef5;
  background: #fff;
}

.input-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
}

.input-hint {
  font-size: 12px;
  color: #909399;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

/* Markdown Styles */
.markdown-body {
  font-size: 14px;
  line-height: 1.8;
}

.markdown-body :deep(p) {
  margin: 0 0 12px;
}

.markdown-body :deep(p:last-child) {
  margin-bottom: 0;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin: 8px 0;
  padding-left: 20px;
}

.markdown-body :deep(li) {
  margin: 4px 0;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4) {
  margin: 16px 0 8px;
  font-weight: 600;
}

.markdown-body :deep(h1) {
  font-size: 1.5em;
}

.markdown-body :deep(h2) {
  font-size: 1.3em;
}

.markdown-body :deep(h3) {
  font-size: 1.1em;
}

.markdown-body :deep(blockquote) {
  margin: 12px 0;
  padding: 8px 16px;
  border-left: 4px solid #409eff;
  background: #f5f7fa;
  color: #606266;
}

.markdown-body :deep(code:not(.hljs)) {
  padding: 2px 6px;
  background: #f5f7fa;
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  color: #e6a23c;
}

.markdown-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  padding: 8px 12px;
  border: 1px solid #ebeef5;
  text-align: left;
}

.markdown-body :deep(th) {
  background: #f5f7fa;
  font-weight: 600;
}

/* Code Block Styles */
.markdown-body :deep(.code-block) {
  margin: 12px 0;
  border-radius: 8px;
  overflow: hidden;
  background: #1e1e1e;
}

.markdown-body :deep(.code-block.routeros-block) {
  border: 2px solid #67c23a;
}

.markdown-body :deep(.code-header) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #2d2d2d;
  border-bottom: 1px solid #3d3d3d;
}

.markdown-body :deep(.code-language) {
  font-size: 12px;
  color: #909399;
  text-transform: uppercase;
}

.markdown-body :deep(.code-actions) {
  display: flex;
  gap: 8px;
}

.markdown-body :deep(.code-action-btn) {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  background: #3d3d3d;
  color: #c0c4cc;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.markdown-body :deep(.code-action-btn:hover) {
  background: #4d4d4d;
  color: #fff;
}

.markdown-body :deep(.code-action-btn.execute-btn) {
  background: #67c23a;
  color: #fff;
}

.markdown-body :deep(.code-action-btn.execute-btn:hover) {
  background: #85ce61;
}

.markdown-body :deep(.code-block pre) {
  margin: 0;
  padding: 16px;
  overflow-x: auto;
}

.markdown-body :deep(.code-block code) {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #d4d4d4;
}

/* Highlight.js Theme Overrides */
.markdown-body :deep(.hljs-keyword) {
  color: #569cd6;
}

.markdown-body :deep(.hljs-string) {
  color: #ce9178;
}

.markdown-body :deep(.hljs-number) {
  color: #b5cea8;
}

.markdown-body :deep(.hljs-comment) {
  color: #6a9955;
}

.markdown-body :deep(.hljs-function) {
  color: #dcdcaa;
}

.markdown-body :deep(.hljs-variable) {
  color: #9cdcfe;
}

.markdown-body :deep(.hljs-attr) {
  color: #9cdcfe;
}

.markdown-body :deep(.hljs-built_in) {
  color: #4ec9b0;
}
</style>

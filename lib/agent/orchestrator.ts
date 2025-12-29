/**
 * Orchestrator for the AI Agent system.
 * Core agent logic that coordinates intent detection, tool execution, and response generation.
 * Requirements: 1.1, 3.1, 3.2, 5.2, 5.3
 */

import OpenAI from 'openai';
import { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources';
import { Redis } from '@upstash/redis';
import {
  AgentContext,
  AgentResponse,
  ConversationMessage,
  Tool,
  ToolResult,
  ToolCall,
} from './types';
import { ToolRegistry, getToolRegistry } from './tool-registry';
import { ContextManager, getContextManager } from './context-manager';
import { ResponseGenerator, getResponseGenerator } from './response-generator';
import {
  AgentError,
  ToolExecutionError,
  RateLimitError,
  IntentError,
  ValidationError,
} from './errors';
import {
  ToolExecutionService,
  getToolExecutionService,
  ToolExecutionLog,
} from '../database/services/tool-execution.service';

/**
 * Configuration for retry logic.
 * Requirement 5.2: Exponential backoff for rate limit errors.
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts: number;
  /** Base delay in milliseconds (default: 1000) */
  baseDelayMs: number;
  /** Maximum delay in milliseconds (default: 10000) */
  maxDelayMs: number;
  /** Backoff multiplier (default: 2) */
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

/**
 * Configuration for tool result caching.
 * Requirement 5.3: Cache tool results with configurable TTL.
 */
export interface CacheConfig {
  /** Default TTL for cached results in seconds (default: 300) */
  defaultTtlSeconds: number;
  /** Whether caching is enabled (default: true) */
  enabled: boolean;
}

const DEFAULT_CACHE_CONFIG: CacheConfig = {
  defaultTtlSeconds: 300,
  enabled: true,
};

/**
 * Configuration for the Orchestrator.
 */
export interface OrchestratorConfig {
  retry: RetryConfig;
  cache: CacheConfig;
  /** Model to use for OpenAI calls (default: gpt-4o-mini) */
  model: string;
  /** Maximum tokens for response (default: 1000) */
  maxTokens: number;
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  retry: DEFAULT_RETRY_CONFIG,
  cache: DEFAULT_CACHE_CONFIG,
  model: 'gpt-5-mini',
  maxTokens: 1000,
};

/**
 * System prompt for the AI agent.
 */
const SYSTEM_PROMPT = `You are Gengar, an intelligent AI assistant for the MoeGo team on Slack. You help team members with various tasks.

以下是可用的命令：
1. *帮助命令*
   • 输入 \`help\` 或 \`帮助\` 显示此帮助信息

2. *AI 对话*
   • 直接输入任何问题，AI 助手会为您解答

3. *预约相关*
   • 输入 \`a<appointment id>\` 查看预约详情（如 \`a123456\`）
   • 输入 \`o<order id>\` 查看订单详情（如 \`o123456\`）
   • 输入 \`create <语义化文本>\` 创建新预约（如 \`create an appointment today at 10am\`）

4. *CI 相关*
   • 输入 \`ci <repository> <branch>\` 订阅 CI 状态（如 ci moego-svc-task feature-update）

5. *Jira 相关*
   • 输入 \`jira <projectKey> <issueType> [summary]\` 创建 Jira issue（如 \`jira MER Task 修复登录问题\`）
   * 注意：projectKey 可用 MER|ERP|CRM|FIN|GRM|ENT，issueType 可用 task|bug|story|epic，summary 选填。大小写皆可。

6. *文件分析*
   • 输入 \`file <链接地址>\` 分析文件格式（如 \`file https://example.com/document.pdf\`）
   * 功能：Detect file type and suggest possible file extensions
可用命令更新时间为 2025-12-29。反馈建议的 slack channel 是 <#C08EXLMF5SQ|bot-feedback-fuel>。

When users make requests:
1. Understand their intent from natural language
2. Use the appropriate tools to fulfill their request
3. Provide clear, helpful responses

If you're unsure about what the user wants, ask clarifying questions.
If a request cannot be fulfilled, explain why and suggest alternatives.

Keep responses concise and professional. Use Slack formatting when appropriate.

Important: Always respond in the same language as the user's question. 使用提问者的语言回答。
`;

/**
 * Orchestrator class coordinates the AI agent's processing pipeline.
 * Implements the main process() method that handles user messages.
 */
export class Orchestrator {
  private openai: OpenAI;
  private redis: Redis;
  private toolRegistry: ToolRegistry;
  private contextManager: ContextManager;
  private responseGenerator: ResponseGenerator;
  private toolExecutionService: ToolExecutionService;
  private config: OrchestratorConfig;

  constructor(
    openai?: OpenAI,
    redis?: Redis,
    toolRegistry?: ToolRegistry,
    contextManager?: ContextManager,
    responseGenerator?: ResponseGenerator,
    config?: Partial<OrchestratorConfig>,
    toolExecutionService?: ToolExecutionService
  ) {
    this.openai = openai ?? new OpenAI({
      baseURL: process.env.OPENAI_API_URL,
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.redis = redis ?? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL || '',
      token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
    });
    this.toolRegistry = toolRegistry ?? getToolRegistry();
    this.contextManager = contextManager ?? getContextManager();
    this.responseGenerator = responseGenerator ?? getResponseGenerator();
    this.toolExecutionService = toolExecutionService ?? getToolExecutionService();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Main entry point for processing user messages.
   * Requirement 1.1: Extract user intent from natural language.
   * Requirement 3.1: Identify and invoke appropriate tools.
   * Requirement 3.2: Create action plans for multi-tool requests.
   * 
   * @param userMessage - The user's message text
   * @param context - Agent context with user and channel information
   * @returns AgentResponse with the result
   */
  async process(userMessage: string, context: AgentContext): Promise<AgentResponse> {
    const toolsUsed: string[] = [];

    try {
      // Build messages array with conversation history
      const messages = await this.buildMessages(userMessage, context);

      // Get tool definitions for function calling
      const tools = this.getToolsForOpenAI();

      // Call OpenAI with function calling
      const response = await this.callOpenAIWithRetry(messages, tools);

      // Process the response and execute any tool calls
      const result = await this.processResponse(response, context, toolsUsed);

      // Save the conversation
      await this.saveConversation(userMessage, result.text, context);

      return result;
    } catch (error) {
      return this.handleError(error, toolsUsed);
    }
  }


  /**
   * Build the messages array for OpenAI, including conversation history.
   * Requirement 2.2: Incorporate previous messages as context.
   */
  private async buildMessages(
    userMessage: string,
    context: AgentContext
  ): Promise<ChatCompletionMessageParam[]> {
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT },
    ];

    // Add conversation history from context
    if (context.conversationHistory && context.conversationHistory.length > 0) {
      for (const msg of context.conversationHistory) {
        if (msg.role === 'system') {
          // Include system messages (like summaries) as context
          messages.push({ role: 'system', content: msg.content });
        } else if (msg.role === 'user') {
          messages.push({ role: 'user', content: msg.content });
        } else if (msg.role === 'assistant') {
          messages.push({ role: 'assistant', content: msg.content });
        }
      }
    }

    // Add the current user message
    messages.push({ role: 'user', content: userMessage });

    return messages;
  }

  /**
   * Get tool definitions in OpenAI format.
   */
  private getToolsForOpenAI(): ChatCompletionTool[] {
    const toolDefinitions = this.toolRegistry.getToolDefinitions();
    return toolDefinitions.map((def) => ({
      type: 'function' as const,
      function: {
        name: def.function.name,
        description: def.function.description,
        parameters: def.function.parameters as unknown as Record<string, unknown>,
      },
    }));
  }

  /**
   * Call OpenAI with retry logic and exponential backoff.
   * Requirement 5.2: Retry with exponential backoff on rate limit errors.
   */
  private async callOpenAIWithRetry(
    messages: ChatCompletionMessageParam[],
    tools: ChatCompletionTool[]
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    return this.withRetry(
      async () => {
        const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
          model: this.config.model,
          messages,
          max_tokens: this.config.maxTokens,
        };

        // Only include tools if there are any registered
        if (tools.length > 0) {
          params.tools = tools;
          params.tool_choice = 'auto';
        }

        return await this.openai.chat.completions.create(params);
      },
      this.isRetryableError.bind(this)
    );
  }

  /**
   * Process the OpenAI response and execute any tool calls.
   * Requirement 3.1: Invoke appropriate tools.
   * Requirement 3.2: Execute tools in sequence for multi-step operations.
   */
  private async processResponse(
    response: OpenAI.Chat.Completions.ChatCompletion,
    context: AgentContext,
    toolsUsed: string[]
  ): Promise<AgentResponse> {
    const choice = response.choices[0];
    
    if (!choice) {
      throw new IntentError('No response from AI model');
    }

    const message = choice.message;

    // Check if there are tool calls to execute
    if (message.tool_calls && message.tool_calls.length > 0) {
      return await this.executeToolCalls(message.tool_calls, context, toolsUsed);
    }

    // No tool calls, return the text response
    const text = message.content || 'I processed your request but have no response.';
    
    return {
      text: this.responseGenerator.formatTextResponse(text),
      toolsUsed,
      success: true,
    };
  }

  /**
   * Execute tool calls from the AI response.
   * Requirement 3.1: Invoke appropriate tools.
   * Requirement 3.2: Handle multi-step tool chains.
   * Requirement 3.4: Provide progress updates for multi-step operations.
   */
  private async executeToolCalls(
    toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[],
    context: AgentContext,
    toolsUsed: string[]
  ): Promise<AgentResponse> {
    const results: Array<{ toolName: string; result: ToolResult }> = [];

    for (const toolCall of toolCalls) {
      const toolName = toolCall.function.name;
      toolsUsed.push(toolName);

      try {
        // Parse the arguments
        const params = JSON.parse(toolCall.function.arguments || '{}');

        // Execute the tool (with caching if applicable)
        const result = await this.executeToolWithCache(toolName, params, context);
        results.push({ toolName, result });

        // If a tool fails, we might want to stop the chain
        if (!result.success) {
          break;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          toolName,
          result: {
            success: false,
            error: errorMessage,
            displayText: `Failed to execute ${toolName}: ${errorMessage}`,
          },
        });
        break;
      }
    }

    // Combine results into a single response
    return this.combineToolResults(results, toolsUsed);
  }

  /**
   * Execute a tool with caching support.
   * Requirement 5.3: Cache tool results with configurable TTL.
   * Requirement 6.4: Log tool executions with timing.
   */
  private async executeToolWithCache(
    toolName: string,
    params: Record<string, unknown>,
    context: AgentContext
  ): Promise<ToolResult> {
    const tool = this.toolRegistry.get(toolName);
    
    if (!tool) {
      return {
        success: false,
        error: `Tool "${toolName}" not found`,
        displayText: `I don't have access to a tool called "${toolName}".`,
      };
    }

    // Check if caching is enabled and the tool is cacheable
    if (this.config.cache.enabled && tool.cacheable !== false) {
      const cacheKey = this.generateCacheKey(toolName, params);
      const cached = await this.getCachedResult(cacheKey);
      
      if (cached) {
        // Log cache hit (no execution time since it was cached)
        await this.logToolExecution(toolName, params, cached, context, 0, true);
        return cached;
      }

      // Execute the tool with timing
      const startTime = Date.now();
      const result = await this.executeTool(tool, params, context);
      const executionTimeMs = Date.now() - startTime;

      // Log the execution
      await this.logToolExecution(toolName, params, result, context, executionTimeMs, false);

      // Cache the result if successful
      if (result.success) {
        const ttl = tool.cacheTtlSeconds ?? this.config.cache.defaultTtlSeconds;
        await this.cacheResult(cacheKey, result, ttl);
      }

      return result;
    }

    // No caching, execute directly with timing
    const startTime = Date.now();
    const result = await this.executeTool(tool, params, context);
    const executionTimeMs = Date.now() - startTime;

    // Log the execution
    await this.logToolExecution(toolName, params, result, context, executionTimeMs, false);

    return result;
  }

  /**
   * Execute a single tool.
   * Requirement 3.3: Report errors and suggest alternatives.
   */
  private async executeTool(
    tool: Tool,
    params: Record<string, unknown>,
    context: AgentContext
  ): Promise<ToolResult> {
    try {
      // Validate parameters against schema
      this.validateToolParams(tool, params);

      // Execute the tool
      return await tool.execute(params, context);
    } catch (error) {
      if (error instanceof ValidationError) {
        return {
          success: false,
          error: error.message,
          displayText: `Invalid parameters for ${tool.name}: ${error.message}`,
        };
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new ToolExecutionError(tool.name, errorMessage, {
        originalError: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Validate tool parameters against the schema.
   * Requirement 6.3: Validate parameters before execution.
   */
  private validateToolParams(tool: Tool, params: Record<string, unknown>): void {
    const schema = tool.parameters;

    // Check required fields
    for (const required of schema.required) {
      if (!(required in params) || params[required] === undefined || params[required] === null) {
        throw new ValidationError(`Missing required parameter: ${required}`, {
          field: required,
          suggestion: `Please provide a value for "${required}".`,
        });
      }
    }

    // Check types for provided parameters
    for (const [key, value] of Object.entries(params)) {
      const propDef = schema.properties[key];
      if (!propDef) continue; // Unknown parameter, skip

      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (propDef.type !== actualType && value !== null && value !== undefined) {
        throw new ValidationError(
          `Invalid type for parameter "${key}": expected ${propDef.type}, got ${actualType}`,
          {
            field: key,
            expectedType: propDef.type,
            receivedValue: value,
          }
        );
      }

      // Check enum values
      if (propDef.enum && !propDef.enum.includes(value as string)) {
        throw new ValidationError(
          `Invalid value for parameter "${key}": must be one of ${propDef.enum.join(', ')}`,
          {
            field: key,
            receivedValue: value,
          }
        );
      }
    }
  }


  /**
   * Combine multiple tool results into a single response.
   */
  private combineToolResults(
    results: Array<{ toolName: string; result: ToolResult }>,
    toolsUsed: string[]
  ): AgentResponse {
    if (results.length === 0) {
      return {
        text: 'No tools were executed.',
        toolsUsed,
        success: false,
      };
    }

    if (results.length === 1) {
      const { toolName, result } = results[0];
      return {
        text: this.responseGenerator.formatTextResponse(
          result.displayText || (result.success ? 'Operation completed.' : result.error || 'Operation failed.')
        ),
        blocks: result.data ? this.responseGenerator.formatStructuredResponse(result.data, 'generic') : undefined,
        toolsUsed,
        success: result.success,
      };
    }

    // Multiple results - combine them
    const textParts: string[] = [];
    let allSuccess = true;

    for (const { toolName, result } of results) {
      if (!result.success) {
        allSuccess = false;
        textParts.push(`❌ ${toolName}: ${result.error || 'Failed'}`);
      } else {
        textParts.push(`✅ ${toolName}: ${result.displayText || 'Completed'}`);
      }
    }

    return {
      text: this.responseGenerator.formatTextResponse(textParts.join('\n')),
      toolsUsed,
      success: allSuccess,
    };
  }

  /**
   * Save the conversation to context manager.
   */
  private async saveConversation(
    userMessage: string,
    assistantResponse: string,
    context: AgentContext
  ): Promise<void> {
    try {
      // Save user message
      const userMsg: ConversationMessage = {
        role: 'user',
        content: userMessage,
        timestamp: new Date(),
      };
      await this.contextManager.saveMessage(context.channel, context.threadTs, userMsg);

      // Save assistant response
      const assistantMsg: ConversationMessage = {
        role: 'assistant',
        content: assistantResponse,
        timestamp: new Date(),
      };
      await this.contextManager.saveMessage(context.channel, context.threadTs, assistantMsg);
    } catch (error) {
      // Log but don't fail the request if context saving fails
      console.error('Failed to save conversation context:', error);
    }
  }

  /**
   * Handle errors and return appropriate response.
   * Requirement 3.3: Report errors and suggest alternatives.
   */
  private handleError(error: unknown, toolsUsed: string[]): AgentResponse {
    console.error('Orchestrator error:', error);

    if (error instanceof AgentError) {
      return {
        text: this.responseGenerator.formatTextResponse(
          `⚠️ ${error.message}\n\n💡 ${error.suggestion || 'Please try again.'}`
        ),
        toolsUsed,
        success: false,
      };
    }

    // Generic error handling
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return {
      text: this.responseGenerator.formatTextResponse(
        `⚠️ Something went wrong: ${errorMessage}\n\n💡 Please try again or rephrase your request.`
      ),
      toolsUsed,
      success: false,
    };
  }

  // ============================================
  // Retry Logic (Requirement 5.2)
  // ============================================

  /**
   * Execute an operation with retry logic and exponential backoff.
   * Requirement 5.2: Retry with 2^n second delays, max 3 retries.
   * 
   * @param operation - The async operation to execute
   * @param isRetryable - Function to determine if an error is retryable
   * @returns The result of the operation
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    isRetryable: (error: Error) => boolean
  ): Promise<T> {
    let lastError: Error | undefined;
    const { maxAttempts, baseDelayMs, maxDelayMs, backoffMultiplier } = this.config.retry;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if we should retry
        if (!isRetryable(lastError) || attempt === maxAttempts - 1) {
          throw lastError;
        }

        // Calculate delay with exponential backoff: 2^attempt * baseDelay
        const delay = Math.min(
          baseDelayMs * Math.pow(backoffMultiplier, attempt),
          maxDelayMs
        );

        console.log(`Retry attempt ${attempt + 1}/${maxAttempts} after ${delay}ms`);
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  /**
   * Check if an error is retryable (rate limit errors).
   */
  private isRetryableError(error: Error): boolean {
    // Check for OpenAI rate limit errors
    if (error.message.includes('rate limit') || error.message.includes('429')) {
      return true;
    }

    // Check for RateLimitError from our system
    if (error instanceof RateLimitError && error.limitType === 'api') {
      return true;
    }

    // Check for temporary network errors
    if (error.message.includes('ECONNRESET') || error.message.includes('ETIMEDOUT')) {
      return true;
    }

    return false;
  }

  /**
   * Sleep for a specified duration.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ============================================
  // Caching Logic (Requirement 5.3)
  // ============================================

  /**
   * Generate a cache key for tool results.
   */
  private generateCacheKey(toolName: string, params: Record<string, unknown>): string {
    const paramsStr = JSON.stringify(params, Object.keys(params).sort());
    return `agent:toolcache:${toolName}:${Buffer.from(paramsStr).toString('base64')}`;
  }

  /**
   * Get a cached tool result.
   * Requirement 5.3: Cache tool results.
   */
  private async getCachedResult(cacheKey: string): Promise<ToolResult | null> {
    try {
      const cached = await this.redis.get<ToolResult>(cacheKey);
      return cached;
    } catch (error) {
      console.error('Cache read error:', error);
      return null;
    }
  }

  /**
   * Cache a tool result.
   * Requirement 5.3: Cache with configurable TTL.
   */
  private async cacheResult(cacheKey: string, result: ToolResult, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(cacheKey, result, { ex: ttlSeconds });
    } catch (error) {
      console.error('Cache write error:', error);
      // Don't fail the request if caching fails
    }
  }

  /**
   * Clear cached result for a specific tool and params.
   * Useful for invalidating cache after mutations.
   */
  async clearCache(toolName: string, params: Record<string, unknown>): Promise<void> {
    const cacheKey = this.generateCacheKey(toolName, params);
    await this.redis.del(cacheKey);
  }

  // ============================================
  // Tool Execution Logging (Requirement 6.4)
  // ============================================

  /**
   * Log a tool execution to the database.
   * Requirement 6.4: Log tool invocations with context.
   * 
   * @param toolName - Name of the tool executed
   * @param params - Parameters passed to the tool
   * @param result - Result from the tool execution
   * @param context - Agent context with user and channel info
   * @param executionTimeMs - Time taken to execute in milliseconds
   * @param fromCache - Whether the result was from cache
   */
  private async logToolExecution(
    toolName: string,
    params: Record<string, unknown>,
    result: ToolResult,
    context: AgentContext,
    executionTimeMs: number,
    fromCache: boolean
  ): Promise<void> {
    try {
      const log: ToolExecutionLog = {
        request_id: context.requestId,
        channel: context.channel,
        thread_ts: context.threadTs,
        user_id: context.userId,
        tool_name: toolName,
        parameters: params,
        result: {
          success: result.success,
          data: result.data,
          error: result.error,
          displayText: result.displayText,
          fromCache,
        },
        success: result.success,
        execution_time_ms: executionTimeMs,
      };

      await this.toolExecutionService.logExecution(log);
    } catch (error) {
      // Log but don't fail the request if logging fails
      console.error('Failed to log tool execution:', error);
    }
  }
}

/**
 * Singleton instance for the default orchestrator.
 */
let defaultOrchestrator: Orchestrator | null = null;

/**
 * Get the default orchestrator instance.
 * Creates one if it doesn't exist.
 */
export function getOrchestrator(): Orchestrator {
  if (!defaultOrchestrator) {
    defaultOrchestrator = new Orchestrator();
  }
  return defaultOrchestrator;
}

/**
 * Create a new orchestrator with custom configuration.
 * Useful for testing or specialized use cases.
 */
export function createOrchestrator(
  openai?: OpenAI,
  redis?: Redis,
  toolRegistry?: ToolRegistry,
  contextManager?: ContextManager,
  responseGenerator?: ResponseGenerator,
  config?: Partial<OrchestratorConfig>,
  toolExecutionService?: ToolExecutionService
): Orchestrator {
  return new Orchestrator(openai, redis, toolRegistry, contextManager, responseGenerator, config, toolExecutionService);
}

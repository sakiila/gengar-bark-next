/**
 * Agent Command for the AI Agent system.
 * Implements the Command interface to integrate the AI agent with the existing chat handler.
 * Requirements: 1.1, 2.2, 3.1, 6.2
 */

import { randomBytes } from 'crypto';
import { Command } from '../commands/command';
import { AgentContext, ConversationMessage } from './types';
import { ToolRegistry, getToolRegistry } from './tool-registry';
import { ContextManager, getContextManager } from './context-manager';
import { RateLimiter, getRateLimiter } from './rate-limiter';
import { Orchestrator, getOrchestrator } from './orchestrator';
import { ResponseGenerator, getResponseGenerator } from './response-generator';
import { postMessage, postBlockMessage, getThreadReplies } from '../slack/gengar-bolt';
import { createAllTools } from './tools';
import { RateLimitError } from './errors';
import { cleanText } from '../ai/openai';
import { initializeMCPForUser, cleanupMCPConnections, MCPIntegrationResult } from '../mcp/mcp-integration';
import { logger } from '../utils/logger';

/**
 * Generate a unique request ID using crypto.
 */
function generateRequestId(): string {
  return randomBytes(16).toString('hex');
}

/**
 * AgentCommand integrates the AI agent with the existing Slack bot command system.
 * It serves as the default handler when no other command matches.
 * 
 * Requirements:
 * - 1.1: Extract user intent from natural language
 * - 2.2: Incorporate previous messages as context
 * - 3.1: Identify and invoke appropriate tools
 */
export class AgentCommand implements Command {
  private channel: string;
  private ts: string;
  private userId: string;
  private userName?: string;
  private toolRegistry: ToolRegistry;
  private contextManager: ContextManager;
  private rateLimiter: RateLimiter;
  private orchestrator: Orchestrator;
  private responseGenerator: ResponseGenerator;

  constructor(
    channel: string,
    ts: string,
    userId: string,
    userName?: string,
    toolRegistry?: ToolRegistry,
    contextManager?: ContextManager,
    rateLimiter?: RateLimiter,
    orchestrator?: Orchestrator,
    responseGenerator?: ResponseGenerator
  ) {
    this.channel = channel;
    this.ts = ts;
    this.userId = userId;
    this.userName = userName;
    this.toolRegistry = toolRegistry ?? getToolRegistry();
    this.contextManager = contextManager ?? getContextManager();
    this.rateLimiter = rateLimiter ?? getRateLimiter();
    this.orchestrator = orchestrator ?? getOrchestrator();
    this.responseGenerator = responseGenerator ?? getResponseGenerator();
  }

  /**
   * Always returns true as this is the default handler.
   * The agent will process any message that doesn't match other commands.
   */
  matches(_text: string): boolean {
    return true;
  }

  /**
   * Process the user message through the full agent pipeline.
   * 
   * Pipeline:
   * 1. Check rate limits (duplicate detection, user throttling)
   * 2. Initialize MCP connections for user
   * 3. Retrieve conversation context
   * 4. Process through orchestrator (intent detection, tool execution)
   * 5. Send response to Slack
   * 6. Cleanup MCP connections
   * 
   * @param text - The user's message text
   * @param _userId - User ID (unused, we use the constructor value)
   * 
   * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.7, 6.8
   */
  async execute(text: string, _userId?: string): Promise<void> {
    let mcpIntegration: MCPIntegrationResult | null = null;

    console.log(`[AgentCommand] Starting execute for user: ${this.userId}, text: ${text.substring(0, 50)}...`);

    try {
      // Step 1: Check rate limits
      console.log(`[AgentCommand] Step 1: Checking rate limits...`);
      await this.checkRateLimits(text);

      // Step 2: Initialize MCP connections for the user
      // Requirements: 6.1, 6.2, 6.4, 6.5
      console.log(`[AgentCommand] Step 2: Initializing MCP for user ${this.userId}...`);
      try {
        mcpIntegration = await initializeMCPForUser(this.userId);
        console.log(`[AgentCommand] MCP initialization result: ${mcpIntegration.connectedCount} connected, ${mcpIntegration.failedCount} failed`);
        
        if (mcpIntegration.connectedCount > 0) {
          logger.info(`MCP integration: ${mcpIntegration.connectedCount} servers connected for user ${this.userId}`);
        }
      } catch (mcpError) {
        // Log error but continue without MCP - don't fail the entire request
        console.error(`[AgentCommand] MCP initialization error:`, mcpError);
        logger.error('Failed to initialize MCP for user:', mcpError instanceof Error ? mcpError : { error: String(mcpError) });
      }

      // Step 3: Build agent context with conversation history and MCP context
      console.log(`[AgentCommand] Step 3: Building context...`);
      const context = await this.buildContext(text, mcpIntegration);

      // Step 4: Process through orchestrator
      const response = await this.orchestrator.process(text, context);

      // Step 5: Send response to Slack
      await this.sendResponse(response.text, response.blocks);

    } catch (error) {
      await this.handleError(error);
    } finally {
      // Step 6: Always cleanup MCP connections
      // Requirement 6.8: Ensure cleanup happens even if errors occur
      if (mcpIntegration && mcpIntegration.manager) {
        await cleanupMCPConnections(mcpIntegration.manager);
      }
    }
  }

  /**
   * Check rate limits before processing.
   * Throws RateLimitError if limits are exceeded.
   */
  private async checkRateLimits(text: string): Promise<void> {
    // Check for duplicate message
    const isDuplicate = await this.rateLimiter.checkDuplicate(
      this.userId,
      this.channel,
      this.ts,
      text
    );

    if (isDuplicate) {
      throw new RateLimitError(
        'duplicate',
        'This message was already processed recently.',
        { retryAfterMs: 120000 }
      );
    }

    // Check user rate limit
    const canProceed = await this.rateLimiter.checkUserLimit(this.userId);
    if (!canProceed) {
      throw new RateLimitError(
        'user',
        'You are sending too many requests. Please wait a moment.',
        { retryAfterMs: 60000 }
      );
    }

    // Record the request
    await this.rateLimiter.recordRequest(this.userId);
  }

  /**
   * Build the agent context with conversation history and MCP context.
   * Requirement 2.2: Incorporate previous messages as context.
   * Requirement 6.7: Include MCP tools and resources in context.
   * Fetches thread replies from Slack and applies text cleaning similar to GptCommand.
   * 
   * @param _text - The user's message text
   * @param mcpIntegration - Optional MCP integration result with context
   */
  private async buildContext(
    _text: string,
    mcpIntegration?: MCPIntegrationResult | null
  ): Promise<AgentContext> {
    // Fetch thread replies from Slack (similar to GptCommand)
    const threadReplies = await getThreadReplies(this.channel, this.ts);
    
    // Bot ID for identifying bot messages and removing @mentions
    const botID = 'U0666R94C83';
    
    // Convert Slack thread messages to ConversationMessage format
    // Apply the same text cleaning logic as GptCommand for consistency
    let threadMessages: ConversationMessage[] = [];
    if (Array.isArray(threadReplies) && threadReplies.length > 0) {
      threadMessages = threadReplies
        .filter((msg: any) => msg && msg.text && msg.subtype !== 'assistant_app_thread')
        .map((msg: any) => {
          const isBot = !!msg.bot_id && !msg.client_msg_id;
          
          // Clean text and remove @mentions (same as GptCommand)
          let content = cleanText(msg.text || '');
          if (!isBot) {
            // Remove bot @mention from user messages
            content = content.replace(`<@${botID}> `, '').replace(`<@${botID}>`, '');
          }
          
          return {
            role: isBot ? 'assistant' : 'user',
            content,
            timestamp: new Date(parseFloat(msg.ts) * 1000),
          };
        });
    }

    // Retrieve cached conversation history from context manager
    const cachedHistory = await this.contextManager.getContext(
      this.channel,
      this.ts
    );

    // Merge thread messages with cached history, preferring fresh thread data
    // If we have thread messages, use them; otherwise fall back to cached history
    const conversationHistory = threadMessages.length > 0 ? threadMessages : cachedHistory;

    // Summarize if needed (>20 messages)
    const processedHistory = await this.contextManager.summarizeIfNeeded(
      conversationHistory
    );

    // Build the context object
    const context: AgentContext = {
      channel: this.channel,
      threadTs: this.ts,
      userId: this.userId,
      userName: this.userName,
      conversationHistory: processedHistory,
      requestId: generateRequestId(),
      timestamp: new Date(),
    };

    // Add MCP context if available
    // Requirement 6.7: Pass MCP context to AI model
    if (mcpIntegration && Object.keys(mcpIntegration.context).length > 0) {
      (context as any).mcpContext = mcpIntegration.context;
      // Also pass the manager for tool execution
      (context as any).mcpManager = mcpIntegration.manager;
      logger.info(`Added MCP context with ${Object.keys(mcpIntegration.context).length} servers to agent context`);
    }

    return context;
  }

  /**
   * Send the response to Slack.
   * Uses blocks for rich formatting when available.
   */
  private async sendResponse(text: string, blocks?: unknown[]): Promise<void> {
    if (blocks && blocks.length > 0) {
      await postBlockMessage(this.channel, this.ts, blocks);
    } else {
      await postMessage(this.channel, this.ts, text);
    }
  }

  /**
   * Handle errors and send appropriate response to user.
   */
  private async handleError(error: unknown): Promise<void> {
    console.error('AgentCommand error:', error);

    let errorMessage: string;

    if (error instanceof RateLimitError) {
      if (error.limitType === 'duplicate') {
        // Silently ignore duplicates - don't send a message
        return;
      }
      errorMessage = `⏳ ${error.message}`;
    } else if (error instanceof Error) {
      errorMessage = `⚠️ Something went wrong: ${error.message}\n\n💡 Please try again or rephrase your request.`;
    } else {
      errorMessage = '⚠️ An unexpected error occurred. Please try again.';
    }

    try {
      await postMessage(this.channel, this.ts, errorMessage);
    } catch (sendError) {
      console.error('Failed to send error message:', sendError);
    }
  }
}

/**
 * Initialize the tool registry with all available tools.
 * Requirement 6.2: Register tools for automatic inclusion in intent matching.
 */
export function initializeAgentTools(registry?: ToolRegistry): ToolRegistry {
  const toolRegistry = registry ?? getToolRegistry();

  // Only register tools if the registry is empty
  if (toolRegistry.size === 0) {
    const tools = createAllTools();
    for (const tool of tools) {
      toolRegistry.register(tool);
    }
  }

  return toolRegistry;
}

/**
 * Create an AgentCommand instance with initialized tools.
 * This is the main factory function for creating agent commands.
 * 
 * @param channel - Slack channel ID
 * @param ts - Thread timestamp
 * @param userId - Slack user ID
 * @param userName - Optional user display name
 * @returns Configured AgentCommand instance
 */
export function createAgentCommand(
  channel: string,
  ts: string,
  userId: string,
  userName?: string
): AgentCommand {
  // Ensure tools are registered
  initializeAgentTools();

  return new AgentCommand(channel, ts, userId, userName);
}

/**
 * Singleton flag to track if tools have been initialized.
 */
let toolsInitialized = false;

/**
 * Ensure tools are initialized exactly once.
 * Call this at application startup.
 */
export function ensureToolsInitialized(): void {
  if (!toolsInitialized) {
    initializeAgentTools();
    toolsInitialized = true;
  }
}

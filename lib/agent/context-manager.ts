/**
 * Context Manager for the AI Agent system.
 * Handles conversation context retrieval, storage, and summarization.
 * Requirements: 2.1, 2.2, 2.3
 */

import { Redis } from '@upstash/redis';
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources';
import { ConversationMessage, CachedConversation } from './types';

/**
 * Configuration for the context manager.
 */
export interface ContextManagerConfig {
  /** TTL for conversation cache in seconds (default: 24 hours) */
  cacheTtlSeconds: number;
  /** Maximum messages before summarization (default: 20) */
  maxMessagesBeforeSummary: number;
  /** Number of recent messages to keep after summarization (default: 10) */
  recentMessagesToKeep: number;
}

const DEFAULT_CONFIG: ContextManagerConfig = {
  cacheTtlSeconds: 24 * 60 * 60, // 24 hours
  maxMessagesBeforeSummary: 20,
  recentMessagesToKeep: 10,
};

/**
 * ContextManager class for managing conversation context.
 * Uses Redis for persistent storage and OpenAI for summarization.
 */
export class ContextManager {
  private redis: Redis;
  private openai: OpenAI;
  private config: ContextManagerConfig;

  constructor(
    redis?: Redis,
    openai?: OpenAI,
    config?: Partial<ContextManagerConfig>
  ) {
    this.redis = redis ?? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL || '',
      token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
    });
    this.openai = openai ?? new OpenAI({
      baseURL: process.env.OPENAI_API_URL,
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate the Redis key for a conversation context.
   * Format: agent:context:{channel}:{threadTs}
   */
  private getContextKey(channel: string, threadTs: string): string {
    return `agent:context:${channel}:${threadTs}`;
  }

  /**
   * Retrieve conversation context from Redis.
   * Returns an empty array if no context exists.
   * 
   * Requirement 2.1: Retrieve Thread_Memory for existing conversations.
   * 
   * @param channel - Slack channel ID
   * @param threadTs - Thread timestamp
   * @returns Array of conversation messages
   */
  async getContext(channel: string, threadTs: string): Promise<ConversationMessage[]> {
    const key = this.getContextKey(channel, threadTs);
    const cached = await this.redis.get<CachedConversation>(key);

    if (!cached) {
      return [];
    }

    // Reconstruct Date objects from stored timestamps
    const messages = cached.messages.map((msg) => ({
      ...msg,
      timestamp: new Date(msg.timestamp),
    }));

    // If there's a summary, prepend it as a system message
    if (cached.summary) {
      const summaryMessage: ConversationMessage = {
        role: 'system',
        content: `Previous conversation summary: ${cached.summary}`,
        timestamp: new Date(cached.lastUpdated),
      };
      return [summaryMessage, ...messages];
    }

    return messages;
  }

  /**
   * Save a message to the conversation context.
   * Appends the message to existing conversation and updates TTL.
   * 
   * Requirement 2.1: Store messages in Thread_Memory.
   * 
   * @param channel - Slack channel ID
   * @param threadTs - Thread timestamp
   * @param message - Message to save
   */
  async saveMessage(
    channel: string,
    threadTs: string,
    message: ConversationMessage
  ): Promise<void> {
    const key = this.getContextKey(channel, threadTs);
    const cached = await this.redis.get<CachedConversation>(key);

    const now = Date.now();
    let conversation: CachedConversation;

    if (cached) {
      // Append to existing conversation
      conversation = {
        messages: [...cached.messages, message],
        lastUpdated: now,
        summary: cached.summary,
      };
    } else {
      // Create new conversation
      conversation = {
        messages: [message],
        lastUpdated: now,
      };
    }

    // Check if summarization is needed
    if (conversation.messages.length > this.config.maxMessagesBeforeSummary) {
      conversation = await this.summarizeConversation(conversation);
    }

    // Save with TTL
    await this.redis.set(key, conversation, {
      ex: this.config.cacheTtlSeconds,
    });
  }

  /**
   * Summarize older messages when conversation exceeds the limit.
   * Keeps recent messages and creates a summary of older ones.
   * 
   * Requirement 2.3: Summarize conversations with >20 messages.
   * 
   * @param conversation - Current conversation state
   * @returns Updated conversation with summary
   */
  private async summarizeConversation(
    conversation: CachedConversation
  ): Promise<CachedConversation> {
    const { messages, summary: existingSummary } = conversation;
    
    // Split messages: older ones to summarize, recent ones to keep
    const messagesToSummarize = messages.slice(0, -this.config.recentMessagesToKeep);
    const recentMessages = messages.slice(-this.config.recentMessagesToKeep);

    // Build content to summarize (include existing summary if present)
    let contentToSummarize = '';
    if (existingSummary) {
      contentToSummarize += `Previous summary: ${existingSummary}\n\n`;
    }
    contentToSummarize += 'Recent messages:\n';
    contentToSummarize += messagesToSummarize
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join('\n');

    // Generate summary using OpenAI
    const newSummary = await this.generateSummary(contentToSummarize);

    return {
      messages: recentMessages,
      lastUpdated: Date.now(),
      summary: newSummary,
    };
  }

  /**
   * Generate a summary of conversation content using OpenAI.
   * 
   * @param content - Content to summarize
   * @returns Summary string
   */
  private async generateSummary(content: string): Promise<string> {
    const systemPrompt = `You are a conversation summarizer. Your task is to create a concise summary of the conversation that captures:
1. Key topics discussed
2. Important decisions or conclusions
3. Any action items or requests
4. Relevant context for future messages

Keep the summary under 500 characters while preserving essential information.`;

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Please summarize this conversation:\n\n${content}` },
    ];

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.3,
      });

      return response.choices[0]?.message?.content || 'Unable to generate summary.';
    } catch (error) {
      console.error('Error generating summary:', error);
      // Return a fallback summary on error
      return 'Previous conversation context available but summary generation failed.';
    }
  }

  /**
   * Summarize messages if the count exceeds the threshold.
   * Public method for external use.
   * 
   * Requirement 2.3: Summarize conversations with >20 messages.
   * 
   * @param messages - Array of conversation messages
   * @returns Summarized messages array (length <= maxMessagesBeforeSummary)
   */
  async summarizeIfNeeded(
    messages: ConversationMessage[]
  ): Promise<ConversationMessage[]> {
    if (messages.length <= this.config.maxMessagesBeforeSummary) {
      return messages;
    }

    // Create a temporary conversation object for summarization
    const tempConversation: CachedConversation = {
      messages,
      lastUpdated: Date.now(),
    };

    const summarized = await this.summarizeConversation(tempConversation);

    // Return messages with summary prepended as system message
    const summaryMessage: ConversationMessage = {
      role: 'system',
      content: `Previous conversation summary: ${summarized.summary}`,
      timestamp: new Date(),
    };

    return [summaryMessage, ...summarized.messages];
  }

  /**
   * Resolve a reference from conversation context.
   * Attempts to find referenced information (e.g., "that appointment ID").
   * 
   * Requirement 2.4: Resolve references from Conversation_Context.
   * 
   * @param reference - The reference to resolve (e.g., "that appointment")
   * @param context - Conversation messages to search
   * @returns Resolved value or null if not found
   */
  async resolveReference(
    reference: string,
    context: ConversationMessage[]
  ): Promise<string | null> {
    if (context.length === 0) {
      return null;
    }

    // Build context string from messages
    const contextString = context
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join('\n');

    const systemPrompt = `You are a reference resolver. Given a conversation context and a reference phrase, identify what the reference is pointing to.

If you can identify the referenced item, return ONLY the specific value (e.g., an ID, name, or value).
If you cannot identify the reference, return "NOT_FOUND".

Do not include any explanation, just the value or "NOT_FOUND".`;

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Conversation context:\n${contextString}\n\nReference to resolve: "${reference}"`,
      },
    ];

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0,
      });

      const result = response.choices[0]?.message?.content?.trim();
      
      if (!result || result === 'NOT_FOUND') {
        return null;
      }

      return result;
    } catch (error) {
      console.error('Error resolving reference:', error);
      return null;
    }
  }

  /**
   * Clear conversation context for a thread.
   * Useful for testing or manual cleanup.
   * 
   * @param channel - Slack channel ID
   * @param threadTs - Thread timestamp
   */
  async clearContext(channel: string, threadTs: string): Promise<void> {
    const key = this.getContextKey(channel, threadTs);
    await this.redis.del(key);
  }

  /**
   * Get the raw cached conversation data.
   * Useful for debugging and testing.
   * 
   * @param channel - Slack channel ID
   * @param threadTs - Thread timestamp
   * @returns Raw cached conversation or null
   */
  async getRawContext(
    channel: string,
    threadTs: string
  ): Promise<CachedConversation | null> {
    const key = this.getContextKey(channel, threadTs);
    return await this.redis.get<CachedConversation>(key);
  }

  /**
   * Get the current message count for a conversation.
   * 
   * @param channel - Slack channel ID
   * @param threadTs - Thread timestamp
   * @returns Number of messages in the conversation
   */
  async getMessageCount(channel: string, threadTs: string): Promise<number> {
    const cached = await this.getRawContext(channel, threadTs);
    return cached?.messages.length ?? 0;
  }
}

/**
 * Singleton instance for the default context manager.
 */
let defaultContextManager: ContextManager | null = null;

/**
 * Get the default context manager instance.
 * Creates one if it doesn't exist.
 */
export function getContextManager(): ContextManager {
  if (!defaultContextManager) {
    defaultContextManager = new ContextManager();
  }
  return defaultContextManager;
}

/**
 * Create a new context manager with custom configuration.
 * Useful for testing or specialized use cases.
 */
export function createContextManager(
  redis?: Redis,
  openai?: OpenAI,
  config?: Partial<ContextManagerConfig>
): ContextManager {
  return new ContextManager(redis, openai, config);
}

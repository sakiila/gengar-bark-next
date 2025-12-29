/**
 * Core types and interfaces for the AI Agent system.
 * Requirements: 6.1, 6.4
 */

/**
 * Represents a message in a conversation thread.
 */
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

/**
 * Encapsulates all context needed for processing a user request.
 * Passed to tools during execution (Requirement 6.4).
 */
export interface AgentContext {
  /** Slack channel ID */
  channel: string;
  /** Thread timestamp for conversation tracking */
  threadTs: string;
  /** Slack user ID */
  userId: string;
  /** Optional user display name */
  userName?: string;
  /** Conversation history for context */
  conversationHistory: ConversationMessage[];
  /** Unique identifier for this request */
  requestId: string;
  /** Request timestamp */
  timestamp: Date;
}

/**
 * Schema definition for tool parameters.
 * Used for validation and OpenAI function definitions (Requirement 6.1).
 */
export interface ToolParameterSchema {
  type: 'object';
  properties: Record<string, ParameterDefinition>;
  required: string[];
}

/**
 * Definition for a single parameter in a tool schema.
 */
export interface ParameterDefinition {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  enum?: string[];
  items?: ParameterDefinition;
}


/**
 * Result returned from tool execution.
 */
export interface ToolResult {
  /** Whether the tool executed successfully */
  success: boolean;
  /** Result data if successful */
  data?: unknown;
  /** Error message if failed */
  error?: string;
  /** Human-readable text for display */
  displayText?: string;
}

/**
 * Represents a tool call made by the AI.
 */
export interface ToolCall {
  toolName: string;
  parameters: Record<string, unknown>;
}

/**
 * Interface that all tools must implement (Requirement 6.1).
 * Tools are registered with name, description, and parameter schema.
 */
export interface Tool {
  /** Unique tool identifier */
  name: string;
  /** Human-readable description for the AI */
  description: string;
  /** JSON Schema for parameter validation */
  parameters: ToolParameterSchema;
  /** Whether results can be cached */
  cacheable?: boolean;
  /** Cache TTL in seconds (default: 300) */
  cacheTtlSeconds?: number;
  /** Execute the tool with given parameters and context */
  execute(params: Record<string, unknown>, context: AgentContext): Promise<ToolResult>;
}

/**
 * OpenAI function definition format for tool registration.
 */
export interface OpenAIToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: ToolParameterSchema;
  };
}

/**
 * Response from the agent after processing a request.
 */
export interface AgentResponse {
  /** Main response text */
  text: string;
  /** Optional Slack blocks for rich formatting */
  blocks?: SlackBlock[];
  /** List of tools that were invoked */
  toolsUsed: string[];
  /** Whether the request was successful */
  success: boolean;
}

/**
 * Slack block element for rich message formatting.
 */
export interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
    emoji?: boolean;
  };
  elements?: SlackBlockElement[];
  fields?: SlackBlockField[];
  accessory?: SlackBlockElement;
  block_id?: string;
}

/**
 * Element within a Slack block.
 */
export interface SlackBlockElement {
  type: string;
  text?: string | { type: string; text: string; emoji?: boolean };
  url?: string;
  action_id?: string;
  value?: string;
}

/**
 * Field within a Slack section block.
 */
export interface SlackBlockField {
  type: string;
  text: string;
}

/**
 * Cached conversation stored in Redis.
 */
export interface CachedConversation {
  messages: ConversationMessage[];
  lastUpdated: number;
  /** Summarized older messages when conversation exceeds limit */
  summary?: string;
}

/**
 * Error response format for consistent error handling.
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    suggestion?: string;
  };
}

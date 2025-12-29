/**
 * AI Agent module exports.
 * Provides the main entry points for the AI agent system.
 * Requirements: 1.1, 2.2, 3.1, 6.2
 */

// Agent Command - main entry point for chat integration
export {
  AgentCommand,
  createAgentCommand,
  initializeAgentTools,
  ensureToolsInitialized,
} from './agent-command';

// Core components
export { Orchestrator, getOrchestrator, createOrchestrator } from './orchestrator';
export { ToolRegistry, getToolRegistry, resetToolRegistry } from './tool-registry';
export { ContextManager, getContextManager, createContextManager } from './context-manager';
export { RateLimiter, getRateLimiter, createRateLimiter } from './rate-limiter';
export { ResponseGenerator, getResponseGenerator } from './response-generator';

// Tools
export {
  createAllTools,
  getAvailableToolNames,
  JiraTool,
  AppointmentTool,
  CITool,
  QATool,
} from './tools';

// Types
export type {
  AgentContext,
  AgentResponse,
  Tool,
  ToolResult,
  ToolCall,
  ToolParameterSchema,
  ConversationMessage,
  SlackBlock,
} from './types';

// Errors
export {
  AgentError,
  ValidationError,
  ToolExecutionError,
  RateLimitError,
  IntentError,
  toUserFriendlyError,
} from './errors';

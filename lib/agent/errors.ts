/**
 * Custom error classes for the AI Agent system.
 * Requirements: 6.1, 6.4
 */

/**
 * Base error class for all agent-related errors.
 */
export class AgentError extends Error {
  public readonly code: string;
  public readonly suggestion?: string;

  constructor(message: string, code: string, suggestion?: string) {
    super(message);
    this.name = 'AgentError';
    this.code = code;
    this.suggestion = suggestion;
    Object.setPrototypeOf(this, AgentError.prototype);
  }

  /**
   * Convert to user-friendly error response format.
   */
  toErrorResponse() {
    return {
      success: false as const,
      error: {
        code: this.code,
        message: this.message,
        suggestion: this.suggestion,
      },
    };
  }
}

/**
 * Error thrown when input validation fails.
 * Used for invalid parameters, malformed requests, etc.
 */
export class ValidationError extends AgentError {
  public readonly field?: string;
  public readonly expectedType?: string;
  public readonly receivedValue?: unknown;

  constructor(
    message: string,
    options?: {
      field?: string;
      expectedType?: string;
      receivedValue?: unknown;
      suggestion?: string;
    }
  ) {
    super(
      message,
      'VALIDATION_ERROR',
      options?.suggestion ?? 'Please check your input and try again.'
    );
    this.name = 'ValidationError';
    this.field = options?.field;
    this.expectedType = options?.expectedType;
    this.receivedValue = options?.receivedValue;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}


/**
 * Error thrown when tool execution fails.
 * Wraps underlying errors from tool implementations.
 */
export class ToolExecutionError extends AgentError {
  public readonly toolName: string;
  public readonly originalError?: Error;

  constructor(
    toolName: string,
    message: string,
    options?: {
      originalError?: Error;
      suggestion?: string;
    }
  ) {
    super(
      message,
      'TOOL_EXECUTION_FAILED',
      options?.suggestion ?? `The ${toolName} tool encountered an error. Please try again or use a different approach.`
    );
    this.name = 'ToolExecutionError';
    this.toolName = toolName;
    this.originalError = options?.originalError;
    Object.setPrototypeOf(this, ToolExecutionError.prototype);
  }
}

/**
 * Error thrown when rate limits are exceeded.
 * Includes information about when to retry.
 */
export class RateLimitError extends AgentError {
  public readonly retryAfterMs?: number;
  public readonly limitType: 'user' | 'api' | 'duplicate';

  constructor(
    limitType: 'user' | 'api' | 'duplicate',
    message: string,
    options?: {
      retryAfterMs?: number;
      suggestion?: string;
    }
  ) {
    const defaultSuggestions: Record<string, string> = {
      user: 'You have sent too many requests. Please wait a moment before trying again.',
      api: 'The AI service is temporarily busy. Your request will be retried automatically.',
      duplicate: 'This message was already processed. Please wait for the response.',
    };

    super(
      message,
      'RATE_LIMIT_EXCEEDED',
      options?.suggestion ?? defaultSuggestions[limitType]
    );
    this.name = 'RateLimitError';
    this.limitType = limitType;
    this.retryAfterMs = options?.retryAfterMs;
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }

  /**
   * Check if this error indicates the request should be retried.
   */
  shouldRetry(): boolean {
    return this.limitType === 'api';
  }
}

/**
 * Error thrown when context operations fail.
 */
export class ContextError extends AgentError {
  constructor(message: string, suggestion?: string) {
    super(
      message,
      'CONTEXT_ERROR',
      suggestion ?? 'There was an issue with the conversation context. Please try starting a new thread.'
    );
    this.name = 'ContextError';
    Object.setPrototypeOf(this, ContextError.prototype);
  }
}

/**
 * Error thrown when intent cannot be determined.
 */
export class IntentError extends AgentError {
  constructor(message: string, suggestion?: string) {
    super(
      message,
      'INTENT_ERROR',
      suggestion ?? 'I couldn\'t understand your request. Try rephrasing or ask me what I can help with.'
    );
    this.name = 'IntentError';
    Object.setPrototypeOf(this, IntentError.prototype);
  }
}

/**
 * Type guard to check if an error is an AgentError.
 */
export function isAgentError(error: unknown): error is AgentError {
  return error instanceof AgentError;
}

/**
 * Convert any error to a user-friendly message.
 * Ensures internal details are not exposed.
 */
export function toUserFriendlyError(error: unknown): {
  code: string;
  message: string;
  suggestion: string;
} {
  if (isAgentError(error)) {
    return {
      code: error.code,
      message: error.message,
      suggestion: error.suggestion ?? 'Please try again.',
    };
  }

  // For unknown errors, return a generic message
  return {
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred.',
    suggestion: 'Please try again. If the problem persists, contact support.',
  };
}

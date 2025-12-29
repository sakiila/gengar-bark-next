# Implementation Plan: Slack Bot AI Agent

## Overview

This implementation plan breaks down the AI agent feature into incremental coding tasks. Each task builds on previous work, ensuring no orphaned code. The plan follows the existing codebase patterns (command structure, Slack bolt integration, Redis caching) while introducing the new agent architecture.

## Tasks

- [x] 1. Set up core interfaces and types
  - Create `lib/agent/types.ts` with AgentContext, Tool, ToolResult, ConversationMessage interfaces
  - Create `lib/agent/errors.ts` with custom error classes (ValidationError, ToolExecutionError, RateLimitError)
  - _Requirements: 6.1, 6.4_

- [x] 2. Implement Tool Registry
  - [x] 2.1 Create `lib/agent/tool-registry.ts` with ToolRegistry class
    - Implement register(), get(), getAll(), getToolDefinitions() methods
    - Store tools in a Map with name as key
    - Generate OpenAI function definitions from tool schemas
    - _Requirements: 6.1, 6.2_

  - [ ]* 2.2 Write property test for tool registration completeness
    - **Property 14: Tool Registration Completeness**
    - **Validates: Requirements 6.1, 6.2**

  - [ ]* 2.3 Write property test for tool parameter validation
    - **Property 15: Tool Parameter Validation**
    - **Validates: Requirements 6.3**

- [x] 3. Implement Rate Limiter
  - [x] 3.1 Create `lib/agent/rate-limiter.ts` with RateLimiter class
    - Implement checkDuplicate() using Redis with 120s TTL
    - Implement checkUserLimit() tracking requests per user per minute
    - Implement recordRequest() to increment user request count
    - Use existing upstash Redis client
    - _Requirements: 5.1, 5.4_

  - [ ]* 3.2 Write property test for duplicate message detection
    - **Property 10: Duplicate Message Detection**
    - **Validates: Requirements 5.1**

  - [ ]* 3.3 Write property test for user abuse throttling
    - **Property 13: User Abuse Throttling**
    - **Validates: Requirements 5.4**

- [ ] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement Context Manager
  - [x] 5.1 Create `lib/agent/context-manager.ts` with ContextManager class
    - Implement getContext() to retrieve conversation from Redis
    - Implement saveMessage() to append message to conversation
    - Implement summarizeIfNeeded() to condense conversations >20 messages using OpenAI
    - Use key format `agent:context:{channel}:{threadTs}` with 24h TTL
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ]* 5.2 Write property test for context storage round-trip
    - **Property 3: Context Storage Round-Trip**
    - **Validates: Requirements 2.1**

  - [ ]* 5.3 Write property test for context summarization bounds
    - **Property 5: Context Summarization Bounds**
    - **Validates: Requirements 2.3**

- [x] 6. Implement Response Generator
  - [x] 6.1 Create `lib/agent/response-generator.ts` with ResponseGenerator class
    - Implement formatTextResponse() with 2000 char limit
    - Implement formatStructuredResponse() to create Slack blocks
    - Implement formatErrorResponse() for user-friendly errors
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 6.2 Write property test for response length limit
    - **Property 9: Response Length Limit**
    - **Validates: Requirements 4.4**

- [x] 7. Implement Core Tools
  - [x] 7.1 Create `lib/agent/tools/jira-tool.ts`
    - Wrap existing createIssue() from lib/jira/create-issue.ts
    - Define parameter schema for project, issueType, summary, description
    - Return structured ToolResult with Jira issue link
    - _Requirements: 3.5_

  - [x] 7.2 Create `lib/agent/tools/appointment-tool.ts`
    - Wrap existing sendAppointmentToSlack() functionality
    - Define parameter schema for appointmentId
    - Return structured ToolResult with appointment details
    - _Requirements: 3.5_

  - [x] 7.3 Create `lib/agent/tools/ci-tool.ts`
    - Wrap existing CI subscription logic
    - Define parameter schema for repository, branch
    - Return ToolResult with subscription confirmation
    - _Requirements: 3.5_

  - [x] 7.4 Create `lib/agent/tools/qa-tool.ts`
    - Wrap existing GPT Q&A functionality
    - Define parameter schema for question
    - Return ToolResult with AI response
    - _Requirements: 3.5_

  - [ ]* 7.5 Write unit tests for tool implementations
    - Test each tool's execute() method with valid parameters
    - Test error handling for invalid parameters
    - _Requirements: 3.3, 3.5_

- [ ] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Implement Orchestrator
  - [x] 9.1 Create `lib/agent/orchestrator.ts` with Orchestrator class
    - Implement process() method as main entry point
    - Build system prompt with tool definitions
    - Call OpenAI with function calling enabled
    - Parse tool calls from response and execute sequentially
    - Handle multi-step tool chains
    - _Requirements: 1.1, 3.1, 3.2_

  - [x] 9.2 Add retry logic with exponential backoff
    - Implement withRetry() helper for OpenAI calls
    - Configure max 3 retries with 2^n second delays
    - Handle rate limit errors specifically
    - _Requirements: 5.2_

  - [ ]* 9.3 Write property test for rate limit retry with backoff
    - **Property 11: Rate Limit Retry with Backoff**
    - **Validates: Requirements 5.2**

  - [x] 9.4 Add tool result caching
    - Cache tool results in Redis with configurable TTL
    - Skip cache for tools marked as non-cacheable
    - _Requirements: 5.3_

  - [ ]* 9.5 Write property test for tool result caching
    - **Property 12: Tool Result Caching**
    - **Validates: Requirements 5.3**

- [x] 10. Implement Agent Command
  - [x] 10.1 Create `lib/agent/agent-command.ts` implementing Command interface
    - Wire together ToolRegistry, ContextManager, RateLimiter, Orchestrator, ResponseGenerator
    - Implement matches() to always return true (default handler)
    - Implement execute() to process through full agent pipeline
    - _Requirements: 1.1, 2.2, 3.1_

  - [x] 10.2 Register all tools in agent initialization
    - Create tool instances and register with ToolRegistry
    - Export initialized agent for use in chat handler
    - _Requirements: 6.2_

- [x] 11. Integrate with Existing Chat Handler
  - [x] 11.1 Update `lib/events-handlers/chat.ts`
    - Replace GptCommand with AgentCommand as default handler
    - Ensure rate limiting check happens before processing
    - Maintain backward compatibility with existing commands
    - _Requirements: 1.1, 5.1_

  - [ ]* 11.2 Write integration tests for end-to-end flow
    - Test user message → intent → tool → response flow
    - Test multi-tool orchestration
    - Test error recovery scenarios
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 12. Add Tool Execution Logging
  - [x] 12.1 Create Supabase migration for agent_tool_executions table
    - Add table with columns: id, request_id, channel, thread_ts, user_id, tool_name, parameters, result, success, execution_time_ms, created_at
    - Add indexes for channel/thread and user lookups
    - _Requirements: 6.4_

  - [x] 12.2 Implement logging in Orchestrator
    - Log each tool execution with timing
    - Store parameters and results as JSONB
    - _Requirements: 6.4_

- [ ] 13. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Verify all property tests run with minimum 100 iterations

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use fast-check library for TypeScript
- Existing patterns from lib/commands/ and lib/ai/ are reused where possible
- Redis keys use `agent:` prefix to namespace from existing keys

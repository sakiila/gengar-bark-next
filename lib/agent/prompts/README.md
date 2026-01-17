# Agent System Prompts

This directory contains system prompts for the AI agent, separated from code for easier management and version control.

## Files

### `system-prompt.txt`
The main system prompt for Gengar AI assistant. This prompt defines:
- Agent identity and capabilities
- Available commands and tools
- Guidelines for when to use tools vs direct responses
- Response formatting rules

## Usage

The prompt is automatically loaded by `lib/agent/orchestrator.ts` at runtime using:

```typescript
const SYSTEM_PROMPT = loadSystemPrompt();
```

## Editing Guidelines

When modifying the system prompt:

1. **Test thoroughly** - Changes affect all AI responses
2. **Keep it concise** - Longer prompts cost more tokens
3. **Be specific** - Clear instructions lead to better results
4. **Version control** - Commit changes with descriptive messages

## Key Sections

### 1. Identity
Defines who the agent is and its purpose.

### 2. Available Commands
Lists all commands users can use (help, appointments, CI, Jira, etc.)

### 3. Tool Usage Guidelines (IMPORTANT)
Specifies when to use tools vs direct responses:
- **Direct response**: Text processing (translate, summarize, explain)
- **Tool usage**: External actions (create appointments, Jira tickets)

### 4. Response Rules
- Language matching (respond in user's language)
- Formatting preferences (concise, professional)
- Slack-specific formatting

## Fallback Behavior

If the prompt file cannot be loaded, the system uses a minimal fallback prompt defined in `orchestrator.ts`. This ensures the agent continues to function even if the file is missing.

## Testing Changes

After modifying the prompt:

1. Restart the development server
2. Test various scenarios:
   - Translation requests
   - Summarization requests
   - Tool-based commands (create appointment, Jira)
   - General questions
3. Monitor logs for unexpected tool calls
4. Verify response quality and accuracy

## Examples

### Good Prompt Additions
```
For code review requests, provide structured feedback with:
1. Issues found
2. Suggestions for improvement
3. Best practices recommendations
```

### Bad Prompt Additions
```
Always use tools for everything. Never respond directly.
```
(This would break text processing tasks)

## Version History

- **2025-01-17**: Initial extraction of prompt to separate file
  - Added tool vs direct response guidelines
  - Improved translation/summarization handling

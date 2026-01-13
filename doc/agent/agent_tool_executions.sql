-- Agent Tool Executions Table
-- Stores logs of all tool executions by the AI agent for debugging and analytics.
-- Requirements: 6.4 - Log tool invocations with context

-- Create the agent_tool_executions table
CREATE TABLE IF NOT EXISTS agent_tool_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id VARCHAR(255) NOT NULL,
  channel VARCHAR(255) NOT NULL,
  thread_ts VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  tool_name VARCHAR(100) NOT NULL,
  parameters JSONB,
  result JSONB,
  success BOOLEAN NOT NULL,
  execution_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for looking up executions by channel and thread
-- Useful for debugging conversation-specific tool usage
CREATE INDEX IF NOT EXISTS idx_tool_executions_channel_thread 
  ON agent_tool_executions(channel, thread_ts);

-- Index for looking up executions by user
-- Useful for user-specific analytics and abuse detection
CREATE INDEX IF NOT EXISTS idx_tool_executions_user 
  ON agent_tool_executions(user_id);

-- Index for looking up executions by tool name
-- Useful for tool-specific analytics
CREATE INDEX IF NOT EXISTS idx_tool_executions_tool_name 
  ON agent_tool_executions(tool_name);

-- Index for time-based queries
-- Useful for recent execution lookups and cleanup
CREATE INDEX IF NOT EXISTS idx_tool_executions_created_at 
  ON agent_tool_executions(created_at);

-- Comment on table and columns for documentation
COMMENT ON TABLE agent_tool_executions IS 'Logs of AI agent tool executions for debugging and analytics';
COMMENT ON COLUMN agent_tool_executions.id IS 'Unique identifier for the execution record';
COMMENT ON COLUMN agent_tool_executions.request_id IS 'Unique identifier for the agent request that triggered this execution';
COMMENT ON COLUMN agent_tool_executions.channel IS 'Slack channel ID where the request originated';
COMMENT ON COLUMN agent_tool_executions.thread_ts IS 'Slack thread timestamp for conversation tracking';
COMMENT ON COLUMN agent_tool_executions.user_id IS 'Slack user ID who made the request';
COMMENT ON COLUMN agent_tool_executions.tool_name IS 'Name of the tool that was executed';
COMMENT ON COLUMN agent_tool_executions.parameters IS 'JSON object containing the parameters passed to the tool';
COMMENT ON COLUMN agent_tool_executions.result IS 'JSON object containing the tool execution result';
COMMENT ON COLUMN agent_tool_executions.success IS 'Whether the tool execution was successful';
COMMENT ON COLUMN agent_tool_executions.execution_time_ms IS 'Time taken to execute the tool in milliseconds';
COMMENT ON COLUMN agent_tool_executions.created_at IS 'Timestamp when the execution was logged';

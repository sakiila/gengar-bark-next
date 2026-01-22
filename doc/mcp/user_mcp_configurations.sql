-- User MCP Configurations Table
-- Stores user-specific Model Context Protocol (MCP) server configurations
-- Requirements: 1.1, 1.2, 1.5, 1.6 - User MCP Configuration Storage

-- Create the user_mcp_configurations table
CREATE TABLE IF NOT EXISTS user_mcp_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  server_name VARCHAR(255) NOT NULL,
  transport_type VARCHAR(20) NOT NULL CHECK (transport_type IN ('sse', 'websocket')),
  url TEXT NOT NULL,
  encrypted_auth_token TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  capabilities JSONB,
  verification_status VARCHAR(20) NOT NULL CHECK (verification_status IN ('verified', 'unverified', 'failed')),
  verification_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_user_server UNIQUE (user_id, server_name)
);

-- Index for looking up configurations by user
-- Useful for retrieving all configurations for a specific user
CREATE INDEX IF NOT EXISTS idx_user_mcp_configs_user_id 
  ON user_mcp_configurations(user_id);

-- Partial index for looking up enabled configurations by user
-- Useful for AI pipeline to quickly find active MCP servers
CREATE INDEX IF NOT EXISTS idx_user_mcp_configs_enabled 
  ON user_mcp_configurations(user_id, enabled) 
  WHERE enabled = TRUE;

-- Index for looking up configurations by server name
-- Useful for slash commands that reference servers by name
CREATE INDEX IF NOT EXISTS idx_user_mcp_configs_server_name 
  ON user_mcp_configurations(user_id, server_name);

-- Comment on table and columns for documentation
COMMENT ON TABLE user_mcp_configurations IS 'User-specific MCP server configurations for personalized AI context';
COMMENT ON COLUMN user_mcp_configurations.id IS 'Unique identifier for the configuration';
COMMENT ON COLUMN user_mcp_configurations.user_id IS 'Slack user ID who owns this configuration';
COMMENT ON COLUMN user_mcp_configurations.server_name IS 'User-friendly name for the MCP server';
COMMENT ON COLUMN user_mcp_configurations.transport_type IS 'Transport protocol: sse or websocket';
COMMENT ON COLUMN user_mcp_configurations.url IS 'MCP server endpoint URL (must be HTTPS)';
COMMENT ON COLUMN user_mcp_configurations.encrypted_auth_token IS 'Encrypted authentication token for server access';
COMMENT ON COLUMN user_mcp_configurations.enabled IS 'Whether this configuration is active';
COMMENT ON COLUMN user_mcp_configurations.capabilities IS 'Server capabilities from MCP Initialize handshake';
COMMENT ON COLUMN user_mcp_configurations.verification_status IS 'Connection verification status: verified, unverified, or failed';
COMMENT ON COLUMN user_mcp_configurations.verification_error IS 'Error message if verification failed';
COMMENT ON COLUMN user_mcp_configurations.created_at IS 'Timestamp when the configuration was created';
COMMENT ON COLUMN user_mcp_configurations.updated_at IS 'Timestamp when the configuration was last updated';

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_mcp_configurations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the update function before each update
CREATE TRIGGER trigger_update_user_mcp_configurations_updated_at
  BEFORE UPDATE ON user_mcp_configurations
  FOR EACH ROW
  EXECUTE FUNCTION update_user_mcp_configurations_updated_at();

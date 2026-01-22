-- Rollback script for User MCP Configurations Table
-- This script removes the user_mcp_configurations table and related objects

-- Drop the trigger first
DROP TRIGGER IF EXISTS trigger_update_user_mcp_configurations_updated_at ON user_mcp_configurations;

-- Drop the function
DROP FUNCTION IF EXISTS update_user_mcp_configurations_updated_at();

-- Drop the indexes (they will be dropped with the table, but explicit for clarity)
DROP INDEX IF EXISTS idx_user_mcp_configs_user_id;
DROP INDEX IF EXISTS idx_user_mcp_configs_enabled;
DROP INDEX IF EXISTS idx_user_mcp_configs_server_name;

-- Drop the table
DROP TABLE IF EXISTS user_mcp_configurations;

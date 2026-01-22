import { NextApiResponse } from 'next';
import { MCPConfigurationService } from '@/lib/database/services/mcp-configuration.service';

/**
 * Handler for /mcp-disable slash command
 * Disables a specific MCP server configuration by server name
 * 
 * @param res - Next.js API response object
 * @param userId - Slack user ID
 * @param serverName - Name of the server to disable
 */
export default async function mcpDisable(
  res: NextApiResponse,
  userId: string,
  serverName: string,
) {
  try {
    // Validate server name is provided
    if (!serverName || serverName.trim() === '') {
      res.send({
        response_type: 'ephemeral',
        text: '❌ Please provide a server name.\n\nUsage: `/mcp-disable <server-name>`',
      });
      return;
    }
    
    // Get the MCP configuration service
    const service = await MCPConfigurationService.getInstance();
    
    // Find the configuration by server name
    const configs = await service.listConfigurations(userId);
    const config = configs.find(c => c.serverName.toLowerCase() === serverName.toLowerCase());
    
    if (!config) {
      res.send({
        response_type: 'ephemeral',
        text: `❌ MCP server '${serverName}' not found.\n\nUse \`/mcp-list\` to see your configured servers.`,
      });
      return;
    }
    
    // Check if already disabled
    if (!config.enabled) {
      res.send({
        response_type: 'ephemeral',
        text: `ℹ️ MCP server '*${config.serverName}*' is already disabled.`,
      });
      return;
    }
    
    // Disable the configuration
    await service.disableConfiguration(userId, config.id);
    
    res.send({
      response_type: 'ephemeral',
      text: `⏸️ Successfully disabled MCP server '*${config.serverName}*'.\n\nIt will no longer be used in your AI conversations.`,
    });
  } catch (error) {
    console.error('Error in mcp-disable handler:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    res.send({
      response_type: 'ephemeral',
      text: `❌ Failed to disable MCP server: ${errorMessage}`,
    });
  }
}

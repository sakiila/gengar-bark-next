import { NextApiResponse } from 'next';
import { MCPConfigurationService } from '@/lib/database/services/mcp-configuration.service';

/**
 * Handler for /mcp-enable slash command
 * Enables a specific MCP server configuration by server name
 * 
 * @param res - Next.js API response object
 * @param userId - Slack user ID
 * @param serverName - Name of the server to enable
 */
export default async function mcpEnable(
  res: NextApiResponse,
  userId: string,
  serverName: string,
) {
  try {
    // Validate server name is provided
    if (!serverName || serverName.trim() === '') {
      res.send({
        response_type: 'ephemeral',
        text: '❌ Please provide a server name.\n\nUsage: `/mcp-enable <server-name>`',
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
    
    // Check if already enabled
    if (config.enabled) {
      res.send({
        response_type: 'ephemeral',
        text: `ℹ️ MCP server '*${config.serverName}*' is already enabled.`,
      });
      return;
    }
    
    // Enable the configuration
    await service.enableConfiguration(userId, config.id);
    
    res.send({
      response_type: 'ephemeral',
      text: `✅ Successfully enabled MCP server '*${config.serverName}*'.\n\nIt will now be used in your AI conversations.`,
    });
  } catch (error) {
    console.error('Error in mcp-enable handler:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    res.send({
      response_type: 'ephemeral',
      text: `❌ Failed to enable MCP server: ${errorMessage}`,
    });
  }
}

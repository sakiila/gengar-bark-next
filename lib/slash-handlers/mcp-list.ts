import { NextApiResponse } from 'next';
import { MCPConfigurationService } from '@/lib/database/services/mcp-configuration.service';

/**
 * Handler for /mcp-list slash command
 * Lists all MCP server configurations for the user with their status
 * 
 * @param res - Next.js API response object
 * @param userId - Slack user ID
 */
export default async function mcpList(
  res: NextApiResponse,
  userId: string,
) {
  try {
    // Get the MCP configuration service
    const service = await MCPConfigurationService.getInstance();
    
    // Retrieve all configurations for the user
    const configs = await service.listConfigurations(userId);
    
    // Handle empty state
    if (configs.length === 0) {
      res.send({
        response_type: 'ephemeral',
        text: '📋 *Your MCP Servers*\n\nYou don\'t have any MCP servers configured yet.\n\nUse the App Home tab to add your first MCP server! 🚀',
      });
      return;
    }
    
    // Format the configuration list
    let text = '📋 *Your MCP Servers*\n\n';
    
    configs.forEach((config, index) => {
      const statusEmoji = config.enabled ? '✅' : '⏸️';
      const verificationEmoji = 
        config.verificationStatus === 'verified' ? '🔒' :
        config.verificationStatus === 'failed' ? '❌' : '⚠️';
      
      text += `${index + 1}. *${config.serverName}*\n`;
      text += `   Status: ${statusEmoji} ${config.enabled ? 'Enabled' : 'Disabled'}\n`;
      text += `   Verification: ${verificationEmoji} ${config.verificationStatus}\n`;
      text += `   Transport: ${config.transportType.toUpperCase()}\n`;
      text += `   URL: ${config.url}\n`;
      
      if (config.verificationError) {
        text += `   Error: ${config.verificationError}\n`;
      }
      
      text += '\n';
    });
    
    text += '\n_Use `/mcp-enable <server-name>` or `/mcp-disable <server-name>` to toggle servers._';
    text += '\n_Visit the App Home tab to add, edit, or delete servers._';
    
    res.send({
      response_type: 'ephemeral',
      text,
    });
  } catch (error) {
    console.error('Error in mcp-list handler:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    res.send({
      response_type: 'ephemeral',
      text: `❌ Failed to list MCP servers: ${errorMessage}`,
    });
  }
}

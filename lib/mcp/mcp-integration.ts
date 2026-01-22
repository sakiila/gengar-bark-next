/**
 * MCP Integration Helper
 * 
 * Provides helper functions for integrating MCP into the AI pipeline.
 * Handles loading user configurations, initializing connections, collecting context,
 * and cleanup.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.7, 6.8
 */

import { MCPConfigurationService } from '../database/services/mcp-configuration.service';
import { MCPClientManager } from './client-manager';
import { MCPContext } from '../../types/mcp';
import { logger } from '../utils/logger';

/**
 * Result of MCP integration
 */
export interface MCPIntegrationResult {
  manager: MCPClientManager;
  context: MCPContext;
  connectedCount: number;
  failedCount: number;
}

/**
 * Load user MCP configurations and initialize connections
 * 
 * @param userId - The Slack user ID
 * @returns MCPIntegrationResult with manager, context, and connection stats
 * 
 * Requirements: 6.1, 6.2, 6.4, 6.5
 */
export async function initializeMCPForUser(userId: string): Promise<MCPIntegrationResult> {
  const manager = new MCPClientManager();
  const context: MCPContext = {};
  let connectedCount = 0;
  let failedCount = 0;

  logger.info(`[MCP] Starting MCP initialization for user: ${userId}`);

  try {
    // Step 1: Load user's enabled MCP configurations
    logger.info(`[MCP] Getting MCPConfigurationService instance...`);
    const mcpService = await MCPConfigurationService.getInstance();
    
    logger.info(`[MCP] Fetching enabled configurations for user: ${userId}`);
    const configs = await mcpService.getEnabledConfigurations(userId);

    logger.info(`[MCP] Found ${configs.length} enabled MCP configurations for user ${userId}`);
    
    if (configs.length === 0) {
      logger.info(`[MCP] No MCP configurations found for user ${userId}. User needs to add MCP servers via App Home.`);
    } else {
      logger.info(`[MCP] Configurations: ${configs.map(c => `${c.serverName} (${c.id})`).join(', ')}`);
    }

    // Step 2: Initialize connections to each MCP server
    for (const config of configs) {
      try {
        logger.info(`Connecting to MCP server: ${config.serverName} (${config.id})`);

        // Attempt to connect with 5-second timeout
        const connection = await manager.connect(config.id, {
          url: config.url,
          transport: config.transportType,
          authToken: config.authToken,
          connectionTimeout: 5000, // 5 seconds as per requirements
          executionTimeout: 30000, // 30 seconds for operations
        });

        connectedCount++;
        logger.info(`Successfully connected to MCP server: ${config.serverName}`);

        // Step 3: Collect context from the connected server
        // Handle tools and resources separately since some servers may not support resources
        let tools: any[] = [];
        let resources: any[] = [];

        // Get tools
        try {
          tools = await manager.listTools(config.id);
          logger.info(`Collected ${tools.length} tools from ${config.serverName}`);
          if (tools.length > 0) {
            console.log(`[MCP] Tools from ${config.serverName}:`, JSON.stringify(tools.map(t => t.name), null, 2));
          }
        } catch (toolsError) {
          logger.error(`Failed to list tools from ${config.serverName}:`, toolsError instanceof Error ? toolsError : { error: String(toolsError) });
        }

        // Get resources (optional - some servers don't support this)
        try {
          resources = await manager.getResources(config.id);
          logger.info(`Collected ${resources.length} resources from ${config.serverName}`);
        } catch (resourcesError) {
          // Resources are optional, just log and continue
          logger.warn(`Resources not available from ${config.serverName} (this is normal for some MCP servers)`);
        }

        // Add to context
        context[config.id] = {
          serverName: config.serverName,
          tools,
          resources,
        };

        logger.info(`MCP context for ${config.serverName}: ${tools.length} tools, ${resources.length} resources`);
      } catch (connectionError) {
        // Log error but continue with other servers
        failedCount++;
        logger.error(`Failed to connect to MCP server ${config.serverName}:`, connectionError instanceof Error ? connectionError : { error: String(connectionError) });
        
        // Check if it's a timeout error
        if (connectionError instanceof Error && connectionError.message.includes('timed out')) {
          logger.warn(`Connection to ${config.serverName} timed out after 5 seconds`);
        }
      }
    }

    logger.info(`[MCP] MCP initialization complete: ${connectedCount} connected, ${failedCount} failed`);

    return {
      manager,
      context,
      connectedCount,
      failedCount,
    };
  } catch (error) {
    // If loading configurations fails, log and return empty result
    logger.error('[MCP] Failed to load MCP configurations:', error instanceof Error ? error : { error: String(error) });
    
    return {
      manager,
      context: {},
      connectedCount: 0,
      failedCount: 0,
    };
  }
}

/**
 * Cleanup MCP connections
 * 
 * @param manager - The MCP client manager to cleanup
 * 
 * Requirements: 6.8
 */
export async function cleanupMCPConnections(manager: MCPClientManager): Promise<void> {
  try {
    logger.info('Cleaning up MCP connections');
    await manager.disconnectAll();
    logger.info('MCP connections cleaned up successfully');
  } catch (error) {
    // Log error but don't throw - cleanup should be best-effort
    logger.error('Error during MCP connection cleanup:', error instanceof Error ? error : { error: String(error) });
  }
}

/**
 * Format MCP context for inclusion in AI prompt
 * 
 * @param context - The MCP context collected from servers
 * @returns Formatted string for AI prompt
 * 
 * Requirements: 6.7
 */
export function formatMCPContextForPrompt(context: MCPContext): string {
  if (Object.keys(context).length === 0) {
    return '';
  }

  const parts: string[] = [
    '\n\n--- Available MCP Tools and Resources ---',
  ];

  for (const [configId, serverContext] of Object.entries(context)) {
    parts.push(`\n## ${serverContext.serverName}`);

    if (serverContext.tools.length > 0) {
      parts.push('\nTools:');
      for (const tool of serverContext.tools) {
        parts.push(`- ${tool.name}: ${tool.description || 'No description'}`);
      }
    }

    if (serverContext.resources.length > 0) {
      parts.push('\nResources:');
      for (const resource of serverContext.resources) {
        parts.push(`- ${resource.name || resource.uri}: ${resource.description || 'No description'}`);
      }
    }
  }

  parts.push('\n--- End of MCP Context ---\n');

  return parts.join('\n');
}

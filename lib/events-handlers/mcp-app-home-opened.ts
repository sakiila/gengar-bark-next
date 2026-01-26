import { NextApiRequest, NextApiResponse } from 'next';
import { MCPConfigurationService, MCPConfigOutput } from '@/lib/database/services/mcp-configuration.service';
import { publishView } from '@/lib/slack/gengar-bolt';

/**
 * MCPAppHomeHandler - Handles Slack App Home interface for MCP configuration
 * 
 * This handler manages the App Home view rendering and interactions for
 * user MCP server configurations, providing a visual interface for
 * managing MCP connections directly from Slack.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */
export class MCPAppHomeHandler {
  private mcpService: MCPConfigurationService | null = null;

  /**
   * Initialize the MCP configuration service
   */
  private async initService(): Promise<MCPConfigurationService> {
    if (!this.mcpService) {
      this.mcpService = await MCPConfigurationService.getInstance();
    }
    return this.mcpService;
  }

  /**
   * Render the App Home view for a user
   * 
   * Retrieves the user's MCP configurations and builds a Slack Block Kit
   * interface showing all configurations with their status and action buttons.
   * 
   * @param userId The Slack user ID
   * @returns Promise<AppHomeView> The App Home view structure
   * 
   * Requirements: 4.1, 4.2
   */
  async renderHome(userId: string): Promise<any> {
    const service = await this.initService();
    
    // Retrieve user's configurations
    const configs = await service.listConfigurations(userId);

    // Build the view blocks
    const blocks: any[] = [
      // Header section
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🔌 MCP Server Configuration',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Manage your Model Context Protocol (MCP) server connections. MCP servers provide additional context and capabilities to enhance your AI interactions.',
        },
      },
      {
        type: 'divider',
      },
    ];

    // Add configuration blocks or empty state
    if (configs.length === 0) {
      blocks.push(...this.buildEmptyStateBlocks());
    } else {
      blocks.push(...this.buildConfigurationBlocks(configs));
    }

    // Add "Add MCP Server" button
    blocks.push(
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            style: 'primary',
            text: {
              type: 'plain_text',
              text: '➕ Add MCP Server',
              emoji: true,
            },
            action_id: 'mcp_add_server',
            value: 'add_server',
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '🔄 Refresh',
              emoji: true,
            },
            action_id: 'mcp_refresh_home',
            value: 'refresh',
          },
        ],
      }
    );

    return {
      type: 'home',
      blocks,
    };
  }

  /**
   * Build blocks for displaying MCP configurations
   * 
   * @param configs Array of MCP configurations
   * @returns Array of Slack Block Kit blocks
   */
  private buildConfigurationBlocks(configs: MCPConfigOutput[]): any[] {
    const blocks: any[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Your MCP Servers (${configs.length})*`,
        },
      },
    ];

    for (const config of configs) {
      // Status emoji based on verification and enabled status
      let statusEmoji = '⚪';
      let statusText = 'Unknown';
      
      if (!config.enabled) {
        statusEmoji = '⏸️';
        statusText = 'Disabled';
      } else if (config.verificationStatus === 'verified') {
        statusEmoji = '✅';
        statusText = 'Verified & Enabled';
      } else if (config.verificationStatus === 'failed') {
        statusEmoji = '❌';
        statusText = 'Verification Failed';
      } else if (config.verificationStatus === 'unverified') {
        statusEmoji = '⚠️';
        statusText = 'Unverified';
      }

      // Transport type badge
      const transportBadge = '🌐 HTTP';

      // Build configuration text
      let configText = `*${config.serverName}* ${statusEmoji}\n`;
      configText += `${transportBadge} • ${statusText}\n`;
      configText += `\`${config.url}\``;
      
      if (config.verificationError) {
        configText += `\n_Error: ${config.verificationError}_`;
      }

      // Action buttons
      const buttons: any[] = [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '✏️ Edit',
            emoji: true,
          },
          action_id: 'mcp_edit_server',
          // Pass essential config data in value to avoid DB query on edit
          // This makes the edit modal open instantly
          value: JSON.stringify({
            id: config.id,
            serverName: config.serverName,
            transportType: config.transportType,
            url: config.url,
            hasAuthToken: !!config.authToken,
          }),
        },
      ];

      // Enable/Disable button
      if (config.enabled) {
        buttons.push({
          type: 'button',
          text: {
            type: 'plain_text',
            text: '⏸️ Disable',
            emoji: true,
          },
          action_id: 'mcp_disable_server',
          value: config.id,
        });
      } else {
        buttons.push({
          type: 'button',
          text: {
            type: 'plain_text',
            text: '▶️ Enable',
            emoji: true,
          },
          action_id: 'mcp_enable_server',
          value: config.id,
        });
      }

      // Test and Delete buttons
      buttons.push(
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '🧪 Test',
            emoji: true,
          },
          action_id: 'mcp_test_connection',
          value: config.id,
        },
        {
          type: 'button',
          style: 'danger',
          text: {
            type: 'plain_text',
            text: '🗑️ Delete',
            emoji: true,
          },
          action_id: 'mcp_delete_server',
          value: config.id,
          confirm: {
            title: {
              type: 'plain_text',
              text: 'Delete MCP Server?',
            },
            text: {
              type: 'mrkdwn',
              text: `Are you sure you want to delete *${config.serverName}*? This action cannot be undone.`,
            },
            confirm: {
              type: 'plain_text',
              text: 'Delete',
            },
            deny: {
              type: 'plain_text',
              text: 'Cancel',
            },
          },
        }
      );

      blocks.push(
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: configText,
          },
        },
        {
          type: 'actions',
          elements: buttons,
        },
        {
          type: 'divider',
        }
      );
    }

    return blocks;
  }

  /**
   * Build blocks for empty state (no configurations)
   * 
   * @returns Array of Slack Block Kit blocks
   */
  private buildEmptyStateBlocks(): any[] {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*No MCP Servers Configured*\n\nYou haven\'t added any MCP servers yet. Click the button below to add your first server and enhance your AI interactions with additional context and capabilities.',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*What are MCP Servers?*\n\nMCP (Model Context Protocol) servers provide your AI assistant with access to external data sources and tools.',
        },
      },
    ];
  }

  /**
   * Handle "Add MCP Server" button click
   * Opens a modal for adding a new MCP server configuration
   * 
   * @param userId The Slack user ID
   * @param triggerId The trigger ID for opening the modal
   * 
   * Requirements: 4.3
   */
  async handleAddServerAction(userId: string, triggerId: string): Promise<void> {
    // Import modal handler dynamically
    const { MCPModalHandler } = await import('@/lib/events-handlers/mcp-modal-handler');
    const modalHandler = new MCPModalHandler();
    await modalHandler.openAddModal(triggerId);
  }

  /**
   * Handle "Edit" button click
   * Opens a modal for editing an existing MCP server configuration
   * 
   * @param userId The Slack user ID
   * @param configData The configuration data (JSON string or config ID for backwards compat)
   * @param triggerId The trigger ID for opening the modal
   * 
   * Requirements: 4.4
   */
  async handleEditServerAction(
    userId: string,
    configData: string,
    triggerId: string
  ): Promise<void> {
    let config: MCPConfigOutput;
    
    // Try to parse as JSON (new format with embedded data)
    try {
      const parsed = JSON.parse(configData);
      if (parsed.id && parsed.serverName && parsed.transportType && parsed.url) {
        // Use embedded data directly - no DB query needed!
        config = {
          id: parsed.id,
          serverName: parsed.serverName,
          transportType: parsed.transportType,
          url: parsed.url,
          authToken: parsed.hasAuthToken ? '********' : undefined, // Placeholder, actual token not needed for edit form
          enabled: true,
          capabilities: null,
          verificationStatus: 'verified',
          verificationError: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      } else {
        throw new Error('Invalid config data format');
      }
    } catch {
      // Fallback: treat as config ID (old format) - requires DB query
      const service = await this.initService();
      const fetchedConfig = await service.getConfiguration(userId, configData);
      
      if (!fetchedConfig) {
        throw new Error('Configuration not found or access denied');
      }
      config = fetchedConfig;
    }

    // Open edit modal
    const { MCPModalHandler } = await import('@/lib/events-handlers/mcp-modal-handler');
    const modalHandler = new MCPModalHandler();
    await modalHandler.openEditModal(triggerId, config);
  }

  /**
   * Handle "Delete" button click
   * Deletes an MCP server configuration
   * 
   * @param userId The Slack user ID
   * @param configId The configuration ID to delete
   * 
   * Requirements: 4.3
   */
  async handleDeleteServerAction(userId: string, configId: string): Promise<void> {
    const service = await this.initService();
    await service.deleteConfiguration(userId, configId);
  }

  /**
   * Handle "Enable/Disable" toggle
   * Toggles the enabled status of an MCP server configuration
   * 
   * @param userId The Slack user ID
   * @param configId The configuration ID to toggle
   * @param enable True to enable, false to disable
   * 
   * Requirements: 4.3
   */
  async handleToggleServerAction(
    userId: string,
    configId: string,
    enable: boolean
  ): Promise<void> {
    const service = await this.initService();
    
    if (enable) {
      await service.enableConfiguration(userId, configId);
    } else {
      await service.disableConfiguration(userId, configId);
    }
  }

  /**
   * Handle "Test Connection" button click
   * Tests the connection to an MCP server
   * 
   * @param userId The Slack user ID
   * @param configId The configuration ID to test
   * @returns Object with success status and message
   * 
   * Requirements: 4.3
   */
  async handleTestConnectionAction(
    userId: string,
    configId: string
  ): Promise<{ success: boolean; message: string }> {
    const service = await this.initService();
    
    // Retrieve the configuration
    const config = await service.getConfiguration(userId, configId);
    
    if (!config) {
      return {
        success: false,
        message: 'Configuration not found or access denied',
      };
    }

    // Verify the connection
    const result = await service.verifyConnection({
      serverName: config.serverName,
      transportType: config.transportType,
      url: config.url,
      authToken: config.authToken,
    });

    if (result.success) {
      return {
        success: true,
        message: `✅ Connection successful! Server capabilities: ${JSON.stringify(result.capabilities, null, 2)}`,
      };
    } else {
      return {
        success: false,
        message: `❌ Connection failed: ${result.error}`,
      };
    }
  }
}

/**
 * Event handler for app_home_opened event
 * 
 * This function is called when a user opens the App Home tab.
 * It renders the MCP configuration interface for the user.
 * 
 * @param req Next.js API request
 * @param res Next.js API response
 * 
 * Requirements: 4.1
 */
export default async function mcpAppHomeOpened(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  try {
    const event = req.body.event;
    const userId = event.user;

    // Create handler instance
    const handler = new MCPAppHomeHandler();

    // Render and publish the home view
    const view = await handler.renderHome(userId);
    await publishView(userId, view);

    res.status(200).send('');
  } catch (error) {
    console.error('Error handling app_home_opened event:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

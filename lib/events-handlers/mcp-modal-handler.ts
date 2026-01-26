import { MCPConfigurationService, MCPConfigOutput } from '@/lib/database/services/mcp-configuration.service';
import { openView } from '@/lib/slack/gengar-bolt';
import { getTemplates, MCPTemplate } from '@/lib/mcp/templates';

/**
 * MCPModalHandler - Handles Slack modal interactions for MCP configuration
 * 
 * This handler manages the modal views for adding and editing MCP server
 * configurations, including template selection and form validation.
 * 
 * Requirements: 4.3, 4.4, 8.2, 10.4
 */
export class MCPModalHandler {
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
   * Open modal for adding a new MCP server
   * 
   * @param triggerId The trigger ID for opening the modal
   * 
   * Requirements: 4.3, 8.2
   */
  async openAddModal(triggerId: string): Promise<void> {
    const templates = getTemplates();

    const view = {
      type: 'modal',
      callback_id: 'mcp_add_modal',
      title: {
        type: 'plain_text',
        text: 'Add MCP Server',
      },
      submit: {
        type: 'plain_text',
        text: 'Add Server',
      },
      close: {
        type: 'plain_text',
        text: 'Cancel',
      },
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'Configure a new MCP server connection. You can start with a template or configure manually.',
          },
        },
        {
          type: 'divider',
        },
        // Template selector
        {
          type: 'input',
          block_id: 'template_block',
          optional: true,
          dispatch_action: true,
          element: {
            type: 'static_select',
            action_id: 'template_select',
            placeholder: {
              type: 'plain_text',
              text: 'Choose a template (optional)',
            },
            options: [
              {
                text: {
                  type: 'plain_text',
                  text: '📝 Manual Configuration',
                },
                value: 'manual',
              },
              ...templates.map((template) => ({
                text: {
                  type: 'plain_text',
                  text: `${template.name}`,
                },
                value: template.id,
              })),
            ],
          },
          label: {
            type: 'plain_text',
            text: 'Template',
          },
        },
        // Server name
        {
          type: 'input',
          block_id: 'server_name_block',
          element: {
            type: 'plain_text_input',
            action_id: 'server_name_input',
            placeholder: {
              type: 'plain_text',
              text: 'e.g., My GitHub Server',
            },
          },
          label: {
            type: 'plain_text',
            text: 'Server Name',
          },
        },
        // Transport type (hidden - always HTTP)
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: '🌐 Transport: HTTP',
            },
          ],
        },
        // URL
        {
          type: 'input',
          block_id: 'url_block',
          element: {
            type: 'plain_text_input',
            action_id: 'url_input',
            placeholder: {
              type: 'plain_text',
              text: 'https://api.example.com/mcp',
            },
          },
          label: {
            type: 'plain_text',
            text: 'Server URL',
          },
          hint: {
            type: 'plain_text',
            text: 'Must be HTTPS. Private network addresses are not allowed.',
          },
        },
        // Auth token
        {
          type: 'input',
          block_id: 'auth_token_block',
          optional: true,
          element: {
            type: 'plain_text_input',
            action_id: 'auth_token_input',
            placeholder: {
              type: 'plain_text',
              text: 'Optional authentication token',
            },
          },
          label: {
            type: 'plain_text',
            text: 'Authentication Token',
          },
          hint: {
            type: 'plain_text',
            text: 'Optional. Will be encrypted before storage.',
          },
        },
        // Skip verification checkbox
        {
          type: 'input',
          block_id: 'skip_verification_block',
          optional: true,
          element: {
            type: 'checkboxes',
            action_id: 'skip_verification_checkbox',
            options: [
              {
                text: {
                  type: 'plain_text',
                  text: 'Skip connection verification (not recommended)',
                },
                value: 'skip',
              },
            ],
          },
          label: {
            type: 'plain_text',
            text: 'Verification Options',
          },
        },
      ],
    };

    await openView(triggerId, view);
  }

  /**
   * Open modal for editing an existing MCP server
   * 
   * @param triggerId The trigger ID for opening the modal
   * @param config The existing configuration to edit
   * 
   * Requirements: 4.4, 10.4
   */
  async openEditModal(triggerId: string, config: MCPConfigOutput): Promise<void> {
    const view = {
      type: 'modal',
      callback_id: 'mcp_edit_modal',
      private_metadata: config.id, // Store config ID for submission
      title: {
        type: 'plain_text',
        text: 'Edit MCP Server',
      },
      submit: {
        type: 'plain_text',
        text: 'Save Changes',
      },
      close: {
        type: 'plain_text',
        text: 'Cancel',
      },
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Editing configuration for *${config.serverName}*`,
          },
        },
        {
          type: 'divider',
        },
        // Server name
        {
          type: 'input',
          block_id: 'server_name_block',
          element: {
            type: 'plain_text_input',
            action_id: 'server_name_input',
            initial_value: config.serverName,
          },
          label: {
            type: 'plain_text',
            text: 'Server Name',
          },
        },
        // Transport type (hidden - always HTTP)
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: '🌐 Transport: HTTP',
            },
          ],
        },
        // URL
        {
          type: 'input',
          block_id: 'url_block',
          element: {
            type: 'plain_text_input',
            action_id: 'url_input',
            initial_value: config.url,
          },
          label: {
            type: 'plain_text',
            text: 'Server URL',
          },
          hint: {
            type: 'plain_text',
            text: 'Must be HTTPS. Private network addresses are not allowed.',
          },
        },
        // Auth token (masked)
        {
          type: 'input',
          block_id: 'auth_token_block',
          optional: true,
          element: {
            type: 'plain_text_input',
            action_id: 'auth_token_input',
            placeholder: {
              type: 'plain_text',
              text: config.authToken ? '••••••••••••' : 'Optional authentication token',
            },
          },
          label: {
            type: 'plain_text',
            text: 'Authentication Token',
          },
          hint: {
            type: 'plain_text',
            text: 'Leave empty to keep existing token. Enter new token to replace.',
          },
        },
      ],
    };

    await openView(triggerId, view);
  }

  /**
   * Handle modal submission for add or edit
   * 
   * @param userId The Slack user ID
   * @param values The form values from the modal
   * @param isEdit Whether this is an edit operation
   * @param configId The configuration ID (for edit operations)
   * @returns Object with success status and optional errors
   * 
   * Requirements: 4.3, 4.4
   */
  async handleModalSubmission(
    userId: string,
    values: Record<string, any>,
    isEdit: boolean,
    configId?: string,
    privateMetadata?: string
  ): Promise<{ success: boolean; errors?: Record<string, string> }> {
    const service = await this.initService();

    try {
      // Parse template defaults from private_metadata (if available)
      let templateDefaults: {
        defaultServerName?: string;
        defaultTransportType?: string;
        defaultUrl?: string;
      } = {};
      
      if (privateMetadata) {
        try {
          templateDefaults = JSON.parse(privateMetadata);
        } catch {
          // Ignore parse errors - privateMetadata might be a config ID for edit modal
        }
      }

      // Extract values from the modal, falling back to template defaults
      // This handles the case where user selects a template but doesn't modify the pre-filled fields
      const serverName = values.server_name_block?.server_name_input?.value || templateDefaults.defaultServerName;
      const transportType = 'http'; // Always use HTTP transport
      const url = values.url_block?.url_input?.value || templateDefaults.defaultUrl;
      const authToken = values.auth_token_block?.auth_token_input?.value;
      const skipVerification = values.skip_verification_block?.skip_verification_checkbox?.selected_options?.length > 0;

      // Validate input
      const validationResult = this.validateModalInput({
        serverName,
        transportType,
        url,
      });

      if (!validationResult.valid) {
        return {
          success: false,
          errors: validationResult.errors,
        };
      }

      // Create or update configuration
      if (isEdit && configId) {
        // Update existing configuration
        const updates: any = {
          serverName,
          transportType,
          url,
        };

        // Only update auth token if a new value was provided
        if (authToken && authToken.trim() !== '') {
          updates.authToken = authToken;
        }

        await service.updateConfiguration(userId, configId, updates);
      } else {
        // Create new configuration
        await service.createConfiguration(userId, {
          serverName,
          transportType,
          url,
          authToken: authToken || undefined,
          skipVerification,
        });
      }

      return { success: true };
    } catch (error) {
      console.error('Error handling modal submission:', error);
      
      // Return error message
      return {
        success: false,
        errors: {
          general: error instanceof Error ? error.message : 'Unknown error occurred',
        },
      };
    }
  }

  /**
   * Validate modal input values
   * 
   * @param values The values to validate
   * @returns Object with validation result and optional errors
   */
  private validateModalInput(
    values: Record<string, any>
  ): { valid: boolean; errors?: Record<string, string> } {
    const errors: Record<string, string> = {};

    if (!values.serverName || values.serverName.trim() === '') {
      errors.server_name_block = 'Server name is required';
    }

    if (!values.url || values.url.trim() === '') {
      errors.url_block = 'Server URL is required';
    }

    if (Object.keys(errors).length > 0) {
      return { valid: false, errors };
    }

    return { valid: true };
  }

  /**
   * Build modal view with template values pre-filled
   * 
   * @param template The template to apply
   * @returns Modal view object for updating
   */
  buildAddModalWithTemplate(template: MCPTemplate): any {
    const templates = getTemplates();

    // Store template defaults in private_metadata as fallback for untouched fields
    const privateMetadata = JSON.stringify({
      templateId: template.id,
      defaultServerName: template.name,
      defaultUrl: template.urlPattern,
    });

    return {
      type: 'modal',
      callback_id: 'mcp_add_modal',
      private_metadata: privateMetadata,
      title: {
        type: 'plain_text',
        text: 'Add MCP Server',
      },
      submit: {
        type: 'plain_text',
        text: 'Add Server',
      },
      close: {
        type: 'plain_text',
        text: 'Cancel',
      },
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Configure a new MCP server connection using the *${template.name}* template.\n\n_${template.description}_`,
          },
        },
        {
          type: 'divider',
        },
        // Template selector (with selected value)
        {
          type: 'input',
          block_id: 'template_block',
          optional: true,
          dispatch_action: true,
          element: {
            type: 'static_select',
            action_id: 'template_select',
            initial_option: {
              text: {
                type: 'plain_text',
                text: template.name,
              },
              value: template.id,
            },
            options: [
              {
                text: {
                  type: 'plain_text',
                  text: '📝 Manual Configuration',
                },
                value: 'manual',
              },
              ...templates.map((t) => ({
                text: {
                  type: 'plain_text',
                  text: t.name,
                },
                value: t.id,
              })),
            ],
          },
          label: {
            type: 'plain_text',
            text: 'Template',
          },
        },
        // Server name (pre-filled with template name)
        {
          type: 'input',
          block_id: 'server_name_block',
          element: {
            type: 'plain_text_input',
            action_id: 'server_name_input',
            initial_value: template.name,
            placeholder: {
              type: 'plain_text',
              text: 'e.g., My GitHub Server',
            },
          },
          label: {
            type: 'plain_text',
            text: 'Server Name',
          },
        },
        // Transport type (hidden - always HTTP)
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: '🌐 Transport: HTTP',
            },
          ],
        },
        // URL (pre-filled from template)
        {
          type: 'input',
          block_id: 'url_block',
          element: {
            type: 'plain_text_input',
            action_id: 'url_input',
            initial_value: template.urlPattern,
            placeholder: {
              type: 'plain_text',
              text: 'https://api.example.com/mcp',
            },
          },
          label: {
            type: 'plain_text',
            text: 'Server URL',
          },
          hint: {
            type: 'plain_text',
            text: 'Must be HTTPS. Private network addresses are not allowed.',
          },
        },
        // Auth token
        {
          type: 'input',
          block_id: 'auth_token_block',
          optional: !template.requiredFields.includes('authToken'),
          element: {
            type: 'plain_text_input',
            action_id: 'auth_token_input',
            placeholder: {
              type: 'plain_text',
              text: template.requiredFields.includes('authToken') 
                ? 'Required authentication token' 
                : 'Optional authentication token',
            },
          },
          label: {
            type: 'plain_text',
            text: 'Authentication Token',
          },
          hint: {
            type: 'plain_text',
            text: template.requiredFields.includes('authToken')
              ? 'Required for this template. Will be encrypted before storage.'
              : 'Optional. Will be encrypted before storage.',
          },
        },
        // Skip verification checkbox
        {
          type: 'input',
          block_id: 'skip_verification_block',
          optional: true,
          element: {
            type: 'checkboxes',
            action_id: 'skip_verification_checkbox',
            options: [
              {
                text: {
                  type: 'plain_text',
                  text: 'Skip connection verification (not recommended)',
                },
                value: 'skip',
              },
            ],
          },
          label: {
            type: 'plain_text',
            text: 'Verification Options',
          },
        },
        // Documentation link
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `📚 <${template.documentation}|View ${template.name} documentation>`,
            },
          ],
        },
      ],
    };
  }

  /**
   * Build modal view for manual configuration (clears template values)
   * 
   * @returns Modal view object for updating
   */
  buildManualConfigModal(): any {
    const templates = getTemplates();

    return {
      type: 'modal',
      callback_id: 'mcp_add_modal',
      title: {
        type: 'plain_text',
        text: 'Add MCP Server',
      },
      submit: {
        type: 'plain_text',
        text: 'Add Server',
      },
      close: {
        type: 'plain_text',
        text: 'Cancel',
      },
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'Configure a new MCP server connection. You can start with a template or configure manually.',
          },
        },
        {
          type: 'divider',
        },
        // Template selector (with Manual selected)
        {
          type: 'input',
          block_id: 'template_block',
          optional: true,
          dispatch_action: true,
          element: {
            type: 'static_select',
            action_id: 'template_select',
            initial_option: {
              text: {
                type: 'plain_text',
                text: '📝 Manual Configuration',
              },
              value: 'manual',
            },
            options: [
              {
                text: {
                  type: 'plain_text',
                  text: '📝 Manual Configuration',
                },
                value: 'manual',
              },
              ...templates.map((t) => ({
                text: {
                  type: 'plain_text',
                  text: t.name,
                },
                value: t.id,
              })),
            ],
          },
          label: {
            type: 'plain_text',
            text: 'Template',
          },
        },
        // Server name (empty)
        {
          type: 'input',
          block_id: 'server_name_block',
          element: {
            type: 'plain_text_input',
            action_id: 'server_name_input',
            placeholder: {
              type: 'plain_text',
              text: 'e.g., My GitHub Server',
            },
          },
          label: {
            type: 'plain_text',
            text: 'Server Name',
          },
        },
        // Transport type (hidden - always HTTP)
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: '🌐 Transport: HTTP',
            },
          ],
        },
        // URL (empty)
        {
          type: 'input',
          block_id: 'url_block',
          element: {
            type: 'plain_text_input',
            action_id: 'url_input',
            placeholder: {
              type: 'plain_text',
              text: 'https://api.example.com/mcp',
            },
          },
          label: {
            type: 'plain_text',
            text: 'Server URL',
          },
          hint: {
            type: 'plain_text',
            text: 'Must be HTTPS. Private network addresses are not allowed.',
          },
        },
        // Auth token (empty)
        {
          type: 'input',
          block_id: 'auth_token_block',
          optional: true,
          element: {
            type: 'plain_text_input',
            action_id: 'auth_token_input',
            placeholder: {
              type: 'plain_text',
              text: 'Optional authentication token',
            },
          },
          label: {
            type: 'plain_text',
            text: 'Authentication Token',
          },
          hint: {
            type: 'plain_text',
            text: 'Optional. Will be encrypted before storage.',
          },
        },
        // Skip verification checkbox
        {
          type: 'input',
          block_id: 'skip_verification_block',
          optional: true,
          element: {
            type: 'checkboxes',
            action_id: 'skip_verification_checkbox',
            options: [
              {
                text: {
                  type: 'plain_text',
                  text: 'Skip connection verification (not recommended)',
                },
                value: 'skip',
              },
            ],
          },
          label: {
            type: 'plain_text',
            text: 'Verification Options',
          },
        },
      ],
    };
  }
}

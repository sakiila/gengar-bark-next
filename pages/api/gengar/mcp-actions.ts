import { NextApiRequest, NextApiResponse } from 'next';
import { MCPAppHomeHandler } from '@/lib/events-handlers/mcp-app-home-opened';
import { MCPModalHandler } from '@/lib/events-handlers/mcp-modal-handler';
import { publishView, updateView, postEphemeralMessage } from '@/lib/slack/gengar-bolt';
import { getTemplateById } from '@/lib/mcp/templates';

/**
 * API route for handling MCP-related Slack interactions
 * 
 * This route handles:
 * - Button clicks from App Home (add, edit, delete, enable, disable, test)
 * - Modal submissions (add/edit configuration)
 * 
 * Note: Request signature verification is handled by the parent interactive.ts handler
 * 
 * Requirements: 4.3, 4.4
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Parse the payload
    const payload = JSON.parse(req.body.payload);
    const type = payload.type;

    console.log('MCP action received:', { type, action: payload.actions?.[0]?.action_id });

    // Handle different interaction types
    if (type === 'block_actions') {
      return await handleBlockActions(payload, res);
    } else if (type === 'view_submission') {
      return await handleViewSubmission(payload, res);
    } else {
      console.warn('Unhandled interaction type:', type);
      return res.status(200).json({});
    }
  } catch (error) {
    console.error('Error handling MCP action:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Handle block actions (button clicks)
 */
async function handleBlockActions(payload: any, res: NextApiResponse) {
  const action = payload.actions[0];
  const actionId = action.action_id;
  const userId = payload.user.id;
  const triggerId = payload.trigger_id;

  const handler = new MCPAppHomeHandler();

  try {
    switch (actionId) {
      case 'mcp_add_server':
        // Open add modal
        await handler.handleAddServerAction(userId, triggerId);
        return res.status(200).json({});

      case 'mcp_edit_server':
        // Open edit modal
        // Config data is embedded in button value to avoid DB query latency
        // This ensures we can open the modal within Slack's 3-second trigger_id limit
        const editConfigData = action.value;
        try {
          await handler.handleEditServerAction(userId, editConfigData, triggerId);
        } catch (err) {
          console.error('Error opening edit modal:', err);
        }
        return res.status(200).json({});

      case 'mcp_delete_server':
        // Delete configuration
        const deleteConfigId = action.value;
        await handler.handleDeleteServerAction(userId, deleteConfigId);
        
        // Refresh App Home
        const deleteView = await handler.renderHome(userId);
        await publishView(userId, deleteView);
        
        return res.status(200).json({});

      case 'mcp_enable_server':
        // Enable configuration
        const enableConfigId = action.value;
        await handler.handleToggleServerAction(userId, enableConfigId, true);
        
        // Refresh App Home
        const enableView = await handler.renderHome(userId);
        await publishView(userId, enableView);
        
        return res.status(200).json({});

      case 'mcp_disable_server':
        // Disable configuration
        const disableConfigId = action.value;
        await handler.handleToggleServerAction(userId, disableConfigId, false);
        
        // Refresh App Home
        const disableView = await handler.renderHome(userId);
        await publishView(userId, disableView);
        
        return res.status(200).json({});

      case 'mcp_test_connection':
        // Test connection
        const testConfigId = action.value;
        const testResult = await handler.handleTestConnectionAction(userId, testConfigId);
        
        // Send ephemeral message with result to the user
        // For App Home interactions, we need to send to the user's DM channel
        await postEphemeralMessage(userId, userId, testResult.message);
        
        // Refresh App Home to update verification status
        const testView = await handler.renderHome(userId);
        await publishView(userId, testView);
        
        return res.status(200).json({});

      case 'mcp_refresh_home':
        // Refresh App Home
        const refreshView = await handler.renderHome(userId);
        await publishView(userId, refreshView);
        
        return res.status(200).json({});

      case 'template_select':
        // Handle template selection - update modal with template values
        const selectedTemplateId = action.selected_option?.value;
        const viewId = payload.view.id;
        
        if (selectedTemplateId && selectedTemplateId !== 'manual') {
          const template = getTemplateById(selectedTemplateId);
          if (template) {
            // Update the modal with template values
            const modalHandler = new MCPModalHandler();
            const updatedView = modalHandler.buildAddModalWithTemplate(template);
            await updateView(viewId, updatedView);
          }
        }
        
        return res.status(200).json({});

      default:
        console.warn('Unhandled action:', actionId);
        return res.status(200).json({});
    }
  } catch (error) {
    console.error('Error handling block action:', error);
    
    // Return error to user
    return res.status(200).json({
      response_action: 'errors',
      errors: {
        general: error instanceof Error ? error.message : 'An error occurred',
      },
    });
  }
}

/**
 * Handle view submissions (modal submissions)
 */
async function handleViewSubmission(payload: any, res: NextApiResponse) {
  const callbackId = payload.view.callback_id;
  const userId = payload.user.id;
  const values = payload.view.state.values;

  const modalHandler = new MCPModalHandler();
  const appHomeHandler = new MCPAppHomeHandler();

  try {
    let result;

    if (callbackId === 'mcp_add_modal') {
      // Handle add modal submission
      result = await modalHandler.handleModalSubmission(userId, values, false);
    } else if (callbackId === 'mcp_edit_modal') {
      // Handle edit modal submission
      const configId = payload.view.private_metadata;
      result = await modalHandler.handleModalSubmission(userId, values, true, configId);
    } else {
      console.warn('Unhandled callback_id:', callbackId);
      return res.status(200).json({});
    }

    if (!result.success) {
      // Return validation errors
      return res.status(200).json({
        response_action: 'errors',
        errors: result.errors,
      });
    }

    // Success - refresh App Home
    const view = await appHomeHandler.renderHome(userId);
    await publishView(userId, view);

    return res.status(200).json({
      response_action: 'clear',
    });
  } catch (error) {
    console.error('Error handling view submission:', error);
    
    // Return error to user
    return res.status(200).json({
      response_action: 'errors',
      errors: {
        general: error instanceof Error ? error.message : 'An error occurred',
      },
    });
  }
}

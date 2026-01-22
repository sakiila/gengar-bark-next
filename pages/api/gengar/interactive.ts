import { NextApiRequest, NextApiResponse } from 'next';
import mcpActionsHandler from './mcp-actions';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  console.log('payload = ', req.body.payload);

  try {
    const payload = JSON.parse(req.body.payload);
    const actionId = payload.actions?.[0]?.action_id || '';
    const callbackId = payload.view?.callback_id || '';

    console.log('Interactive handler:', { actionId, callbackId, type: payload.type });

    // Route MCP-related actions to mcp-actions handler
    // Include template_select which is used in MCP add modal
    if (actionId.startsWith('mcp_') || actionId === 'template_select' || callbackId.startsWith('mcp_')) {
      return await mcpActionsHandler(req, res);
    }

    // Default response for unhandled actions
    res.status(200).send('');
  } catch (error) {
    console.error('Error parsing interactive payload:', error);
    res.status(200).send('');
  }
}


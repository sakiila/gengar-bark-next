import { verifyRequest } from '@/lib/slack/slack';
import { NextApiRequest, NextApiResponse } from 'next';
import mcpList from '@/lib/slash-handlers/mcp-list';
import mcpEnable from '@/lib/slash-handlers/mcp-enable';
import mcpDisable from '@/lib/slash-handlers/mcp-disable';

/**
 * API route handler for MCP slash commands
 * Handles /mcp-list, /mcp-enable, and /mcp-disable commands
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  console.log('mcp command =', req.body);

  // Verify the request is from Slack
  const verification = verifyRequest(req);
  if (!verification.status) {
    return res.status(403).json({
      response_type: 'ephemeral',
      text: 'Nice try buddy. Slack signature mismatch.',
    });
  }

  // Extract command details from request body
  const userId = req.body.user_id;
  const command = req.body.command; // e.g., '/mcp-list', '/mcp-enable', '/mcp-disable'
  const text = req.body.text?.trim() || ''; // Command arguments

  // Route to appropriate handler based on command
  switch (command) {
    case '/mcp-list':
      await mcpList(res, userId);
      break;

    case '/mcp-enable':
      await mcpEnable(res, userId, text);
      break;

    case '/mcp-disable':
      await mcpDisable(res, userId, text);
      break;

    default:
      res.send({
        response_type: 'ephemeral',
        text: `❌ Unknown command: ${command}`,
      });
  }
}

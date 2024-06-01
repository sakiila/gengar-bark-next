import { verifyRequest } from '@/lib/slack';
import { NextApiRequest, NextApiResponse } from 'next';
import { send_gpt_response_in_dm } from '@/lib/events_handlers/chat';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      response_type: 'ephemeral',
      text: 'This endpoint only accepts POST requests',
    });
  }

  const verification = verifyRequest(req);
  if (!verification.status) {
    // verify that the request is coming from the correct Slack team
    return res.status(403).json({
      response_type: 'ephemeral',
      text: 'Nice try buddy. Slack signature mismatch.',
    });
  }

  console.info('req.body = ', req.body);

  await send_gpt_response_in_dm(req, res);
}

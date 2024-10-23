import { verifyRequest, postBoldBlockToChannelId } from '@/lib/slack';
import { NextApiRequest, NextApiResponse } from 'next';

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

  console.info('say req.body = ', req.body);

  const channelId = req.body.channel_id as string;
  const message = req.body.text as string;
  await postBoldBlockToChannelId(channelId, res, message);

  return res.status(200).send('');
}

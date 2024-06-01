import { verifyRequest } from '@/lib/slack';
import { NextApiRequest, NextApiResponse } from 'next';
import { existsCacheThanSet, publishAi } from '@/lib/upstash';

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

  console.info('req.body = ', JSON.stringify(req.body));

  const text = req.body.text;
  const response_url = req.body.response_url;

  const hasSentText = await existsCacheThanSet(text);
  if (hasSentText) {
    return res.status(200).send({
      response_type: 'ephemeral',
      text: 'Already sent text in 2 minutes.',
    });
  }

  await publishAi(text, response_url);

  return res.status(200).send('');
}

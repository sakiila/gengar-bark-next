import { verifyRequest } from '@/lib/slack/slack';
import { NextApiRequest, NextApiResponse } from 'next';
import ciAdd from '@/lib/slash-handlers/ci-add';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  console.log('ci command = ', req.body);

  const verification = verifyRequest(req);
  if (!verification.status) {
    // verify that the request is coming from the correct Slack team
    return res.status(403).json({
      response_type: 'ephemeral',
      text: 'Nice try buddy. Slack signature mismatch.',
    });
  }

  const userId = req.body.user_id;
  const userName = req.body.user_name;
  const channelId = req.body.channel_id;
  const channelName = req.body.channel_name;
  const text = req.body.text;
  const [repository, branch] = text.split(' ');

  await ciAdd(
    res,
    repository,
    branch,
    channelId,
    channelName,
    userId,
    userName,
  );
}

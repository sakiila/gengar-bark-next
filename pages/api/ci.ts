import { verifyRequest, prodChannel, testChannel } from '@/lib/slack';
import { NextApiRequest, NextApiResponse } from 'next';
import watch_add from '@/lib/slash_handlers/watch_add';
import watch_ls from '@/lib/slash_handlers/watch_ls';
import watch_rm from '@/lib/slash_handlers/watch_rm';
import { aw } from '@upstash/redis/zmscore-415f6c9f';
import ci_add from '@/lib/slash_handlers/ci_add';

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
  const text = req.body.event.text;
  const [repository, branch] = text.split(' ');

  await  ci_add(res, repository, branch, channelId, channelName, userId, userName)
}

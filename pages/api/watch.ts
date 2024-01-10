import { verifyRequest, prodChannel, testChannel } from '@/lib/slack';
import { NextApiRequest, NextApiResponse } from 'next';
import watch_add from '@/lib/slash_handlers/watch_add';
import watch_ls from '@/lib/slash_handlers/watch_ls';
import watch_rm from '@/lib/slash_handlers/watch_rm';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  console.log('watch command = ', req.body);

  const verification = verifyRequest(req);
  if (!verification.status) {
    // verify that the request is coming from the correct Slack team
    return res.status(403).json({
      response_type: 'ephemeral',
      text: 'Nice try buddy. Slack signature mismatch.',
    });
  }

  const channelId = req.body.channel_id;
  if (!channelId || (channelId !== prodChannel && channelId !== testChannel)) {
    res.send({
      response_type: 'ephemeral',
      text: 'Wrong usage of the command!',
    });
  }

  const text = req.body.text;
  const [action, ...data] = text.split(' ');

  switch (action) {
    case 'add':
      await watch_add(res, data);
      break;
    case 'ls':
      await watch_ls(res, data);
      break;
    case 'rm':
      await watch_rm(res, data);
      break;
    default:
      res.send({
        response_type: 'ephemeral',
        text: 'Wrong usage of the command!',
      });
  }
}

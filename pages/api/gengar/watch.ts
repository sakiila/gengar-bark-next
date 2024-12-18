import { verifyRequest, prodChannel, testChannel } from '@/lib/slack/slack';
import { NextApiRequest, NextApiResponse } from 'next';
import watchAdd from '@/lib/slash-handlers/watch-add';
import watchLs from '@/lib/slash-handlers/watch-ls';
import watchRm from '@/lib/slash-handlers/watch-rm';

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
      await watchAdd(res, data);
      break;
    case 'ls':
      await watchLs(res, data);
      break;
    case 'rm':
      await watchRm(res, data);
      break;
    default:
      res.send({
        response_type: 'ephemeral',
        text: 'Wrong usage of the command!',
      });
  }
}

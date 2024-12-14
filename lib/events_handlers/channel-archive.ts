import { NextApiRequest, NextApiResponse } from 'next';
import { postToProd } from '@/lib/slack/slack';

export default async function channelArchive(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const event = req.body.event;

  try {
    await postToProd(
      res,
      `:innocent: A channel archived: <#${event.channel}> by <@${event.user}> !`,
    );
  } catch (e) {
    console.log(e);
  }
}

import { NextApiRequest, NextApiResponse } from 'next';
import { postToProd } from '@/lib/slack';

export default async function channel_created(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const event = req.body.event;

  try {
    await postToProd(
      res,
      `:eyes: A new channel created: <#${event.channel.id}> by <@${event.channel.creator}> !`,
    );
  } catch (e) {
    console.log(e);
  }
}

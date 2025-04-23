import { NextApiRequest, NextApiResponse } from 'next';
import { postMessageProdByAnon } from '@/lib/slack/gengar-bolt';

export default async function channelCreated(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const event = req.body.event;

  try {
    const text = `:eyes: A new channel created: <#${event.channel.id}> by <@${event.channel.creator}> !`;
    await postMessageProdByAnon( '', text);
  } catch (e) {
    console.log(e);
  }
}

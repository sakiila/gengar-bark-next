import { NextApiRequest, NextApiResponse } from 'next';
import { postMessageProdByAnon } from '@/lib/slack/gengar-bolt';

export default async function channelArchive(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const event = req.body.event;

  try {
    const text = `:innocent: A channel archived: <#${event.channel}> by <@${event.user}> !`;
    await postMessageProdByAnon( '', text);
  } catch (e) {
    console.log(e);
  }
}

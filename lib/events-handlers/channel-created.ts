import { NextApiRequest, NextApiResponse } from 'next';
import { postMessage, postMessageProdByAnon } from '@/lib/slack/gengar-bolt';
import { postToChannelId } from '@/lib/slack/slack';

export default async function channelCreated(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const event = req.body.event;

  try {
    const text = `:eyes: A new channel created: <#${event.channel.id}> by <@${event.channel.creator}> !`;
    await postMessageProdByAnon( '', text);

    // if channel.name contains 'incident', send it to C08M838EYGL #team-grooming-epd
    if (event.channel.name.toLowerCase().includes('incident-')) {
      const text = `:rotating_light: A new incident channel created: <#${event.channel.id}> !`;
      await postMessage('C08M838EYGL', '', text);
    }

  } catch (e) {
    console.log(e);
  }
}

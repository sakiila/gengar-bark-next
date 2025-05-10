import { NextApiRequest } from 'next';
import { getAddedUserId } from '@/lib/slack/slack';
import { postMessageProdByAnon } from '@/lib/slack/gengar-bolt';

export default async function emojiChanged(
  req: NextApiRequest,
) {
  const event = req.body.event;

  try {
    let text: string = '';
    switch (event.subtype) {
      case 'add':
        const userId = await getAddedUserId(event.name);
        if (userId !== 'unknown') {
          text = `:tada:  ${event.subtype} emoji :${event.name}: (${event.name}) ${event.value} by <@${userId}>`;
          break;
        }
        text = `:tada:  ${event.subtype} emoji :${event.name}: (${event.name}) ${event.value}`;
        break;
      case 'remove':
        text = `:tada:  ${event.subtype} emoji ${event.names}`;
        break;
      case 'rename':
        text = `:tada:  ${event.subtype} emoji :${event.new_name}: (${event.new_name})`;
        break;
    }

    await postMessageProdByAnon( '', text);
  } catch (e) {
    console.log(e);
  }
}

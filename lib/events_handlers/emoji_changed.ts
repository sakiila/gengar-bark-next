import { NextApiRequest, NextApiResponse } from 'next';
import { getAddedUserId, postToProd } from '@/lib/slack';

export default async function emoji_changed(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const event = req.body.event;

  try {
    let text: string = '';
    switch (event.subtype) {
      case 'add':
        const userId = await getAddedUserId(event.name);
        text = `:tada:  ${event.subtype} Emoji :${event.name}: name: ${event.name} pic: ${event.value} user: <@${userId}>`;
        break;
      case 'remove':
        text = `:tada:  ${event.subtype} Emoji ${event.names}`;
        break;
      case 'rename':
        text = `:tada:  ${event.subtype} Emoji :${event.new_name}: name: ${event.new_name}`;
        break;
    }

    await postToProd(res, text);
  } catch (e) {
    console.log(e);
  }
}

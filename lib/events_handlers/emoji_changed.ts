import { NextApiRequest, NextApiResponse } from 'next';
import { postToProd } from '@/lib/slack';

export default async function emoji_changed(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const event = req.body.event;

  try {
    let text: string = '';
    if (event.subtype === 'remove') {
      text = `:tada:  ${event.subtype} Emoji ${event.names}`;
    } else if (event.subtype === 'add') {
      text = `:tada:  ${event.subtype} Emoji :${event.name}: name: ${event.name} pic: ${event.value}`;
    } else if (event.subtype === 'rename') {
      text = `:tada:  ${event.subtype} Emoji :${event.new_name}: name: ${event.new_name}`;
    }

    await postToProd(res, text);
  } catch (e) {
    console.log(e);
  }
}

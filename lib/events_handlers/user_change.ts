import { NextApiRequest, NextApiResponse } from 'next';
import { postToProd } from '@/lib/slack';
import { produceMessage } from '@/lib/upstash';

export default async function user_change(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const user = req.body.event.user;

  try {
    const realName = user.profile.real_name_normalized;
    const id = user.id;
    const isBot = user.is_bot;
    const deleted = user.deleted;

    if (!isBot && deleted) {
      const text = `:smiling_face_with_tear: ${realName} (<@${id}>) has left us.`;
      await postToProd(res, text);
    } else {
      await produceMessage(user);
      res.status(200).send(`user_change ${realName} (<@${id}>) not deleted`);
    }
  } catch (e) {
    console.log(e);
  }
}

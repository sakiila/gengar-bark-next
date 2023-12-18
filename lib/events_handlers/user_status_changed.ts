import { NextApiRequest, NextApiResponse } from 'next';
import { postToProd, postToTest } from '@/lib/slack';
import { postgres } from '@/lib/supabase';

export default async function user_status_changed(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const user = req.body.event.user;

  try {
    const id = user.id;
    const realName = user.real_name;
    const statusEmoji = user.profile.status_emoji;
    const statusText = user.profile.status_text;

    if ('U03FPQWGTN2' === id.toUpperCase()) {
      await postToTest(
        res,
        `:smirk: ${realName} changed status: ${statusEmoji} ${statusText}`,
      );
      return;
    }

    const { data: entity, error } = await postgres
      .from('user_status_whitelist')
      .select('*')
      .eq('member_id', id.toUpperCase());

    if (error) {
      res.status(500).send(error);
      return;
    }

    if (!entity || entity.length === 0) {
      res.status(200).send('');
      return;
    }

    const text = `:partying_face: ${realName} changed status: ${statusEmoji} ${statusText}`;
    await postToProd(res, text);
  } catch (e) {
    console.log(e);
  }
}

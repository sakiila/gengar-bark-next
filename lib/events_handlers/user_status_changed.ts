import { NextApiRequest, NextApiResponse } from 'next';
import { postToProd, postToTest } from '@/lib/slack';
import { postgres } from '@/lib/supabase';
import { getCache, setCacheEx } from '@/lib/upstash';

export default async function user_status_changed(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const user = req.body.event.user;

  try {
    const id = user.id;
    const statusEmoji = user.profile.status_emoji;
    const statusText = user.profile.status_text;
    let statusMessage = `${statusEmoji} ${statusText}`;
    let payload = `:partying_face: <@${id}> changed status: ${statusMessage}`;
    if (statusMessage.trim() === '') {
      payload = `:partying_face: <@${id}> cleared status`;
    }

    if ('U03FPQWGTN2' === id.toUpperCase()) {
      res.status(200).send('');
      // await postToTest(res, payload);
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

    const key = `send.${id}`;
    const value = await getCache(key);
    if (value === id) {
      res.status(200).send('');
    }

    await setCacheEx(key, id, 60);

    await postToProd(res, payload);
  } catch (e) {
    console.log(e);
  }
}

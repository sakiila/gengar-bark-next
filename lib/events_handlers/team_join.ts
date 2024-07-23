import { NextApiRequest, NextApiResponse } from 'next';
import { postToProd } from '@/lib/slack';
import { postgres } from '@/lib/supabase';

export default async function team_join(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const user = req.body.event.user;
  const id = user.id;
  const realName = user.profile.real_name_normalized;
  const email = user.profile.email;
  const tz = user.tz;
  const isBot = user.is_bot;
  const deleted = user.deleted;
  const teamId = user.team_id;

  const { data: dbUser, error } = await postgres
    .from('user')
    .select('*')
    .eq('user_id', id)
    .eq('deleted', false);

  if (dbUser && dbUser.length > 0) {
    res.status(200).send('');
  }

  await postgres.from('user').upsert(
    {
      user_id: id,
      deleted: deleted,
      email: email,
      real_name_normalized: realName,
      updated_at: new Date().toISOString(),
      tz: tz,
      is_bot: isBot,
      team_id: teamId,
    },
    { onConflict: 'user_id' },
  );

  try {
    const text = `:tada: <@${id}> (${realName}) has joined MoeGo!`;
    await postToProd(res, text);
  } catch (e) {
    console.log(e);
  }
}

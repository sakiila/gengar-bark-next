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

  const { data: dbUser, error } = await postgres
    .from('user')
    .select('*')
    .eq('user_id', id);

  if (dbUser && dbUser.length > 0) {
    return res.status(200).send('');
  }

  await postgres.from('user').upsert({
    user_id: id,
    deleted: false,
    email: email,
    real_name_normalized: realName,
    updated_at: new Date().toISOString(),
  });

  try {
    const text = `:tada: <@${id}> (${realName}) join us!`;
    await postToProd(res, text);
  } catch (e) {
    console.log(e);
  }
}

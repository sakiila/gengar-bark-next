import { NextApiRequest, NextApiResponse } from 'next';
import { getUser, getUserByEmail, postgres } from '@/lib/database/supabase';
import { postMessageProdByAnon } from '@/lib/slack/gengar-bolt';
import { getCache, setCacheEx } from '@/lib/upstash/upstash';

export async function teamJoin(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const user = req.body.event.user;
  const id = user.id;
  const realName = user.profile.real_name_normalized;
  const email = user.profile.email;
  const tz = user?.tz ?? 'Asia/Chongqing';
  const isBot = user.is_bot;
  const deleted = user.deleted;
  const teamId = user.team_id;

  const dbUser = await getUser(id);
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
      entry_date: new Date(),
      confirm_date: new Date(
        new Date().setMonth(
          new Date().getMonth() + 3,
        ),
      ),
    },
    { onConflict: 'user_id' },
  );

  try {
    const text = `:tada: <@${id}> (${realName}) has joined MoeGo in :slack: Slack!`;
    await postMessageProdByAnon( '', text);
  } catch (e) {
    console.log(e);
  }
  return res.status(200).send('');
}


export async function teamJoinFeiShu(
  realName: string, email: string,
) {
  const value = await getCache(`feishu-join-${email}`);
  if (value) {
    return;
  }

  let text = `:tada: ${realName} has joined MoeGo team in :feishu: FeiShu!`;

  const user = await getUserByEmail(email);
  if (user && user.length > 0) {
    text = `:tada: <@${user[0].user_id}> (${realName}) has joined MoeGo team in :feishu: FeiShu!`;
  }

  try {
    await postMessageProdByAnon( '', text);
  } catch (e) {
    console.log(e);
    return;
  }

  await setCacheEx(`feishu-join-${email}`, 'true', 60 * 60 * 24)
}


import { NextApiRequest, NextApiResponse } from 'next';
import { getUser, postgres } from '@/lib/database/supabase';
import { postMessageProdByAnon } from '@/lib/slack/gengar-bolt';

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
    const text = `:tada: <@${id}> (${realName}) has joined MoeGo in Slack!`;
    await postMessageProdByAnon( '', text);
  } catch (e) {
    console.log(e);
  }
  return res.status(200).send('');
}


export async function teamJoinFeiShu(
  realName: string,
) {

  try {
    const text = `:tada: ${realName} has joined MoeGo in FeiShu!`;
    await postMessageProdByAnon( '', text);
  } catch (e) {
    console.log(e);
  }
}


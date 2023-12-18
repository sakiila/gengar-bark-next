import { NextApiRequest, NextApiResponse } from 'next';
import { postToProd } from '@/lib/slack';

export default async function team_join(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const user = req.body.event.user;
  const id = user.id;
  const realName = user.profile.real_name_normalized;

  try {
    const text = `:tada: <@${id}> (${realName}) join us!`;
    await postToProd(res, text);
  } catch (e) {
    console.log(e);
  }
}

import { postToChannelId } from '@/lib/slack/slack';
import { NextApiRequest, NextApiResponse } from 'next';
import { postgres } from '@/lib/database/supabase';

export const config = {
  maxDuration: 60,
};

interface User {
  user_id: string;
  real_name_normalized: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      response_type: 'ephemeral',
      text: 'Not allowed',
    });
  }

  const { data: dbUser } = await postgres.rpc('get_birthday_user');
  if (!dbUser || dbUser.length === 0) {
    return res.status(200).send({
      response_type: 'ephemeral',
      text: `No birthday user found.`,
    });
  }

  const text =  ":birthday: Happy birthday to " + dbUser?.map((user: User) => `<@${user.user_id}>`).join(', ').trim() + ".";

  try {
    await postToChannelId('C04BB2RDPQS', res, `${text}`);
  } catch (e) {
    console.log(e);
  }
}

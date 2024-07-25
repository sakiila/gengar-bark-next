import { postToChannelId } from '@/lib/slack';
import { NextApiRequest, NextApiResponse } from 'next';
import { postgres } from '@/lib/supabase';

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
    return '';
  }
  const text =  ":birthday: Happy birthday to " + dbUser?.map((user: User) => `<@${user.user_id}>`).join(', ').trim() + ".";

  if (!text) {
    return res.send({
      response_type: 'ephemeral',
      text: `No birthday user found.`,
    });
  }

  try {
    await postToChannelId('C04BB2RDPQS', res, `${text}`);
  } catch (e) {
    console.log(e);
  }
}

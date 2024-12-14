import { NextApiResponse } from 'next';
import { postgres } from '@/lib/database/supabase';

export default async function ciAdd(
  res: NextApiResponse,
  repository: string,
  branch: string,
  channel: string,
  channelName: string,
  userId: string,
  userName: string,
) {
  const newArr = [
    {
      repository: repository,
      branch: branch,
      channel: channel,
      channel_name: channelName,
      user_id: userId,
      user_name: userName,
    },
  ];

  try {
    await postgres.from('build_watch').insert(newArr).select();

    res.send({
      response_type: 'in_channel',
      text: `Observing success.`,
    });
  } catch (err) {
    console.log('fetch Error:', err);
    res.send({
      response_type: 'ephemeral',
      text: `${err}`,
    });
  }
}

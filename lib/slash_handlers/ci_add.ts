import { NextApiResponse } from 'next';
import { postgres } from '@/lib/supabase';
import { userIdToName } from '@/lib/slack';

export default async function ci_add(
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
    const { data: entity, error } = await postgres
      .from('build_watch')
      .insert(newArr)
      .select();
    console.log('data from fetch:', entity);

    res.send({
      response_type: 'in_channel',
      text: `Watching Successful.`,
    });
  } catch (err) {
    console.log('fetch Error:', err);
    res.send({
      response_type: 'ephemeral',
      text: `${err}`,
    });
  }
}

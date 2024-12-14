import { NextApiResponse } from 'next';
import { postgres } from '@/lib/database/supabase';
import { userIdToName } from '@/lib/slack/slack';

export default async function watchAdd(
  res: NextApiResponse,
  commandArray: string[],
) {
  const { data: entities, error } = await postgres
    .from('user_status_whitelist')
    .select('*');

  const newArr = (
    await Promise.all(
      commandArray.map(async (item, index) => {
        const name = await userIdToName(item);
        return { member_id: item, member_name: name };
      }),
    )
  ).filter((item) =>
    item !== undefined && item.member_name !== 'unknown' && entities
      ? !entities.find((entity) => entity.member_id === item.member_id)
      : true,
  );

  if (newArr.length === 0) {
    res.send({
      response_type: 'ephemeral',
      text: `No new members added.`,
    });
    return;
  }

  let value = '';
  for (let i = 0; i < newArr.length; i++) {
    const memberId = newArr[i]?.member_id;
    const memberName = newArr[i]?.member_name;
    if (memberId && memberName) {
      value += `${memberId} (${memberName}) `;
    }
  }

  try {
    const { data: entity, error } = await postgres
      .from('user_status_whitelist')
      .insert(newArr)
      .select();
    console.log('data from fetch:', entity);

    res.send({
      response_type: 'in_channel',
      text: `Watch added ${value}.`,
    });
  } catch (err) {
    console.log('fetch Error:', err);
    res.send({
      response_type: 'ephemeral',
      text: `${err}`,
    });
  }
}

import { postgres } from '@/lib/database/supabase';
import { NextApiResponse } from 'next';

export default async function watchRm(
  res: NextApiResponse,
  commandArray: string[],
) {
  const { data: entities, error } = await postgres
    .from('user_status_whitelist')
    .select('*');
  if (!entities || error) {
    res.send({
      response_type: 'ephemeral',
      text: `No valid members found.`,
    });
    return;
  }

  const newArr = commandArray
    .map((item, index) => {
      return item.toUpperCase();
    })
    .filter((item) =>
      item !== undefined && entities
        ? entities.some((entity) => entity.member_id === item)
        : false,
    );

  if (newArr.length === 0) {
    res.send({
      response_type: 'ephemeral',
      text: `No valid members found.`,
    });
    return;
  }

  let value = '';
  for (let i = 0; i < newArr.length; i++) {
    value += `${newArr[i]} (${
      entities.find((member) => member.member_id === newArr[i]).member_name
    }) `;
  }

  try {
    for (const item of newArr) {
      console.log('item:', item);
      const { error: err } = await postgres
        .from('user_status_whitelist')
        .delete()
        .eq('member_id', item);
      if (err) {
        console.log('delete Error:', err);
        res.send({
          response_type: 'ephemeral',
          text: `${err}`,
        });
      }
    }

    res.send({
      response_type: 'in_channel',
      text: `Watch removed ${value}.`,
    });
  } catch (err) {
    console.log('fetch Error:', err);
    res.send({
      response_type: 'ephemeral',
      text: `${err}`,
    });
  }
}

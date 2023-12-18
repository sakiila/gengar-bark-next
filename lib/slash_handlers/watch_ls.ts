import { postgres } from '@/lib/supabase';
import { NextApiResponse } from 'next';

export default async function watch_ls(
  res: NextApiResponse,
  commandArray: string[],
) {
  try {
    const { data: entities, error } = await postgres
      .from('user_status_whitelist')
      .select('*')
      .order('id', { ascending: true });

    if (!entities || error) {
      res.send({
        response_type: 'ephemeral',
        text: `No valid members found.`,
      });
      return;
    }

    console.log('data from fetch:', entities);

    let text = '';
    entities.forEach((item, index) => {
      text +=
        index +
        1 +
        '. ' +
        item.member_name +
        ' (' +
        `<@${item.member_id}>` +
        ')\n';
    });

    res.send({
      response_type: 'in_channel',
      text: `Watch list result: \n${text}`,
    });
  } catch (err) {
    console.log('fetch Error:', err);
    res.send({
      response_type: 'ephemeral',
      text: `${err}`,
    });
  }
}

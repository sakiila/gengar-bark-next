import { postToProd } from '@/lib/slack';
import { NextApiRequest, NextApiResponse } from 'next';
import { postgres } from '@/lib/supabase';
import { ChatCompletionMessageParam } from 'openai/resources';
import { getGPTResponse3 } from '@/lib/openai';

export const config = {
  maxDuration: 30,
};

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

  const isHoliday = await todayIsHoliday();
  if (isHoliday) {
    res.send({
      response_type: 'ephemeral',
      text: `Today is holiday.`,
    });
    return;
  }

  let { data: users, error: userError } = await postgres
    .from('user_wealth')
    .select('*');

  if (!users || userError) {
    res.send({
      response_type: 'ephemeral',
      text: `No valid user found.`,
    });
    return;
  }

  let num = Math.floor(Math.random() * users.length) + 1;
  const shuffled = users.sort(() => 0.5 - Math.random());
  const at = shuffled
    .slice(0, num)
    .map((user) => `<@${user.member_id}>`)
    .join(' ');

  let { data: entities, error: entityError } = await postgres
    .from('random_conversation_template')
    .select('*')
    .limit(1);

  if (!entities || entityError) {
    res.send({
      response_type: 'ephemeral',
      text: `No valid template found.`,
    });
    return;
  }

  const prompts: ChatCompletionMessageParam[] = [
    {
      role: 'assistant',
      content: String(entities[0].template),
    },
  ];

  const gptResponse = await getGPTResponse3(prompts);
  console.log('gptResponse:', JSON.stringify(gptResponse));

  try {
    await postToProd(res, `${at} ${gptResponse.choices[0].message.content}`);
  } catch (e) {
    console.log(e);
  }
}

async function todayIsHoliday() {
  const dateString = new Date().toISOString().split('T')[0];
  const url = `https://api.haoshenqi.top/holiday?date=${dateString}`;

  try {
    const response = await fetch(url);

    const data = await response.json();

    console.log('data:', data);

    return data[0].status == 1 || data[0].status == 3;
  } catch (error) {
    console.error('Fetch error:', error);
    return false;
  }
}

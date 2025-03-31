import { NextApiRequest, NextApiResponse } from 'next';
import { setStatus, threadReply } from '@/lib/slack/hr-bolt';
import { logger } from '@/lib/utils/logger';
import { getUser } from '@/lib/database/supabase';
import { askCNQuestion } from '@/lib/ai/maxkb-cn';
import { askUSQuestion } from '@/lib/ai/maxkb-us';

export async function response_policy(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const userId = req.body.event.user;
  const channelId = req.body.event.channel;
  const threadTs = req.body.event.thread_ts ?? req.body.event.ts;
  const text: string = req.body.event.text;

  console.log('text:', text);

  res.status(200).send('');

  try {
    await setStatus(channelId, threadTs);
  } catch (error) {
    logger.error('send_gpt_response_in_channel', error instanceof Error ? error : new Error('Unknown error'));
  }

  let country = 'CN';
  const dbUser = await getUser(userId);
  if (dbUser && Array.isArray(dbUser) && dbUser.length > 0 && dbUser[0].country) {
    country = dbUser[0].country;
  }

  const answer = country.toUpperCase().trim() == 'CN' ? await askCNQuestion(text) : await askUSQuestion(text);

  const realAnswer = processString(answer);

  console.log('answer:', JSON.stringify(answer));
  console.log('realAnswer:', JSON.stringify(realAnswer));

  try {
    await threadReply(
      channelId,
      threadTs,
      `${realAnswer}`,
    );
  } catch (error) {
    logger.error('send_gpt_response_in_channel', error instanceof Error ? error : new Error('Unknown error'));
  }
}

function processString(answer: string): string {
  // Step 1: Replace image patterns like ![](/api/image/abc) with https://amber.baobo.me/api/image/abc
  let processed = answer.replace(/!\[]\(\/api\/image\/([^)]+)\)/g, '<https://amber.baobo.me/api/image/$1|点击查看图片>');

  // Step 2: Replace link patterns like [123](https://mengshikeji.feishu.cn/wiki/abc) with <123|https://mengshikeji.feishu.cn/wiki/abc>
  processed = processed.replace(/\[([^\]]+)]\(([^)]+)\)/g, '<$2|$1>');

  return processed;
}

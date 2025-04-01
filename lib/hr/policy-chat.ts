import { NextApiRequest, NextApiResponse } from 'next';
import { setStatus, setSuggestedPrompts, threadReply } from '@/lib/slack/hr-bolt';
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
  const isCN = country.toUpperCase().trim() == 'CN';

  const answer = isCN ? await askCNQuestion(text) : await askUSQuestion(text);

  if (answer.includes('<quick_question>')) {
    try {
      await threadReply(
        channelId,
        threadTs,
        isCN ? '没有找到相关信息，请您重新描述问题。' : 'Sorry, I cannot find the relevant information. Please describe your question again.',
      );
      await setSuggestedPrompts(
        channelId,
        threadTs,
        extractQuickQuestions(answer),
        isCN,
      );
    } catch (error) {
      logger.error('send_gpt_response_in_channel', error instanceof Error ? error : new Error('Unknown error'));
    }
    return;
  }

  const realAnswer = processString(answer);

  // console.log('answer:', JSON.stringify(answer));
  // console.log('realAnswer:', JSON.stringify(realAnswer));

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

function extractQuickQuestions(input: string): string[] {
  // 使用正则表达式匹配所有<quick_question>标签内的内容
  const regex = /<quick_question>(.*?)<\/quick_question>/g;
  const matches = [];
  let match;

  while ((match = regex.exec(input)) !== null) {
    // 获取匹配到的内容（即标签内的文本）
    let questionText = match[1];

    // 去除前缀数字和点以及可能的空格
    questionText = questionText.replace(/^\d+\.\s*/, '');

    matches.push(questionText);
  }

  return matches;
}

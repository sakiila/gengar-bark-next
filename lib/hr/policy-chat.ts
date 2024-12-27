import { NextApiRequest, NextApiResponse } from 'next';
import { setStatus, threadReply } from '@/lib/slack/hr-bolt';
import { logger } from '@/lib/utils/logger';
import { askQuestion } from '@/lib/ai/maxkb';

export async function response_policy(
  req: NextApiRequest,
  res: NextApiResponse,
) {
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

  // const thread = await getThreadReply(channelId, threadTs);
  // const prompts = await generatePromptFromThread(thread);
  const answer = await askQuestion(text);

  console.log("answer:", JSON.stringify(answer));

  try {
    await threadReply(
      channelId,
      threadTs,
      `${answer}`,
    );
  } catch (error) {
    logger.error('send_gpt_response_in_channel', error instanceof Error ? error : new Error('Unknown error'));
  }
}

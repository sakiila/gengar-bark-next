import { NextApiRequest, NextApiResponse } from 'next';
import { getThreadReplies, setDefaultSuggestedPrompts, setStatus, threadReply } from '@/lib/slack/hr-bolt';
import { logger } from '@/lib/utils/logger';
import { HumanCommand, MaxKbCommand } from '@/lib/commands/hr-commands';
import { postgres } from '@/lib/database/supabase';

export async function response_policy(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const userId = req.body.event.user;
  // const userName = req.body.event.user_name;
  const channel = req.body.event.channel;
  const ts = req.body.event.thread_ts ?? req.body.event.ts;
  const text: string = req.body.event.text;

  console.log('text:', text);

  res.status(200).send('');

  const commands = [
    new HumanCommand(channel, ts, userId),
    new MaxKbCommand(channel, ts, userId), // always the last command to avoid conflicts with other commands
  ];

  try {
    for (const command of commands) {
      if (command.matches(text)) {
        await command.execute(text);
        break;
      }
    }
  } catch (error) {
    logger.error('send_response', error instanceof Error ? error : new Error('Unknown error'));
  }
}

export async function set_suggested_prompts(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const channelId = req.body.event.assistant_thread.channel_id;
  const thread_ts = req.body.event.assistant_thread.thread_ts;
  try {
    await setDefaultSuggestedPrompts(channelId, thread_ts);
    return res.status(200).send('');
  } catch (error) {
    logger.error('send_response', error instanceof Error ? error : new Error('Unknown error'));
  }
}

export async function response_human_service(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // const userId = req.body.event.user;
  // const userName = req.body.event.user_name;
  const channel = req.body.event.channel;
  const ts = req.body.event.thread_ts ?? req.body.event.ts;
  const text: string = req.body.event.text;

  console.log('text:', text);

  res.status(200).send('');

  // 只移除消息最前面的 Slack 用户 ID（例如 <@U0666R94C83>）
  const realText = text.replace(/^<@[A-Z0-9]+>\s*/, '');

  const messages = await getThreadReplies(channel, ts);
  if (!messages || messages.length === 0) {
    throw new Error('No messages found');
  }

  const firstBotTs = messages.map((message: any) => {
    return message.metadata?.event_payload?.first_ts;
  });

  if (firstBotTs) {
    const { data: record } = await postgres.from('hr_human_service')
    .select('*')
    .eq('bot_timestamp', firstBotTs[0]);

    if (!record || record.length === 0) {
      throw new Error('No record found');
    }

    const targetUserId = record[0].user_id;
    const targetTimestamp = record[0].bot_timestamp;
    await threadReply(targetUserId as string, targetTimestamp as string, `<@${targetUserId}> ${realText}`);
    return;
  }

}

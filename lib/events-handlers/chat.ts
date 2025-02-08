import { NextApiRequest, NextApiResponse } from 'next';
import {
  getThreadReply,
  setStatus,
  setSuggestedPrompts,
  threadReply,
} from '@/lib/slack/slack';
import { generatePromptFromThread, getGPT4 } from '@/lib/ai/openai';
import { existsCacheThanSet } from '@/lib/upstash/upstash';
import { execute_moego } from '@/lib/moego/moego';
import { execute_build } from '@/lib/jenkins/build';
import { logger } from '@/lib/utils/logger';
import { extractId, IdType } from '@/lib/utils/id-utils';
import { sendAppointmentToSlack, sendOrderToSlack } from '@/lib/database/services/appointment-slack';
import { CommandContext } from '../commands/command';
import { IdCommand, CreateAppointmentCommand, GptCommand } from '../commands/commands';

/**
 * Send GPT response to the channel
 * Do not support 'message' event type because it will be triggered by every message
 * @param req
 * @param res
 */
export async function send_gpt_response_in_channel(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const channel = req.body.event.channel;
  const ts = req.body.event.thread_ts ?? req.body.event.ts;
  let text: string = req.body.event.text;
  const userId = req.body.event.user;

  // 只移除消息最前面的 Slack 用户 ID（例如 <@U0666R94C83>）
  text = text.replace(/^<@[A-Z0-9]+>\s*/, '');

  // check if the text has been sent in the last 2 minutes
  let cacheKey = text + ":" + ts;
  const hasSentText = await existsCacheThanSet(cacheKey);
  if (hasSentText) {
    logger.info('Already sent same text in 2 minutes:', { text });
    return res.status(200).send('Already sent same text in 2 minutes.');
  }


  const commands = [
    new IdCommand(channel, ts, userId),
    new CreateAppointmentCommand(channel, ts, userId),
    new GptCommand(channel, ts),
  ];

  try {
    for (const command of commands) {
      if (command.matches(text)) {
        await command.execute(text);
        break;
      }
    }
    return res.status(200).send('');
  } catch (error) {
    logger.error('send_gpt_response_in_channel', error instanceof Error ? error : new Error('Unknown error'));
    return res.status(500).send('Internal Server Error');
  }
}

export async function set_suggested_prompts(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const channelId = req.body.event.assistant_thread.channel_id;
  const thread_ts = req.body.event.assistant_thread.thread_ts;

  // console.log("channelId:", channelId);
  // console.log("thread_ts:", thread_ts);

  try {
    await setSuggestedPrompts(res, channelId, thread_ts);
    // return res.send({
    //   response_type: 'in_channel',
    //   text: `${gptResponse.choices[0].message.content}`,
    // });
    return res.status(200).send('');
  } catch (error) {
    logger.error('send_gpt_response_in_channel', error instanceof Error ? error : new Error('Unknown error'));
  }
}

export async function set_status(req: NextApiRequest, res: NextApiResponse) {
  const channelId = req.body.event.assistant_thread.channel_id;
  const thread_ts = req.body.event.assistant_thread.thread_ts;

  // console.log("channelId:", channelId);
  // console.log("thread_ts:", thread_ts);

  try {
    await setStatus(res, channelId, thread_ts);
    // return res.send({
    //   response_type: 'in_channel',
    //   text: `${gptResponse.choices[0].message.content}`,
    // });
    return res.status(200).send('');
  } catch (error) {
    logger.error('send_gpt_response_in_channel', error instanceof Error ? error : new Error('Unknown error'));
  }
}

export async function response_container(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const channelId = req.body.event.channel;
  const threadTs = req.body.event.thread_ts ?? req.body.event.ts;
  const text: string = req.body.event.text;

  // console.log("channelId:", channelId);
  // console.log("threadTs:", threadTs);
  // console.log("text:", text);

  try {
    await setStatus(res, channelId, threadTs);
  } catch (error) {
    logger.error('send_gpt_response_in_channel', error instanceof Error ? error : new Error('Unknown error'));
  }

  await send_gpt_response_in_channel(req, res);
}

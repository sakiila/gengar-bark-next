import { NextApiRequest, NextApiResponse } from 'next';
import { setStatus } from '@/lib/slack/slack';
import { existsCacheThanSet } from '@/lib/upstash/upstash';
import { logger } from '@/lib/utils/logger';
import {
  CiCommand,
  CreateAppointmentCommand,
  GptCommand,
  HelpCommand,
  IdCommand,
  JiraCommand,
} from '../commands/gengar-commands';
import { setDefaultSuggestedPrompts } from '@/lib/slack/gengar-bolt';

/**
 * Send GPT response to the channel
 * Do not support 'message' event type because it will be triggered by every message
 * @param req
 * @param res
 */
export async function send_response(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const channel = req.body.event.channel;
  const ts = req.body.event.thread_ts ?? req.body.event.ts;
  let text: string = req.body.event.text;
  const userId = req.body.event.user;
  const userName = req.body.event.user_name;
  const channelName = req.body.event.channel_name;

  // 只移除消息最前面的 Slack 用户 ID（例如 <@U0666R94C83>）
  text = text.replace(/^<@[A-Z0-9]+>\s*/, '');

  // check if the text has been sent in the last 2 minutes
  const key = `${userId}-${channel}-${ts}-${text}`;
  const hasSentText = await existsCacheThanSet(key);
  if (hasSentText) {
    logger.info('Already sent same text in 2 minutes:', { text });
    // await postMessage(channel, ts, 'Please wait for 2 minutes and try again.');
    return res.status(200).send('Already sent same text in 2 minutes.');
  }

  const commands = [
    new HelpCommand(channel, ts),
    new IdCommand(channel, ts, userId),
    new JiraCommand(channel, ts, userId),
    new CiCommand(ts, userId, userName, channel, channelName),
    new CreateAppointmentCommand(channel, ts, userId),
    new GptCommand(channel, ts), // always the last command to avoid conflicts with other commands
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
    logger.error('send_response', error instanceof Error ? error : new Error('Unknown error'));
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
    await setDefaultSuggestedPrompts(channelId, thread_ts);
    // return res.send({
    //   response_type: 'in_channel',
    //   text: `${gptResponse.choices[0].message.content}`,
    // });
    return res.status(200).send('');
  } catch (error) {
    logger.error('send_response', error instanceof Error ? error : new Error('Unknown error'));
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
    logger.error('send_response', error instanceof Error ? error : new Error('Unknown error'));
  }
}

export async function response_container(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const channelId = req.body.event.channel;
  const threadTs = req.body.event.thread_ts ?? req.body.event.ts;

  // console.log("channelId:", channelId);
  // console.log("threadTs:", threadTs);
  // console.log("text:", text);

  try {
    await setStatus(res, channelId, threadTs);
  } catch (error) {
    logger.error('send_response', error instanceof Error ? error : new Error('Unknown error'));
  }

  await send_response(req, res);
}

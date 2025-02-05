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
import { sendAppointmentToSlack } from '@/lib/database/services/appointment-slack';

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
  const channel = req.body.event.channel; // channel the message was sent in
  const ts = req.body.event.thread_ts ?? req.body.event.ts; // message timestamp
  let text: string = req.body.event.text;
  const userId = req.body.event.user;

  // 只移除消息最前面的 Slack 用户 ID（例如 <@U0666R94C83>）
  text = text.replace(/^<@[A-Z0-9]+>\s*/, '');

  // check if the text has been sent in the last 2 minutes
  const hasSentText = await existsCacheThanSet(text);
  if (hasSentText) {
    logger.info('Already sent same text in 2 minutes:', { text });
    return res.status(200).send('Already sent same text in 2 minutes.');
  }

  const id = extractId(text);
  if (id.type === IdType.APPOINTMENT) {
    await sendAppointmentToSlack(parseInt(id.value), userId,channel, ts);
    return res.status(200).send('');
  } else if (id.type === IdType.ORDER) {
    await sendOrderToSlack(parseInt(id.value), userId, channel, ts);
    return res.status(200).send('');
  }

  // if (text.trim().startsWith('build')) {
  //   await execute_build(req, res);
  //   return;
  // }

  // create appointment
  const regex = /预约|appointment|appt/i;
  if (text.trim().toLowerCase().startsWith('create') && regex.test(text)) {
    await execute_moego(req, res);
    return;
  }

  const thread = await getThreadReply(channel, ts);

  const prompts = await generatePromptFromThread(thread);
  const gptResponse = await getGPT4(prompts);

  try {
    await threadReply(
      channel,
      ts,
      res,
      `${gptResponse.choices[0].message.content}`,
    );
  } catch (error) {
    logger.error('send_gpt_response_in_channel', error instanceof Error ? error : new Error('Unknown error'));
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

  const regex = /预约|appointment|appt/i;
  if (text.trim().toLowerCase().startsWith('create') && regex.test(text)) {
    await execute_moego(req, res);
    return;
  }

  const thread = await getThreadReply(channelId, threadTs);

  const prompts = await generatePromptFromThread(thread);
  const gptResponse = await getGPT4(prompts);

  // console.log("gptResponse:", JSON.stringify(gptResponse));

  try {
    await threadReply(
      channelId,
      threadTs,
      res,
      `${gptResponse.choices[0].message.content}`,
    );
  } catch (error) {
    logger.error('send_gpt_response_in_channel', error instanceof Error ? error : new Error('Unknown error'));
  }
}

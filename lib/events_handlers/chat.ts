import { NextApiRequest, NextApiResponse } from "next";
import {
  getThreadReply,
  setStatus,
  setSuggestedPrompts,
  threadReply,
} from "@/lib/slack";
import { generatePromptFromThread, getGPT4 } from "@/lib/openai";
import { existsCacheThanSet } from "@/lib/upstash";
import { execute_moego } from "@/lib/moego/moego";
import { execute_build } from "@/lib/ci/build";
import { logger } from '@/lib/logger';

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
  const text: string = req.body.event.text;

  const notResponse = text.includes("pearl.baobo.me");
  if (notResponse) {
    logger.info("Not response to pearl.baobo.me:");
    return res.status(200).send("");
  }

  const hasSentText = await existsCacheThanSet(text);
  if (hasSentText) {
    logger.info("Already sent same text in 2 minutes:", { text });
    return res.status(200).send("Already sent same text in 2 minutes.");
  }

  if (text.trim().startsWith("<@U0666R94C83> build")) {
    await execute_build(req, res);
    return;
  }

  const regex = /预约|appointment|appt/i;
  if (text.trim().toLowerCase().startsWith("<@u0666r94c83> create") && regex.test(text)) {
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
    logger.error("send_gpt_response_in_channel", error instanceof Error ? error : new Error('Unknown error'));
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
    return res.status(200).send("");
  } catch (error) {
    logger.error("send_gpt_response_in_channel", error instanceof Error ? error : new Error('Unknown error'));
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
    return res.status(200).send("");
  } catch (error) {
    logger.error("send_gpt_response_in_channel", error instanceof Error ? error : new Error('Unknown error'));
  }
}

export async function response_container(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const channelId = req.body.event.channel;
  const threadTs = req.body.event.thread_ts ?? req.body.event.ts;
  const text: string  = req.body.event.text;

  // console.log("channelId:", channelId);
  // console.log("threadTs:", threadTs);
  // console.log("text:", text);

  try {
    await setStatus(res, channelId, threadTs);
  } catch (error) {
    logger.error("send_gpt_response_in_channel", error instanceof Error ? error : new Error('Unknown error'));
  }

  const regex = /预约|appointment|appt/i;
  if (text.trim().toLowerCase().startsWith("create") && regex.test(text)) {
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
    logger.error("send_gpt_response_in_channel", error instanceof Error ? error : new Error('Unknown error'));
  }
}

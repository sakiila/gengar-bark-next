import { NextApiRequest, NextApiResponse } from 'next';
import {
  getThreadReply,
  responseUrl, setStatus,
  setSuggestedPrompts,
  threadReply,
} from '@/lib/slack';
import { generatePromptFromThread, getGPT4 } from '@/lib/openai';
import { existsCacheThanSet } from '@/lib/upstash';

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
  const text = req.body.event.text;

  const hasSentText = await existsCacheThanSet(text);
  if (hasSentText) {
    console.log('Already sent same text in 2 minutes:', text);
    return res.status(200).send('Already sent same text in 2 minutes.');
  }

  const thread = await getThreadReply(channel, ts);

  const prompts = await generatePromptFromThread(thread);
  const gptResponse = await getGPT4(prompts);

  console.log('gptResponse:', gptResponse);

  try {
    await threadReply(
      channel,
      ts,
      res,
      `${gptResponse.choices[0].message.content}`,
    );
  } catch (e) {
    console.log(e);
  }
}

export async function set_suggested_prompts(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const channelId = req.body.event.channel;
  const thread_ts = req.body.event.thread_ts;

  console.log("channelId:", channelId);
  console.log('thread_ts:', thread_ts);

  try {
    await setSuggestedPrompts(res, channelId, thread_ts);
    // return res.send({
    //   response_type: 'in_channel',
    //   text: `${gptResponse.choices[0].message.content}`,
    // });
    return res.status(200).send('');
  } catch (e) {
    console.log(e);
  }
}


export async function set_status(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const channelId = req.body.event.channel;
  const thread_ts = req.body.event.thread_ts;

  console.log("channelId:", channelId);
  console.log('thread_ts:', thread_ts);

  try {
    await setStatus(res, channelId, thread_ts);
    // return res.send({
    //   response_type: 'in_channel',
    //   text: `${gptResponse.choices[0].message.content}`,
    // });
    return res.status(200).send('');
  } catch (e) {
    console.log(e);
  }
}


export async function send_gpt_response(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const channel = req.body.event.channel; // channel the message was sent in
  const ts = req.body.event.thread_ts ?? req.body.event.ts; // message timestamp
  const text = req.body.event.text;

  // const hasSentText = await existsCacheThanSet(text);
  // if (hasSentText) {
  //   console.log('Already sent same text in 2 minutes:', text);
  //   return res.status(200).send('Already sent same text in 2 minutes.');
  // }

  const thread = await getThreadReply(channel, ts);

  const prompts = await generatePromptFromThread(thread);
  const gptResponse = await getGPT4(prompts);

  console.log('gptResponse:', JSON.stringify(gptResponse));

  try {
    await threadReply(
      channel,
      ts,
      res,
      `${gptResponse.choices[0].message.content}`,
    );
  } catch (e) {
    console.log(e);
  }
}

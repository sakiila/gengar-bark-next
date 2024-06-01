import { NextApiRequest, NextApiResponse } from 'next';
import { getThreadReply, threadReply } from '@/lib/slack';
import { generatePromptFromThread, getGPTResponse4 } from '@/lib/openai';
import { existsCacheThanSet } from '@/lib/upstash';

/**
 * Send GPT response to the channel
 * Do not support 'message' event type because it will be triggered by every message
 * @param req
 * @param res
 */
export default async function send_gpt_response(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const channel = req.body.event.channel; // channel the message was sent in
  const ts = req.body.event.ts; // message timestamp
  const text = req.body.event.text;

  const hasSentText = await existsCacheThanSet(text);
  if (hasSentText) {
    console.log('Already sent text:', text);
    return res.status(200).send('');
  }

  const thread = await getThreadReply(channel, ts);

  const prompts = await generatePromptFromThread(thread);
  const gptResponse = await getGPTResponse4(prompts);

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

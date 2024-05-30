import { NextApiRequest, NextApiResponse } from 'next';
import { getThreadReply, threadReply } from '@/lib/slack';
import { generatePromptFromThread, getGPTResponse } from '@/lib/openai';

export default async function send_gpt_response(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const channel = req.body.event.channel; // channel the message was sent in
  const ts = req.body.event.message_ts; // message timestamp

  const thread = await getThreadReply(channel, ts);

  const prompts = await generatePromptFromThread(thread);
  const gptResponse = await getGPTResponse(prompts);

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
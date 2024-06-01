import { NextApiRequest, NextApiResponse } from 'next';
import { getThreadReply, responseUrl, threadReply } from '@/lib/slack';
import { generatePromptFromThread, getGPTResponse4 } from '@/lib/openai';
import { existsCacheThanSet } from '@/lib/upstash';
import { ChatCompletionMessageParam } from 'openai/resources';

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
  const ts = req.body.event.ts; // message timestamp
  const text = req.body.event.text;

  const hasSentText = await existsCacheThanSet(text);
  if (hasSentText) {
    console.log('Already sent text:', text);
    return res.status(200).send('Already sent text in 2 minutes.');
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

export async function send_gpt_response_in_dm(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const text = req.body.text;
  const response_url = req.body.response_url;

  const hasSentText = await existsCacheThanSet(text);
  if (hasSentText) {
    return res.status(200).send({
      response_type: 'ephemeral',
      text: 'Already sent text in 2 minutes.',
    });
  }

  const prompts: ChatCompletionMessageParam[] = [
    {
      role: 'assistant',
      content: String(text),
    },
  ];

  const gptResponse = await getGPTResponse4(prompts);

  console.log('gptResponse:', gptResponse);

  try {
   await responseUrl(response_url, `${gptResponse.choices[0].message.content}`);
    // return res.send({
    //   response_type: 'in_channel',
    //   text: `${gptResponse.choices[0].message.content}`,
    // });
    return res.status(200).send('');
  } catch (e) {
    console.log(e);
  }
}

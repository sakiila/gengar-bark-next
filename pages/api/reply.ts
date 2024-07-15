import { responseUrl } from '@/lib/slack';
import { NextApiRequest, NextApiResponse } from 'next';
import { ChatCompletionMessageParam } from 'openai/resources';
import { getGPTResponse4 } from '@/lib/openai';

export const config = {
  maxDuration: 30,
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // if (req.method !== 'POST') {
  //   return res.status(405).json({
  //     response_type: 'ephemeral',
  //     text: 'This endpoint only accepts POST requests',
  //   });
  // }
  // const {
  //   'upstash-signature': upstash_signature,
  // } = req.headers as {
  //   [key: string]: string;
  // };
  //
  // console.log('upstash_signature:', upstash_signature);

  // const valid = await isValid(upstash_signature, req.body);
  // if (!valid) {
  //   return res.status(403).json({
  //     response_type: 'ephemeral',
  //     text: 'Nice try buddy. Upstash signature mismatch.',
  //   });
  // }

  console.info('req.body = ', JSON.stringify(req.body));

  // const hasSentText = await existsCacheThanSet(String(req.body.text));
  // if (hasSentText) {
  //   return res.status(200).send({
  //     response_type: 'ephemeral',
  //     text: 'Already sent same text in 2 minutes.',
  //   });
  // }

  const prompts: ChatCompletionMessageParam[] = [
    {
      role: 'assistant',
    },
  ];

  switch (req.body.type) {
    case 'ai':
      prompts[0].content = String(req.body.text);
      break;
    case 'bob':
      prompts[0].content = process.env.BOB_PROMT + String(req.body.text);
      break;
  }

  const gptResponse = await getGPTResponse4(prompts);

  console.log('gptResponse:', `${gptResponse.choices[0].message.content}`);

  try {
    await responseUrl(
      req.body.url,
      `${gptResponse.choices[0].message.content}`,
    );
    // return res.send({
    //   response_type: 'in_channel',
    //   text: `${gptResponse.choices[0].message.content}`,
    // });
    return res.status(200).send('');
  } catch (e) {
    console.log(e);
  }
}

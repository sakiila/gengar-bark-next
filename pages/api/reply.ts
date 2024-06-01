import { responseUrl } from '@/lib/slack';
import { NextApiRequest, NextApiResponse } from 'next';
import { ChatCompletionMessageParam } from 'openai/resources';
import { getGPTResponse4 } from '@/lib/openai';
import { isValid } from '@/lib/upstash';

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

  const valid = await isValid(String(req.headers["upstash-signature"]), req.body);
  if (!valid) {
    return res.status(403).json({
      response_type: 'ephemeral',
      text: 'Nice try buddy. Upstash signature mismatch.',
    });
  }

  console.info('req.body = ', JSON.stringify(req.body));

  const prompts: ChatCompletionMessageParam[] = [
    {
      role: 'assistant',
      content: String(req.body.text),
    },
  ];

  const gptResponse = await getGPTResponse4(prompts);

  console.log('gptResponse:', gptResponse);

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

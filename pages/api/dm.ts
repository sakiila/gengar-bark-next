import {
  verifyRequest,
  postBlockToChannelId,
  emailToUserId,
} from '@/lib/slack';
import { NextApiRequest, NextApiResponse } from 'next';
import { setCache, getCache } from '@/lib/upstash';
import { deflateRawSync } from 'node:zlib';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      response_type: 'ephemeral',
      text: 'This endpoint only accepts POST requests',
    });
  }

  // const verification = verifyRequest(req);
  // if (!verification.status) {
  //   // verify that the request is coming from the correct Slack team
  //   return res.status(403).json({
  //     response_type: 'ephemeral',
  //     text: 'Nice try buddy. Slack signature mismatch.',
  //   });
  // }

  console.info('req.body = ', req.body);

  const message = req.body.message as string;
  const email = req.body.email as string;

  const userId = await getUserId(email.trim());
  if (userId === 'unknown') {
    return res.status(404).json({
      response_type: 'ephemeral',
      text: 'Email not found',
    });
  }

  await postBlockToChannelId(userId, res, message);
}

async function getUserId(email: string): Promise<string> {
  let userId = await getCache(email);
  // console.log('userId = ', userId);
  if (!userId) {
    userId = await emailToUserId(email.trim());
    await setCache(email, userId);
  }
  return userId;
}

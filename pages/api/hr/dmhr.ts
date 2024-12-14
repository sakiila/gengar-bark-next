import { emailToUserId, postToUserIdHr } from '@/lib/slack/slack';
import { NextApiRequest, NextApiResponse } from 'next';
import { getCache, setCache } from '@/lib/upstash/upstash';

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

  console.info('dmhr req.body = ', req.body);

  const message = req.body.message as string;
  const email = req.body.email as string;

  const userId = await getUserId(email.trim());
  if (userId === 'unknown') {
    return res.status(404).json({
      response_type: 'ephemeral',
      text: 'Email not found',
    });
  }

  // return res.status(200).send(record);
  await postToUserIdHr(userId, res, message);
}

async function getUserId(email: string): Promise<string> {
  let userId = await getCache(email);
  // console.log('userId = ', userId);
  if (!userId) {
    userId = await emailToUserId(email);
    await setCache(email, userId);
  }
  return userId;
}

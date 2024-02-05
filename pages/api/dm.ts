import { emailToUserId, postBlockToChannelId, postToUserId } from '@/lib/slack';
import { NextApiRequest, NextApiResponse } from 'next';
import { getCache, setCache } from '@/lib/upstash';
import { postgres } from '@/lib/supabase';

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

  let notification = '';
  if (message.includes('SUCCESS')) {
    if (email.toLowerCase() === 'pc@moego.pet') {
      return res.status(200).send('');
    }
    notification = `:tada: ${message}`;
  } else {
    notification = `:face_holding_back_tears: ${message}`;
  }

  const record = extractInfo(message);
  if (record) {
    const { data, error } = await postgres.from('build_record').insert([
      {
        result: record.result,
        duration: record.duration,
        repository: record.repository,
        branch: record.branch,
        sequence: record.sequence,
        email: email,
        user_id: userId,
        text: message,
      },
    ]);
    if (error) {
      console.log('insert Error:', error);
    }
  }

  // return res.status(200).send(record);
  await postToUserId(userId, res, notification);
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

function extractInfo(text: string):
  | {
      result: string;
      repository: string;
      duration: string;
      branch: string;
      sequence: string;
    }
  | undefined {
  const match = text.match(
    /(BUILD \w+) \(([\w\s]+)\).*» ([a-z0-9-]+) » ([a-z0-9-]+) #(\d+)/i,
  );
  if (match) {
    return {
      result: match[1],
      duration: match[2],
      repository: match[3],
      branch: match[4],
      sequence: match[5],
    };
  } else {
    console.log('no match = ', text);
  }
}

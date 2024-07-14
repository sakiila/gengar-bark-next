import { emailToUserId, postToUserId } from '@/lib/slack';
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

  /**
   * BUILD SUCCESS
   * BUILD UNSTABLE
   * BUILD NOT_BUILT
   * BUILD ABORTED
   * BUILD FAILURE
   */
  let notification = message;
  if (message.includes('SUCCESS')) {
    if (email.toLowerCase() === 'pc@moego.pet') {
      return res.status(200).send({});
    }
    notification = `:tada: ${message}`;
  } else if (message.includes('NOT_BUILT') || message.includes('UNSTABLE')) {
    notification = `:warning: ${message}`;
  } else if (message.includes('ABORTED')) {
    notification = `:negative_squared_cross_mark: ${message}`;
  } else if (message.includes('FAILURE')) {
    notification = `:red_circle: ${message}`;
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

  await postToUserId(userId, res, notification);

  if (record) {
    let { data: build_watchs, error } = await postgres
      .from('build_watch')
      .select('*')
      .eq('repository', record.repository.trim())
      .eq('branch', record.branch.trim());

    build_watchs?.forEach(async (build_watch) => {
      await postToUserId(
        build_watch.channel,
        res,
        `${notification} by <@${userId}>`,
      );
    });
  }

  res.status(200).send('Success');
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

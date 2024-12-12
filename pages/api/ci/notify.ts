import { emailToUserId, getUserId, postToUserId } from '@/lib/slack';
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

  console.info('/ci/notify req.body = ', req.body);

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
  const lowerCaseMessage = message.toLowerCase();

  if (lowerCaseMessage.includes('success')) {
    notification = `:tada: ${message}`;
  } else if (lowerCaseMessage.includes('not_built') || lowerCaseMessage.includes('unstable')) {
    notification = `:warning: ${message}`;
  } else if (lowerCaseMessage.includes('aborted')) {
    notification = `:negative_squared_cross_mark: ${message}`;
  } else if (lowerCaseMessage.includes('failure')) {
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

  // filter
  if (email.toLowerCase() === 'pc@moego.pet') {
    // no opt
  } else {
    await postToUserId(userId, res, notification);
  }

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

import { getUserId, postToUserId } from '@/lib/slack/slack';
import { NextApiRequest, NextApiResponse } from 'next';
import { postgres } from '@/lib/database/supabase';
import { BuildRecordService } from '@/lib/database/services/build-record.service';
import { postMessage } from '@/lib/slack/bolt';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({
        response_type: 'ephemeral',
        text: 'This endpoint only accepts POST requests',
      });
    }

    const message = req.body.message as string;
    const email = req.body.email as string;

    const userId = await getUserId(email.trim());
    if (userId === 'unknown') {
      return res.status(404).json({
        response_type: 'ephemeral',
        text: 'Email not found',
      });
    }

    const record = extractInfo(message);
    const useTypeorm = process.env.USE_TYPEORM === 'true';

    if (useTypeorm) {
      try {
        const buildRecordService = await BuildRecordService.getInstance();

        await buildRecordService.create({
          result: record?.result || "",
          duration: record?.duration || "",
          repository: record?.repository || "",
          branch: record?.branch || "",
          sequence: record?.sequence || "",
          email: email,
          user_id: userId,
          text: message,
        });
      } catch (error) {
        console.error('TypeORM insert Error:', error);
        // 如果 TypeORM 失败，回退到 Supabase
        await insertWithSupabase(record, email, userId, message);
      }
    } else {
      await insertWithSupabase(record, email, userId, message);
    }

    /**
     * BUILD SUCCESS
     * BUILD UNSTABLE
     * BUILD NOT_BUILT
     * BUILD ABORTED
     * BUILD FAILURE
     */
    const result = record?.result;
    let notification = message;
    const lowerCaseMessage = result?.toLowerCase() || message.toLowerCase();
    if (lowerCaseMessage.includes('success')) {
      notification = `:tada: ${message}`;
    } else if (lowerCaseMessage.includes('not_built') || lowerCaseMessage.includes('unstable')) {
      notification = `:warning: ${message}`;
    } else if (lowerCaseMessage.includes('abort') || lowerCaseMessage.includes('cancel')) {
      notification = `:negative_squared_cross_mark: ${message}`;
    } else if (lowerCaseMessage.includes('failure')) {
      notification = `:red_circle: ${message}`;
    }

    // filter
    if (email.toLowerCase() === 'pc@moego.pet') {
      // no opt
    } else {
      await postToUserId(userId, res, notification);
      // await postMessage(userId,  notification);
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
  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({
      response_type: 'ephemeral',
      text: 'Internal server error',
    });
  }
}

async function insertWithSupabase(
  record: ReturnType<typeof extractInfo>,
  email: string,
  userId: string,
  message: string
) {
  const insertData = record ? {
    result: record.result,
    duration: record.duration,
    repository: record.repository,
    branch: record.branch,
    sequence: record.sequence,
    email: email,
    user_id: userId,
    text: message,
  } : {
    result: "",
    duration: "",
    repository: "",
    branch: "",
    sequence: "",
    email: email,
    user_id: userId,
    text: message,
  };

  const { error } = await postgres.from('build_record').insert([insertData]);
  if (error) {
    console.error('Supabase insert Error:', error);
    throw error;
  }
}

/**
 * *<https://ci.devops.moego.pet/job/MoeGolibrary/job/moego-server-business/job/feature-account-structure/151/display/redirect|BUILD FAILURE (43 sec) - Moement, Inc » moego-server-business » feature-account-structure #151>*
 * <https://github.com/MoeGolibrary/Boarding_Desktop/actions/runs/12311337827|* Deploy success (4 min 20 sec): Boarding_Desktop » bugfix-time-check (run #12311337827)*>
 */
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
    /(BUILD \w+) \(([\w\s]+)\).*» ([a-zA-Z0-9_-]+) » ([a-zA-Z0-9-]+) #(\d+)/i
  ) || text.match(
    /\* (Deploy \w+) \(([\w\s]+)\): ([a-zA-Z0-9_-]+) » ([a-zA-Z0-9-]+) \(run #(\d+)\)\*/
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

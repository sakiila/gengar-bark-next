import { getUserId, postToUserId } from '@/lib/slack/slack';
import { NextApiRequest, NextApiResponse } from 'next';
import { insertWithSupabase, postgres } from '@/lib/database/supabase';
import { BuildRecordService } from '@/lib/database/services/build-record.service';

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

    const record = BuildRecordService.extractInfo(message);
    const useTypeorm = process.env.USE_TYPEORM === 'true';

    if (useTypeorm) {
      try {
        const buildRecordService = await BuildRecordService.getInstance();

        await buildRecordService.createNow({
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

    // notify watch list
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




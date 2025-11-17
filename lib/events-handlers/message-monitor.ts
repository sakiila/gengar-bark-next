import { NextApiRequest, NextApiResponse } from 'next';
import { logger } from '@/lib/utils/logger';
import { postMessage } from '@/lib/slack/gengar-bolt';
import { translateToChinese } from '@/lib/ai/openai';

// cto
const TARGET_USER_ID = [''];
// bulletin-ears
const TARGET_CHANNEL_ID = 'C091FDM1M62';

export async function monitorUserMessages(req: NextApiRequest, res: NextApiResponse) {
  const log = logger.scope('message-monitor');

  try {
    const { event } = req.body;
    const { user, channel, ts, text } = event;

    if (TARGET_USER_ID.includes(user)) {

      const messageLink = `https://moegoworkspace.slack.com/archives/${channel}/p${ts.replace('.', '')}`;

      await postMessage(TARGET_CHANNEL_ID, '', `新消息提醒！来自用户 <@${user}> 的消息：\n${text}\n消息链接：${messageLink}`);

      log.info('Successfully sent notification', {
        user,
        channel,
        messageLink,
      });

      const translation = await translateToChinese(text);
      if (translation) {
        await postMessage(TARGET_CHANNEL_ID, '', `翻译结果：\n${translation}`);
      }
    }

    return res.status(200).end();
  } catch (error) {
    log.error('Error in message monitoring', error instanceof Error ? error : new Error('Unknown error'));
    return res.status(500).json({ error: 'Internal server error' });
  }
} 
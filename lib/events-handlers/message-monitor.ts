import { NextApiRequest, NextApiResponse } from 'next';
import { WebClient } from '@slack/web-api';
import { logger } from '@/lib/utils/logger';
import { postMessage } from '@/lib/slack/gengar-bolt';

const TARGET_USER_ID =['U078XGHJUUA', 'U03FPQWGTN2'];

export async function monitorUserMessages(req: NextApiRequest, res: NextApiResponse) {
  const log = logger.scope('message-monitor');
  
  try {
    const { event } = req.body;
    const { user, channel, ts, text } = event;

    // 检查消息是否来自目标用户
    if (TARGET_USER_ID.includes(user)) {

      // 构建消息链接
      const messageLink = `https://moegoworkspace.slack.com/archives/${channel}/p${ts.replace('.', '')}`;

      // 发送通知到指定频道
      await postMessage('C067ENL1TLN', '', `新消息提醒！\n来自用户 <@${user}> 的消息：\n${text}\n消息链接：${messageLink}`);

      log.info('Successfully sent notification', {
        user,
        channel,
        messageLink,
      });
    }

    return res.status(200).end();
  } catch (error) {
    log.error('Error in message monitoring', error instanceof Error ? error : new Error('Unknown error'));
    return res.status(500).json({ error: 'Internal server error' });
  }
} 
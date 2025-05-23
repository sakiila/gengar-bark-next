import { NextApiRequest, NextApiResponse } from 'next';
import { verifyHrRequest } from '@/lib/slack/slack';
import app_home_opened from '@/lib/events-handlers/hr-app-home-opened';
import { response_human_service, response_policy, set_suggested_prompts } from '@/lib/hr/policy-chat';
import { send_response } from '@/lib/events-handlers/chat';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    console.log('hr req.body = ', JSON.stringify(req.body));

    const type = req.body.type;
    if (type === 'url_verification') {
      return res.status(200).json(req.body.challenge);
    } else if (verifyHrRequest(req)) {
      if (type === 'event_callback') {
        const event_type = req.body.event.type;

        switch (event_type) {
          case 'app_home_opened':
            await app_home_opened(req, res);
            if (!res.writableEnded) {
              return res.status(200).json({ message: 'App home opened processed' });
            }
            break;
          case "assistant_thread_started":
            await set_suggested_prompts(req, res);
            break;
          case 'message':
            const { channel_type, hidden, bot_profile, subtype, user } = req.body.event;
            if (channel_type === 'im' && !hidden && !bot_profile && !subtype && user) {
              await response_policy(req, res);
              if (!res.writableEnded) {
                return res.status(200).json({ message: 'Message processed' });
              }
            } else {
              return res.status(200).json({ message: 'Message ignored' });
            }
            break;
          case 'app_mention':
            await response_human_service(req, res);
            break;
          default:
            return res.status(200).json({ message: 'Event ignored' });
        }
      }
      // If we reach here and haven't sent a response yet
      if (!res.writableEnded) {
        return res.status(200).json({ message: 'Event processed' });
      }
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }
  } catch (error) {
    console.error('Error processing HR event:', error);
    if (!res.writableEnded) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}

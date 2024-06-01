import { NextApiRequest, NextApiResponse } from 'next';
import { verifyRequest } from '@/lib/slack';
import emoji_changed from '@/lib/events_handlers/emoji_changed';
import team_join from '@/lib/events_handlers/team_join';
import user_status_changed from '@/lib/events_handlers/user_status_changed';
import user_change from '@/lib/events_handlers/user_change';
import channel_created from '@/lib/events_handlers/channel_created';
import channel_archive from '@/lib/events_handlers/channel_archive';
import { send_gpt_response_in_channel } from '@/lib/events_handlers/chat';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  console.log('req.body = ', JSON.stringify(req.body));

  const type = req.body.type;
  if (type === 'url_verification') {
    return res.status(200).json(req.body.challenge);
  } else if (verifyRequest(req)) {
    // } else if (true) {
    if (type === 'event_callback') {
      const event_type = req.body.event.type;

      switch (event_type) {
        case 'emoji_changed':
          await emoji_changed(req, res);
          break;
        case 'team_join':
          await team_join(req, res);
          break;
        case 'user_status_changed':
          await user_status_changed(req, res);
          break;
        case 'user_change':
          await user_change(req, res);
          break;
        case 'channel_created':
          await channel_created(req, res);
          break;
        case 'channel_archive':
          await channel_archive(req, res);
          break;
        case 'app_mention':
          await send_gpt_response_in_channel(req, res);
          break;
        // case 'message':
        //   await send_gpt_response(req, res);
        //   break;
        default:
          break;
      }
    }
  } else {
    res.status(403).send('Forbidden');
  }
}

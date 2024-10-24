import { NextApiRequest, NextApiResponse } from 'next';
import { verifyHrRequest } from '@/lib/slack';
import app_home_opened from '@/lib/events_handlers/hr_app_home_opend';

export const config = {
  maxDuration: 30,
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  console.log('hr req.body = ', JSON.stringify(req.body));

  const type = req.body.type;
  if (type === 'url_verification') {
    return res.status(200).json(req.body.challenge);
  } else if (verifyHrRequest(req)) {
    // } else if (true) {
    if (type === 'event_callback') {
      const event_type = req.body.event.type;

      switch (event_type) {
        case 'app_home_opened':
          await app_home_opened(req, res);
          break;
        default:
          break;
      }
    }
  } else {
    res.status(403).send('Forbidden');
  }
}

import { deleteMessage, verifyRequest } from '@/lib/slack';
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  console.log('message command = ', req.body);

  const verification = verifyRequest(req);
  if (!verification.status) {
    // verify that the request is coming from the correct Slack team
    return res.status(403).json({
      response_type: 'ephemeral',
      text: 'Nice try buddy. Slack signature mismatch.',
    });
  }

  const text = req.body.text;
  const [action, url] = text.split(' ');

  switch (action) {
    case 'rm':
      await deleteMessage(res, url);
      break;
    default:
      res.send({
        response_type: 'ephemeral',
        text: 'Wrong usage of the command!',
      });
  }
}

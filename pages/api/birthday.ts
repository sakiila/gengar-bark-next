import { postToChannelId } from '@/lib/slack';
import { NextApiRequest, NextApiResponse } from 'next';
import { getBirthdayUsers } from '@/lib/events_handlers/hr_app_home_opend';

export const config = {
  maxDuration: 60,
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      response_type: 'ephemeral',
      text: 'Not allowed',
    });
  }

  const text = await getBirthdayUsers();
  if (!text) {
    return res.send({
      response_type: 'ephemeral',
      text: `No birthday user found.`,
    });
  }

  try {
    await postToChannelId('C04BB2RDPQS', res, `:birthday: ${text}`);
  } catch (e) {
    console.log(e);
  }
}

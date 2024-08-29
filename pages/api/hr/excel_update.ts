import { NextApiRequest, NextApiResponse } from 'next';
import { autoMessageReminderTask } from '@/lib/auto_message_reminder_task';
import { user_update } from '@/lib/user_update';

export const config = {
  maxDuration: 30,
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const payload = req.body as Array<{
    email: string;
    entry: string;
    confirm: string;
    birthday: string;
    tz: string;
  }>;

  console.log('payload = ', JSON.stringify(payload));

  // payload.forEach((load) => {
  //   console.log('load = ', JSON.stringify(load));
  // });

  await user_update(payload);

  return res.status(200).json({ message: 'Update successful!' });
}

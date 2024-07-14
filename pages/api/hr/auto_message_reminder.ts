import { NextApiRequest, NextApiResponse } from 'next';
import { autoMessageReminderTask } from '@/lib/auto_message_reminder_task';

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse,
) {
  await autoMessageReminderTask();

  res.status(200).json({ message: 'Cron job successful!' });
}

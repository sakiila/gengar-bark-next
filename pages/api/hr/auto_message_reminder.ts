import { NextApiRequest, NextApiResponse } from 'next';
import { autoMessageReminderTask } from '@/lib/auto_message_reminder_task';

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse,
) {
  await autoMessageReminderTask();

  return res.status(200).json({ message: 'Cron job successful!' });
}

/**

 create or replace function get_reminder_user() returns setof public.user as
 $$
 select *
 from public.user
 where ((extract(month from birthday_date) = extract(month from now())
 and extract(day from birthday_date) = extract(day from now()))
 or entry_date = now()::date
 or confirm_date = now()::date)
 and ((tz is not null and extract(hour from now() AT TIME ZONE tz) = 9)
 or (tz is null and extract(hour from now() AT TIME ZONE 'Asia/Chongqing') = 9))
 $$ language sql;

 */

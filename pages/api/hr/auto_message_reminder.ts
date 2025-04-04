import { autoMessageReminderTaskV2 } from '@/lib/hr/auto-message';
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse,
) {
  await autoMessageReminderTaskV2();

  return res.status(200).json({ message: 'Cron job successful!' });
}

/**

 create or replace function get_reminder_user() returns setof public.user as
 $$
 select *
 from public.user
 where (entry_date = current_date - interval '1 day'
 and ((tz is not null and extract(hour from now() AT TIME ZONE tz) = 9)
 or (tz is null and extract(hour from now() AT TIME ZONE 'Asia/Chongqing') = 9)))
 or (confirm_date = now()::date and (((tz is not null and extract(hour from now() AT TIME ZONE tz) = 9)
 or (tz is null and extract(hour from now() AT TIME ZONE 'Asia/Chongqing') = 9))))
 or ((extract(month from birthday_date) = extract(month from now())
 and extract(day from birthday_date) = extract(day from now()))
 and ((tz is not null and extract(hour from now() AT TIME ZONE tz) = 9)
 or (tz is null and extract(hour from now() AT TIME ZONE 'Asia/Chongqing') = 9)))
 or ((extract(month from entry_date) = extract(month from now())
 and extract(day from entry_date) = extract(day from now())
 and entry_date != now()::date)
 and (((tz is not null and extract(hour from now() AT TIME ZONE tz) = 9)
 or (tz is null and extract(hour from now() AT TIME ZONE 'Asia/Chongqing') = 9))))
 ;
 $$ language sql;

 */

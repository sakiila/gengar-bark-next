import { postToUserIdHrDirect } from '@/lib/slack';
import { postgres } from '@/lib/supabase';

export async function autoMessageReminderTask() {
  const { data: dbUser, error } = await postgres.rpc('get_reminder_user');

  if (error) {
    console.log('Error:', error);
    return;
  }

  if (!dbUser || dbUser.length === 0) {
    console.log('No user found');
    return;
  }

  let entryReminderUser = [];
  let confirmReminderUser = [];
  let birthdayReminderUser = [];
  const nowDate = Date.now();
  for (const user of dbUser) {
    if (isValid(user.entry_date) && isToday(new Date(user.entry_date))) {
      entryReminderUser.push(user);
    }
    if (isValid(user.confirm_date) && isToday(new Date(user.confirm_date))) {
      confirmReminderUser.push(user);
    }
    if (
      isValid(user.birthday_date) &&
      isTodayBirthday(new Date(user.birthday_date))
    ) {
      birthdayReminderUser.push(user);
    }
  }

  const { data: templates } = await postgres
    .from('hr_auto_message_template')
    .select('*');

  if (!templates || templates.length === 0) {
    console.log('No template found');
    return;
  }

  let promises = [];
  for (const template of templates) {
    if (template.template_type === 1) {
      for (const user of entryReminderUser) {
        promises.push(postAndRecord(user, template));
      }
    }

    if (template.template_type === 2) {
      for (const user of confirmReminderUser) {
        promises.push(postAndRecord(user, template));
      }
    }

    if (template.template_type === 3) {
      for (const user of birthdayReminderUser) {
        promises.push(postAndRecord(user, template));
      }
    }
  }

  Promise.all(promises)
    .then(() => console.log('All messages have been sent'))
    .catch((err) => console.error(err));
}

function isValid(value: unknown): boolean {
  return value !== undefined && value !== null && !Number.isNaN(value);
}

function isToday(dateFromPostgres: Date): boolean {
  const today = new Date(); // 当前日期和时间

  // 设置 today 为该天的开始（0时0分0秒）
  today.setHours(0, 0, 0, 0);

  // 创建一个新的日期对象，基于 dateFromPostgres
  const checkingDate = new Date(dateFromPostgres);
  checkingDate.setHours(0, 0, 0, 0);

  // 判断两个日期是否相等
  return today.getTime() === checkingDate.getTime();
}

function isTodayBirthday(birthday: Date): boolean {
  if (!isValid(birthday)) {
    return false;
  }

  const today = new Date();
  return (
    birthday.getMonth() === today.getMonth() &&
    birthday.getDate() === today.getDate()
  );
}

function getAge(birthday: Date): number {
  if (!isValid(birthday)) {
    return 0;
  }
  return new Date().getFullYear() - birthday.getFullYear();
}

function formatMessage(
  template: string,
  userId: string,
  birthday: Date,
): string {
  return template
    .replace(/{name}/g, `<@${userId}>`)
    .replace(/{today}/g, new Date().toLocaleDateString())
    .replace(/{age}/g, getAge(birthday).toString());
}

async function postAndRecord(user: any, template: any) {
  const userId = user.user_id;

  const text = formatMessage(
    template.template_text,
    userId,
    new Date(user.birthday_date),
  );

  let errorMessage;
  try {
    await postToUserIdHrDirect(userId, text);
  } catch (error) {
    if (error instanceof Error) {
      console.error(
        `Sending message to user ${userId} failed with error: ${error.message}`,
      );
      errorMessage = error.message;
    } else {
      console.error(
        `Sending message to user ${userId} failed with an unknown error`,
      );
    }
  }

  let nowInTz;
  if (isValid(user.tz)) {
    const tz = user.tz;
    nowInTz = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
  } else {
    nowInTz = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Asia/Chongqing' }),
    );
  }

  await postgres.from('hr_auto_message_template_log').insert({
    log_name: template.template_name,
    log_type: template.template_type,
    log_text: text,
    log_time: new Date(),
    log_user_id: userId,
    log_user_name: user.real_name_normalized,
    log_user_time: nowInTz,
    log_result: errorMessage,
  });
}

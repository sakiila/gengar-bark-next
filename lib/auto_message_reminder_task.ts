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
  let anniversaryReminderUser = [];
  for (const user of dbUser) {
    const afterEntryDate = new Date(user.entry_date);
    afterEntryDate.setDate(afterEntryDate.getDate() + 1);
    if (isValid(user.entry_date) && isToday(afterEntryDate)) {
      entryReminderUser.push(user);
    }
    if (isValid(user.confirm_date)
      && isToday(new Date(user.confirm_date))) {
      confirmReminderUser.push(user);
    }
    if (
      isValid(user.birthday_date)
      && isTodayAnniversary(new Date(user.birthday_date))
    ) {
      birthdayReminderUser.push(user);
    }
    if (isValid(user.entry_date)
      && !isToday(new Date(user.entry_date))
      && isTodayAnniversary(new Date(user.entry_date))) {
      anniversaryReminderUser.push(user);
    }
  }


  // const { data }= await postgres.from('user').select('*').eq('user_id', 'U03FPQWGTN2');
  // console.log('data:',data);
  // if (data) {
  //   anniversaryReminderUser.push(data[0]);
  //   entryReminderUser.push(data[0]);
  //   confirmReminderUser.push(data[0]);
  //   birthdayReminderUser.push(data[0]);
  // }

  console.log('entryReminderUser:', entryReminderUser);
  console.log('confirmReminderUser:', confirmReminderUser);
  console.log('birthdayReminderUser:', birthdayReminderUser);
  console.log('anniversaryReminderUser:', anniversaryReminderUser);

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

    if (template.template_type === 4) {
      for (const user of anniversaryReminderUser) {
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

function isTodayAnniversary(birthday: Date): boolean {
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
  username: string,
  anniversary: Date,
): string {
  return template
  .replace(/{name}/g, `${username}`)
  .replace(/{today}/g, new Date().toLocaleDateString())
  .replace(/{anniversary}/g, getAge(anniversary).toString());
}

async function postAndRecord(user: any, template: any) {
  const userId = user.user_id;

  const text = formatMessage(
    template.template_text,
    user.real_name_normalized,
    new Date(user.entry_date),
  );

  let errorMessage;
  try {
    await Promise.all([
      // postToUserIdHrDirect(userId, text),
      // postToUserIdHrDirect('U054RLGNA5U', text), // send to Iris
      postToUserIdHrDirect('U03FPQWGTN2', text), // send to Bob
    ]);
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

  // await postgres.from('hr_auto_message_template_log').insert({
  //   log_name: template.template_name,
  //   log_type: template.template_type,
  //   log_text: text,
  //   log_time: new Date(),
  //   log_user_id: userId,
  //   log_user_name: user.real_name_normalized,
  //   log_user_time: nowInTz,
  //   log_result: errorMessage,
  //   success: !errorMessage,
  // });
}

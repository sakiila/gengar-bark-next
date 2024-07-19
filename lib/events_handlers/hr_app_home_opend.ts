import { NextApiRequest, NextApiResponse } from 'next';
import { publishView } from '@/lib/slack';
import { postgres } from '@/lib/supabase';

interface User {
  real_name_normalized: string;
}

export default async function app_home_opened(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const event = req.body.event;
  const userId = event.user;

  if (!adminUser.includes(userId)) {
    await publishView(userId, banView);
  } else {
    await publishView(userId, await getView(userId, 1));
  }

  res.status(200).send('');
}

export async function getView(userId: string, page: number) {
  const { error, data, count } = await postgres
    .from('user')
    .select('*', { count: 'exact' })
    .eq('deleted', false)
    .ilike('email', '%@moego.pet%')
    .not('email', 'ilike', '%devops%');

  if (error || !count) {
    console.error('Error fetching users:', error);
    return;
  }

  const totalPages = Math.ceil(count / 5);
  if (page < 1) {
    page = totalPages;
  }
  if (page > totalPages) {
    page = 1;
  }

  const [niceDayBlock, userBlocks, templateBlocks, templateLogBlocks] =
    await Promise.all([
      fetchUser(userId),
      fetchUserBlocks(page),
      fetchTemplateBlocks(),
      fetchTemplateLogBlocks(),
    ]);

  const view = {
    private_metadata: JSON.stringify({
      page: `${page}`,
    }),
    type: 'home',
    blocks: [
      niceDayBlock,
      {
        type: 'section',
        text: {
          type: 'plain_text',
          text: ' ',
          emoji: true,
        },
      },
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `Manage Users (${count} users)`,
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Pick users from the list',
        },
        accessory: {
          action_id: 'multi_users_select',
          type: 'multi_users_select',
          placeholder: {
            type: 'plain_text',
            text: '🔍 Select',
            emoji: true,
          },
        },
      },
      ...userBlocks,
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            style: 'primary',
            text: {
              type: 'plain_text',
              emoji: true,
              text: 'Refresh',
            },
            value: 'refresh',
            action_id: 'refresh',
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              emoji: true,
              text: 'Last 5 Results',
            },
            value: 'last',
            action_id: 'last',
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              emoji: true,
              text: 'Next 5 Results',
            },
            value: 'next',
            action_id: 'next',
          },
        ],
      },
      {
        type: 'divider',
      },
      {
        type: 'context',
        elements: [
          {
            type: 'plain_text',
            text: ' ',
            emoji: true,
          },
        ],
      },
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'Manage Templates (3 templates)',
          emoji: true,
        },
      },
      ...templateBlocks,
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            style: 'primary',
            text: {
              type: 'plain_text',
              emoji: true,
              text: 'Refresh',
            },
            value: 'refresh_template',
            action_id: 'refresh_template',
          },
        ],
      },
      {
        type: 'divider',
      },
      {
        type: 'context',
        elements: [
          {
            type: 'plain_text',
            text: ' ',
            emoji: true,
          },
        ],
      },
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'Send Logs (latest 10)',
          emoji: true,
        },
      },
      ...templateLogBlocks,
      {
        type: 'divider',
      },
    ],
  };

  // console.log('---------------------------------------');
  // console.log('---------------------------------------');
  // console.log('view', JSON.stringify(view));
  // console.log('---------------------------------------');
  // console.log('---------------------------------------');

  return view;
}

export async function getViewByUserIds(userIds: string[]) {
  let blo: any[] = [];
  await postgres
    .from('user')
    .select('*')
    .in('user_id', userIds)
    .order('real_name_normalized', { ascending: true })
    .then(({ data, error }) => {
      const usersBlocks = data?.map((user) => getUserBlock(user));
      blo = blo.concat(usersBlocks);
    });

  const view = {
    private_metadata: JSON.stringify({
      user_ids: userIds,
    }),
    type: 'home',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'plain_text',
          text: ' ',
          emoji: true,
        },
      },
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'Manage Users',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Pick users from the list',
        },
        accessory: {
          action_id: 'multi_users_select',
          type: 'multi_users_select',
          placeholder: {
            type: 'plain_text',
            text: '🔍 Select',
            emoji: true,
          },
        },
      },
      ...blo,
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            style: 'primary',
            text: {
              type: 'plain_text',
              emoji: true,
              text: 'Back Home',
            },
            value: 'refresh',
            action_id: 'refresh',
          },
        ],
      },
      {
        type: 'divider',
      },
    ],
  };

  // console.log('view', JSON.stringify(view));

  return view;
}

function getUserBlock(user: any) {
  return {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*${user.real_name_normalized}* [ entry: ${
        user.entry_date || '-'
      }   confirm: ${user.confirm_date || '-'}   birthday: ${
        user.birthday_date || '-'
      }   tz: ${user.tz || '-'} ]`,
    },
    accessory: {
      type: 'button',
      text: {
        type: 'plain_text',
        text: `Manage ${user.real_name_normalized}`,
        emoji: true,
      },
      value: `manage_${user.user_id}`,
      action_id: 'manage_user',
    },
  };
}

function getTemplateBlock(template: any) {
  return {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*${template.template_name}*\n${template.template_text}`,
    },
    accessory: {
      type: 'button',
      text: {
        type: 'plain_text',
        text: `Edit ${template.template_name}`,
        emoji: true,
      },
      value: `edit_${template.id}`,
      action_id: 'edit_template',
    },
  };
}

function getTemplateLogBlock(templateLog: any) {
  return {
    type: 'section',
    fields: [
      {
        type: 'mrkdwn',
        text: `${templateLog.id}. *${templateLog.log_name}* for *${templateLog.log_user_name}* on ${formatDateTime(new Date(templateLog.log_user_time))}`,
      },
      {
        type: 'mrkdwn',
        text: `${templateLog.log_text.length > 80 ? templateLog.log_text.substring(0, 80) + '...' : templateLog.log_text}`,
      },
    ],
  };
}

export const adminUser = [
  'U03FPQWGTN2', // Bob
  'U03JFM4M82C', // Peter
  'U02J9Q2ST1B', // Chris
  'U054RLGNA5U', // Iris
  'U01G0F85QGG', // Fiona
  'U0565L2DV50',  // Eva
  'U0521K5FP6E', // Pepper
  'U06PLNDC6KF', // Sora
  'U06RKRMELA2', // Teresa
  'U072DFTJ6G1', // Melody
];

export const banView = {
  type: 'home',
  blocks: [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: ':ghost: You are not allowed to manage this app. Please contact Iris.',
      },
    },
  ],
};

async function fetchUser(userId: string) {
  const { data, error } = await postgres
    .from('user')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching user blocks:', error);
    return [];
  }

  const birthdayText = await getBirthdayUsers();

  return {
    type: 'section',
    text: {
      type: 'plain_text',
      text: `:tada: Have a nice day, ${data[0].real_name_normalized}. ${birthdayText}`,
      emoji: true,
    },
  };
}

async function getBirthdayUsers() {
  const { data: dbUser } = await postgres.rpc('get_birthday_user');
  if (!dbUser || dbUser.length === 0) {
    return '';
  }
  return "Happy birthday to " + dbUser?.map((user: User) => `${user.real_name_normalized}`).join(', ').trim() + ".";
}

async function fetchUserBlocks(page: number) {
  const { data, error } = await postgres
    .from('user')
    .select('*')
    .eq('deleted', false)
    .ilike('email', '%@moego.pet%')
    .not('email', 'ilike', '%devops%')
    .order('real_name_normalized', { ascending: true })
    .range((page - 1) * 5, (page - 1) * 5 + 4);

  if (error) {
    console.error('Error fetching user blocks:', error);
    return [];
  }

  return data.map(getUserBlock);
}

async function fetchTemplateBlocks() {
  const { data, error } = await postgres
    .from('hr_auto_message_template')
    .select('*')
    .order('id', { ascending: true });

  if (error) {
    console.error('Error fetching template blocks:', error);
    return [];
  }

  return data.map(getTemplateBlock);
}

async function fetchTemplateLogBlocks() {
  const { data, error } = await postgres
    .from('hr_auto_message_template_log')
    .select('*')
    .order('id', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching template log blocks:', error);
    return [];
  }

  return data.map(getTemplateLogBlock);
}

function formatDateTime(date: Date): string {
  if (!(date instanceof Date)) {
    throw new Error('Invalid date');
  }

  const pad = (num: number) => (num < 10 ? `0${num}` : num.toString());

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  const second = pad(date.getSeconds());

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

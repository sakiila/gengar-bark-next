import { NextApiRequest, NextApiResponse } from 'next';
import { postgres } from '@/lib/supabase';
import { openView, publishView } from '@/lib/slack';
import {
  adminUser,
  banView,
  getView,
  getViewByUserIds,
} from '@/lib/events_handlers/hr_app_home_opend';

export const config = {
  maxDuration: 30,
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const payload = JSON.parse(req.body.payload);
  console.log('payload = ', JSON.stringify(payload));

  const userId = payload.user.id;
  if (!adminUser.includes(userId)) {
    await publishView(userId, banView);
    res.status(200).send('');
  }

  let metadata = JSON.parse(payload.view.private_metadata || '{}');

  if (payload.type === 'block_actions') {
    const triggerId = payload.trigger_id;
    let actions = Array.isArray(payload.actions)
      ? payload.actions
      : [payload.actions];

    for (const action of actions) {
      if (!action) {
        continue;
      }

      const actionId = action.action_id;
      const userId = payload.user.id;
      const page = metadata.page || 1;
      const userIds = metadata.user_ids;

      switch (actionId) {
        case 'manage_user':
          await getUserInfo(
            action.value.split('_')[1],
            triggerId,
            page,
            userIds,
          );
          break;
        case 'refresh':
        case 'refresh_template':
          await publishView(userId, await getView(userId, page));
          break;
        case 'last':
          await publishView(userId, await getView(userId, Number(page) - 1));
          break;
        case 'next':
          await publishView(userId, await getView(userId, Number(page) + 1));
          break;
        case 'multi_users_select':
          await publishView(
            userId,
            await getViewByUserIds(action.selected_users),
          );
          break;
        case 'edit_template':
          await getTemplateInfo(action.value.split('_')[1], triggerId, page);
          break;
      }
    }
  } else if (payload.type === 'view_submission') {
    const userId = payload.user.id;
    const page = metadata.page;
    const values = payload.view.state.values;

    if (payload.view.callback_id === 'manage_user_modal') {
      const user_id = metadata.user_id;
      const userIds = metadata.user_ids;

      const entryDate = values.entry_date.entry_date_action.selected_date;
      const confirmDate = values.confirm_date.confirm_date_action.selected_date;
      const birthdayDate =
        values.birthday_date.birthday_date_action.selected_date;
      const tz = values.timezone_select.timezone_select.selected_option.value;
      const { data: date, error: error } = await postgres
        .from('user')
        .update({
          entry_date: entryDate,
          confirm_date: confirmDate,
          birthday_date: birthdayDate,
          tz: tz || 'Asia/Chongqing',
        })
        .eq('user_id', user_id);

      if (error) {
        console.error('Error updating user:', error);
      }

      if (userIds) {
        await publishView(userId, await getViewByUserIds(userIds));
      } else {
        await publishView(userId, await getView(userId, page));
      }
    } else if (payload.view.callback_id === 'manage_template_modal') {
      const template_id = metadata.template_id;

      const name = values.template_name_input.template_name_input_action.value;
      const text = values.template_text_input.template_text_input_action.value;
      const { data: date, error: error } = await postgres
        .from('hr_auto_message_template')
        .update({
          template_name: name,
          template_text: text,
          update_time: new Date(),
          update_user_id: userId,
        })
        .eq('id', template_id);

      if (error) {
        console.error('Error updating user:', error);
      }
      await publishView(userId, await getView(userId, page));
    }
  }

  res.status(200).send('');
}

async function getUserInfo(
  userId: string,
  triggerId: string,
  page: number,
  userIds: string[],
) {
  const { data: users } = await postgres
    .from('user')
    .select('*')
    .eq('user_id', userId);

  if (!users) {
    return;
  }
  const user = users[0];

  const modalView = {
    private_metadata: JSON.stringify({
      page: `${page}`,
      user_id: `${userId}`,
      user_ids: userIds,
    }),
    type: 'modal',
    callback_id: 'manage_user_modal',
    title: {
      type: 'plain_text',
      text: `Edit ${user.real_name_normalized}`,
    },
    blocks: [
      {
        type: 'input',
        optional: true,
        block_id: 'entry_date',
        element: {
          type: 'datepicker',
          ...(user.entry_date ? { initial_date: `${user.entry_date}` } : {}),
          placeholder: {
            type: 'plain_text',
            text: 'Select a date',
          },
          action_id: 'entry_date_action',
        },
        label: {
          type: 'plain_text',
          text: 'Entry date',
        },
      },
      {
        type: 'input',
        optional: true,
        block_id: 'confirm_date',
        element: {
          type: 'datepicker',
          ...(user.confirm_date
            ? { initial_date: `${user.confirm_date}` }
            : {}),
          placeholder: {
            type: 'plain_text',
            text: 'Select a date',
          },
          action_id: 'confirm_date_action',
        },
        label: {
          type: 'plain_text',
          text: 'Confirm date',
        },
      },
      {
        type: 'input',
        optional: true,
        block_id: 'birthday_date',
        element: {
          type: 'datepicker',
          ...(user.birthday_date
            ? { initial_date: `${user.birthday_date}` }
            : {}),
          placeholder: {
            type: 'plain_text',
            text: 'Select a date',
          },
          action_id: 'birthday_date_action',
        },
        label: {
          type: 'plain_text',
          text: 'Birthday date',
        },
      },
      {
        type: 'section',
        block_id: 'timezone_select',
        text: {
          type: 'mrkdwn',
          text: '*Timezone*',
        },
        accessory: {
          action_id: 'timezone_select',
          type: 'static_select',

          initial_option: {
            text: {
              type: 'plain_text',
              text: `${user.tz || 'Asia/Chongqing'}`,
            },
            value: `${user.tz || 'Asia/Chongqing'}`,
          },

          placeholder: {
            type: 'plain_text',
            text: 'Select an item',
          },
          options: [
            {
              text: {
                type: 'plain_text',
                text: 'Asia/Chongqing',
              },
              value: 'Asia/Chongqing',
            },
            {
              text: {
                type: 'plain_text',
                text: 'America/Los_Angeles',
              },
              value: 'America/Los_Angeles',
            },
            {
              text: {
                type: 'plain_text',
                text: 'America/New_York',
              },
              value: 'America/New_York',
            },
          ],
        },
      },
    ],
    submit: {
      type: 'plain_text',
      text: 'Submit',
    },
    close: {
      type: 'plain_text',
      text: 'Cancel',
      emoji: true,
    },
  };

  console.log('modalView = ', JSON.stringify(modalView));

  await openView(triggerId, modalView);
}

async function getTemplateInfo(
  templateId: string,
  triggerId: string,
  page: number,
) {
  const { data: templates } = await postgres
    .from('hr_auto_message_template')
    .select('*')
    .eq('id', templateId);

  if (!templates) {
    return;
  }
  const template = templates[0];

  const modalView = {
    private_metadata: JSON.stringify({
      page: `${page}`,
      template_id: `${templateId}`,
    }),
    type: 'modal',
    callback_id: 'manage_template_modal',
    title: {
      type: 'plain_text',
      text: `Edit ${template.template_name}`,
    },
    blocks: [
      {
        type: 'input',
        block_id: 'template_name_input',
        element: {
          type: 'plain_text_input',
          action_id: 'template_name_input_action',
          initial_value: `${template.template_name}`,
          max_length: 20,
        },
        label: {
          type: 'plain_text',
          text: 'Edit Name',
          emoji: true,
        },
      },
      {
        type: 'input',
        block_id: 'template_text_input',
        element: {
          type: 'plain_text_input',
          action_id: 'template_text_input_action',
          initial_value: `${template.template_text}`,
          multiline: true,
        },
        label: {
          type: 'plain_text',
          text: 'Edit Text',
          emoji: true,
        },
      },
    ],
    submit: {
      type: 'plain_text',
      text: 'Submit',
    },
    close: {
      type: 'plain_text',
      text: 'Cancel',
      emoji: true,
    },
  };

  // console.log('modalView = ', JSON.stringify(modalView));

  await openView(triggerId, modalView);
}

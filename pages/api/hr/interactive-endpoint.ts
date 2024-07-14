import { NextApiRequest, NextApiResponse } from 'next';
import { ac, aw } from '@upstash/redis/zmscore-415f6c9f';
import { postgres } from '@/lib/supabase';
import { openView, publishView } from '@/lib/slack';
import {
  adminUser,
  banView,
  getView,
  getViewByUserIds,
} from '@/lib/events_handlers/hr_app_home_opend';
import { number } from 'prop-types';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  console.log('req.body.payload = ', req.body.payload);
  const payload = JSON.parse(req.body.payload);
  // console.log('payload = ', payload);

  const userId = payload.user.id;
  if (!adminUser.includes(userId)) {
    await publishView(userId, banView);
    return res.status(200).send({});
  }

  if (payload.type === 'block_actions') {
    const triggerId = payload.trigger_id;
    let actions = Array.isArray(payload.actions)
      ? payload.actions
      : [payload.actions];
    for (const action of actions) {
      if (!action) {
        continue;
      }

      if (action.action_id === 'manage_user') {
        const userId = action.value.split('_')[1];
        await getUserInfo(userId, triggerId);
      } else if (action.action_id === 'refresh') {
        const userId = payload.user.id;
        const page = payload.view.private_metadata;
        await publishView(userId, await getView(page));
      } else if (action.action_id === 'last') {
        const userId = payload.user.id;
        const page = payload.view.private_metadata;
        await publishView(userId, await getView(Number(page) - 1));
      } else if (action.action_id === 'next') {
        const userId = payload.user.id;
        const page = payload.view.private_metadata;
        await publishView(userId, await getView(Number(page) + 1));
      } else if (action.action_id === 'multi_users_select') {
        const userId = payload.user.id;
        const selectedUsers = action.selected_users;
        await publishView(userId, await getViewByUserIds(selectedUsers));
      }
    }
  } else if (payload.type === 'view_submission') {
    const userId = payload.user.id;
    const id = payload.view.private_metadata;
    const values = payload.view.state.values;
    const entryDate = values.entry_date.entry_date_action.selected_date;
    const confirmDate = values.confirm_date.confirm_date_action.selected_date;
    const birthdayDate =
      values.birthday_date.birthday_date_action.selected_date;

    const { data: date, error: error } = await postgres
      .from('user')
      .update({
        entry_date: entryDate,
        confirm_date: confirmDate,
        birthday_date: birthdayDate,
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating user:', error);
    }

    await publishView(userId, await getView(1));
  }

  res.status(200).send({});
}

async function getUserInfo(userId: string, triggerId: string) {
  const { data: users } = await postgres
    .from('user')
    .select('*')
    .eq('id', userId);

  if (!users) {
    return;
  }
  const user = users[0];

  const modalView = {
    private_metadata: `${user.id}`,
    type: 'modal',
    callback_id: 'manage_user_modal',
    title: {
      type: 'plain_text',
      text: `Manage ${user.real_name_normalized}'s dates`,
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

  // Send modal to user
  await openView(triggerId, modalView);
}

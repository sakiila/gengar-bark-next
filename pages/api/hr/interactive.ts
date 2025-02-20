import { NextApiRequest, NextApiResponse } from 'next';
import { postgres } from '@/lib/database/supabase';
import { openView, publishView } from '@/lib/slack/slack';
import { adminUser, banView, getView, getViewByUserIds } from '@/lib/events-handlers/hr-app-home-opened';
import {
  deleteScheduledMessages,
  getConversationsInfo,
  postBlockMessage,
  scheduleMessage,
} from '@/lib/slack/hr-bolt';
import { sharedPublicURL } from '@/lib/slack/bob-bolt';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  res.status(200).send('');

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
        case 'refresh_push_template':
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
          await getReminderTemplateInfo(
            action.value.split('_')[1],
            triggerId,
            page,
          );
          break;
        case 'edit_push_template':
          await getPushTemplateInfo(
            action.value.split('_')[1],
            triggerId,
            page,
          );
          break;
        case 'cancel_task':
          await cancelTask(action.value.split('_')[1], action.value.split('_')[2]);
          await publishView(userId, await getView(userId, page));
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
        confirm_date: confirmDate
          ? confirmDate
          : entryDate
            ? new Date(
              new Date(entryDate).setMonth(
                new Date(entryDate).getMonth() + 3,
              ),
            )
            : null,
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

      console.log('values = ', JSON.stringify(values));
      const name = values.template_name_input.template_name_input_action.value;
      const text_value =
        values.template_text_input.template_text_input_action.rich_text_value;
      const { data: data, error: error } = await postgres
      .from('hr_auto_message_template')
      .update({
        template_name: name,
        template_text: text_value,
        update_time: new Date(),
        update_user_id: userId,
      })
      .eq('id', template_id);

      if (error) {
        console.error('Error updating user:', error);
      }
      await publishView(userId, await getView(userId, page));
    } else if (payload.view.callback_id === 'manage_push_template_modal') {
      const template_id = metadata.template_id;

      console.log('values = ', JSON.stringify(values));
      const name = values.template_name_input.template_name_input_action.value;
      const text_value =
        values.template_text_input.template_text_input_action.rich_text_value;

      const image_values = values.file_input_block.file_input_action.files.map(
        (file: any) => {
          return {
            type: 'image',
            title: {
              type: 'plain_text',
              text: file.title,
            },
            image_url: `${file.url_private}?pub_secret=${file.permalink_public?.split('-').pop()}`,
            alt_text: file.name,
          };
        },
      );

      await Promise.all(
        values.file_input_block.file_input_action.files.map(async (file: any) => {
          await sharedPublicURL(file.id);
        }),
      );

      // 添加 2 秒延迟
      await new Promise(resolve => setTimeout(resolve, 2000));

      const blocks = [text_value, ...image_values];
      // console.log('blocks = ', JSON.stringify(blocks));

      const { data: data, error: error } = await postgres
      .from('hr_auto_message_template')
      .update({
        template_name: name,
        template_text: text_value,
        update_time: new Date(),
        update_user_id: userId,
      })
      .eq('id', template_id);

      const selected_channels =
        values.multi_channels_select_block.multi_channels_select_action
          .selected_channels;
      const selected_date_time =
        values.datetimepicker_block.datetimepicker_action.selected_date_time;

      let scheduledMessages: any[];
      if (selected_date_time <= new Date().getTime() / 1000) {
        scheduledMessages = (await Promise.all(
          selected_channels.map(async (channel: string) => {
            try {
              await postBlockMessage(channel, '', blocks);
              return {
                channel,
                scheduled_message_id: '',
                status: 2,
              };
            } catch (error) {
              console.error(`Failed to schedule message for channel ${channel}:`, error);
              return null;
            }
          }),
        )).filter((msg): msg is NonNullable<typeof msg> => msg !== null);
      } else {
        scheduledMessages = (await Promise.all(
          selected_channels.map(async (channel: string) => {
            try {
              const result = await scheduleMessage(channel, 'HR People Management Message', blocks, selected_date_time);
              return result === 'unknown' ? null : result;
            } catch (error) {
              console.error(`Failed to schedule message for channel ${channel}:`, error);
              return null;
            }
          }),
        )).filter((msg): msg is NonNullable<typeof msg> => msg !== null);
      }

      await Promise.all(
        scheduledMessages.map(async (msg) => {
            if (!msg.channel) {
              console.error('Channel ID is missing in scheduled message');
              return;
            }
            const conversationsInfo = await getConversationsInfo(msg.channel);
            if (conversationsInfo === 'unknown') {
              console.error(`Unknown channel: ${msg.channel}`);
              return;
            }
            return postgres
            .from('hr_auto_message_task')
            .insert({
              template_id: template_id,
              template_text: JSON.stringify(blocks),
              plan_send_time: new Date(selected_date_time * 1000).toISOString(),
              user_id: userId,
              channel: msg.channel,
              scheduled_message_id: msg.scheduled_message_id,
              template_name: name,
              channel_name: conversationsInfo.name,
              status: msg.status || 1,
            });
          },
        ),
      );

      if (error) {
        console.error('Error updating message template:', error);
      }
      await publishView(userId, await getView(userId, page));
    }
  }

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
      text: `${user.real_name_normalized}`,
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

  // console.log('modalView = ', JSON.stringify(modalView));

  await openView(triggerId, modalView);
}

async function getReminderTemplateInfo(
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
      text: `${template.template_name}`,
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
          text: 'Template Name',
          emoji: true,
        },
      },
      {
        type: 'input',
        block_id: 'template_text_input',
        element: {
          type: 'rich_text_input',
          action_id: 'template_text_input_action',
          initial_value: JSON.parse(template.template_text),
        },
        label: {
          type: 'plain_text',
          text: 'Template Text',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'plain_text',
          text: `${template.note || ''}`,
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

  // console.log();
  // console.log('modalView = ', JSON.stringify(modalView));

  await openView(triggerId, modalView);
}

async function getPushTemplateInfo(
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
    callback_id: 'manage_push_template_modal',
    title: {
      type: 'plain_text',
      text: `${template.template_name}`,
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
          text: 'Template Name',
          emoji: true,
        },
      },
      {
        type: 'input',
        block_id: 'template_text_input',
        element: {
          type: 'rich_text_input',
          action_id: 'template_text_input_action',
          initial_value: JSON.parse(template.template_text),
        },
        label: {
          type: 'plain_text',
          text: 'Template Text',
          emoji: true,
        },
      },
      {
        'type': 'input',
        'block_id': 'file_input_block',
        'label': {
          'type': 'plain_text',
          'text': 'Upload Images',
        },
        'element': {
          'type': 'file_input',
          'action_id': 'file_input_action',
          'filetypes': [
            'jpg',
            'png',
            'jpeg',
            'gif',
          ],
          'max_files': 5,
        },
      },
      {
        type: 'section',
        text: {
          type: 'plain_text',
          text: `${template.note || ' '}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        block_id: 'multi_channels_select_block',
        text: {
          type: 'mrkdwn',
          text: '*Pick channels from the list*',
        },
        accessory: {
          action_id: 'multi_channels_select_action',
          type: 'multi_channels_select',
          placeholder: {
            type: 'plain_text',
            text: 'Select channels',
          },
        },
      },
      {
        type: 'input',
        block_id: 'datetimepicker_block',
        element: {
          type: 'datetimepicker',
          action_id: 'datetimepicker_action',
        },
        label: {
          type: 'plain_text',
          text: 'Plan sending time',
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

  // console.log("modalView = ", JSON.stringify(modalView));

  await openView(triggerId, modalView);
}

async function cancelTask(channel: string, scheduledMessageId: string) {
  await deleteScheduledMessages(channel, scheduledMessageId);
}

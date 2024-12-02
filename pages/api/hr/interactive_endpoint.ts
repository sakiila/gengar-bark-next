import { NextApiRequest, NextApiResponse } from "next";
import { postgres } from "@/lib/supabase";
import {
  openView,
  postToUserIdHrDirectSchedule,
  publishView,
  sharedPublicURL,
} from "@/lib/slack";
import {
  adminUser,
  banView,
  getView,
  getViewByUserIds,
} from "@/lib/events_handlers/hr_app_home_opend";
import { map } from "@smithy/smithy-client";

interface SlackScheduledMessageResponse {
  ok: boolean;
  channel: string;
  scheduled_message_id: string;
  post_at: string;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const payload = JSON.parse(req.body.payload);
  console.log("payload = ", JSON.stringify(payload));

  const userId = payload.user.id;
  if (!adminUser.includes(userId)) {
    await publishView(userId, banView);
    res.status(200).send("");
  }

  let metadata = JSON.parse(payload.view.private_metadata || "{}");

  if (payload.type === "block_actions") {
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
        case "manage_user":
          await getUserInfo(
            action.value.split("_")[1],
            triggerId,
            page,
            userIds,
          );
          break;
        case "refresh":
        case "refresh_template":
        case "refresh_push_template":
          await publishView(userId, await getView(userId, page));
          break;
        case "last":
          await publishView(userId, await getView(userId, Number(page) - 1));
          break;
        case "next":
          await publishView(userId, await getView(userId, Number(page) + 1));
          break;
        case "multi_users_select":
          await publishView(
            userId,
            await getViewByUserIds(action.selected_users),
          );
          break;
        case "edit_template":
          await getReminderTemplateInfo(
            action.value.split("_")[1],
            triggerId,
            page,
          );
          break;
        case "edit_push_template":
          await getPushTemplateInfo(
            action.value.split("_")[1],
            triggerId,
            page,
          );
          break;
      }
    }
  } else if (payload.type === "view_submission") {
    const userId = payload.user.id;
    const page = metadata.page;
    const values = payload.view.state.values;

    if (payload.view.callback_id === "manage_user_modal") {
      const user_id = metadata.user_id;
      const userIds = metadata.user_ids;

      const entryDate = values.entry_date.entry_date_action.selected_date;
      const confirmDate = values.confirm_date.confirm_date_action.selected_date;
      const birthdayDate =
        values.birthday_date.birthday_date_action.selected_date;
      const tz = values.timezone_select.timezone_select.selected_option.value;
      const { data: date, error: error } = await postgres
        .from("user")
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
          tz: tz || "Asia/Chongqing",
        })
        .eq("user_id", user_id);

      if (error) {
        console.error("Error updating user:", error);
      }

      if (userIds) {
        await publishView(userId, await getViewByUserIds(userIds));
      } else {
        await publishView(userId, await getView(userId, page));
      }
    } else if (payload.view.callback_id === "manage_template_modal") {
      const template_id = metadata.template_id;

      console.log("values = ", JSON.stringify(values));
      const name = values.template_name_input.template_name_input_action.value;
      const text_value =
        values.template_text_input.template_text_input_action.rich_text_value;
      const { data: data, error: error } = await postgres
        .from("hr_auto_message_template")
        .update({
          template_name: name,
          template_text: text_value,
          update_time: new Date(),
          update_user_id: userId,
        })
        .eq("id", template_id);

      if (error) {
        console.error("Error updating user:", error);
      }
      await publishView(userId, await getView(userId, page));
    } else if (payload.view.callback_id === "manage_push_template_modal") {
      const template_id = metadata.template_id;

      console.log("values = ", JSON.stringify(values));
      const name = values.template_name_input.template_name_input_action.value;
      const text_value =
        values.template_text_input.template_text_input_action.rich_text_value;

      const image_values = [
        {
          type: "image",
          image_url: values.url_text_input_block1.url_text_input_action1.value,
          alt_text: "",
        },
        {
          type: "image",
          image_url: values.url_text_input_block2.url_text_input_action2.value,
          alt_text: "",
        },
        {
          type: "image",
          image_url: values.url_text_input_block3.url_text_input_action3.value,
          alt_text: "",
        },
        {
          type: "image",
          image_url: values.url_text_input_block4.url_text_input_action4.value,
          alt_text: "",
        },
        {
          type: "image",
          image_url: values.url_text_input_block5.url_text_input_action5.value,
          alt_text: "",
        },
      ];

      // const image_value = values.file_input_block.file_input_action.files.map(
      //   (file: any) => {
      //     return {
      //       type: "image",
      //       title: {
      //         type: "plain_text",
      //         text: file.title,
      //       },
      //       image_url: file.permalink_public,
      //       alt_text: file.name,
      //     };
      //   },
      // );

      // await Promise.all(
      //   values.file_input_block.file_input_action.files.map((file: any) => {
      //     sharedPublicURL(file.id);
      //   }),
      // );

      const blocks = [text_value, ...image_values];
      console.log("blocks = ", JSON.stringify(blocks));

      const { data: data, error: error } = await postgres
        .from("hr_auto_message_template")
        .update({
          template_name: name,
          template_text: text_value,
          update_time: new Date(),
          update_user_id: userId,
        })
        .eq("id", template_id);

      const selected_channels =
        values.multi_channels_select_block.multi_channels_select_action
          .selected_channels;
      const selected_date_time =
        values.datetimepicker_block.datetimepicker_action.selected_date_time;

      const scheduledMessages = (await Promise.all(
        selected_channels.map((channel: string) =>
          postToUserIdHrDirectSchedule(channel, blocks, selected_date_time),
        ),
      )) as SlackScheduledMessageResponse[];

      const scheduledMessageDetails = scheduledMessages.map((msg) => ({
        channel: msg.channel,
        scheduled_message_id: msg.scheduled_message_id,
      }));
      console.log("Scheduled message details:", scheduledMessageDetails);

      const { data: taskData, error: taskError } = await postgres
      .from("hr_auto_message_task")
      .insert({
        template_id: template_id,
        template_text: JSON.stringify(blocks),
        plan_send_time: new Date(selected_date_time).toISOString(), // Ensure the date is in ISO format
        user_id: userId,
        public_channel: selected_channels,
        send_info: JSON.stringify(scheduledMessageDetails), // Ensure send_info is a string
      });

      if (error) {
        console.error("Error updating message template:", error);
      }
      if (taskError) {
        console.error("Error updating task message:", taskError);
      }
      await publishView(userId, await getView(userId, page));
    }
  }

  res.status(200).send("");
}

async function getUserInfo(
  userId: string,
  triggerId: string,
  page: number,
  userIds: string[],
) {
  const { data: users } = await postgres
    .from("user")
    .select("*")
    .eq("user_id", userId);

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
    type: "modal",
    callback_id: "manage_user_modal",
    title: {
      type: "plain_text",
      text: `${user.real_name_normalized}`,
    },
    blocks: [
      {
        type: "input",
        optional: true,
        block_id: "entry_date",
        element: {
          type: "datepicker",
          ...(user.entry_date ? { initial_date: `${user.entry_date}` } : {}),
          placeholder: {
            type: "plain_text",
            text: "Select a date",
          },
          action_id: "entry_date_action",
        },
        label: {
          type: "plain_text",
          text: "Entry date",
        },
      },
      {
        type: "input",
        optional: true,
        block_id: "confirm_date",
        element: {
          type: "datepicker",
          ...(user.confirm_date
            ? { initial_date: `${user.confirm_date}` }
            : {}),
          placeholder: {
            type: "plain_text",
            text: "Select a date",
          },
          action_id: "confirm_date_action",
        },
        label: {
          type: "plain_text",
          text: "Confirm date",
        },
      },
      {
        type: "input",
        optional: true,
        block_id: "birthday_date",
        element: {
          type: "datepicker",
          ...(user.birthday_date
            ? { initial_date: `${user.birthday_date}` }
            : {}),
          placeholder: {
            type: "plain_text",
            text: "Select a date",
          },
          action_id: "birthday_date_action",
        },
        label: {
          type: "plain_text",
          text: "Birthday date",
        },
      },
      {
        type: "section",
        block_id: "timezone_select",
        text: {
          type: "mrkdwn",
          text: "*Timezone*",
        },
        accessory: {
          action_id: "timezone_select",
          type: "static_select",

          initial_option: {
            text: {
              type: "plain_text",
              text: `${user.tz || "Asia/Chongqing"}`,
            },
            value: `${user.tz || "Asia/Chongqing"}`,
          },

          placeholder: {
            type: "plain_text",
            text: "Select an item",
          },
          options: [
            {
              text: {
                type: "plain_text",
                text: "Asia/Chongqing",
              },
              value: "Asia/Chongqing",
            },
            {
              text: {
                type: "plain_text",
                text: "America/Los_Angeles",
              },
              value: "America/Los_Angeles",
            },
            {
              text: {
                type: "plain_text",
                text: "America/New_York",
              },
              value: "America/New_York",
            },
          ],
        },
      },
    ],
    submit: {
      type: "plain_text",
      text: "Submit",
    },
    close: {
      type: "plain_text",
      text: "Cancel",
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
    .from("hr_auto_message_template")
    .select("*")
    .eq("id", templateId);

  if (!templates) {
    return;
  }
  const template = templates[0];

  const modalView = {
    private_metadata: JSON.stringify({
      page: `${page}`,
      template_id: `${templateId}`,
    }),
    type: "modal",
    callback_id: "manage_template_modal",
    title: {
      type: "plain_text",
      text: `${template.template_name}`,
    },
    blocks: [
      {
        type: "input",
        block_id: "template_name_input",
        element: {
          type: "plain_text_input",
          action_id: "template_name_input_action",
          initial_value: `${template.template_name}`,
          max_length: 20,
        },
        label: {
          type: "plain_text",
          text: "Template Name",
          emoji: true,
        },
      },
      {
        type: "input",
        block_id: "template_text_input",
        element: {
          type: "rich_text_input",
          action_id: "template_text_input_action",
          initial_value: JSON.parse(template.template_text),
        },
        label: {
          type: "plain_text",
          text: "Template Text",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "plain_text",
          text: `${template.note || ""}`,
          emoji: true,
        },
      },
    ],
    submit: {
      type: "plain_text",
      text: "Submit",
    },
    close: {
      type: "plain_text",
      text: "Cancel",
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
    .from("hr_auto_message_template")
    .select("*")
    .eq("id", templateId);

  if (!templates) {
    return;
  }
  const template = templates[0];

  const modalView = {
    private_metadata: JSON.stringify({
      page: `${page}`,
      template_id: `${templateId}`,
    }),
    type: "modal",
    callback_id: "manage_push_template_modal",
    title: {
      type: "plain_text",
      text: `${template.template_name}`,
    },
    blocks: [
      {
        type: "input",
        block_id: "template_name_input",
        element: {
          type: "plain_text_input",
          action_id: "template_name_input_action",
          initial_value: `${template.template_name}`,
          max_length: 20,
        },
        label: {
          type: "plain_text",
          text: "Template Name",
          emoji: true,
        },
      },
      {
        type: "input",
        block_id: "template_text_input",
        element: {
          type: "rich_text_input",
          action_id: "template_text_input_action",
          initial_value: JSON.parse(template.template_text),
        },
        label: {
          type: "plain_text",
          text: "Template Text",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "plain_text",
          text: `${template.note || " "}`,
          emoji: true,
        },
      },
      {
        type: "section",
        block_id: "multi_channels_select_block",
        text: {
          type: "mrkdwn",
          text: "Pick channels from the list",
        },
        accessory: {
          action_id: "multi_channels_select_action",
          type: "multi_channels_select",
          placeholder: {
            type: "plain_text",
            text: "Select channels",
          },
        },
      },
      {
        type: "input",
        block_id: "datetimepicker_block",
        element: {
          type: "datetimepicker",
          action_id: "datetimepicker_action",
        },
        label: {
          type: "plain_text",
          text: "Plan sending time",
          emoji: true,
        },
      },
      {
        type: "input",
        block_id: "url_text_input_block1",
        element: {
          type: "url_text_input",
          action_id: "url_text_input_action1",
        },
        label: {
          type: "plain_text",
          text: "Label",
          emoji: true,
        },
      },
      {
        type: "input",
        block_id: "url_text_input_block2",
        element: {
          type: "url_text_input",
          action_id: "url_text_input_action2",
        },
        label: {
          type: "plain_text",
          text: "Label",
          emoji: true,
        },
      },
      {
        type: "input",
        block_id: "url_text_input_block3",
        element: {
          type: "url_text_input",
          action_id: "url_text_input_action3",
        },
        label: {
          type: "plain_text",
          text: "Label",
          emoji: true,
        },
      },
      {
        type: "input",
        block_id: "url_text_input_block4",
        element: {
          type: "url_text_input",
          action_id: "url_text_input_action4",
        },
        label: {
          type: "plain_text",
          text: "Label",
          emoji: true,
        },
      },
      {
        type: "input",
        block_id: "url_text_input_block5",
        element: {
          type: "url_text_input",
          action_id: "url_text_input_action5",
        },
        label: {
          type: "plain_text",
          text: "Label",
          emoji: true,
        },
      },
    ],
    submit: {
      type: "plain_text",
      text: "Submit",
    },
    close: {
      type: "plain_text",
      text: "Cancel",
      emoji: true,
    },
  };

  // console.log("modalView = ", JSON.stringify(modalView));

  await openView(triggerId, modalView);
}

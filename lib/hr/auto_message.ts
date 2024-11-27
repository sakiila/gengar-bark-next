import { postToUserIdHrDirect } from "@/lib/slack";
import { postgres } from "@/lib/supabase";

// Types
interface User {
  user_id: string;
  real_name_normalized: string;
  entry_date: string;
  confirm_date: string;
  birthday_date: string;
  tz?: string;
}

interface Template {
  template_type: ReminderType;
  template_name: string;
  template_text: string;
}

enum ReminderType {
  ENTRY = 1,
  CONFIRM = 2,
  BIRTHDAY = 3,
  ANNIVERSARY = 4,
  ONE_MONTH = 5,
}

interface MessageRecipient {
  userId: string;
  sent: boolean;
  attempts: number;
}

const userQueries = {
  getEntryReminders: async () => {
    return await postgres.rpc('get_entry_reminders');
  },

  getConfirmReminders: async () => {
    return await postgres.rpc('get_confirm_reminders');
  },

  getBirthdayReminders: async () => {
    return await postgres.rpc('get_birthday_reminders');
  },

  getAnniversaryReminders: async () => {
    return await postgres.rpc('get_anniversary_reminders');
  },

  getOneMonthReminders: async () => {
    return await postgres.rpc('get_one_month_reminders');
  },
};

// Message formatting
const formatMessage = (template: string, user: User): string => {
  const entryDate = new Date(user.entry_date);
  const years = new Date().getFullYear() - entryDate.getFullYear();

  return template
    .replace(/{name}/g, user.real_name_normalized)
    .replace(/{today}/g, new Date().toLocaleDateString())
    .replace(/{anniversary}/g, years.toString());
};

// Message sending
const sendMessage = async (userId: string, text: string): Promise<void> => {
  try {
    await postToUserIdHrDirect(userId, text);
  } catch (error) {
    console.error(`Failed to send message to user ${userId}:`, error);
    throw error;
  }

  // send to Iris
  try {
    await postToUserIdHrDirect('U054RLGNA5U', text)
  } catch (error) {
    console.error(`Failed to send message to user Iris:`, error);
  }

  // send to Bob
  try {
    await postToUserIdHrDirect("U03FPQWGTN2", text);
  } catch (error) {
    console.error(`Failed to send message to user Bob:`, error);
  }

};

// Get templates
const getTemplates = async () => {
  return await postgres.from("hr_auto_message_template").select("*");
};

// Process and send reminders for a specific type
const processReminders = async (
  users: User[],
  template: Template,
  reminderType: ReminderType,
): Promise<void> => {
  if (!users?.length) return;

  const sendingPromises = users.map((user) => {
    const message = formatMessage(template.template_text, user);
    return sendMessage(user.user_id, message)
      .then(async () => {
        await logResult(user, template, message, "");
      })
      .catch(async (error) => {
        await logResult(user, template, message, error.message);
      });
  });

  await Promise.all(sendingPromises);
};

// Main function
export async function autoMessageReminderTaskV2(): Promise<void> {
  try {
    // 获取消息模板
    const { data: templates, error: templateError } = await getTemplates();
    if (templateError) {
      console.error("Error fetching templates:", templateError);
      throw templateError;
    }
    if (!templates?.length) {
      console.log("No templates found");
      return;
    }

    // 为每种提醒类型获取用户并发送消息
    const reminderTasks = [
      {
        type: ReminderType.ENTRY,
        query: userQueries.getEntryReminders,
      },
      {
        type: ReminderType.CONFIRM,
        query: userQueries.getConfirmReminders,
      },
      {
        type: ReminderType.BIRTHDAY,
        query: userQueries.getBirthdayReminders,
      },
      {
        type: ReminderType.ANNIVERSARY,
        query: userQueries.getAnniversaryReminders,
      },
      {
        type: ReminderType.ONE_MONTH,
        query: userQueries.getOneMonthReminders,
      },
    ];

    await Promise.all(
      reminderTasks.map(async ({ type, query }) => {
        const template = templates.find((t) => t.template_type === type);
        if (!template) return;

        const { data: users, error } = await query();
        if (error) {
          console.error(
            `Error fetching ${ReminderType[type]} reminders:`,
            error,
          );
          return;
        }

        await processReminders(users || [], template, type);
      }),
    );

    console.log("All reminder messages have been processed");
  } catch (error) {
    console.error("Error in autoMessageReminderTask:", error);
    throw error;
  }
}

async function logResult(
  user: User,
  template: Template,
  text: string,
  errorMessage: string,
) {
  const logEntry = {
    log_name: template.template_name,
    log_type: template.template_type,
    log_text: text,
    log_time: new Date(),
    log_user_id: user.user_id,
    log_user_name: user.real_name_normalized,
    log_user_time: getUserTime(user),
    log_result: errorMessage,
    success: !errorMessage,
  };

  try {
    await postgres.from("hr_auto_message_template_log").insert(logEntry);
  } catch (error) {
    console.error("Failed to log result:", {
      error,
      user: user.user_id,
      template: template.template_name,
    });
  }
}

function getUserTime(user: User) {
  if (isValid(user.tz)) {
    const tz = user.tz;
    return new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
  }
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Chongqing" }),
  );
}

function isValid(value: unknown): boolean {
  return value !== undefined && value !== null && !Number.isNaN(value);
}

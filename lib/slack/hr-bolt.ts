import { App, LogLevel } from '@slack/bolt';

// Initialize the Slack Bolt app with more configuration options
const app = new App({
  token: process.env.SLACK_BOT_HR_TOKEN,
  signingSecret: process.env.SLACK_HR_SIGNING_SECRET,
  logLevel: LogLevel.DEBUG,
});

// Initialize different WebClients for different token types
const botClient = app.client;

/**
 * Base message sender function
 * @param params - Message parameters
 */
async function sendMessage(params: any) {
  try {
    return await botClient.chat.postMessage(params);
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}

export async function openView(triggerId: string, view: any) {
  try {
    return await botClient.views.open({
      trigger_id: triggerId,
      view,
    });
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}

export async function publishView(userId: string, view: any) {
  try {
    return await botClient.views.publish({
      user_id: userId,
      view,
    });
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}

export async function setStatus(channelId: string, ts: string) {
  try {
    return await botClient.assistant.threads.setStatus({
      channel_id: channelId,
      thread_ts: ts,
      status: 'is working on your request...',
    });
  } catch (error) {
    console.error('Error setting status:', error);
    throw error;
  }
}

export async function getThreadReplies(channelId: string, ts: string) {
  try {
    const result = await botClient.conversations.replies({
      channel: channelId,
      ts,
      inclusive: true,
      include_all_metadata: true,
    });
    return result.messages || undefined;
  } catch (error) {
    console.error('Error getting thread reply:', error);
    throw error;
  }
}

export async function threadReply(channelId: string,
                                  ts: string,
                                  text: string) {
  try {
    return await botClient.chat.postMessage({
      channel: channelId,
      thread_ts: ts,
      text,
      // blocks: textToMarkdown(text),
    });
  } catch (error) {
    console.error('Error replying to thread:', error);
    throw error;
  }
}

export async function threadReplyWithHumanMetaData(channelId: string,
                                                   ts: string,
                                                   text: string,
                                                   firstTs: string) {
  try {
    return await botClient.chat.postMessage({
      channel: channelId,
      thread_ts: ts,
      text,
      // blocks: textToMarkdown(text),
      username: "小伙伴求助（请在 Thread 中 @HrBot 回复）",
      metadata: {
        event_type: 'human_reply',
        event_payload: {
          first_ts: firstTs,
        },
      },
    });
  } catch (error) {
    console.error('Error replying to thread:', error);
    throw error;
  }
}

export async function postBlockMessage(channel: string, thread_ts: string, blocks: any[]) {
  if (!thread_ts || thread_ts.length === 0) {
    return sendMessage({ channel, blocks });
  }
  return sendMessage({ channel, thread_ts, blocks });
}

export async function scheduleMessage(channel: string, text: string, blocks: any[], post_at: number) {
  try {
    const result = await botClient.chat.scheduleMessage({
      channel,
      blocks,
      text,
      post_at,
    });
    return result || 'unknown';
  } catch (error) {
    console.error('Error getting replies:', error);
    return 'unknown';
  }
}

export async function deleteScheduledMessages(channel: string, scheduled_message_id: string) {
  try {
    const result = await botClient.chat.deleteScheduledMessage({
      channel,
      scheduled_message_id,
    });
    return result.ok || 'unknown';
  } catch (error) {
    console.error('Error getting replies:', error);
    return 'unknown';
  }
}

export async function getConversationsInfo(channel: string) {
  try {
    const result = await botClient.conversations.info({
      channel,
    });
    return result.channel || 'unknown';
  } catch (error) {
    console.error('Error getting replies:', error);
    return 'unknown';
  }
}

/**
 * Set suggested prompts for assistant
 * @param channel_id - Channel ID
 * @param thread_ts - Thread timestamp
 * @param messages - Array of suggested prompts
 * @param is_cn - Whether to use simplified Chinese or not
 */
export async function setSuggestedPrompts(channel_id: string, thread_ts: string, messages: string[], is_cn: boolean) {
  const prompts = messages.map((message) => {
    return {
      title: message,
      message: message,
    };
  });

  try {
    await botClient.apiCall('assistant.threads.setSuggestedPrompts', {
      channel_id,
      thread_ts,
      title: is_cn ? '猜你想问：' : 'Suggested questions:',
      prompts: prompts,
    });
  } catch (error) {
    console.error('Error setting prompts:', error);
    throw error;
  }
}

/**
 * Set suggested prompts for assistant
 * @param channel_id - Channel ID
 * @param thread_ts - Thread timestamp
 */
export async function setDefaultSuggestedPrompts(channel_id: string, thread_ts: string) {
  try {

    await botClient.assistant.threads.setSuggestedPrompts({
      channel_id,
      thread_ts,
      title: 'Hi! What can I do for you today?',
      prompts: [
        {
          title: 'What is MoeGo\'s fundamental value?',
          message: 'What is MoeGo\'s fundamental value?',
        },
        {
          title: 'How do MoeGo view mediocrity?',
          message: 'How do MoeGo view mediocrity?',
        },
        {
          title: 'Calling human customer service',
          message: 'Human',
        },
      ],
    });
  } catch (error) {
    console.error('Error setting prompts:', error);
    throw error;
  }
}

export async function deleteMessage(urlString: string) {
  console.log('deleting message url: ', urlString);
  try {
    const url = new URL(urlString);
    if (!url.hostname.endsWith('slack.com') || !url.pathname.startsWith('/archives/')) {
      console.log('not a valid slack message url');
      return;
    }

    //  ['', 'archives', 'C067ENL1TLN', 'p1743429646143019']
    const pathParts = url.pathname.split('/');
    const channel = pathParts[2];
    const ts = pathParts[3].slice(1, -6) + '.' + pathParts[3].slice(-6);

    console.log('deleting message: ', channel, ts);

    await botClient.chat.delete({ channel, ts });
  } catch (error) {
    console.error('Error deleting message:', error);
  }
}

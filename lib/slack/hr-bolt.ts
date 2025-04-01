import { App, LogLevel } from '@slack/bolt';
import { bot_hr_token } from '@/lib/slack/slack';

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

export async function publishView(userId: string, view: any) {
  const url = 'https://slack.com/api/views.publish';

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bot_hr_token}`,
        'Content-type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        user_id: userId,
        view: view,
      }),
    });

    if (!response.ok) {
      const message = `An error has occurred: ${response.status}`;
      throw new Error(message);
    }

    return await response.json();
  } catch (error) {
    console.error('Error publishing view:', error);
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

export async function getThreadReply(channelId: string, ts: string) {
  try {
    return await botClient.conversations.replies({
      channel: channelId,
      ts: ts,
    });
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
 const prompts =  messages.map((message) => {
    return {
      title: message,
      message: message,
    }
  });

  try {
    await app.client.apiCall('assistant.threads.setSuggestedPrompts', {
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

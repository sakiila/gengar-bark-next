import { App, LogLevel } from '@slack/bolt';
import { ChatPostMessageArguments } from '@slack/web-api';
import { ChannelService } from '../database/services/channel.service';
import { Channel } from '@/lib/database/entities/Channel';

// Initialize the Slack Bolt app with more configuration options
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  logLevel: LogLevel.DEBUG,
});

// Initialize different WebClients for different token types
const botClient = app.client;

/**
 * Base message sender function
 * @param params - Message parameters
 * @param client - WebClient instance to use
 */
async function sendMessage(params: ChatPostMessageArguments) {
  try {
    return await botClient.chat.postMessage(params);
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}

/**
 * Send a simple text message
 * @param channel - Channel or user ID
 * @param text - Message text
 */
export async function postMessage(channel: string, text: string) {
  return sendMessage({ channel, text });
}

/**
 * Send a message with blocks
 * @param channel - Channel or user ID
 * @param blocks - Message blocks
 */
export async function postBlockMessage(channel: string, blocks: any[]) {
  return sendMessage({ channel, blocks });
}

/**
 * Look up user by email
 * @param email - Email address
 */
export async function lookupUserByEmail(email: string): Promise<string> {
  try {
    const result = await app.client.users.lookupByEmail({ email });
    return result.user?.id || 'unknown';
  } catch (error) {
    console.error('Error looking up user:', error);
    return 'unknown';
  }
}

/**
 * Get user information
 * @param user - User ID
 */
export async function getUserInfo(user: string): Promise<string> {
  try {
    const result = await app.client.users.info({ user });
    return result.user?.name || 'unknown';
  } catch (error) {
    console.error('Error getting user info:', error);
    return 'unknown';
  }
}

/**
 * Delete a message
 * @param channel - Channel ID
 * @param ts - Message timestamp
 */
export async function deleteMessage(channel: string, ts: string) {
  try {
    await app.client.chat.delete({ channel, ts });
  } catch (error) {
    console.error('Error deleting message:', error);
    throw error;
  }
}

interface ProfileStatus {
  status_emoji: string;
  status_text: string;
}

/**
 * Get thread replies
 * @param channel - Channel ID
 * @param ts - Thread timestamp
 */
export async function getThreadReplies(channel: string, ts: string) {
  try {
    const result = await app.client.conversations.replies({
      channel,
      ts,
      inclusive: true,
    });
    return result.messages || 'unknown';
  } catch (error) {
    console.error('Error getting replies:', error);
    return 'unknown';
  }
}

/**
 * Reply to a thread
 * @param channel - Channel ID
 * @param thread_ts - Parent message timestamp
 * @param text - Reply text
 */
export async function replyToThread(channel: string, thread_ts: string, text: string) {
  return sendMessage({
    channel,
    thread_ts,
    text,
    blocks: [{
      type: 'section',
      text: {
        type: 'mrkdwn',
        text,
      },
    }],
  });
}

/**
 * Set suggested prompts for assistant
 * @param channel_id - Channel ID
 * @param thread_ts - Thread timestamp
 */
export async function setSuggestedPrompts(channel_id: string, thread_ts: string) {
  try {
    await app.client.apiCall('assistant.threads.setSuggestedPrompts', {
      channel_id,
      thread_ts,
      title: 'Welcome buddy. What can I do for you today?',
      prompts: [
        {
          title: 'Who are you',
          message: 'Who are you?',
        },
        {
          title: 'Generate ideas',
          message: 'Pretend you are a marketing associate and you need new ideas for an enterprise productivity feature. Generate 10 ideas for a new feature launch.',
        },
        {
          title: 'Describe how AI works',
          message: 'How does artificial intelligence work?',
        },
      ],
    });
  } catch (error) {
    console.error('Error setting prompts:', error);
    throw error;
  }
}

export async function conversationsListForIm() {
  try {
    const { ok, channels, error } = await botClient.conversations.list({ limit: 1000, types: 'im' });

    if (!ok) {
      console.error('Error getting conversations list:', error);
      throw new Error(error);
    }

    // Save channels to database
    const channelService = await ChannelService.getInstance();
    const channelDOs = channels?.map(channel => {
      return {
        channel_id: channel.id,
        created_at: channel.created ? new Date(channel.created * 1000) : new Date(),
        is_archived: channel.is_archived,
        user_id: channel.user,
        is_im: channel.is_im,
        context_team_id: channel.context_team_id,
        is_user_deleted: channel.is_user_deleted,
      };
    });
    await channelService.saveChannels(channelDOs as Channel[]);

    console.log('Conversations list:', channelDOs);
  } catch (error) {
    console.error('Error getting conversations list:', error);
    throw error;
  }
}

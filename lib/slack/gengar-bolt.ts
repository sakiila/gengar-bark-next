import { App, LogLevel } from '@slack/bolt';
import { ChannelService } from '../database/services/channel.service';
import { Channel } from '@/lib/database/entities/Channel';
import { BuildRecordService } from '@/lib/database/services/build-record.service';
import { convertToDate } from '@/lib/utils/time-utils';
import { getAllUser } from '@/lib/database/supabase';
import pLimit from 'p-limit';
import { chunk } from 'lodash';

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
async function sendMessage(params: any) {
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

/**
 * get all conversations list channel for who used gengar bark
 */
export async function conversationsListForIm() {
  try {
    const { ok, channels, error } = await botClient.conversations.list({ limit: 1000, types: 'im' });

    if (!ok) {
      console.error('Error getting conversations list:', error);
      throw new Error(error);
    }

    const allUsers = await getAllUser();
    if (!allUsers) {
      throw new Error('Failed to retrieve users');
    }
    const userMap = new Map(allUsers.map(user => [user.user_id, user]));

    // Save channels to database
    const channelService = await ChannelService.getInstance();

    // Create array of promises
    const channelPromises = channels?.map(async channel => {
      if (!channel.id) {
        console.error('Channel ID is missing:', channel);
        return null;
      }

      return {
        channel_id: channel.id,
        created_at: channel.created ? new Date(channel.created * 1000) : new Date(),
        is_archived: channel.is_archived || false,
        user_id: channel.user,
        is_im: channel.is_im || false,
        context_team_id: channel.context_team_id,
        is_user_deleted: channel.is_user_deleted || false,
        email: userMap.get(channel.user)?.email || '',
      };
    }) || [];

    // Wait for all promises to resolve and filter out null values
    const channelDOs = (await Promise.all(channelPromises)).filter((channel): channel is Channel =>
      channel !== null && channel.channel_id !== undefined,
    );

    if (channelDOs.length > 0) {
      await channelService.saveChannels(channelDOs);
      console.log('Conversations list:', channelDOs);
    } else {
      console.log('No valid channels to save');
    }

  } catch (error) {
    console.error('Error getting conversations list:', error);
    throw error;
  }
}

interface SlackMessage {
  type?: string;
  subtype?: string;
  text?: string;
  user?: string;
  ts?: string;
}

const MOEGO_REGEX = /moego/i;

function isValidMessage(message: SlackMessage): boolean {
  return !message.subtype &&
    message.type === 'message' &&
    message.text != null &&
    message.user != null &&
    MOEGO_REGEX.test(message.text);
}

// Add rate limiting configuration
const CHANNEL_BATCH_SIZE = 10;
const MESSAGE_BATCH_SIZE = 2000;
const CONCURRENT_CHANNEL_LIMIT = 3;
const MESSAGES_PER_REQUEST = 1000;

async function importConversationsHistory(
  channel: Channel,
  initialCursor?: string,
  maxRetries: number = 3
): Promise<any[]> {
  const accumulator: any[] = [];
  let cursor = initialCursor;

  while (true) {
    let retries = 0;
    let success = false;
    let response;

    while (retries < maxRetries && !success) {
      try {
        response = await botClient.conversations.history({
          channel: channel.channel_id,
          limit: MESSAGES_PER_REQUEST,
          cursor,
        });
        success = true;
      } catch (error) {
        retries++;
        console.error(`Attempt ${retries} failed for channel ${channel.channel_id}:`, error);
        if (retries === maxRetries) throw error;
        // 指数退避
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
      }
    }

    if (!response?.ok) {
      throw new Error(response?.error || 'Failed to fetch messages');
    }

    const validMessages = (response.messages || [])
      .filter(isValidMessage)
      .map(msg => ({
        text: msg.text!,
        user_id: channel.user_id,
        created_at: convertToDate(msg.ts!),
        ...BuildRecordService.extractInfo(msg.text!) || {
          result: '',
          duration: '',
          repository: '',
          branch: '',
          sequence: '',
        },
        email: channel.email,
      }));

    accumulator.push(...validMessages);

    if (!response.response_metadata?.next_cursor) {
      break;
    }

    cursor = response.response_metadata.next_cursor;
    // 添加延迟以遵守速率限制
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return accumulator;
}

async function processChannelBatch(channels: Channel[]): Promise<void> {
  const buildRecordService = await BuildRecordService.getInstance();
  const limit = pLimit(CONCURRENT_CHANNEL_LIMIT);

  const channelPromises = channels.map(channel =>
    limit(async () => {
      console.log(`Processing channel: ${channel.channel_id}`);
      try {
        const messages = await importConversationsHistory(channel);

        // 分批处理消息
        const messageBatches = chunk(messages, MESSAGE_BATCH_SIZE);
        for (const batch of messageBatches) {
          await buildRecordService.batchCreate(batch);
          console.log(`Inserted ${batch.length} messages for channel ${channel.channel_id}`);
        }
      } catch (error) {
        console.error(`Error processing channel ${channel.channel_id}:`, error);
      }
    })
  );

  await Promise.all(channelPromises);
}

function logMemoryUsage() {
  const used = process.memoryUsage();
  console.log('Memory usage:');
  // 明确指定 NodeJS.MemoryUsage 的键
  const metrics: Array<keyof NodeJS.MemoryUsage> = ['heapTotal', 'heapUsed', 'external', 'rss'];
  metrics.forEach(key => {
    console.log(`${key}: ${Math.round(used[key] / 1024 / 1024 * 100) / 100} MB`);
  });
}

export async function dataImport(timeoutMinutes: number = 30) {
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Data import timeout')), timeoutMinutes * 60 * 1000);
  });

  try {
    await Promise.race([
      (async () => {
        logMemoryUsage();
        const startTime = Date.now();
        const channelService = await ChannelService.getInstance();
        const channels = await channelService.findAll();

        console.log(`Starting import for ${channels.length} channels at ${new Date().toISOString()}`);
        let processedChannels = 0;
        let totalMessages = 0;

        const channelBatches = chunk(channels, CHANNEL_BATCH_SIZE);

        for (let i = 0; i < channelBatches.length; i++) {
          logMemoryUsage();
          const batchStartTime = Date.now();
          console.log(`Processing batch ${i + 1}/${channelBatches.length}`);

          await processChannelBatch(channelBatches[i]);
          processedChannels += channelBatches[i].length;

          const batchDuration = (Date.now() - batchStartTime) / 1000;
          console.log(`Batch ${i + 1} completed in ${batchDuration}s. Progress: ${processedChannels}/${channels.length} channels`);

          if (i < channelBatches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        const totalDuration = (Date.now() - startTime) / 1000;
        console.log(`Import completed in ${totalDuration}s. Processed ${processedChannels} channels and ${totalMessages} messages`);
      })(),
      timeout
    ]);
  } catch (err: unknown) {
    logMemoryUsage();
    // 类型守卫确保错误处理的类型安全
    if (err instanceof Error) {
      if (err.message === 'Data import timeout') {
        console.error(`Import timed out after ${timeoutMinutes} minutes`);
      } else {
        console.error('Error in data import:', err);
      }
    } else {
      console.error('Unknown error in data import:', err);
    }
    throw err;
  }
}

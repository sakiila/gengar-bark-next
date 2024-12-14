import { App, LogLevel } from '@slack/bolt';
import { WebClient, ChatPostMessageArguments } from '@slack/web-api';
import { bot_hr_token } from '@/lib/slack/slack';

// Initialize the Slack Bolt app with more configuration options
const app = new App({
  token: process.env.SLACK_BOT_HR_TOKEN,
  logLevel: LogLevel.DEBUG,
});

// Initialize different WebClients for different token types
const botClient = app.client;

/**
 * Base message sender function
 * @param params - Message parameters
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
 * Schedule a message to be sent later
 * @param channel - Channel or user ID
 * @param blocks - Message blocks
 * @param postAt - Unix timestamp for scheduled time
 */
export async function scheduleMessage(channel: string, blocks: any[], postAt: number) {
  try {
    return await botClient.chat.scheduleMessage({
      channel,
      text: "HR People Management Message",
      blocks,
      post_at: postAt,
      unfurl_links: false
    });
  } catch (error) {
    console.error('Error scheduling message:', error);
    throw error;
  }
}

export async function publishView(userId: string, view: any) {
  const url = "https://slack.com/api/views.publish";

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bot_hr_token}`,
        "Content-type": "application/json; charset=UTF-8",
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

    const data = await response.json();

    return data;
  } catch (error) {
    console.error("Error publishing view:", error);
  }
}

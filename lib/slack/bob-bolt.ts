import { App, LogLevel } from '@slack/bolt';
import { bot_token, personalCookie, personalToken } from '@/lib/slack/slack';

// Initialize the Slack Bolt app with more configuration options
const app = new App({
  token: process.env.SLACK_USER_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  logLevel: LogLevel.DEBUG,
});

// Initialize different WebClients for different token types
const botClient = app.client;

// Bob
const user = process.env.SLACK_ADMIN_MEMBER_ID;

interface ProfileStatus {
  status_emoji: string;
  status_text: string;
}

/**
 * Set user profile status
 * @param emoji - Status emoji
 * @param text - Status text
 */
export async function setProfileStatus(emoji: string, text: string) {
  try {
    await botClient.users.profile.set({
      profile: {
        status_emoji: emoji,
        status_text: text,
      },
    });
  } catch (error) {
    console.error('Error setting status:', error);
    throw error;
  }
}

/**
 * Get user profile status
 */
export async function getProfileStatus(): Promise<ProfileStatus | null> {
  try {
    const result = await botClient.users.profile.get({
      user,
    });
    return {
      status_emoji: result.profile?.status_emoji as string,
      status_text: result.profile?.status_text as string,
    };
  } catch (error) {
    console.error('Error getting status:', error);
    return null;
  }
}

export async function getThreadReply(channelId: string, ts: string) {
  const url = `https://slack.com/api/conversations.replies?channel=${channelId}&ts=${ts}&inclusive=true`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${bot_token}`,
      },
    });
    const data = await response.json();
    if (data.ok) {
      return data.messages;
    } else {
      return 'unknown';
    }
  } catch (err) {
    console.log(err);
  }
}


export async function getAddedUserId(name: string) {
  var myHeaders = new Headers();
  myHeaders.append('authority', 'moegoworkspace.slack.com');
  myHeaders.append('accept', '*/*');
  myHeaders.append('accept-language', 'en,zh-CN;q=0.9,zh;q=0.8');
  myHeaders.append('cookie', personalCookie);
  myHeaders.append(
    'user-agent',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  );

  var formdata = new FormData();
  formdata.append('token', personalToken);
  formdata.append('page', '1');
  formdata.append('count', '2');
  formdata.append('sort_by', 'created');
  formdata.append('sort_dir', 'desc');

  const response = await fetch(
    'https://moegoworkspace.slack.com/api/emoji.adminList',
    {
      method: 'POST',
      headers: myHeaders,
      body: formdata,
      redirect: 'follow',
    },
  );
  const data = await response.json();
  if (data.emoji == undefined) {
    return 'unknown';
  }
  const foundEmoji = data.emoji.find(
    (emoji: { name: string; user_id: string }) => emoji.name == name,
  );
  return foundEmoji ? foundEmoji.user_id : 'unknown';
}

export async function sharedPublicURL(fileId: string) {
  try {
    const result = await botClient.files.sharedPublicURL({
      file: fileId,
    });
    return result.file || 'unknown';
  } catch (error) {
    console.error('Error getting replies:', error);
    return 'unknown';
  }
}

import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { regexOperations, truncateString } from './helpers';
import {
  clearDataForTeam,
  existsCacheThanSet,
  getAccessToken,
  getChannel,
  getKeywords,
  getTeamConfigAndStats,
  trackBotUsage,
  trackUnfurls,
} from './upstash';
import { getParent, getPost } from '@/lib/hn';
import { aw } from '@upstash/redis/zmscore-415f6c9f';

export const bot_token = process.env.SLACK_BOT_TOKEN as string;
export const bot_hr_token = process.env.SLACK_BOT_HR_TOKEN as string;
export const user_token = process.env.SLACK_USER_TOKEN as string;
export const signingSecret = process.env.SLACK_SIGNING_SECRET as string;
export const prodChannel = process.env.PROD_CHANNEL as string;
export const testChannel = process.env.TEST_CHANNEL as string;
export const personalToken = process.env.PERSONAL_TOKEN as string;
export const personalCookie = process.env.PERSONAL_COOKIE as string;

export function verifyRequest(req: NextApiRequest) {
  /* Verify that requests are genuinely coming from Slack and not a forgery */
  const {
    'x-slack-signature': slack_signature,
    'x-slack-request-timestamp': timestamp,
  } = req.headers as {
    [key: string]: string;
  };

  if (!slack_signature || !timestamp) {
    return {
      status: false,
      message: 'No slack signature or timestamp found in request headers.',
    };
  }
  if (process.env.SLACK_SIGNING_SECRET === undefined) {
    return {
      status: false,
      message: '`SLACK_SIGNING_SECRET` env var is not defined.',
    };
  }
  if (
    Math.abs(Math.floor(new Date().getTime() / 1000) - parseInt(timestamp)) >
    60 * 5
  ) {
    return {
      status: false,
      message: 'Nice try buddy. Slack signature mismatch.',
    };
  }
  const req_body = new URLSearchParams(req.body).toString(); // convert body to URL search params
  const sig_basestring = 'v0:' + timestamp + ':' + req_body; // create base string
  const my_signature =
    'v0=' +
    crypto
      .createHmac('sha256', signingSecret)
      .update(sig_basestring)
      .digest('hex'); // create signature

  if (
    crypto.timingSafeEqual(
      Buffer.from(slack_signature),
      Buffer.from(my_signature),
    )
  ) {
    return {
      status: true,
      message: 'Verified Request.',
    };
  } else {
    return {
      status: false,
      message: 'Nice try buddy. Slack signature mismatch.',
    };
  }
}

export async function sendSlackMessage(postId: number, teamId: string) {
  /* Send a message containing the link to the hacker news post to Slack */
  const [accessToken, channelId] = await Promise.all([
    getAccessToken(teamId),
    getChannel(teamId),
  ]);
  console.log(
    `Sending message to team ${teamId} in channel ${channelId} for post ${postId}`,
  );
  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      text: `https://news.ycombinator.com/item?id=${postId}`,
      channel: channelId,
      unfurl_links: true,
    }),
  });
  const trackResponse = await trackBotUsage(teamId); // track bot usage for a team
  return {
    response,
    trackResponse,
  };
}

export async function handleUnfurl(req: NextApiRequest, res: NextApiResponse) {
  /* Unfurl a hacker news post to Slack using Slack's Attachments API: https://api.slack.com/messaging/composing/layouts#attachments */

  const { team_id } = req.body;
  if (!team_id) {
    return res.status(400).json({ message: 'No team_id found' });
  }
  const channel = req.body.event.channel; // channel the message was sent in
  const ts = req.body.event.message_ts; // message timestamp
  const url = req.body.event.links[0].url; // url that was shared
  const newUrl = new URL(url);
  const id = newUrl.searchParams.get('id'); // get hacker news post id
  if (!id) {
    return res.status(400).json({ message: 'No id found' });
  }

  const [post, accessToken, keywords] = await Promise.all([
    getPost(parseInt(id)), // get post data from hacker news API
    getAccessToken(team_id), // get access token from upstash
    getKeywords(team_id), // get keywords from upstash
  ]);

  const { processedPost, mentionedTerms } = regexOperations(post, keywords); // get post data with keywords highlighted

  const originalPost = post.parent ? await getParent(post) : null; // if post is a comment, get title of original post

  const response = await fetch('https://slack.com/api/chat.unfurl', {
    // unfurl the hacker news post using the Slack API
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      channel,
      ts,
      unfurls: {
        [url]: {
          mrkdwn_in: ['author_name', 'text', 'footer'],
          fallback: `https://news.ycombinator.com/item?id=${post.id}`,
          author_name: `New ${post.type} from ${post.by}`,
          author_link: `https://news.ycombinator.com/item?id=${post.id}`,
          author_icon: `https://ui-avatars.com/api/?name=${post.by}&background=random`,
          ...(post.title && {
            title: post.title,
            title_link: `https://news.ycombinator.com/item?id=${post.id}`,
          }),
          text: processedPost,
          ...(mentionedTerms.size > 0 && {
            fields: [
              {
                title: 'Mentioned Terms',
                value: Array.from(mentionedTerms).join(', '),
                short: false,
              },
            ],
          }),
          footer: `<https://news.ycombinator.com/item?id=${
            originalPost ? originalPost.id : post.id
          }|${
            originalPost?.title // if original post exists, add a footer with the link to it
              ? `on: ${truncateString(originalPost.title, 40)}` // truncate the title to max 40 chars
              : 'Hacker News'
          }> | <!date^${
            post.time
          }^{date_short_pretty} at {time}^${`https://news.ycombinator.com/item?id=${post.id}`}|Just Now>`,
          footer_icon:
            'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/Y_Combinator_logo.svg/1024px-Y_Combinator_logo.svg.png',
        },
      },
    }),
  });
  const trackResponse = await trackUnfurls(team_id); // track unfurl usage for a team

  return res.status(200).json({
    response,
    trackResponse,
  });
}

export function verifyRequestWithToken(req: NextApiRequest) {
  const { token } = req.body;
  return token === process.env.SLACK_VERIFICATION_TOKEN;
}

export async function handleUninstall(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (!verifyRequestWithToken(req))
    // verify that the request is coming from the correct Slack team
    // here we use the verification token because for some reason signing secret doesn't work
    return res.status(403).json({
      message: 'Nice try buddy. Slack signature mismatch.',
    });
  const { team_id } = req.body;
  const response = await clearDataForTeam(team_id);
  const logResponse = await log(
    'Team *`' + team_id + '`* just uninstalled the bot :cry:',
  );
  return res.status(200).json({
    response,
    logResponse,
  });
}

export async function log(message: string) {
  /* Log a message to the console */
  console.log(message);
  if (!process.env.VERCEL_SLACK_HOOK) return;
  try {
    return await fetch(process.env.VERCEL_SLACK_HOOK, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: message,
            },
          },
        ],
      }),
    });
  } catch (e) {
    console.log(`Failed to log to Vercel Slack. Error: ${e}`);
  }
}

export const boldBlock = (text: string) => [
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*${text}*`,
    },
  },
];

export const configureBlocks = (
  keywords: string[],
  channel: string,
  unfurls: number,
  notifications: number,
  feedback?: {
    keyword?: string;
    channel?: string;
  },
) => [
  {
    type: 'header',
    text: {
      type: 'plain_text',
      text: ':hammer_and_wrench:  Bot Configuration  :hammer_and_wrench:',
    },
  },
  {
    type: 'context',
    block_id: 'stats',
    elements: [
      {
        type: 'mrkdwn',
        text: `Current Usage: ${unfurls} link previews shown, ${notifications} notifications sent |  <https://slack.com/apps/A03QV0U65HN|More Configuration Settings>`,
      },
    ],
  },
  {
    type: 'divider',
  },
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: ':bulb: KEYWORDS :bulb:',
    },
  },
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text:
        keywords.length > 0
          ? "Here's the list of keywords that you're currently tracking:"
          : '_No keywords configured yet._',
    },
  },
  ...(keywords.length > 0
    ? keywords.map((keyword: any) => ({
        type: 'section',
        block_id: `keyword_${keyword}`,
        text: {
          type: 'mrkdwn',
          text: '`' + keyword + '`',
        },
        accessory: {
          action_id: 'remove_keyword',
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Remove',
          },
          value: keyword,
        },
      }))
    : []),
  {
    type: 'input',
    dispatch_action: true,
    element: {
      type: 'plain_text_input',
      action_id: 'add_keyword',
      placeholder: {
        type: 'plain_text',
        text: 'Add a keyword (must be between 3 and 30 characters)',
      },
      dispatch_action_config: {
        trigger_actions_on: ['on_enter_pressed'],
      },
      min_length: 3,
      max_length: 30,
      focus_on_load: true,
    },
    label: {
      type: 'plain_text',
      text: ' ',
    },
  },
  ...(feedback?.keyword
    ? [
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: feedback.keyword,
            },
          ],
        },
      ]
    : []),
  {
    type: 'divider',
  },
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: ':hash: CHANNEL :hash:',
    },
  },
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: 'Select a public channel to receive notifications in:',
    },
    accessory: {
      action_id: 'set_channel',
      type: 'conversations_select',
      placeholder: {
        type: 'plain_text',
        text: 'Select a channel...',
        emoji: true,
      },
      ...(channel ? { initial_conversation: channel } : {}),
    },
  },
  ...(feedback?.channel
    ? [
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: feedback.channel,
            },
          ],
        },
      ]
    : []),
  {
    type: 'divider',
  },
  {
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: 'Made and <https://slacker.run/|open-sourced> with :black_heart: by <https://vercel.com/|▲ Vercel>',
      },
    ],
  },
];

export async function respondToSlack(
  res: NextApiResponse,
  response_url: string,
  teamId: string,
  feedback?: {
    keyword?: string;
    channel?: string;
  },
) {
  const { keywords, channel, unfurls, notifications } =
    await getTeamConfigAndStats(teamId); // get the latest state of the bot configurations to make sure it's up to date

  // respond to Slack with the new state of the bot
  const response = await fetch(response_url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      blocks: configureBlocks(
        keywords,
        channel,
        unfurls,
        notifications,
        feedback,
      ),
    }),
  });
  return res.status(200).json(response);
}

export async function postToChannelId(
  channelId: string,
  res: NextApiResponse,
  text: string,
) {
  const hasSentText = await existsCacheThanSet(text);
  if (hasSentText) {
    return res.status(200).send('');
  }

  const message = {
    channel: channelId,
    text: text,
  };
  const url = 'https://slack.com/api/chat.postMessage';

  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${bot_token}`,
      },
      body: JSON.stringify(message),
    });
    res.status(200).send('');
  } catch (err) {
    console.log(err);
    res.send({
      response_type: 'ephemeral',
      text: `${err}`,
    });
  }
}

export async function postBlockToChannelId(
  channelId: string,
  res: NextApiResponse,
  text: string,
) {
  const message = {
    channel: channelId,
    blocks: boldBlock(text),
  };
  const url = 'https://slack.com/api/chat.postMessage';

  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${bot_token}`,
      },
      body: JSON.stringify(message),
    });
    res.status(200).send('');
  } catch (err) {
    console.log(err);
    res.send({
      response_type: 'ephemeral',
      text: `${err}`,
    });
  }
}

export const buildMarkdown = (text: string) => [
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `${text}`,
    },
  },
];

export async function postToUserId(
  userId: string,
  res: NextApiResponse,
  text: string,
) {
  const message = {
    channel: userId,
    text: text,
    // blocks: buildMarkdown(text),
  };
  const url = 'https://slack.com/api/chat.postMessage';

  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${bot_token}`,
      },
      body: JSON.stringify(message),
    });
    res.status(200).send('');
  } catch (err) {
    console.log(err);
    res.send({
      response_type: 'ephemeral',
      text: `${err}`,
    });
  }
}

export async function postToUserIdHr(
  userId: string,
  res: NextApiResponse,
  text: string,
) {
  const message = {
    channel: userId,
    text: text,
    // blocks: buildMarkdown(text),
  };
  const url = 'https://slack.com/api/chat.postMessage';

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${bot_hr_token}`,
      },
      body: JSON.stringify(message),
    });
    const data = await response.json();
    res.status(200).send(data);
  } catch (err) {
    console.log(err);
    res.send({
      response_type: 'ephemeral',
      text: `${err}`,
    });
  }
}

export async function postToChannel(
  channel: string,
  res: NextApiResponse,
  payload: string,
) {
  console.log('channel:', channel);
  const channelId = await channelNameToId(channel);
  console.log('channelId:', channelId);

  if (!channelId) {
    throw new Error(`Channel "${channel}" not found.`);
  }

  return await postToChannelId(channelId, res, payload);
}

export async function postToProd(res: NextApiResponse, payload: string) {
  await postToChannelId(prodChannel, res, payload);
}

export async function postToTest(res: NextApiResponse, payload: string) {
  await postToChannelId(testChannel, res, payload);
}

export async function channelNameToId(channelName: string): Promise<string> {
  let id: string = '';

  try {
    const url = 'https://slack.com/api/conversations.list';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${bot_token}`,
      },
    });
    const data = await response.json();

    data.channels.forEach((element: { name: string; id: string }) => {
      if (element.name === channelName) {
        id = element.id;
      }
    });
    if (id) {
      return id;
    }
  } catch (err) {
    console.log(err);
  }
  return id;
}

export async function userIdToName(userId: string) {
  try {
    const url: string = `https://slack.com/api/users.info?user=${userId}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${bot_token}`,
      },
    });
    const data = await response.json();

    if (data.ok) {
      return data.user.name;
    } else {
      return 'unknown';
    }
  } catch (err) {
    console.log(err);
  }
}

export async function emailToUserId(email: string): Promise<string> {
  try {
    const url: string = `https://slack.com/api/users.lookupByEmail?email=${email}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${bot_token}`,
      },
    });
    const data = await response.json();

    if (data.ok) {
      return data.user.id as string;
    }
  } catch (err) {
    console.log(err);
  }
  return 'unknown';
}

export async function deleteMessage(res: NextApiResponse, url: string) {
  const parts = url.split('/');
  const channelId = parts[parts.length - 2];
  const lastPartWithP = parts[parts.length - 1];
  const ts = lastPartWithP.slice(1, -6) + '.' + lastPartWithP.slice(-6);

  const message = {
    channel: channelId,
    ts: ts,
  };

  try {
    const url: string = 'https://slack.com/api/chat.delete';
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${bot_token}`,
      },
      body: JSON.stringify(message),
    });

    res.status(200).send('');
  } catch (err) {
    console.log(err);
    res.send({
      response_type: 'ephemeral',
      text: `${err}`,
    });
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

export async function setProfileStatus(
  res: NextApiResponse,
  emoji: string,
  text: string,
) {
  const message = {
    profile: {
      status_emoji: emoji,
      status_text: text,
    },
  };

  try {
    const url: string = 'https://slack.com/api/users.profile.set';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${user_token}`,
      },
      body: JSON.stringify(message),
    });

    const data = await response.json();
    if (!data.ok) {
      return res.status(200).send({ message: `${data.error}` });
    }

    return res.status(200).send({ message: 'Status updated' });
  } catch (err) {
    console.log(err);
    res.send({
      response_type: 'ephemeral',
      text: `${err}`,
    });
  }
}

export async function getProfileStatus() {
  try {
    const url: string = 'https://slack.com/api/users.profile.get';
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${user_token}`,
      },
    });

    const data = await response.json();

    if (data.ok) {
      return {
        status_emoji: data.profile.status_emoji,
        status_text: data.profile.status_text,
      };
    } else {
      return null;
    }
  } catch (err) {
    console.log(err);
    return null;
  }
}

export async function getThreadReply(channelId: string, ts: string) {
  const url = `https://slack.com/api/conversations.replies?channel=${channelId}&ts=${ts}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${bot_token}`,
      },
    });
    const data = await response.json();
    if (data.of) {
      return data.messages;
    } else {
      return 'unknown';
    }
  } catch (err) {
    console.log(err);
  }
}

export async function threadReply(
  channelId: string,
  ts: string,
  res: NextApiResponse,
  text: string,
) {
  // const hasSentText = await existsCacheThanSet(text);
  // if (hasSentText) {
  //   return res.status(200).send('');
  // }

  const message = {
    channel: channelId,
    text: text,
    thread_ts: ts,
  };
  const url = 'https://slack.com/api/chat.postMessage';

  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${bot_token}`,
      },
      body: JSON.stringify(message),
    });
    res.status(200).send('');
  } catch (err) {
    console.log(err);
    res.send({
      response_type: 'ephemeral',
      text: `${err}`,
    });
  }
}

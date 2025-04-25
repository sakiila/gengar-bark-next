import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { getCache, setCache } from '../upstash/upstash';

export const bot_token = process.env.SLACK_BOT_TOKEN as string;
export const bot_hr_token = process.env.SLACK_BOT_HR_TOKEN as string;
export const user_token = process.env.SLACK_USER_TOKEN as string;
export const signing_secret = process.env.SLACK_SIGNING_SECRET as string;
export const signing_hr_Secret = process.env.SLACK_SIGNING_HR_SECRET as string;
export const prodChannel = process.env.PROD_CHANNEL as string;
export const testChannel = process.env.TEST_CHANNEL as string;
export const personalToken = process.env.PERSONAL_TOKEN as string;
export const personalCookie = process.env.PERSONAL_COOKIE as string;

export function verifyRequest(req: NextApiRequest) {
  /* Verify that requests are genuinely coming from Slack and not a forgery */
  const {
    "x-slack-signature": slack_signature,
    "x-slack-request-timestamp": timestamp,
  } = req.headers as {
    [key: string]: string;
  };

  if (!slack_signature || !timestamp) {
    return {
      status: false,
      message: "No slack signature or timestamp found in request headers.",
    };
  }
  if (process.env.SLACK_SIGNING_SECRET === undefined) {
    return {
      status: false,
      message: "`SLACK_SIGNING_SECRET` env var is not defined.",
    };
  }
  if (
    Math.abs(Math.floor(new Date().getTime() / 1000) - parseInt(timestamp)) >
    60 * 5
  ) {
    return {
      status: false,
      message: "Nice try buddy. Slack signature mismatch.",
    };
  }
  const req_body = new URLSearchParams(req.body).toString(); // convert body to URL search params
  const sig_basestring = "v0:" + timestamp + ":" + req_body; // create base string
  const my_signature =
    "v0=" +
    crypto
      .createHmac("sha256", signing_secret)
      .update(sig_basestring)
      .digest("hex"); // create signature

  if (
    crypto.timingSafeEqual(
      Buffer.from(slack_signature),
      Buffer.from(my_signature),
    )
  ) {
    return {
      status: true,
      message: "Verified Request.",
    };
  } else {
    return {
      status: false,
      message: "Nice try buddy. Slack signature mismatch.",
    };
  }
}

export function verifyHrRequest(req: NextApiRequest) {
  /* Verify that requests are genuinely coming from Slack and not a forgery */
  const {
    "x-slack-signature": slack_signature,
    "x-slack-request-timestamp": timestamp,
  } = req.headers as {
    [key: string]: string;
  };

  if (!slack_signature || !timestamp) {
    return {
      status: false,
      message: "No slack signature or timestamp found in request headers.",
    };
  }
  if (process.env.SLACK_SIGNING_HR_SECRET === undefined) {
    return {
      status: false,
      message: "`SLACK_SIGNING_HR_SECRET` env var is not defined.",
    };
  }
  if (
    Math.abs(Math.floor(new Date().getTime() / 1000) - parseInt(timestamp)) >
    60 * 5
  ) {
    return {
      status: false,
      message: "Nice try buddy. Slack signature mismatch.",
    };
  }
  const req_body = new URLSearchParams(req.body).toString(); // convert body to URL search params
  const sig_basestring = "v0:" + timestamp + ":" + req_body; // create base string
  const my_signature =
    "v0=" +
    crypto
      .createHmac("sha256", signing_hr_Secret)
      .update(sig_basestring)
      .digest("hex"); // create signature

  if (
    crypto.timingSafeEqual(
      Buffer.from(slack_signature),
      Buffer.from(my_signature),
    )
  ) {
    return {
      status: true,
      message: "Verified Request.",
    };
  } else {
    return {
      status: false,
      message: "Nice try buddy. Slack signature mismatch.",
    };
  }
}

export const reminderBlock = (
  reminder: string,
  text: string,
  imageUrl: string,
) => [
  {
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*提醒${reminder}小助手*\n ${text}`,
    },
  },
  {
    type: "image",
    title: {
      type: "plain_text",
      text: `提醒${reminder}小助手`,
      emoji: true,
    },
    image_url: `${imageUrl}`,
    alt_text: "by dall-e",
  },
];

export const boldBlock = (text: string) => [
  {
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*${text}*`,
    },
  },
];

export const textToMarkdown = (text: string) => [
  {
    type: "section",
    text: {
      type: "mrkdwn",
      text: `${text}`,
    },
  },
];

export async function postToChannelId(
  channelId: string,
  res: NextApiResponse,
  text: string,
) {
  const message = {
    channel: channelId,
    text: text,
  };
  const url = "https://slack.com/api/chat.postMessage";

  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${bot_token}`,
      },
      body: JSON.stringify(message),
    });
    res.status(200).send("");
  } catch (err) {
    console.log(err);
    res.send({
      response_type: "ephemeral",
      text: `${err}`,
    });
  }
}

export async function postReminderToProd(
  res: NextApiResponse,
  reminder: string,
  text: string,
  imageUrl: string,
) {
  await postReminderBlockToChannelId(
    prodChannel,
    res,
    reminder,
    text,
    imageUrl,
  );
}

export async function postReminderBlockToChannelId(
  channelId: string,
  res: NextApiResponse,
  reminder: string,
  text: string,
  imageUrl: string,
) {
  const message = {
    channel: channelId,
    blocks: reminderBlock(reminder, text, imageUrl),
  };
  const url = "https://slack.com/api/chat.postMessage";

  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${bot_token}`,
      },
      body: JSON.stringify(message),
    });
    res.status(200).send("");
  } catch (err) {
    console.log(err);
    res.send({
      response_type: "ephemeral",
      text: `${err}`,
    });
  }
}

export async function postBoldBlockToChannelId(
  channelId: string,
  res: NextApiResponse,
  text: string,
) {
  const message = {
    channel: channelId,
    blocks: boldBlock(text),
  };
  const url = "https://slack.com/api/chat.postMessage";

  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${bot_token}`,
      },
      body: JSON.stringify(message),
    });
    res.status(200).send("");
  } catch (err) {
    console.log(err);
    res.send({
      response_type: "ephemeral",
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
  const url = "https://slack.com/api/chat.postMessage";

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${bot_hr_token}`,
      },
      body: JSON.stringify(message),
    });
    const data = await response.json();
    console.log("data: ", data);
    res.status(200).send("");
  } catch (err) {
    console.log(err);
    res.send({
      response_type: "ephemeral",
      text: `${err}`,
    });
  }
}

export async function postToUserIdHrDirect(
  userId: string,
  text: string,
): Promise<any> {
  const message = {
    channel: userId,
    // text: text,
    blocks: [JSON.parse(text)],
    unfurl_links: false,
  };

  const url = "https://slack.com/api/chat.postMessage";
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${bot_hr_token}`,
      },
      body: JSON.stringify(message),
    });

    // Check if the response status is not successful
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Make sure to handle this error in your calling function
    if (data.error) {
      throw new Error(data.error);
    }

    return data; // now it returns a JavaScript object
  } catch (err) {
    if (err instanceof Error) {
      throw new Error(`postToUserIdHrDirect failed: ${err.message}`);
    } else {
      throw new Error(`postToUserIdHrDirect failed: ${err}`);
    }
  }
}

export async function postToProd(res: NextApiResponse, payload: string) {
  await postToChannelId(prodChannel, res, payload);
}

export async function postToTest(res: NextApiResponse, payload: string) {
  await postToChannelId(testChannel, res, payload);
}

export async function userIdToName(userId: string) {
  try {
    const url: string = `https://slack.com/api/users.info?user=${userId}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${bot_token}`,
      },
    });
    const data = await response.json();

    if (data.ok) {
      return data.user.name;
    } else {
      return "unknown";
    }
  } catch (err) {
    console.log(err);
  }
}

export async function emailToUserId(email: string): Promise<string> {
  try {
    const url: string = `https://slack.com/api/users.lookupByEmail?email=${email}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
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
  return "unknown";
}

export async function deleteMessage(res: NextApiResponse, url: string) {
  const parts = url.split("/");
  const channelId = parts[parts.length - 2];
  const lastPartWithP = parts[parts.length - 1];
  const ts = lastPartWithP.slice(1, -6) + "." + lastPartWithP.slice(-6);

  const message = {
    channel: channelId,
    ts: ts,
  };

  try {
    const url: string = "https://slack.com/api/chat.delete";
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${bot_token}`,
      },
      body: JSON.stringify(message),
    });
    console.log("response: ", response.body);

    res.status(200).send("");
  } catch (err) {
    console.log(err);
    res.send({
      response_type: "ephemeral",
      text: `${err}`,
    });
  }
}

export async function getAddedUserId(name: string) {
  var myHeaders = new Headers();
  myHeaders.append("authority", "moegoworkspace.slack.com");
  myHeaders.append("accept", "*/*");
  myHeaders.append("accept-language", "en,zh-CN;q=0.9,zh;q=0.8");
  myHeaders.append("cookie", personalCookie);
  myHeaders.append(
    "user-agent",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  );

  var formdata = new FormData();
  formdata.append("token", personalToken);
  formdata.append("page", "1");
  formdata.append("count", "2");
  formdata.append("sort_by", "created");
  formdata.append("sort_dir", "desc");

  const response = await fetch(
    "https://moegoworkspace.slack.com/api/emoji.adminList",
    {
      method: "POST",
      headers: myHeaders,
      body: formdata,
      redirect: "follow",
    },
  );
  const data = await response.json();
  if (data.emoji == undefined) {
    return "unknown";
  }
  const foundEmoji = data.emoji.find(
    (emoji: { name: string; user_id: string }) => emoji.name == name,
  );
  return foundEmoji ? foundEmoji.user_id : "unknown";
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
    const url: string = "https://slack.com/api/users.profile.set";
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${user_token}`,
      },
      body: JSON.stringify(message),
    });

    const data = await response.json();
    if (!data.ok) {
      return res.status(200).send({ message: `${data.error}` });
    }

    return res.status(200).send({ message: "Status updated" });
  } catch (err) {
    console.log(err);
    res.send({
      response_type: "ephemeral",
      text: `${err}`,
    });
  }
}

export async function getProfileStatus() {
  try {
    const url: string = "https://slack.com/api/users.profile.get";
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
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

// export async function getThreadReply(channelId: string, ts: string) {
//   const url = `https://slack.com/api/conversations.replies?channel=${channelId}&ts=${ts}&inclusive=true`;
//
//   try {
//     const response = await fetch(url, {
//       method: "GET",
//       headers: {
//         "Content-Type": "application/json; charset=utf-8",
//         Authorization: `Bearer ${bot_token}`,
//       },
//     });
//     const data = await response.json();
//     if (data.ok) {
//       return data.messages;
//     } else {
//       return "unknown";
//     }
//   } catch (err) {
//     console.log(err);
//   }
// }

export async function threadReply(
  channelId: string,
  ts: string,
  res: NextApiResponse,
  text: string,
) {
  const message = {
    channel: channelId,
    text: text,
    thread_ts: ts,
    blocks: textToMarkdown(text),
  };
  const url = "https://slack.com/api/chat.postMessage";

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${bot_token}`,
      },
      body: JSON.stringify(message),
    });
    const data = await response.json();
    // console.log("threadReply data: ", data);
    return res.status(200).send("");
  } catch (err) {
    console.log(err);
    return res.status(200).send({
      response_type: "ephemeral",
      text: `${err}`,
    });
  }
}

export async function responseUrl(url: string, text: string) {
  try {
    const response = await fetch(url.trim(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${bot_token}`,
      },
      body: JSON.stringify({ text: text, response_type: "in_channel" }),
    });
  } catch (err) {
    console.log(err);
  }
}

export async function setStatus(
  res: NextApiResponse,
  channelId: string,
  ts: string,
) {
  const message = {
    channel_id: channelId,
    thread_ts: ts,
    status: "is working on your request...",
  };

  try {
    const url: string = "https://slack.com/api/assistant.threads.setStatus";
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${bot_token}`,
      },
      body: JSON.stringify(message),
    });

    const data = await response.json();
    if (!data.ok) {
      return res.status(200).send("");
    }

    return res.status(200).send("");
  } catch (err) {
    console.log(err);
    res.send({
      response_type: "ephemeral",
      text: `${err}`,
    });
  }
}

export async function getUserId(email: string): Promise<string> {
  let userId = await getCache(email);
  // console.log('userId = ', userId);
  if (!userId) {
    userId = await emailToUserId(email);
    await setCache(email, userId);
  }
  return userId;
}

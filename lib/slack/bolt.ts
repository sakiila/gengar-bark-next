import { App } from '@slack/bolt';
import { NextApiResponse } from 'next';
import { bot_token } from '@/lib/slack/slack';

// Initializes your app with your bot token and signing secret
const slack = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

// (async () => {
//   // Start your app
//   await app.start(process.env.PORT || 3000);
//
//   console.log('⚡️ Bolt app is running!');
// })();


export async function postMessage(
  userId: string,
  text: string,
) {

  await slack.client.chat.postMessage({
    channel: userId,
    text: text,
  });

  console.log('Message sent');

  // const message = {
  //   channel: userId,
  //   text: text,
  //   // blocks: buildMarkdown(text),
  // };
  // const url = "https://slack.com/api/chat.postMessage";
  //
  // try {
  //   await fetch(url, {
  //     method: "POST",
  //     headers: {
  //       "Content-Type": "application/json; charset=utf-8",
  //       Authorization: `Bearer ${bot_token}`,
  //     },
  //     body: JSON.stringify(message),
  //   });
  // } catch (err) {
  //   console.log(err);
  //   res.send({
  //     response_type: "ephemeral",
  //     text: `${err}`,
  //   });
  // }
}

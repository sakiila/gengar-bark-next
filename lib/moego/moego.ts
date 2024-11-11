import { NextApiRequest, NextApiResponse } from "next";
import { threadReply } from "@/lib/slack";
import { generatePromptForMoeGo, getGPT4mini } from "@/lib/openai";
import { GPTResponse } from "@/lib/moego/types";
import { postgres } from "@/lib/supabase";
import compositeCreateAppointment from "./composite";

export async function execute_moego(req: NextApiRequest, res: NextApiResponse) {
  const channel = req.body.event.channel; // channel the message was sent in
  const ts = req.body.event.thread_ts ?? req.body.event.ts; // message timestamp
  const text = req.body.event.text;
  const userId = req.body.event.user;

  const { data: dbUser, error } = await postgres
    .from("user")
    .select("*")
    .eq("user_id", userId);

  if (error || !dbUser || dbUser.length === 0) {
    throw new Error("Failed to fetch Slack user");
  }

  const prompts = await generatePromptForMoeGo(text);
  const gptResponse = await getGPT4mini(prompts);

  console.log("gptResponse:", gptResponse);

  const result = JSON.parse(
    gptResponse.choices[0].message.content as string,
  ) as GPTResponse;
  console.log("result:", result);

  const slackName = dbUser[0].real_name_normalized;
  let email = dbUser[0].email;
  if (result.email && result.email.length > 0) {
    email = result.email;
  }

  let message;
  try {
    switch (result.intent) {
      case "create":
        message = await compositeCreateAppointment(
          slackName,
          email,
          result.quantity,
          result.customerName,
          result.date,
          result.time,
        );
        break;
      default:
        message = "Not supported temporarily.";
        break;
    }
  } catch (e) {
    const error = e as Error;
    message = error.message;
  }

  const newArr = [
    {
      email: dbUser[0].email,
      user_id: userId,
      text: text,
      result: message,
    },
  ];
  await postgres.from("user_input").insert(newArr).select();

  try {
    await threadReply(channel, ts, res, `${message}`);
  } catch (e) {
    console.log(e);
  }
}

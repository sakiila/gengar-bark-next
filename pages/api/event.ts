import { NextApiRequest, NextApiResponse } from "next";
import { verifyRequest } from "@/lib/slack";
import emoji_changed from "@/lib/events_handlers/emoji_changed";
import team_join from "@/lib/events_handlers/team_join";
import user_status_changed from "@/lib/events_handlers/user_status_changed";
import user_change from "@/lib/events_handlers/user_change";
import channel_created from "@/lib/events_handlers/channel_created";
import channel_archive from "@/lib/events_handlers/channel_archive";
import {
  response_container,
  send_gpt_response_in_channel,
  set_suggested_prompts,
} from "@/lib/events_handlers/chat";
import { log } from "next-axiom";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    // Log incoming request with structured data
    log.info("Incoming event request", {
      type: req.body.type,
      event_type: req.body.event?.type,
      channel_type: req.body.event?.channel_type,
      user_id: req.body.event?.user,
      timestamp: new Date().toISOString(),
    });

    const type = req.body.type;

    if (type === "url_verification") {
      log.debug("Processing URL verification");
      return res.status(200).json(req.body.challenge);
    }

    if (!verifyRequest(req)) {
      log.warn("Invalid request signature", {
        ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
      });
      return res.status(403).send("Forbidden");
    }

    if (type === "event_callback") {
      const event_type = req.body.event.type;

      log.info("Processing event callback", {
        event_type,
        team_id: req.body.team_id,
        api_app_id: req.body.api_app_id,
      });

      try {
        switch (event_type) {
          case "emoji_changed":
            await emoji_changed(req, res);
            break;
          case "team_join":
            await team_join(req, res);
            break;
          case "user_status_changed":
            await user_status_changed(req, res);
            break;
          case "user_change":
            await user_change(req, res);
            break;
          case "channel_created":
            await channel_created(req, res);
            break;
          case "channel_archive":
            await channel_archive(req, res);
            break;
          case "app_mention":
            await send_gpt_response_in_channel(req, res);
            break;
          case "assistant_thread_started":
            await set_suggested_prompts(req, res);
            break;
          case "message":
            const { channel_type, hidden, bot_profile } = req.body.event;
            if (channel_type === "im" && !hidden && !bot_profile) {
              await response_container(req, res);
            }
            break;
          default:
            log.warn("Unhandled event type", { event_type });
            break;
        }
      } catch (error) {
        log.error("Error processing event", {
          event_type,
          error: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
        });

        // Only send 500 if response hasn't been sent yet
        if (!res.headersSent) {
          res.status(500).json({ error: "Internal server error" });
        }
      }
    }

    // If we haven't sent a response yet, send a 200
    if (!res.headersSent) {
      res.status(200).end();
    }
  } catch (error) {
    log.error("Fatal error in event handler", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
}

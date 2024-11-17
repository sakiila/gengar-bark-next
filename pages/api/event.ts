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
import { logger } from "@/lib/logger";

// Create a request-scoped logger with context
const createRequestLogger = (req: NextApiRequest) => {
  return logger.scope('event-handler', {
    url: req.url,
    method: req.method,
    userAgent: req.headers['user-agent'],
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
  });
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const log = createRequestLogger(req);

  // Set a timeout for log flushing
  const logFlushTimeout = setTimeout(() => {
    log.flush().catch((err) => {
      // Use console.error as fallback if logging fails
      console.error('Failed to flush logs:', err);
    });
  }, 2000);

  try {
    const eventData = {
      type: req.body.type,
      event_type: req.body.event?.type,
      timestamp: new Date().toISOString(),
      request_id: req.headers['x-request-id'] || undefined,
    };

    log.info("Incoming event request", eventData);

    const type = req.body.type;

    if (type === "url_verification") {
      log.debug("Processing URL verification", { challenge: req.body.challenge });
      return res.status(200).json({ challenge: req.body.challenge });
    }

    if (!verifyRequest(req)) {
      log.warn("Invalid request signature");
      return res.status(403).json({ error: "Forbidden" });
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
            log.warn("Unhandled event type", {
              event_type,
              body: JSON.stringify(req.body)
            });
            break;
        }
      } catch (error) {
        log.error("Error processing event", error instanceof Error ? error : new Error('Unknown error'));
        if (!res.headersSent) {
          return res.status(500).json({ error: "Internal server error" });
        }
      }
    }

    if (!res.headersSent) {
      return res.status(200).end();
    }
  } catch (error) {
    log.error("Fatal error in event handler", error instanceof Error ? error : new Error('Unknown error'));
    if (!res.headersSent) {
      return res.status(500).json({ error: "Internal server error" });
    }
  }
}

import { setTimeout } from "timers/promises";
import { getUserId, threadReply } from "@/lib/slack";
import { NextApiRequest, NextApiResponse } from "next";
import { AxiomLogger, logger } from '@/lib/logger';

// Types for Pipeline Node response
interface PipelineNode {
  _links: {
    self: { href: string };
    steps?: { href: string };
  };
  displayName: string;
  id: string;
  state: string;
  result?: string;
}

// Types for Pipeline Step response
interface PipelineStep {
  displayName: string;
  input?: {
    message: string;
  };
}

interface EmailResult {
  repo: string;
  buildUrl: string;
  emails: string[];
}

// Types for the request parameters
interface JenkinsPipelineParameter {
  name: string;
  value: string | boolean | number;
}

interface JenkinsPipelineRequest {
  parameters: JenkinsPipelineParameter[];
}

// Types for the response
interface JenkinsLink {
  _class: string;
  href: string;
}

interface JenkinsLinks {
  parent: JenkinsLink;
  tests: JenkinsLink;
  log: JenkinsLink;
  self: JenkinsLink;
  blueTestSummary: JenkinsLink;
  actions: JenkinsLink;
  changeSet: JenkinsLink;
  artifacts: JenkinsLink;
}

interface JenkinsCause {
  _class: string;
  shortDescription: string;
  userId: string;
  userName: string;
}

interface JenkinsPipelineResponse {
  _class: string;
  _links: JenkinsLinks;
  actions: any[];
  artifactsZipFile: null;
  causeOfBlockage: string;
  causes: JenkinsCause[];
  changeSet: any[];
  description: null;
  durationInMillis: null;
  enQueueTime: null;
  endTime: null;
  estimatedDurationInMillis: null;
  id: string;
  name: null;
  organization: string;
  pipeline: string;
  replayable: boolean;
  result: string;
  runSummary: null;
  startTime: null;
  state: string;
  type: string;
  queueId: string;
}

const raw = JSON.stringify({
  "parameters": [
    {
      "name": "CI_ACTION",
      "value": "DEPLOY 部署: 将镜像部署到指定环境"
    },
    {
      "name": "CI_CLUSTER",
      "value": "PRODUCTION 生产集群 (BUILD 时不可选)"
    },
    {
      "name": "SKIP_CANARY",
      "value": true
    },
    {
      "name": "CI_CLEANUP_WORKSPACE",
      "value": false
    },
    {
      "name": "CI_DRY_RUN",
      "value": false
    },
    {
      "name": "CI_DEBUG",
      "value": false
    },
    {
      "name": "CI_VERSION",
      "value": "100"
    }
  ]
});

const baseUrl = "https://ci.devops.moego.pet";

const token =
  '"jenkins-timestamper-offset=-28800000; jenkins-timestamper=system; jenkins-timestamper-local=true; MGDID=2faf4ece-a16d-11ef-82e4-baef83d8f731; MGSID-MIS=63168842.5c_wKWHmZscydLYDDKDJAYxszWdTIRYQ0AIti-VEmIU; intercom-device-id-oh5g31xm=8c239a5b-e88d-41db-af9e-134cff9a02c0; MGSID-B=63546919.WvMo-tueOCpKDoOc5zvtMstWWrzabWuptMKY9MxSiXU; intercom-session-oh5g31xm=cC9GdFZjWmhHNnQxVkk4V3dtNUl3azRBRWJya21SdWczYjZtUjV0VDR0eG40MDY2cG1xT3pMM2JPZXRUdVJwUi0tbWJWQjNuREhkbjdCQjdqNkVRcXEzQT09--f154454437b50984649700fd8b24f11e0eed6e8e; JSESSIONID.1dda8126=node01i49wtam5e05c1qlgqdrpgyxdg553384.node0; screenResolution=2560x1440"';

const createRequestLogger = (req: NextApiRequest) => {
  return logger.scope('event-handler', {
    url: req.url,
    method: req.method,
    userAgent: req.headers['user-agent'],
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    channel: req.body.event.channel,
    ts: req.body.event.thread_ts ?? req.body.event.ts,
    userId: req.body.event.user,
    text: req.body.event.text,
  });
};

/**
 * Triggers a Jenkins pipeline and returns the build ID
 * @returns Promise containing the build ID
 */
async function triggerJenkinsPipeline(repo: string): Promise<string> {
  const url = `${baseUrl}/blue/rest/organizations/jenkins/pipelines/MoeGolibrary/pipelines/${repo}/branches/online/runs/`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        accept: "*/*",
        "accept-language": "en,zh-CN;q=0.9,zh;q=0.8",
        "content-type": "application/json",
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        "jenkins-crumb":
          "89d4a053c350b054ecb8bcfc40a5fe88606c4db55c1a2f329ef6f966607bd698",
        origin: baseUrl,
        cookie: token,
      },
      body: raw,
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: JenkinsPipelineResponse = await response.json();
    return data.id;
  } catch (error) {
    logger.error("triggerJenkinsPipeline", error instanceof Error ? error : new Error('Unknown error'));
    throw error;
  }
}

/**
 * Extract email addresses from text using regex
 */
function extractEmails(text: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@moego\.pet/g;
  const matches = text.match(emailRegex) || [];
  return Array.from(new Set(matches));
}

/**
 * Get build URL from run ID
 */
function getBuildUrl(repo: string, runId: string): string {
  return `https://ci.devops.moego.pet/blue/organizations/jenkins/MoeGolibrary%2F${repo}/detail/online/${runId}/pipeline/`;
}

/**
 * Fetch and process Jenkins pipeline data
 */
async function getJenkinsPipelineData(
  repo: string,
  runId: string,
  maxRetries: number = 200,
  retryDelay: number = 2000,
): Promise<EmailResult> {
  const headers = {
    accept: "*/*",
    "accept-language": "en,zh-CN;q=0.9,zh;q=0.8",
    "content-type": "application/json",
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "jenkins-crumb":
      "89d4a053c350b054ecb8bcfc40a5fe88606c4db55c1a2f329ef6f966607bd698",
    origin: baseUrl,
    cookie: token,
  };

  // Function to fetch nodes
  async function fetchNodes(): Promise<PipelineNode[]> {
    const nodesUrl = `${baseUrl}/blue/rest/organizations/jenkins/pipelines/MoeGolibrary/pipelines/${repo}/branches/online/runs/${runId}/nodes/?limit=10000`;
    const response = await fetch(nodesUrl, { headers });
    if (!response.ok || response.body === null) {
      throw new Error(`Failed to fetch nodes: ${response.statusText}`);
    }
    const data = await response.json();
    return data as PipelineNode[];
  }

  // Function to fetch steps
  async function fetchSteps(stepsUrl: string): Promise<PipelineStep[]> {
    const nodesUrl = `${baseUrl}${stepsUrl}`;
    const response = await fetch(nodesUrl, { headers });
    if (!response.ok) {
      throw new Error(`Failed to fetch steps: ${response.statusText}`);
    }
    return response.json();
  }

  let retries = 0;
  while (retries < maxRetries) {
    try {
      // Fetch nodes
      const nodes = await fetchNodes();

      // Find Production deployment node
      const productionNode = nodes.find((node) => {
        return node.displayName === "Deploy - PRODUCTION";
      });

      if (!productionNode || !productionNode._links.steps) {
        if (retries === maxRetries - 1) {
          throw new Error("Production deployment node not found");
        }
        await setTimeout(retryDelay);
        retries++;
        continue;
      }

      // Fetch steps for the production node
      const steps = await fetchSteps(productionNode._links.steps.href);

      // Find the input step with email information
      const inputStep = steps.find(
        (step) =>
          step.displayName === "Wait for interactive input" &&
          step.input?.message,
      );

      if (!inputStep || !inputStep.input) {
        if (retries === maxRetries - 1) {
          throw new Error("Input step not found");
        }
        await setTimeout(retryDelay);
        retries++;
        continue;
      }

      // Extract emails from the message
      const emails = extractEmails(inputStep.input.message);

      return {
        repo,
        buildUrl: getBuildUrl(repo, runId),
        emails,
      };
    } catch (error) {
      if (retries === maxRetries - 1) {
        throw error;
      }
      await setTimeout(retryDelay);
      retries++;
    }
  }

  throw new Error("Max retries reached");
}

/**
 * Format the result as required
 */
async function formatResult(result: EmailResult): Promise<string> {
  try {
    // First, get all user IDs in parallel
    const userIdsPromises = result.emails.map((email) =>
      getUserId(email.trim()),
    );
    const userIds = await Promise.all(userIdsPromises);

    // Filter and format valid user IDs
    const userMentions = userIds
      .filter((userId) => userId && userId !== "unknown")
      .map((userId) => `<@${userId}>`)
      .join(" ");

    // Include both email addresses and user mentions in the result
    return `<${result.buildUrl}|${result.repo}> ${userMentions}`;
  } catch (error) {
    logger.error("formatResult", error instanceof Error ? error : new Error('Unknown error'));
    // Fallback to just emails if user ID lookup fails
    return `<${result.buildUrl}|${result.repo}> ${result.emails.join(" ")}`;
  }
}

async function processEachPipeline(repo: string): Promise<string> {
  try {
    const runId = await triggerJenkinsPipeline(repo);
    logger.info(`Triggered pipeline for ${repo} with run ID ${runId}`);
    const result = await getJenkinsPipelineData(repo, runId);
    return formatResult(result);
  } catch (error) {
    logger.error("processEachPipeline", error instanceof Error ? error : new Error('Unknown error'));
    throw error;
  }
}

async function processPipeline(repos: string[] ): Promise<string> {
  try {
    const results = await Promise.all(repos.map(processEachPipeline));

    return results
      .map((item, index) => `${index + 1}. ${item}`)
      .join("\n")
      .concat(
        "\n*Please review the differences carefully and mark this message with a :white_check_mark: before QA approval.",
      );
  } catch (error) {
    logger.error("processPipeline", error instanceof Error ? error : new Error('Unknown error'));
    throw error;
  }
}

export async function execute_build(req: NextApiRequest, res: NextApiResponse) {
  const channel = req.body.event.channel; // channel the message was sent in
  const ts = req.body.event.thread_ts ?? req.body.event.ts; // message timestamp
  const text = req.body.event.text.trim();
  const [at, action, ...repos] = text.split(" ");

  const log = createRequestLogger(req);
  log.info("execute_build", { action, repos });

  if (repos.length === 0) {
    await threadReply(
      channel,
      ts,
      res,
      "Please provide at least one repository name.",
    );
    return;
  }

  let message = "";
  try {
    message = await processPipeline(repos);
  } catch (error) {
    log.error("execute_build", error instanceof Error ? error : new Error('Unknown error'));
    message = "Error processing pipeline: " + error;
  }

  try {
    await threadReply(channel, ts, res, `${message}`);
  } catch (e) {
    log.error("execute_build", e instanceof Error ? e : new Error('Unknown error'));
  }
}

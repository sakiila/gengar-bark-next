/**
 * GitHub Issue Tool for the AI Agent system.
 * Wraps existing createGitHubIssue() functionality from lib/github/create-issue.ts
 */

import { Tool, ToolResult, AgentContext, ToolParameterSchema } from '../types';
import { createGitHubIssue } from '@/lib/github/create-issue';

/**
 * Parameter schema for the GitHub Issue tool.
 * Defines repo, label, title, description, and jiraTickets parameters.
 */
const githubIssueParameterSchema: ToolParameterSchema = {
  type: 'object',
  properties: {
    repo: {
      type: 'string',
      description: 'The repository name to create the issue in (e.g., gengar-bark, moego-web)',
    },
    label: {
      type: 'string',
      description: 'Label for the issue (e.g., bug, feat, fix, ci, perf, docs, style, refactor, test, chore)',
    },
    title: {
      type: 'string',
      description: 'Title for the issue. If not provided, AI will generate one from the Slack thread',
    },
    description: {
      type: 'string',
      description: 'Detailed description for the issue body (optional)',
    },
    jiraTickets: {
      type: 'array',
      description: 'Related Jira ticket numbers (e.g., MER-123, CRM-456)',
      items: {
        type: 'string',
        description: 'A Jira ticket number',
      },
    },
  },
  required: ['repo'],
};

/**
 * GitHubIssueTool creates GitHub issues through the AI agent.
 * Wraps the existing createGitHubIssue() function and provides structured results.
 */
export class GitHubIssueTool implements Tool {
  name = 'create_github_issue';
  description = 'Create a new GitHub issue in the specified repository. Use this when users want to create bug reports, feature requests, or track tasks on GitHub.';
  parameters = githubIssueParameterSchema;
  cacheable = false; // Creating issues should never be cached

  /**
   * Execute the GitHub Issue tool to create a new issue.
   *
   * @param params - Tool parameters including repo, label, title, description, jiraTickets
   * @param context - Agent context with user and channel information
   * @returns ToolResult with the created issue URL and number
   */
  async execute(
    params: Record<string, unknown>,
    context: AgentContext
  ): Promise<ToolResult> {
    const { repo, label, title, description, jiraTickets } = params as {
      repo: string;
      label?: string;
      title?: string;
      description?: string;
      jiraTickets?: string[];
    };

    // Validate required parameters
    if (!repo) {
      return {
        success: false,
        error: 'Missing required parameter: repo is required',
        displayText: 'Could not create GitHub issue: missing repository name.',
      };
    }

    try {
      // Get user display name, fallback to userId
      const userName = context.userName || context.userId;

      // Call the existing createGitHubIssue function
      const result = await createGitHubIssue({
        repoName: repo,
        label,
        title,
        description,
        channel: context.channel,
        threadTs: context.threadTs,
        userName,
        jiraTickets,
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error,
          displayText: `❌ Failed to create GitHub issue: ${result.error}`,
        };
      }

      return {
        success: true,
        data: {
          issueUrl: result.issueUrl,
          issueNumber: result.issueNumber,
        },
        displayText: `✅ GitHub issue created successfully: <${result.issueUrl}|#${result.issueNumber}>`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      return {
        success: false,
        error: errorMessage,
        displayText: `❌ Failed to create GitHub issue: ${errorMessage}`,
      };
    }
  }
}

/**
 * Factory function to create a GitHubIssueTool instance.
 */
export function createGitHubIssueTool(): GitHubIssueTool {
  return new GitHubIssueTool();
}

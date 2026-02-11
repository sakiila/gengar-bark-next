/**
 * GitHub Review Tool for the AI Agent system.
 *
 * Detects GitHub PR links from conversation context and posts
 * a review request comment (@gemini-cli /review) on each PR.
 *
 * Handles:
 *  - Multiple PR links in a single message
 *  - Deduplication of same PR
 *  - Permission errors (401/403/404) with clear messages
 *  - Missing GitHub token configuration
 */

import { Tool, ToolResult, AgentContext, ToolParameterSchema } from '../types';
import { extractPRUrls, commentOnPR, ParsedPR } from '@/lib/github/github-api';

const DEFAULT_REVIEW_COMMENT = '@gemini-cli /review';

/**
 * Parameter schema for the GitHub Review tool.
 */
const githubReviewParameterSchema: ToolParameterSchema = {
  type: 'object',
  properties: {
    pr_urls: {
      type: 'string',
      description:
        'Text containing one or more GitHub PR URLs (e.g. https://github.com/owner/repo/pull/123). If not provided, the tool will attempt to extract PR URLs from the conversation context.',
    },
    comment: {
      type: 'string',
      description:
        'Custom comment to post on the PR. Defaults to "@gemini-cli /review".',
    },
  },
  required: [],
};

/**
 * GitHubReviewTool posts review request comments on GitHub PRs.
 */
export class GitHubReviewTool implements Tool {
  name = 'github_review';
  description =
    'Post a code review request comment on GitHub Pull Requests. ' +
    'Detects PR links from the message (e.g. https://github.com/owner/repo/pull/123) ' +
    'and comments "@gemini-cli /review" on each PR. Supports multiple PR links at once.';
  parameters = githubReviewParameterSchema;
  cacheable = false;

  /**
   * Execute the GitHub Review tool.
   *
   * @param params - Tool parameters
   * @param context - Agent context with conversation history
   * @returns ToolResult with the operation results
   */
  async execute(
    params: Record<string, unknown>,
    context: AgentContext
  ): Promise<ToolResult> {
    // 1. Check for GitHub token
    const token = process.env.GITHUB_PAT;
    if (!token) {
      return {
        success: false,
        error: 'GITHUB_PAT not configured',
        displayText:
          '❌ GitHub token not configured. Please set the `GITHUB_PAT` environment variable.',
      };
    }

    // 2. Collect text sources to extract PR URLs from
    const textSources: string[] = [];

    // From explicit parameter
    if (params.pr_urls && typeof params.pr_urls === 'string') {
      textSources.push(params.pr_urls);
    }

    // From conversation history
    if (context.conversationHistory && context.conversationHistory.length > 0) {
      for (const msg of context.conversationHistory) {
        textSources.push(msg.content);
      }
    }

    // 3. Extract PR URLs
    const allText = textSources.join('\n');
    const prs: ParsedPR[] = extractPRUrls(allText);

    if (prs.length === 0) {
      return {
        success: false,
        error: 'No PR links found',
        displayText:
          '🔍 No GitHub PR links found in the conversation. Please share a PR link like `https://github.com/owner/repo/pull/123`.',
      };
    }

    // 4. Determine comment content
    const comment =
      typeof params.comment === 'string' && params.comment.trim()
        ? params.comment.trim()
        : DEFAULT_REVIEW_COMMENT;

    // 5. Post comments on all PRs
    const results = await Promise.all(
      prs.map((pr) => commentOnPR(pr, comment, token))
    );

    // 6. Build response
    const succeeded = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    const lines: string[] = [];

    if (succeeded.length > 0) {
      lines.push(`✅ Successfully commented on ${succeeded.length} PR(s):`);
      for (const r of succeeded) {
        lines.push(`  • ${r.prUrl} → [comment](${r.commentUrl})`);
      }
    }

    if (failed.length > 0) {
      if (lines.length > 0) lines.push('');
      lines.push(`❌ Failed on ${failed.length} PR(s):`);
      for (const r of failed) {
        lines.push(`  • ${r.prUrl} — ${r.error}`);
      }
    }

    const displayText = lines.join('\n');

    return {
      success: failed.length === 0,
      data: { succeeded, failed, comment },
      displayText,
    };
  }
}

/**
 * Factory function to create a GitHubReviewTool instance.
 */
export function createGitHubReviewTool(): GitHubReviewTool {
  return new GitHubReviewTool();
}

/**
 * GitHub API Client
 *
 * Provides methods to interact with the GitHub API.
 * Uses a Personal Access Token (PAT) for authentication.
 */

import axios, { AxiosError } from 'axios';
import { logger } from '../utils/logger';

const GITHUB_API_BASE = 'https://api.github.com';

/**
 * Result of a GitHub API operation.
 */
export interface GitHubOperationResult {
  success: boolean;
  prUrl: string;
  owner: string;
  repo: string;
  prNumber: number;
  error?: string;
  commentUrl?: string;
}

/**
 * Parsed GitHub PR info from a URL.
 */
export interface ParsedPR {
  owner: string;
  repo: string;
  prNumber: number;
  originalUrl: string;
}

/**
 * Extract all GitHub PR URLs from a text string.
 * Supports formats:
 *   - https://github.com/owner/repo/pull/123
 *   - http://github.com/owner/repo/pull/123
 *   - github.com/owner/repo/pull/123
 *
 * @param text - Text to extract PR URLs from
 * @returns Array of parsed PR info
 */
export function extractPRUrls(text: string): ParsedPR[] {
  const prRegex = /(?:https?:\/\/)?github\.com\/([a-zA-Z0-9\-_.]+)\/([a-zA-Z0-9\-_.]+)\/pull\/(\d+)/g;
  const results: ParsedPR[] = [];
  const seen = new Set<string>();

  let match;
  while ((match = prRegex.exec(text)) !== null) {
    const key = `${match[1]}/${match[2]}/${match[3]}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push({
        owner: match[1],
        repo: match[2],
        prNumber: parseInt(match[3], 10),
        originalUrl: match[0],
      });
    }
  }

  return results;
}

/**
 * Post a comment on a GitHub Pull Request.
 *
 * @param pr - Parsed PR info
 * @param comment - Comment body to post
 * @param token - GitHub Personal Access Token
 * @returns Operation result
 */
export async function commentOnPR(
  pr: ParsedPR,
  comment: string,
  token: string
): Promise<GitHubOperationResult> {
  const { owner, repo, prNumber, originalUrl } = pr;
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/issues/${prNumber}/comments`;

  try {
    const response = await axios.post(
      url,
      { body: comment },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'GengarBark-Bot',
        },
        timeout: 10000,
      }
    );

    logger.info(`Successfully commented on PR ${originalUrl}`, {
      owner,
      repo,
      prNumber,
      commentId: response.data.id,
    });

    return {
      success: true,
      prUrl: originalUrl,
      owner,
      repo,
      prNumber,
      commentUrl: response.data.html_url,
    };
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    const status = axiosError.response?.status;
    const message = axiosError.response?.data?.message || axiosError.message;

    let errorMessage: string;
    switch (status) {
      case 401:
        errorMessage = 'GitHub token is invalid or expired. Please update GITHUB_PAT.';
        break;
      case 403:
        errorMessage = `No permission to comment on ${owner}/${repo}#${prNumber}. The token may lack 'repo' scope or you don't have access to this repository.`;
        break;
      case 404:
        errorMessage = `PR not found: ${owner}/${repo}#${prNumber}. The repository may be private or the PR doesn't exist.`;
        break;
      case 422:
        errorMessage = `Invalid request for ${owner}/${repo}#${prNumber}: ${message}`;
        break;
      default:
        errorMessage = `Failed to comment on ${owner}/${repo}#${prNumber}: ${status ? `HTTP ${status} - ` : ''}${message}`;
    }

    logger.error(`Failed to comment on PR ${originalUrl}`, {
      owner,
      repo,
      prNumber,
      status,
      error: errorMessage,
    });

    return {
      success: false,
      prUrl: originalUrl,
      owner,
      repo,
      prNumber,
      error: errorMessage,
    };
  }
}

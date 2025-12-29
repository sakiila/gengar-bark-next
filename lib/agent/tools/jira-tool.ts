/**
 * Jira Tool for the AI Agent system.
 * Wraps existing createIssue() functionality from lib/jira/create-issue.ts
 * Requirements: 3.5
 */

import { Tool, ToolResult, AgentContext, ToolParameterSchema } from '../types';
import { createIssue } from '@/lib/jira/create-issue';
import { getUser } from '@/lib/database/supabase';

/**
 * Parameter schema for the Jira tool.
 * Defines project, issueType, summary, and description parameters.
 */
const jiraParameterSchema: ToolParameterSchema = {
  type: 'object',
  properties: {
    project: {
      type: 'string',
      description: 'The Jira project key (e.g., MER, CRM, FIN, ERP, GRM, ENT)',
      enum: ['MER', 'CRM', 'FIN', 'ERP', 'GRM', 'ENT'],
    },
    issueType: {
      type: 'string',
      description: 'The type of Jira issue to create (e.g., Bug, Task, Story, Epic)',
      enum: ['Bug', 'Task', 'Story', 'Epic'],
    },
    summary: {
      type: 'string',
      description: 'A brief summary/title for the Jira issue',
    },
    description: {
      type: 'string',
      description: 'Detailed description of the issue (optional)',
    },
  },
  required: ['project', 'issueType', 'summary'],
};

/**
 * JiraTool creates Jira issues through the AI agent.
 * Wraps the existing createIssue() function and provides structured results.
 */
export class JiraTool implements Tool {
  name = 'create_jira_issue';
  description = 'Create a new Jira issue in the specified project. Use this when users want to create tickets, report bugs, or track tasks in Jira.';
  parameters = jiraParameterSchema;
  cacheable = false; // Creating issues should never be cached

  /**
   * Execute the Jira tool to create a new issue.
   * 
   * @param params - Tool parameters including project, issueType, summary, description
   * @param context - Agent context with user and channel information
   * @returns ToolResult with the created issue key and link
   */
  async execute(
    params: Record<string, unknown>,
    context: AgentContext
  ): Promise<ToolResult> {
    const { project, issueType, summary, description } = params as {
      project: string;
      issueType: string;
      summary: string;
      description?: string;
    };

    // Validate required parameters
    if (!project || !issueType || !summary) {
      return {
        success: false,
        error: 'Missing required parameters: project, issueType, and summary are required',
        displayText: 'Could not create Jira issue: missing required information.',
      };
    }

    try {
      // Get user information for the reporter
      let userName = context.userId;
      let userEmail: string | undefined;

      const user = await getUser(context.userId);
      if (user && user.length > 0) {
        userName = user[0].real_name_normalized || userName;
        userEmail = user[0].email;
      }

      // Build the command text that createIssue expects
      // Format: jira <projectKey> <issueType> [summary]
      const commandText = `jira ${project} ${issueType} ${summary}`;

      // Call the existing createIssue function
      const issueKey = await createIssue(
        commandText,
        context.channel,
        context.threadTs,
        userName,
        userEmail
      );

      const issueUrl = `https://moego.atlassian.net/browse/${issueKey}`;

      return {
        success: true,
        data: {
          issueKey,
          issueUrl,
          project,
          issueType,
          summary,
        },
        displayText: `✅ Jira issue created successfully: <${issueUrl}|${issueKey}>`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      return {
        success: false,
        error: errorMessage,
        displayText: `❌ Failed to create Jira issue: ${errorMessage}`,
      };
    }
  }
}

/**
 * Factory function to create a JiraTool instance.
 */
export function createJiraTool(): JiraTool {
  return new JiraTool();
}

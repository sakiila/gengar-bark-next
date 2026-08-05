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
    },
    issueType: {
      type: 'string',
      description: 'The type of Jira issue to create (e.g., Bug, Task, Story, Epic)',
    },
    summary: {
      type: 'string',
      description: 'A brief summary/title for the Jira issue',
    },
    description: {
      type: 'string',
      description: 'Detailed description of the issue (optional)',
    },
    csTicket: {
      type: 'string',
      description: 'Related CS ticket number to link (e.g., CS-1234). If present in the conversation, always pass it here.',
    },
  },
  required: [],
};

/**
 * JiraTool returns direct mention command text for Jira issue creation.
 */
export class JiraTool implements Tool {
  name = 'create_jira_issue';
  description = 'Create a new Jira issue in the specified project. Use this when users want to create tickets, report bugs, or track tasks in Jira.';
  parameters = jiraParameterSchema;
  cacheable = false; // Creating issues should never be cached

  /**
   * Execute the Jira tool to return direct creation text.
   * 
   * @param _params - Tool parameters
   * @param _context - Agent context
   * @returns ToolResult with target text
   */
  async execute(
    _params: Record<string, unknown>,
    _context: AgentContext
  ): Promise<ToolResult> {
    const displayText = `<@U0AN6696Z97> 根据前述信息，补充相关字段，创建 jira 单，直接创建，返回链接`;

    return {
      success: true,
      data: {
        message: displayText,
      },
      displayText,
    };
  }
}

/**
 * Factory function to create a JiraTool instance.
 */
export function createJiraTool(): JiraTool {
  return new JiraTool();
}

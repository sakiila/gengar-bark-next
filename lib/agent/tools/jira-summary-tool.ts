/**
 * Jira Summary Tool for the AI Agent system.
 * Generates Jira ticket descriptions from Slack thread conversations.
 */

import { Tool, ToolResult, AgentContext, ToolParameterSchema } from '../types';
import { generateJiraDescriptionFromThread } from '@/lib/ai/openai';
import { getThreadReplies } from '@/lib/slack/gengar-bolt';

/**
 * Parameter schema for the Jira Summary tool.
 */
const jiraSummaryParameterSchema: ToolParameterSchema = {
  type: 'object',
  properties: {},
  required: [],
};

/**
 * JiraSummaryTool generates Jira ticket descriptions from Slack threads.
 * Uses AI to analyze conversation and fill in a structured template.
 */
export class JiraSummaryTool implements Tool {
  name = 'summarize_for_jira';
  description = 'Summarize the current Slack thread into a Jira ticket description format. Use this when users want to generate a bug report or issue description with Root Cause, Issue Status, Solution, etc.';
  parameters = jiraSummaryParameterSchema;
  cacheable = false;

  /**
   * Execute the Jira Summary tool.
   * 
   * @param params - Tool parameters (none required)
   * @param context - Agent context with channel and thread information
   * @returns ToolResult with the generated Jira description
   */
  async execute(
    params: Record<string, unknown>,
    context: AgentContext
  ): Promise<ToolResult> {
    try {
      // Get thread messages
      const messages = await getThreadReplies(context.channel, context.threadTs);
      
      if (!messages || messages.length === 0) {
        return {
          success: false,
          error: 'No messages found in thread',
          displayText: '❌ Could not find any messages in this thread to summarize.',
        };
      }

      // Generate Jira description using AI
      const description = await generateJiraDescriptionFromThread(messages);

      return {
        success: true,
        data: { description },
        displayText: `📝 Jira Description:\n\n${description}`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      return {
        success: false,
        error: errorMessage,
        displayText: `❌ Failed to generate Jira description: ${errorMessage}`,
      };
    }
  }
}

/**
 * Factory function to create a JiraSummaryTool instance.
 */
export function createJiraSummaryTool(): JiraSummaryTool {
  return new JiraSummaryTool();
}

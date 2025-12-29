/**
 * CI Tool for the AI Agent system.
 * Wraps existing CI subscription logic for build notifications.
 * Requirements: 3.5
 */

import { Tool, ToolResult, AgentContext, ToolParameterSchema } from '../types';
import { postgres } from '@/lib/database/supabase';

/**
 * Parameter schema for the CI tool.
 * Defines repository and branch parameters for CI subscription.
 */
const ciParameterSchema: ToolParameterSchema = {
  type: 'object',
  properties: {
    repository: {
      type: 'string',
      description: 'The repository name to subscribe to (e.g., moego-svc-task, moego-web)',
    },
    branch: {
      type: 'string',
      description: 'The branch name to watch for builds (e.g., main, develop, feature-xyz)',
    },
    action: {
      type: 'string',
      description: 'The action to perform: subscribe to start watching, unsubscribe to stop watching, or list to see current subscriptions',
      enum: ['subscribe', 'unsubscribe', 'list'],
    },
  },
  required: ['action'],
};

/**
 * CITool manages CI build notification subscriptions.
 * Allows users to subscribe/unsubscribe to build notifications for specific repos and branches.
 */
export class CITool implements Tool {
  name = 'manage_ci_subscription';
  description = 'Manage CI/CD build notification subscriptions. Use this when users want to subscribe to build notifications, unsubscribe from them, or list their current subscriptions.';
  parameters = ciParameterSchema;
  cacheable = false; // Subscriptions should never be cached

  /**
   * Execute the CI tool to manage build subscriptions.
   * 
   * @param params - Tool parameters including repository, branch, and action
   * @param context - Agent context with user and channel information
   * @returns ToolResult with subscription status
   */
  async execute(
    params: Record<string, unknown>,
    context: AgentContext
  ): Promise<ToolResult> {
    const { repository, branch, action } = params as {
      repository?: string;
      branch?: string;
      action: 'subscribe' | 'unsubscribe' | 'list';
    };

    try {
      switch (action) {
        case 'subscribe':
          return await this.subscribe(repository, branch, context);
        case 'unsubscribe':
          return await this.unsubscribe(repository, branch, context);
        case 'list':
          return await this.listSubscriptions(context);
        default:
          return {
            success: false,
            error: `Unknown action: ${action}`,
            displayText: 'Invalid action. Please use subscribe, unsubscribe, or list.',
          };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      return {
        success: false,
        error: errorMessage,
        displayText: `❌ CI operation failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Subscribe to CI build notifications for a repository/branch.
   */
  private async subscribe(
    repository: string | undefined,
    branch: string | undefined,
    context: AgentContext
  ): Promise<ToolResult> {
    if (!repository || !branch) {
      return {
        success: false,
        error: 'Repository and branch are required for subscription',
        displayText: 'Please provide both repository and branch names to subscribe.',
      };
    }

    // Check if subscription already exists
    const { data: existing } = await postgres
      .from('build_watch')
      .select('*')
      .eq('repository', repository)
      .eq('branch', branch)
      .eq('channel', context.channel)
      .single();

    if (existing) {
      return {
        success: true,
        data: {
          action: 'already_subscribed',
          repository,
          branch,
        },
        displayText: `ℹ️ Already subscribed to ${repository}/${branch} in this channel.`,
      };
    }

    // Create new subscription
    const subscriptionData = {
      repository,
      branch,
      channel: context.channel,
      channel_name: context.channel, // Will be updated if we have channel info
      user_id: context.userId,
      user_name: context.userName || context.userId,
      timestamp: context.threadTs,
    };

    const { error } = await postgres
      .from('build_watch')
      .insert([subscriptionData]);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return {
      success: true,
      data: {
        action: 'subscribed',
        repository,
        branch,
      },
      displayText: `✅ Successfully subscribed to CI notifications for ${repository}/${branch}`,
    };
  }

  /**
   * Unsubscribe from CI build notifications.
   */
  private async unsubscribe(
    repository: string | undefined,
    branch: string | undefined,
    context: AgentContext
  ): Promise<ToolResult> {
    if (!repository || !branch) {
      return {
        success: false,
        error: 'Repository and branch are required for unsubscription',
        displayText: 'Please provide both repository and branch names to unsubscribe.',
      };
    }

    const { error, count } = await postgres
      .from('build_watch')
      .delete()
      .eq('repository', repository)
      .eq('branch', branch)
      .eq('channel', context.channel);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (count === 0) {
      return {
        success: true,
        data: {
          action: 'not_found',
          repository,
          branch,
        },
        displayText: `ℹ️ No subscription found for ${repository}/${branch} in this channel.`,
      };
    }

    return {
      success: true,
      data: {
        action: 'unsubscribed',
        repository,
        branch,
      },
      displayText: `✅ Successfully unsubscribed from CI notifications for ${repository}/${branch}`,
    };
  }

  /**
   * List all CI subscriptions for the current channel.
   */
  private async listSubscriptions(context: AgentContext): Promise<ToolResult> {
    const { data, error } = await postgres
      .from('build_watch')
      .select('repository, branch, user_name, created_at')
      .eq('channel', context.channel)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return {
        success: true,
        data: {
          action: 'list',
          subscriptions: [],
        },
        displayText: 'ℹ️ No CI subscriptions found for this channel.',
      };
    }

    const subscriptionList = data.map(
      (sub: { repository: string; branch: string; user_name: string }) => 
        `• ${sub.repository}/${sub.branch} (by ${sub.user_name})`
    ).join('\n');

    return {
      success: true,
      data: {
        action: 'list',
        subscriptions: data,
      },
      displayText: `📋 CI Subscriptions in this channel:\n${subscriptionList}`,
    };
  }
}

/**
 * Factory function to create a CITool instance.
 */
export function createCITool(): CITool {
  return new CITool();
}

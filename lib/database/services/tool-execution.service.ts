/**
 * Service for logging AI agent tool executions to Supabase.
 * Requirements: 6.4 - Log tool invocations with context
 */

import { postgres } from '../supabase';

/**
 * Data structure for a tool execution log entry.
 */
export interface ToolExecutionLog {
  request_id: string;
  channel: string;
  thread_ts: string;
  user_id: string;
  tool_name: string;
  parameters: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  success: boolean;
  execution_time_ms: number | null;
}

/**
 * Service for managing tool execution logs in Supabase.
 * Uses singleton pattern consistent with other services in the codebase.
 */
export class ToolExecutionService {
  private static instance: ToolExecutionService;

  private constructor() {}

  /**
   * Get the singleton instance of ToolExecutionService.
   */
  static getInstance(): ToolExecutionService {
    if (!ToolExecutionService.instance) {
      ToolExecutionService.instance = new ToolExecutionService();
    }
    return ToolExecutionService.instance;
  }

  /**
   * Log a tool execution to the database.
   * 
   * @param log - The tool execution log entry
   * @returns The inserted record ID or null if failed
   */
  async logExecution(log: ToolExecutionLog): Promise<string | null> {
    try {
      const { data, error } = await postgres
        .from('agent_tool_executions')
        .insert([{
          request_id: log.request_id,
          channel: log.channel,
          thread_ts: log.thread_ts,
          user_id: log.user_id,
          tool_name: log.tool_name,
          parameters: log.parameters,
          result: log.result,
          success: log.success,
          execution_time_ms: log.execution_time_ms,
        }])
        .select('id')
        .single();

      if (error) {
        console.error('Failed to log tool execution:', error);
        return null;
      }

      return data?.id ?? null;
    } catch (error) {
      console.error('Error logging tool execution:', error);
      return null;
    }
  }

  /**
   * Get tool executions for a specific thread.
   * Useful for debugging conversation-specific issues.
   * 
   * @param channel - Slack channel ID
   * @param threadTs - Thread timestamp
   * @param limit - Maximum number of records to return
   */
  async getExecutionsByThread(
    channel: string,
    threadTs: string,
    limit = 50
  ): Promise<ToolExecutionLog[]> {
    try {
      const { data, error } = await postgres
        .from('agent_tool_executions')
        .select('*')
        .eq('channel', channel)
        .eq('thread_ts', threadTs)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Failed to get tool executions by thread:', error);
        return [];
      }

      return data ?? [];
    } catch (error) {
      console.error('Error getting tool executions by thread:', error);
      return [];
    }
  }

  /**
   * Get tool executions for a specific user.
   * Useful for user-specific analytics and abuse detection.
   * 
   * @param userId - Slack user ID
   * @param limit - Maximum number of records to return
   */
  async getExecutionsByUser(userId: string, limit = 50): Promise<ToolExecutionLog[]> {
    try {
      const { data, error } = await postgres
        .from('agent_tool_executions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Failed to get tool executions by user:', error);
        return [];
      }

      return data ?? [];
    } catch (error) {
      console.error('Error getting tool executions by user:', error);
      return [];
    }
  }

  /**
   * Get recent tool executions for a specific tool.
   * Useful for tool-specific analytics.
   * 
   * @param toolName - Name of the tool
   * @param limit - Maximum number of records to return
   */
  async getExecutionsByTool(toolName: string, limit = 50): Promise<ToolExecutionLog[]> {
    try {
      const { data, error } = await postgres
        .from('agent_tool_executions')
        .select('*')
        .eq('tool_name', toolName)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Failed to get tool executions by tool:', error);
        return [];
      }

      return data ?? [];
    } catch (error) {
      console.error('Error getting tool executions by tool:', error);
      return [];
    }
  }
}

/**
 * Get the singleton instance of ToolExecutionService.
 */
export function getToolExecutionService(): ToolExecutionService {
  return ToolExecutionService.getInstance();
}

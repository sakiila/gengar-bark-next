/**
 * Response Generator for the AI Agent system.
 * Handles formatting of responses for Slack with proper markdown,
 * blocks for structured data, and user-friendly error messages.
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

import {
  AgentResponse,
  SlackBlock,
  SlackBlockField,
  ToolResult,
} from './types';
import { toUserFriendlyError } from './errors';

/** Maximum character limit for text responses (Requirement 4.4) */
const MAX_RESPONSE_LENGTH = 2000;

/** Truncation suffix when response exceeds limit */
const TRUNCATION_SUFFIX = '... _(response truncated)_';

/**
 * Types of structured data that get special block formatting.
 */
export type StructuredDataType = 'appointment' | 'order' | 'jira' | 'ci' | 'generic';

/**
 * Structured data for appointments.
 */
export interface AppointmentData {
  id: string;
  customerName: string;
  petName?: string;
  service: string;
  dateTime: string;
  status: string;
  notes?: string;
}

/**
 * Structured data for Jira tickets.
 */
export interface JiraTicketData {
  key: string;
  summary: string;
  status: string;
  assignee?: string;
  url: string;
  priority?: string;
}

/**
 * Structured data for orders.
 */
export interface OrderData {
  id: string;
  customerName: string;
  items: string[];
  total: string;
  status: string;
  createdAt: string;
}

/**
 * Structured data for CI builds.
 */
export interface CIBuildData {
  jobName: string;
  buildNumber: number;
  status: 'success' | 'failure' | 'running' | 'pending';
  branch: string;
  url: string;
  duration?: string;
}


/**
 * ResponseGenerator handles formatting agent responses for Slack.
 * Implements Requirements 4.1-4.4 for response generation.
 */
export class ResponseGenerator {
  /**
   * Format a plain text response with proper Slack markdown.
   * Enforces the 2000 character limit (Requirement 4.4).
   * 
   * @param text - The response text to format
   * @param options - Optional formatting options
   * @returns Formatted text within character limits
   */
  formatTextResponse(
    text: string,
    options?: { allowLongResponse?: boolean }
  ): string {
    if (!text) {
      return '';
    }

    // Apply Slack markdown formatting
    let formatted = this.applySlackMarkdown(text);

    // Enforce character limit unless explicitly allowed
    if (!options?.allowLongResponse && formatted.length > MAX_RESPONSE_LENGTH) {
      formatted = this.truncateResponse(formatted);
    }

    return formatted;
  }

  /**
   * Format structured data (appointments, orders, Jira tickets) using Slack blocks.
   * Requirement 4.2: Use Slack blocks for rich formatting.
   * 
   * @param data - The structured data to format
   * @param dataType - Type of data for appropriate formatting
   * @returns Slack blocks array for rich message formatting
   */
  formatStructuredResponse(
    data: unknown,
    dataType: StructuredDataType
  ): SlackBlock[] {
    switch (dataType) {
      case 'appointment':
        return this.formatAppointmentBlocks(data as AppointmentData);
      case 'jira':
        return this.formatJiraBlocks(data as JiraTicketData);
      case 'order':
        return this.formatOrderBlocks(data as OrderData);
      case 'ci':
        return this.formatCIBlocks(data as CIBuildData);
      case 'generic':
      default:
        return this.formatGenericBlocks(data);
    }
  }

  /**
   * Format an error into a user-friendly response.
   * Requirement 4.3: Provide user-friendly error messages with actionable suggestions.
   * 
   * @param error - The error to format
   * @returns AgentResponse with error information
   */
  formatErrorResponse(error: unknown): AgentResponse {
    const friendlyError = toUserFriendlyError(error);
    
    const errorText = this.buildErrorText(friendlyError);
    const errorBlocks = this.buildErrorBlocks(friendlyError);

    return {
      text: errorText,
      blocks: errorBlocks,
      toolsUsed: [],
      success: false,
    };
  }

  /**
   * Format a successful tool result into an AgentResponse.
   * 
   * @param result - The tool result to format
   * @param toolName - Name of the tool that produced the result
   * @param dataType - Optional type hint for structured data
   * @returns Formatted AgentResponse
   */
  formatToolResult(
    result: ToolResult,
    toolName: string,
    dataType?: StructuredDataType
  ): AgentResponse {
    if (!result.success) {
      return this.formatErrorResponse(
        new Error(result.error ?? 'Tool execution failed')
      );
    }

    const text = this.formatTextResponse(
      result.displayText ?? 'Operation completed successfully.'
    );

    let blocks: SlackBlock[] | undefined;
    if (result.data && dataType) {
      blocks = this.formatStructuredResponse(result.data, dataType);
    }

    return {
      text,
      blocks,
      toolsUsed: [toolName],
      success: true,
    };
  }

  /**
   * Combine multiple tool results into a single response.
   * 
   * @param results - Array of tool results with their names
   * @returns Combined AgentResponse
   */
  combineResponses(
    results: Array<{ result: ToolResult; toolName: string; dataType?: StructuredDataType }>
  ): AgentResponse {
    const toolsUsed: string[] = [];
    const textParts: string[] = [];
    const allBlocks: SlackBlock[] = [];
    let allSuccess = true;

    for (const { result, toolName, dataType } of results) {
      toolsUsed.push(toolName);
      
      if (!result.success) {
        allSuccess = false;
        textParts.push(`❌ ${toolName}: ${result.error ?? 'Failed'}`);
        continue;
      }

      if (result.displayText) {
        textParts.push(`✅ ${toolName}: ${result.displayText}`);
      }

      if (result.data && dataType) {
        const blocks = this.formatStructuredResponse(result.data, dataType);
        allBlocks.push(...blocks);
        // Add divider between different tool results
        if (allBlocks.length > 0) {
          allBlocks.push({ type: 'divider' });
        }
      }
    }

    const combinedText = this.formatTextResponse(textParts.join('\n'));

    return {
      text: combinedText,
      blocks: allBlocks.length > 0 ? allBlocks : undefined,
      toolsUsed,
      success: allSuccess,
    };
  }


  // ============================================
  // Private Helper Methods
  // ============================================

  /**
   * Apply Slack-specific markdown formatting.
   * Requirement 4.1: Format response using appropriate Slack markdown.
   */
  private applySlackMarkdown(text: string): string {
    // Slack uses different markdown than standard:
    // - *bold* instead of **bold**
    // - _italic_ instead of *italic*
    // - ~strikethrough~ is the same
    // - `code` is the same
    // - ```code block``` is the same
    
    // Convert standard markdown bold (**text**) to Slack bold (*text*)
    let formatted = text.replace(/\*\*([^*]+)\*\*/g, '*$1*');
    
    // Ensure proper line breaks for Slack
    formatted = formatted.replace(/\r\n/g, '\n');
    
    return formatted;
  }

  /**
   * Truncate response to fit within character limit.
   */
  private truncateResponse(text: string): string {
    const maxLength = MAX_RESPONSE_LENGTH - TRUNCATION_SUFFIX.length;
    
    // Try to truncate at a word boundary
    let truncated = text.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > maxLength * 0.8) {
      truncated = truncated.substring(0, lastSpace);
    }
    
    return truncated + TRUNCATION_SUFFIX;
  }

  /**
   * Build error text message.
   */
  private buildErrorText(error: { code: string; message: string; suggestion: string }): string {
    return `⚠️ ${error.message}\n\n💡 ${error.suggestion}`;
  }

  /**
   * Build Slack blocks for error display.
   */
  private buildErrorBlocks(error: { code: string; message: string; suggestion: string }): SlackBlock[] {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `⚠️ *Error*\n${error.message}`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `💡 ${error.suggestion}`,
          },
        ],
      },
    ];
  }

  /**
   * Format appointment data into Slack blocks.
   */
  private formatAppointmentBlocks(appointment: AppointmentData): SlackBlock[] {
    const fields: SlackBlockField[] = [
      { type: 'mrkdwn', text: `*Customer:*\n${appointment.customerName}` },
      { type: 'mrkdwn', text: `*Service:*\n${appointment.service}` },
      { type: 'mrkdwn', text: `*Date/Time:*\n${appointment.dateTime}` },
      { type: 'mrkdwn', text: `*Status:*\n${this.getStatusEmoji(appointment.status)} ${appointment.status}` },
    ];

    if (appointment.petName) {
      fields.push({ type: 'mrkdwn', text: `*Pet:*\n${appointment.petName}` });
    }

    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `📅 Appointment #${appointment.id}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields,
      },
    ];

    if (appointment.notes) {
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `📝 Notes: ${appointment.notes}`,
          },
        ],
      });
    }

    return blocks;
  }

  /**
   * Format Jira ticket data into Slack blocks.
   */
  private formatJiraBlocks(ticket: JiraTicketData): SlackBlock[] {
    const fields: SlackBlockField[] = [
      { type: 'mrkdwn', text: `*Key:*\n<${ticket.url}|${ticket.key}>` },
      { type: 'mrkdwn', text: `*Status:*\n${ticket.status}` },
    ];

    if (ticket.assignee) {
      fields.push({ type: 'mrkdwn', text: `*Assignee:*\n${ticket.assignee}` });
    }

    if (ticket.priority) {
      fields.push({ type: 'mrkdwn', text: `*Priority:*\n${ticket.priority}` });
    }

    return [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `🎫 ${ticket.key}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${ticket.summary}*`,
        },
      },
      {
        type: 'section',
        fields,
      },
    ];
  }


  /**
   * Format order data into Slack blocks.
   */
  private formatOrderBlocks(order: OrderData): SlackBlock[] {
    const itemsList = order.items.map(item => `• ${item}`).join('\n');

    return [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `🛒 Order #${order.id}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Customer:*\n${order.customerName}` },
          { type: 'mrkdwn', text: `*Status:*\n${this.getStatusEmoji(order.status)} ${order.status}` },
          { type: 'mrkdwn', text: `*Total:*\n${order.total}` },
          { type: 'mrkdwn', text: `*Created:*\n${order.createdAt}` },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Items:*\n${itemsList}`,
        },
      },
    ];
  }

  /**
   * Format CI build data into Slack blocks.
   */
  private formatCIBlocks(build: CIBuildData): SlackBlock[] {
    const statusEmoji = this.getCIStatusEmoji(build.status);
    const statusText = build.status.charAt(0).toUpperCase() + build.status.slice(1);

    const fields: SlackBlockField[] = [
      { type: 'mrkdwn', text: `*Job:*\n${build.jobName}` },
      { type: 'mrkdwn', text: `*Build:*\n#${build.buildNumber}` },
      { type: 'mrkdwn', text: `*Branch:*\n${build.branch}` },
      { type: 'mrkdwn', text: `*Status:*\n${statusEmoji} ${statusText}` },
    ];

    if (build.duration) {
      fields.push({ type: 'mrkdwn', text: `*Duration:*\n${build.duration}` });
    }

    return [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `🔧 CI Build`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields,
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Build',
              emoji: true,
            },
            url: build.url,
            action_id: 'view_build',
          },
        ],
      },
    ];
  }

  /**
   * Format generic data into Slack blocks.
   */
  private formatGenericBlocks(data: unknown): SlackBlock[] {
    if (data === null || data === undefined) {
      return [];
    }

    // Handle arrays
    if (Array.isArray(data)) {
      return this.formatArrayBlocks(data);
    }

    // Handle objects
    if (typeof data === 'object') {
      return this.formatObjectBlocks(data as Record<string, unknown>);
    }

    // Handle primitives
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: String(data),
        },
      },
    ];
  }

  /**
   * Format an array into Slack blocks.
   */
  private formatArrayBlocks(data: unknown[]): SlackBlock[] {
    if (data.length === 0) {
      return [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '_No items found_',
          },
        },
      ];
    }

    const blocks: SlackBlock[] = [];
    
    for (const item of data.slice(0, 10)) { // Limit to 10 items
      if (typeof item === 'object' && item !== null) {
        blocks.push(...this.formatObjectBlocks(item as Record<string, unknown>));
        blocks.push({ type: 'divider' });
      } else {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `• ${String(item)}`,
          },
        });
      }
    }

    if (data.length > 10) {
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `_...and ${data.length - 10} more items_`,
          },
        ],
      });
    }

    return blocks;
  }

  /**
   * Format an object into Slack blocks.
   */
  private formatObjectBlocks(data: Record<string, unknown>): SlackBlock[] {
    const fields: SlackBlockField[] = [];
    
    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined) continue;
      
      const displayKey = this.formatFieldName(key);
      const displayValue = this.formatFieldValue(value);
      
      fields.push({
        type: 'mrkdwn',
        text: `*${displayKey}:*\n${displayValue}`,
      });
      
      // Slack limits fields to 10 per section
      if (fields.length >= 10) break;
    }

    if (fields.length === 0) {
      return [];
    }

    return [
      {
        type: 'section',
        fields,
      },
    ];
  }

  /**
   * Format a field name for display (camelCase to Title Case).
   */
  private formatFieldName(name: string): string {
    return name
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  /**
   * Format a field value for display.
   */
  private formatFieldValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '_N/A_';
    }
    
    if (typeof value === 'boolean') {
      return value ? '✅ Yes' : '❌ No';
    }
    
    if (Array.isArray(value)) {
      return value.slice(0, 5).join(', ') + (value.length > 5 ? '...' : '');
    }
    
    if (typeof value === 'object') {
      return '_[Complex data]_';
    }
    
    return String(value);
  }

  /**
   * Get emoji for general status values.
   */
  private getStatusEmoji(status: string): string {
    const statusLower = status.toLowerCase();
    
    if (statusLower.includes('complete') || statusLower.includes('done') || statusLower.includes('success')) {
      return '✅';
    }
    if (statusLower.includes('pending') || statusLower.includes('waiting')) {
      return '⏳';
    }
    if (statusLower.includes('cancel') || statusLower.includes('fail')) {
      return '❌';
    }
    if (statusLower.includes('progress') || statusLower.includes('running')) {
      return '🔄';
    }
    
    return '📋';
  }

  /**
   * Get emoji for CI build status.
   */
  private getCIStatusEmoji(status: 'success' | 'failure' | 'running' | 'pending'): string {
    const emojiMap: Record<string, string> = {
      success: '✅',
      failure: '❌',
      running: '🔄',
      pending: '⏳',
    };
    
    return emojiMap[status] ?? '❓';
  }
}

/**
 * Singleton instance for convenience.
 */
let responseGeneratorInstance: ResponseGenerator | null = null;

/**
 * Get the singleton ResponseGenerator instance.
 */
export function getResponseGenerator(): ResponseGenerator {
  if (!responseGeneratorInstance) {
    responseGeneratorInstance = new ResponseGenerator();
  }
  return responseGeneratorInstance;
}

/**
 * Appointment Tool for the AI Agent system.
 * Wraps existing sendAppointmentToSlack() functionality.
 * Requirements: 3.5
 */

import { Tool, ToolResult, AgentContext, ToolParameterSchema } from '../types';
import { sendAppointmentToSlack, sendOrderToSlack } from '@/lib/database/services/appointment-slack';

/**
 * Parameter schema for the Appointment tool.
 * Supports looking up by appointment ID or order ID.
 */
const appointmentParameterSchema: ToolParameterSchema = {
  type: 'object',
  properties: {
    appointmentId: {
      type: 'number',
      description: 'The appointment ID to look up (use this OR orderId, not both)',
    },
    orderId: {
      type: 'number',
      description: 'The order ID to look up (use this OR appointmentId, not both)',
    },
  },
  required: [], // At least one of appointmentId or orderId must be provided
};

/**
 * AppointmentTool looks up appointment or order details and sends them to Slack.
 * Wraps the existing sendAppointmentToSlack() and sendOrderToSlack() functions.
 */
export class AppointmentTool implements Tool {
  name = 'lookup_appointment';
  description = 'Look up appointment or order details by ID. Use this when users want to check appointment information, order status, or pet service details. Provide either an appointmentId or orderId.';
  parameters = appointmentParameterSchema;
  cacheable = true;
  cacheTtlSeconds = 60; // Cache for 1 minute since appointment data can change

  /**
   * Execute the Appointment tool to look up and display appointment/order details.
   * 
   * @param params - Tool parameters including appointmentId or orderId
   * @param context - Agent context with user and channel information
   * @returns ToolResult with appointment details
   */
  async execute(
    params: Record<string, unknown>,
    context: AgentContext
  ): Promise<ToolResult> {
    const { appointmentId, orderId } = params as {
      appointmentId?: number;
      orderId?: number;
    };

    // Validate that at least one ID is provided
    if (!appointmentId && !orderId) {
      return {
        success: false,
        error: 'Either appointmentId or orderId must be provided',
        displayText: 'Could not look up appointment: please provide an appointment ID or order ID.',
      };
    }

    // Validate that only one ID type is provided
    if (appointmentId && orderId) {
      return {
        success: false,
        error: 'Please provide either appointmentId or orderId, not both',
        displayText: 'Please specify either an appointment ID or an order ID, not both.',
      };
    }

    try {
      if (appointmentId) {
        // Look up by appointment ID
        await sendAppointmentToSlack(
          appointmentId,
          context.userId,
          context.channel,
          context.threadTs
        );

        return {
          success: true,
          data: {
            type: 'appointment',
            id: appointmentId,
          },
          displayText: `📋 Appointment #${appointmentId} details have been posted above.`,
        };
      } else if (orderId) {
        // Look up by order ID
        await sendOrderToSlack(
          orderId,
          context.userId,
          context.channel,
          context.threadTs
        );

        return {
          success: true,
          data: {
            type: 'order',
            id: orderId,
          },
          displayText: `📋 Order #${orderId} details have been posted above.`,
        };
      }

      // This should never be reached due to validation above
      return {
        success: false,
        error: 'No valid ID provided',
        displayText: 'Could not look up appointment: no valid ID provided.',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      return {
        success: false,
        error: errorMessage,
        displayText: `❌ Failed to look up appointment/order: ${errorMessage}`,
      };
    }
  }
}

/**
 * Factory function to create an AppointmentTool instance.
 */
export function createAppointmentTool(): AppointmentTool {
  return new AppointmentTool();
}

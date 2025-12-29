/**
 * Tool exports for the AI Agent system.
 * Provides factory functions and classes for all available tools.
 * Requirements: 3.5, 6.2
 */

import { JiraTool, createJiraTool } from './jira-tool';
import { AppointmentTool, createAppointmentTool } from './appointment-tool';
import { CITool, createCITool } from './ci-tool';
import { QATool, createQATool } from './qa-tool';

// Re-export tools and factory functions
export { JiraTool, createJiraTool };
export { AppointmentTool, createAppointmentTool };
export { CITool, createCITool };
export { QATool, createQATool };

// Re-export types for convenience
export type { Tool, ToolResult, AgentContext } from '../types';

/**
 * Create and return all available tools.
 * Useful for registering all tools with the ToolRegistry at once.
 * Requirement 6.2: Tools are registered for automatic inclusion in intent matching.
 */
export function createAllTools() {
  return [
    createJiraTool(),
    createAppointmentTool(),
    // createCITool(),
    createQATool(),
  ];
}

/**
 * Get the list of all available tool names.
 * Useful for documentation and debugging.
 */
export function getAvailableToolNames(): string[] {
  return [
    'create_jira_issue',
    'lookup_appointment',
    'manage_ci_subscription',
    'ask_question',
  ];
}

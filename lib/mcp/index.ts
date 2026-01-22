/**
 * MCP (Model Context Protocol) Client Management
 * 
 * This module provides client management for user-configured MCP servers.
 * It handles connection pooling, timeout management, and transport abstraction
 * for both SSE and WebSocket transports.
 */

export { MCPClientManager } from './client-manager';
export type { MCPClientOptions, MCPConnection } from './types';
export type {
  MCPTemplate,
  TemplateCustomFields,
  AppliedTemplate,
} from './templates';
export {
  MCP_TEMPLATES,
  getTemplates,
  getTemplateById,
  applyTemplate,
} from './templates';

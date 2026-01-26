/**
 * Type definitions for MCP (Model Context Protocol) client management
 */

/**
 * Options for connecting to an MCP server
 */
export interface MCPClientOptions {
  /** MCP server endpoint URL */
  url: string;
  
  /** Transport protocol type */
  transport: 'http';
  
  /** Optional authentication token */
  authToken?: string;
  
  /** Optional custom headers for HTTP transport */
  headers?: Record<string, string>;
  
  /** Connection timeout in milliseconds (default: 5000ms) */
  connectionTimeout?: number;
  
  /** Execution timeout in milliseconds (default: 30000ms) */
  executionTimeout?: number;
}

/**
 * Represents an active MCP connection
 */
export interface MCPConnection {
  /** Configuration ID associated with this connection */
  configId: string;
  
  /** Transport protocol type */
  transport: 'http';
  
  /** MCP client instance (placeholder for actual MCP client) */
  client: any; // TODO: Replace with actual MCP client type when SDK is integrated
  
  /** Server capabilities from handshake */
  capabilities: Record<string, any>;
}

/**
 * Type definitions for MCP (Model Context Protocol) configuration
 * 
 * These types are exported for use across the application.
 */

/**
 * Transport type for MCP connections
 */
export type MCPTransportType = 'sse' | 'websocket' | 'streamablehttp';

/**
 * Verification status for MCP configurations
 */
export type MCPVerificationStatus = 'verified' | 'unverified' | 'failed';

/**
 * Input interface for creating or updating MCP configurations
 */
export interface MCPConfigInput {
  serverName: string;
  transportType: MCPTransportType;
  url: string;
  authToken?: string;
  skipVerification?: boolean;
}

/**
 * Output interface for MCP configurations returned to clients
 */
export interface MCPConfigOutput {
  id: string;
  serverName: string;
  transportType: MCPTransportType;
  url: string;
  authToken?: string; // Decrypted auth token (if present)
  enabled: boolean;
  capabilities: Record<string, any> | null;
  verificationStatus: MCPVerificationStatus;
  verificationError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * MCP client options for connection
 */
export interface MCPClientOptions {
  url: string;
  transport: MCPTransportType;
  authToken?: string;
  connectionTimeout?: number; // Default: 5000ms
  executionTimeout?: number; // Default: 30000ms
}

/**
 * MCP connection object
 */
export interface MCPConnection {
  configId: string;
  transport: MCPTransportType;
  client: any; // MCP client instance
  capabilities: Record<string, any>;
}

/**
 * MCP context collected from servers
 */
export interface MCPContext {
  [configId: string]: {
    serverName: string;
    tools: any[];
    resources: any[];
  };
}

/**
 * Audit log entry for MCP configuration operations
 */
export interface MCPAuditLog {
  timestamp: Date;
  userId: string;
  operation: 'create' | 'read' | 'update' | 'delete' | 'enable' | 'disable' | 'list';
  configurationId?: string;
  serverName?: string;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

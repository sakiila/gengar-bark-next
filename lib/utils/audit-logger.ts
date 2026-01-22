/**
 * Audit Logger Utility
 * 
 * Provides audit logging functionality for MCP configuration operations.
 * Logs all configuration access attempts with user IDs for security monitoring.
 * 
 * Requirements: 7.5
 */

import { logger } from './logger';

/**
 * Audit log entry interface
 */
export interface AuditLog {
  timestamp: Date;
  userId: string;
  operation: 'create' | 'read' | 'update' | 'delete' | 'enable' | 'disable' | 'list';
  configurationId?: string;
  serverName?: string;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Log a configuration access operation for audit purposes
 * 
 * @param entry - The audit log entry to record
 * 
 * Requirements: 7.5
 */
export function logConfigurationAccess(entry: AuditLog): void {
  try {
    // Log to Next Axiom for centralized monitoring
    logger.info('MCP Configuration Access', {
      timestamp: entry.timestamp.toISOString(),
      userId: entry.userId,
      operation: entry.operation,
      configurationId: entry.configurationId,
      serverName: entry.serverName,
      success: entry.success,
      error: entry.error,
      metadata: entry.metadata,
      // Add tags for easier filtering
      component: 'mcp-configuration',
      operationType: entry.operation,
      successStatus: entry.success.toString(),
    });

    // Also log to console for local development
    console.log('[AUDIT] MCP Configuration Access:', {
      timestamp: entry.timestamp.toISOString(),
      userId: entry.userId,
      operation: entry.operation,
      configurationId: entry.configurationId,
      serverName: entry.serverName,
      success: entry.success,
      error: entry.error,
    });
  } catch (error) {
    // Don't fail the operation if logging fails
    console.error('Failed to write audit log:', error);
  }
}

/**
 * Log an SSRF protection block for security monitoring
 * 
 * @param userId - The user ID who attempted the operation
 * @param url - The URL that was blocked
 * @param reason - The reason for blocking (e.g., "private network address")
 * 
 * Requirements: 9.8
 */
export function logSSRFBlock(userId: string, url: string, reason: string): void {
  try {
    // Log to Next Axiom with high priority for security events
    logger.warn('SSRF Protection Block', {
      timestamp: new Date().toISOString(),
      userId,
      url,
      reason,
      // Add tags for security monitoring
      component: 'mcp-configuration',
      security: 'ssrf-block',
      severity: 'warning',
    });

    // Also log to console
    console.warn('[SECURITY] SSRF Protection Block:', {
      timestamp: new Date().toISOString(),
      userId,
      url,
      reason,
    });
  } catch (error) {
    // Don't fail the operation if logging fails
    console.error('Failed to write SSRF block log:', error);
  }
}

import * as crypto from 'crypto';
import { postgres } from '../supabase';
import { logConfigurationAccess, logSSRFBlock } from '@/lib/utils/audit-logger';

/**
 * Database row type for user_mcp_configurations table
 */
interface UserMCPConfigurationRow {
  id: string;
  user_id: string;
  server_name: string;
  transport_type: 'http';
  url: string;
  encrypted_auth_token: string | null;
  enabled: boolean;
  capabilities: Record<string, any> | null;
  verification_status: 'verified' | 'unverified' | 'failed';
  verification_error: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Input interface for creating or updating MCP configurations
 */
export interface MCPConfigInput {
  serverName: string;
  transportType: 'http';
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
  transportType: 'http';
  url: string;
  authToken?: string;
  enabled: boolean;
  capabilities: Record<string, any> | null;
  verificationStatus: 'verified' | 'unverified' | 'failed';
  verificationError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const TABLE_NAME = 'user_mcp_configurations';

/**
 * MCPConfigurationService - Singleton service for managing user MCP configurations
 * Uses Supabase client for database operations.
 */
export class MCPConfigurationService {
  private static instance: MCPConfigurationService;
  private encryptionKey: string;

  private constructor() {
    this.encryptionKey = process.env.MCP_ENCRYPTION_KEY || '';
    if (!this.encryptionKey) {
      console.warn('MCP_ENCRYPTION_KEY not set. Token encryption will not work properly.');
    }
  }

  static async getInstance(): Promise<MCPConfigurationService> {
    if (!MCPConfigurationService.instance) {
      MCPConfigurationService.instance = new MCPConfigurationService();
    }
    return MCPConfigurationService.instance;
  }

  getEncryptionKey(): string {
    return this.encryptionKey;
  }

  private validateRequiredFields(config: MCPConfigInput): void {
    const missingFields: string[] = [];
    if (!config.serverName?.trim()) missingFields.push('serverName');
    if (!config.transportType) missingFields.push('transportType');
    if (!config.url?.trim()) missingFields.push('url');
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }
  }

  private validateTransportType(transportType: string): void {
    if (transportType !== 'http') {
      throw new Error(`Invalid transport type: ${transportType}. Must be 'http'`);
    }
  }

  private validateUrl(url: string): void {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error(`Invalid URL format: ${url}`);
    }
    if (parsedUrl.protocol !== 'https:') {
      throw new Error(`Invalid protocol: ${parsedUrl.protocol}. Only HTTPS is allowed`);
    }
  }

  private checkSSRF(url: string, userId?: string): void {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname;

    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('127.')) {
      if (userId) logSSRFBlock(userId, url, 'localhost address');
      throw new Error('SSRF protection: localhost addresses are not allowed');
    }

    const privateRanges = [/^10\./, /^192\.168\./, /^172\.(1[6-9]|2[0-9]|3[0-1])\./];
    for (const range of privateRanges) {
      if (range.test(hostname)) {
        if (userId) logSSRFBlock(userId, url, 'private network address');
        throw new Error('SSRF protection: private network addresses are not allowed');
      }
    }
  }

  private encryptToken(token: string): string {
    if (!this.encryptionKey) throw new Error('Encryption key not configured');
    const key = crypto.createHash('sha256').update(this.encryptionKey).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  private decryptToken(encryptedToken: string): string {
    if (!this.encryptionKey) throw new Error('Encryption key not configured');
    const parts = encryptedToken.split(':');
    if (parts.length !== 3) throw new Error('Invalid encrypted token format');
    const [ivHex, authTagHex, encryptedData] = parts;
    const key = crypto.createHash('sha256').update(this.encryptionKey).digest();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  private rowToOutput(row: UserMCPConfigurationRow): MCPConfigOutput {
    let authToken: string | undefined;
    if (row.encrypted_auth_token) {
      try {
        authToken = this.decryptToken(row.encrypted_auth_token);
      } catch (error) {
        console.error('Failed to decrypt auth token:', error);
      }
    }
    return {
      id: row.id,
      serverName: row.server_name,
      transportType: row.transport_type,
      url: row.url,
      authToken,
      enabled: row.enabled,
      capabilities: row.capabilities,
      verificationStatus: row.verification_status,
      verificationError: row.verification_error,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async createConfiguration(userId: string, config: MCPConfigInput): Promise<MCPConfigOutput> {
    const startTime = Date.now();
    try {
      this.validateRequiredFields(config);
      this.validateTransportType(config.transportType);
      this.validateUrl(config.url);
      this.checkSSRF(config.url, userId);

      // Check for existing configuration
      const { data: existing } = await postgres
        .from(TABLE_NAME)
        .select('id')
        .eq('user_id', userId)
        .eq('server_name', config.serverName)
        .single();

      if (existing) {
        throw new Error(`Configuration with server name '${config.serverName}' already exists`);
      }

      let encryptedToken: string | null = null;
      if (config.authToken) {
        encryptedToken = this.encryptToken(config.authToken);
      }

      let verificationStatus: 'verified' | 'unverified' | 'failed' = 'unverified';
      let capabilities: Record<string, any> | null = null;
      let verificationError: string | null = null;

      if (!config.skipVerification) {
        const result = await this.verifyConnection(config);
        if (result.success) {
          verificationStatus = 'verified';
          capabilities = result.capabilities || null;
        } else {
          verificationStatus = 'failed';
          verificationError = result.error || 'Connection verification failed';
        }
      }

      const { data, error } = await postgres
        .from(TABLE_NAME)
        .insert({
          user_id: userId,
          server_name: config.serverName,
          transport_type: config.transportType,
          url: config.url,
          encrypted_auth_token: encryptedToken,
          enabled: true,
          capabilities,
          verification_status: verificationStatus,
          verification_error: verificationError,
        })
        .select()
        .single();

      if (error) throw new Error(`Database error: ${error.message}`);

      logConfigurationAccess({
        timestamp: new Date(),
        userId,
        operation: 'create',
        configurationId: data.id,
        serverName: config.serverName,
        success: true,
        metadata: { transportType: config.transportType, verificationStatus, executionTimeMs: Date.now() - startTime },
      });

      return this.rowToOutput(data);
    } catch (err) {
      logConfigurationAccess({
        timestamp: new Date(),
        userId,
        operation: 'create',
        serverName: config.serverName,
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        metadata: { executionTimeMs: Date.now() - startTime },
      });
      throw err;
    }
  }

  async updateConfiguration(userId: string, configId: string, updates: Partial<MCPConfigInput>): Promise<MCPConfigOutput> {
    const startTime = Date.now();
    try {
      const { data: existing, error: findError } = await postgres
        .from(TABLE_NAME)
        .select('*')
        .eq('id', configId)
        .single();

      if (findError || !existing) throw new Error(`Configuration with id '${configId}' not found`);
      if (existing.user_id !== userId) throw new Error('Unauthorized: You do not own this configuration');

      if (updates.transportType) this.validateTransportType(updates.transportType);
      if (updates.url) {
        this.validateUrl(updates.url);
        this.checkSSRF(updates.url, userId);
      }

      if (updates.serverName && updates.serverName !== existing.server_name) {
        const { data: duplicate } = await postgres
          .from(TABLE_NAME)
          .select('id')
          .eq('user_id', userId)
          .eq('server_name', updates.serverName)
          .single();
        if (duplicate) throw new Error(`Configuration with server name '${updates.serverName}' already exists`);
      }

      const updateData: Record<string, any> = {};
      if (updates.serverName !== undefined) updateData.server_name = updates.serverName;
      if (updates.transportType !== undefined) updateData.transport_type = updates.transportType;
      if (updates.url !== undefined) updateData.url = updates.url;
      if (updates.authToken !== undefined) {
        updateData.encrypted_auth_token = updates.authToken ? this.encryptToken(updates.authToken) : null;
      }

      // Verify connection if URL or transport type changed (unless skipVerification is set)
      const connectionChanged = updates.url !== undefined || updates.transportType !== undefined || updates.authToken !== undefined;
      if (connectionChanged && !updates.skipVerification) {
        // Build config for verification using updated values or existing values
        const verifyConfig: MCPConfigInput = {
          serverName: updates.serverName || existing.server_name,
          transportType: updates.transportType || existing.transport_type,
          url: updates.url || existing.url,
          authToken: updates.authToken !== undefined 
            ? updates.authToken 
            : (existing.encrypted_auth_token ? this.decryptToken(existing.encrypted_auth_token) : undefined),
        };

        const result = await this.verifyConnection(verifyConfig);
        if (result.success) {
          updateData.verification_status = 'verified';
          updateData.capabilities = result.capabilities || null;
          updateData.verification_error = null;
        } else {
          updateData.verification_status = 'failed';
          updateData.verification_error = result.error || 'Connection verification failed';
        }
      } else if (updates.skipVerification) {
        updateData.verification_status = 'unverified';
      }

      const { data, error } = await postgres
        .from(TABLE_NAME)
        .update(updateData)
        .eq('id', configId)
        .select()
        .single();

      if (error) throw new Error(`Database error: ${error.message}`);

      logConfigurationAccess({
        timestamp: new Date(),
        userId,
        operation: 'update',
        configurationId: configId,
        serverName: data.server_name,
        success: true,
        metadata: { updatedFields: Object.keys(updates), executionTimeMs: Date.now() - startTime },
      });

      return this.rowToOutput(data);
    } catch (err) {
      logConfigurationAccess({
        timestamp: new Date(),
        userId,
        operation: 'update',
        configurationId: configId,
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        metadata: { executionTimeMs: Date.now() - startTime },
      });
      throw err;
    }
  }

  async deleteConfiguration(userId: string, configId: string): Promise<void> {
    const startTime = Date.now();
    let serverName: string | undefined;
    try {
      const { data: existing, error: findError } = await postgres
        .from(TABLE_NAME)
        .select('*')
        .eq('id', configId)
        .single();

      if (findError || !existing) throw new Error(`Configuration with id '${configId}' not found`);
      if (existing.user_id !== userId) throw new Error('Unauthorized: You do not own this configuration');

      serverName = existing.server_name;

      const { error } = await postgres.from(TABLE_NAME).delete().eq('id', configId);
      if (error) throw new Error(`Database error: ${error.message}`);

      logConfigurationAccess({
        timestamp: new Date(),
        userId,
        operation: 'delete',
        configurationId: configId,
        serverName,
        success: true,
        metadata: { executionTimeMs: Date.now() - startTime },
      });
    } catch (err) {
      logConfigurationAccess({
        timestamp: new Date(),
        userId,
        operation: 'delete',
        configurationId: configId,
        serverName,
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        metadata: { executionTimeMs: Date.now() - startTime },
      });
      throw err;
    }
  }

  async getConfiguration(userId: string, configId: string): Promise<MCPConfigOutput | null> {
    const startTime = Date.now();
    try {
      // Combine user_id check in query for faster execution
      const { data, error } = await postgres
        .from(TABLE_NAME)
        .select('*')
        .eq('id', configId)
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        logConfigurationAccess({
          timestamp: new Date(),
          userId,
          operation: 'read',
          configurationId: configId,
          success: false,
          error: error ? 'Configuration not found or access denied' : 'Configuration not found',
          metadata: { executionTimeMs: Date.now() - startTime },
        });
        return null;
      }

      logConfigurationAccess({
        timestamp: new Date(),
        userId,
        operation: 'read',
        configurationId: configId,
        serverName: data.server_name,
        success: true,
        metadata: { executionTimeMs: Date.now() - startTime },
      });

      return this.rowToOutput(data);
    } catch (err) {
      logConfigurationAccess({
        timestamp: new Date(),
        userId,
        operation: 'read',
        configurationId: configId,
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        metadata: { executionTimeMs: Date.now() - startTime },
      });
      throw err;
    }
  }

  async listConfigurations(userId: string): Promise<MCPConfigOutput[]> {
    const startTime = Date.now();
    try {
      const { data, error } = await postgres
        .from(TABLE_NAME)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw new Error(`Database error: ${error.message}`);

      logConfigurationAccess({
        timestamp: new Date(),
        userId,
        operation: 'list',
        success: true,
        metadata: { count: data?.length || 0, executionTimeMs: Date.now() - startTime },
      });

      return (data || []).map((row) => this.rowToOutput(row));
    } catch (err) {
      logConfigurationAccess({
        timestamp: new Date(),
        userId,
        operation: 'list',
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        metadata: { executionTimeMs: Date.now() - startTime },
      });
      throw err;
    }
  }

  async getEnabledConfigurations(userId: string): Promise<MCPConfigOutput[]> {
    const { data, error } = await postgres
      .from(TABLE_NAME)
      .select('*')
      .eq('user_id', userId)
      .eq('enabled', true)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Database error: ${error.message}`);
    return (data || []).map((row) => this.rowToOutput(row));
  }

  async enableConfiguration(userId: string, configId: string): Promise<void> {
    const startTime = Date.now();
    let serverName: string | undefined;
    try {
      const { data: existing, error: findError } = await postgres
        .from(TABLE_NAME)
        .select('*')
        .eq('id', configId)
        .single();

      if (findError || !existing) throw new Error(`Configuration with id '${configId}' not found`);
      if (existing.user_id !== userId) throw new Error('Unauthorized: You do not own this configuration');

      serverName = existing.server_name;

      const { error } = await postgres.from(TABLE_NAME).update({ enabled: true }).eq('id', configId);
      if (error) throw new Error(`Database error: ${error.message}`);

      logConfigurationAccess({
        timestamp: new Date(),
        userId,
        operation: 'enable',
        configurationId: configId,
        serverName,
        success: true,
        metadata: { executionTimeMs: Date.now() - startTime },
      });
    } catch (err) {
      logConfigurationAccess({
        timestamp: new Date(),
        userId,
        operation: 'enable',
        configurationId: configId,
        serverName,
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        metadata: { executionTimeMs: Date.now() - startTime },
      });
      throw err;
    }
  }

  async disableConfiguration(userId: string, configId: string): Promise<void> {
    const startTime = Date.now();
    let serverName: string | undefined;
    try {
      const { data: existing, error: findError } = await postgres
        .from(TABLE_NAME)
        .select('*')
        .eq('id', configId)
        .single();

      if (findError || !existing) throw new Error(`Configuration with id '${configId}' not found`);
      if (existing.user_id !== userId) throw new Error('Unauthorized: You do not own this configuration');

      serverName = existing.server_name;

      const { error } = await postgres.from(TABLE_NAME).update({ enabled: false }).eq('id', configId);
      if (error) throw new Error(`Database error: ${error.message}`);

      logConfigurationAccess({
        timestamp: new Date(),
        userId,
        operation: 'disable',
        configurationId: configId,
        serverName,
        success: true,
        metadata: { executionTimeMs: Date.now() - startTime },
      });
    } catch (err) {
      logConfigurationAccess({
        timestamp: new Date(),
        userId,
        operation: 'disable',
        configurationId: configId,
        serverName,
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        metadata: { executionTimeMs: Date.now() - startTime },
      });
      throw err;
    }
  }

  async verifyConnection(config: MCPConfigInput): Promise<{ success: boolean; capabilities?: any; error?: string }> {
    try {
      const { MCPClientManager } = await import('@/lib/mcp/client-manager');
      const manager = new MCPClientManager();

      const tempId = `verify-${Date.now()}`;
      const connection = await manager.connect(tempId, {
        url: config.url,
        transport: config.transportType,
        authToken: config.authToken,
      });

      const capabilities = connection.capabilities;
      await manager.disconnect(tempId);

      return { success: true, capabilities };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during verification',
      };
    }
  }
}

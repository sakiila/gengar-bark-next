import { MCPConfigurationService } from './mcp-configuration.service';
import { AppDataSource } from '../data-source';
import { UserMCPConfiguration } from '../entities/UserMCPConfiguration';

describe('MCPConfigurationService', () => {
  let service: MCPConfigurationService;

  beforeAll(async () => {
    service = await MCPConfigurationService.getInstance();
  });

  afterEach(async () => {
    // Clean up test data after each test
    const repository = service.getRepository();
    await repository.clear();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls', async () => {
      const instance1 = await MCPConfigurationService.getInstance();
      const instance2 = await MCPConfigurationService.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should initialize database connection', async () => {
      const instance = await MCPConfigurationService.getInstance();
      
      expect(instance).toBeDefined();
      expect(AppDataSource.isInitialized).toBe(true);
    });
  });

  describe('Initialization', () => {
    it('should have repository initialized', async () => {
      const instance = await MCPConfigurationService.getInstance();
      const repository = instance.getRepository();
      
      expect(repository).toBeDefined();
      expect(repository.target).toBe(UserMCPConfiguration);
    });

    it('should have encryption key from environment', async () => {
      const instance = await MCPConfigurationService.getInstance();
      const encryptionKey = instance.getEncryptionKey();
      
      // Should be defined (even if empty string when not set)
      expect(encryptionKey).toBeDefined();
      expect(typeof encryptionKey).toBe('string');
    });
  });

  describe('createConfiguration', () => {
    describe('Validation', () => {
      it('should reject missing serverName', async () => {
        await expect(
          service.createConfiguration('user123', {
            serverName: '',
            transportType: 'sse',
            url: 'https://example.com/mcp',
          })
        ).rejects.toThrow('Missing required fields: serverName');
      });

      it('should reject missing transportType', async () => {
        await expect(
          service.createConfiguration('user123', {
            serverName: 'test-server',
            transportType: '' as any,
            url: 'https://example.com/mcp',
          })
        ).rejects.toThrow('Missing required fields: transportType');
      });

      it('should reject missing url', async () => {
        await expect(
          service.createConfiguration('user123', {
            serverName: 'test-server',
            transportType: 'sse',
            url: '',
          })
        ).rejects.toThrow('Missing required fields: url');
      });

      it('should reject multiple missing fields', async () => {
        await expect(
          service.createConfiguration('user123', {
            serverName: '',
            transportType: '' as any,
            url: '',
          })
        ).rejects.toThrow('Missing required fields');
      });

      it('should reject invalid transport type', async () => {
        await expect(
          service.createConfiguration('user123', {
            serverName: 'test-server',
            transportType: 'invalid' as any,
            url: 'https://example.com/mcp',
          })
        ).rejects.toThrow("Invalid transport type: invalid. Must be 'sse', 'websocket', or 'streamablehttp'");
      });

      it('should reject invalid URL format', async () => {
        await expect(
          service.createConfiguration('user123', {
            serverName: 'test-server',
            transportType: 'sse',
            url: 'not-a-valid-url',
          })
        ).rejects.toThrow('Invalid URL format');
      });

      it('should reject non-HTTPS URLs', async () => {
        await expect(
          service.createConfiguration('user123', {
            serverName: 'test-server',
            transportType: 'sse',
            url: 'http://example.com/mcp',
          })
        ).rejects.toThrow('Invalid protocol: http:. Only HTTPS is allowed');
      });

      it('should reject localhost URLs', async () => {
        await expect(
          service.createConfiguration('user123', {
            serverName: 'test-server',
            transportType: 'sse',
            url: 'https://localhost/mcp',
          })
        ).rejects.toThrow('SSRF protection: localhost addresses are not allowed');
      });

      it('should reject 127.0.0.1 URLs', async () => {
        await expect(
          service.createConfiguration('user123', {
            serverName: 'test-server',
            transportType: 'sse',
            url: 'https://127.0.0.1/mcp',
          })
        ).rejects.toThrow('SSRF protection: localhost addresses are not allowed');
      });

      it('should reject private network URLs (10.x.x.x)', async () => {
        await expect(
          service.createConfiguration('user123', {
            serverName: 'test-server',
            transportType: 'sse',
            url: 'https://10.0.0.1/mcp',
          })
        ).rejects.toThrow('SSRF protection: private network addresses are not allowed');
      });

      it('should reject private network URLs (192.168.x.x)', async () => {
        await expect(
          service.createConfiguration('user123', {
            serverName: 'test-server',
            transportType: 'sse',
            url: 'https://192.168.1.1/mcp',
          })
        ).rejects.toThrow('SSRF protection: private network addresses are not allowed');
      });

      it('should reject private network URLs (172.16-31.x.x)', async () => {
        await expect(
          service.createConfiguration('user123', {
            serverName: 'test-server',
            transportType: 'sse',
            url: 'https://172.16.0.1/mcp',
          })
        ).rejects.toThrow('SSRF protection: private network addresses are not allowed');
      });

      it('should reject duplicate server names for same user', async () => {
        // Create first configuration
        await service.createConfiguration('user123', {
          serverName: 'test-server',
          transportType: 'sse',
          url: 'https://example.com/mcp',
          skipVerification: true,
        });

        // Try to create duplicate
        await expect(
          service.createConfiguration('user123', {
            serverName: 'test-server',
            transportType: 'websocket',
            url: 'https://example.com/mcp2',
            skipVerification: true,
          })
        ).rejects.toThrow("Configuration with server name 'test-server' already exists for this user");
      });
    });

    describe('Successful Creation', () => {
      it('should create configuration with SSE transport', async () => {
        const result = await service.createConfiguration('user123', {
          serverName: 'test-server',
          transportType: 'sse',
          url: 'https://example.com/mcp',
          skipVerification: true,
        });

        expect(result).toBeDefined();
        expect(result.id).toBeDefined();
        expect(result.serverName).toBe('test-server');
        expect(result.transportType).toBe('sse');
        expect(result.url).toBe('https://example.com/mcp');
        expect(result.enabled).toBe(true);
        expect(result.verificationStatus).toBe('unverified');
        expect(result.capabilities).toBeNull();
        expect(result.createdAt).toBeInstanceOf(Date);
        expect(result.updatedAt).toBeInstanceOf(Date);
      });

      it('should create configuration with WebSocket transport', async () => {
        const result = await service.createConfiguration('user456', {
          serverName: 'ws-server',
          transportType: 'websocket',
          url: 'https://example.com/ws',
          skipVerification: true,
        });

        expect(result).toBeDefined();
        expect(result.transportType).toBe('websocket');
      });

      it('should create configuration with Streamable HTTP transport', async () => {
        const result = await service.createConfiguration('user457', {
          serverName: 'http-server',
          transportType: 'streamablehttp',
          url: 'https://example.com/http',
          skipVerification: true,
        });

        expect(result).toBeDefined();
        expect(result.transportType).toBe('streamablehttp');
      });

      it('should create configuration with auth token', async () => {
        const result = await service.createConfiguration('user789', {
          serverName: 'secure-server',
          transportType: 'sse',
          url: 'https://example.com/mcp',
          authToken: 'my-secret-token-12345',
          skipVerification: true,
        });

        expect(result).toBeDefined();
        
        // Verify token was encrypted in database
        const repository = service.getRepository();
        const saved = await repository.findOne({ where: { id: result.id } });
        expect(saved?.encrypted_auth_token).toBeDefined();
        expect(saved?.encrypted_auth_token).not.toBe('my-secret-token-12345');
        expect(saved?.encrypted_auth_token).toContain(':'); // Should have iv:authTag:data format
      });

      it('should create configuration without auth token', async () => {
        const result = await service.createConfiguration('user999', {
          serverName: 'public-server',
          transportType: 'sse',
          url: 'https://example.com/mcp',
          skipVerification: true,
        });

        expect(result).toBeDefined();
        
        // Verify no token in database
        const repository = service.getRepository();
        const saved = await repository.findOne({ where: { id: result.id } });
        expect(saved?.encrypted_auth_token).toBeNull();
      });

      it('should set verification status to unverified when skipVerification is true', async () => {
        const result = await service.createConfiguration('user111', {
          serverName: 'unverified-server',
          transportType: 'sse',
          url: 'https://example.com/mcp',
          skipVerification: true,
        });

        expect(result.verificationStatus).toBe('unverified');
      });

      it('should set verification status to verified when skipVerification is false', async () => {
        const result = await service.createConfiguration('user222', {
          serverName: 'verified-server',
          transportType: 'sse',
          url: 'https://example.com/mcp',
          skipVerification: false,
        });

        expect(result.verificationStatus).toBe('verified');
      });

      it('should allow same server name for different users', async () => {
        const result1 = await service.createConfiguration('user-a', {
          serverName: 'shared-name',
          transportType: 'sse',
          url: 'https://example.com/mcp',
          skipVerification: true,
        });

        const result2 = await service.createConfiguration('user-b', {
          serverName: 'shared-name',
          transportType: 'sse',
          url: 'https://example.com/mcp',
          skipVerification: true,
        });

        expect(result1.id).not.toBe(result2.id);
        expect(result1.serverName).toBe(result2.serverName);
      });
    });
  });

  describe('updateConfiguration', () => {
    describe('Authorization', () => {
      it('should reject update for non-existent configuration', async () => {
        await expect(
          service.updateConfiguration('user123', 'non-existent-id', {
            serverName: 'updated-name',
          })
        ).rejects.toThrow("Configuration with id 'non-existent-id' not found");
      });

      it('should reject update when user does not own configuration', async () => {
        // Create configuration for user1
        const config = await service.createConfiguration('user1', {
          serverName: 'user1-server',
          transportType: 'sse',
          url: 'https://example.com/mcp',
          skipVerification: true,
        });

        // Try to update as user2
        await expect(
          service.updateConfiguration('user2', config.id, {
            serverName: 'hacked-name',
          })
        ).rejects.toThrow('Unauthorized: You do not own this configuration');
      });
    });

    describe('Validation', () => {
      it('should reject invalid transport type in update', async () => {
        const config = await service.createConfiguration('user123', {
          serverName: 'test-server',
          transportType: 'sse',
          url: 'https://example.com/mcp',
          skipVerification: true,
        });

        await expect(
          service.updateConfiguration('user123', config.id, {
            transportType: 'invalid' as any,
          })
        ).rejects.toThrow("Invalid transport type: invalid. Must be 'sse', 'websocket', or 'streamablehttp'");
      });

      it('should reject invalid URL format in update', async () => {
        const config = await service.createConfiguration('user123', {
          serverName: 'test-server',
          transportType: 'sse',
          url: 'https://example.com/mcp',
          skipVerification: true,
        });

        await expect(
          service.updateConfiguration('user123', config.id, {
            url: 'not-a-valid-url',
          })
        ).rejects.toThrow('Invalid URL format');
      });

      it('should reject non-HTTPS URL in update', async () => {
        const config = await service.createConfiguration('user123', {
          serverName: 'test-server',
          transportType: 'sse',
          url: 'https://example.com/mcp',
          skipVerification: true,
        });

        await expect(
          service.updateConfiguration('user123', config.id, {
            url: 'http://example.com/mcp',
          })
        ).rejects.toThrow('Invalid protocol: http:. Only HTTPS is allowed');
      });

      it('should reject SSRF URLs in update', async () => {
        const config = await service.createConfiguration('user123', {
          serverName: 'test-server',
          transportType: 'sse',
          url: 'https://example.com/mcp',
          skipVerification: true,
        });

        await expect(
          service.updateConfiguration('user123', config.id, {
            url: 'https://127.0.0.1/mcp',
          })
        ).rejects.toThrow('SSRF protection: localhost addresses are not allowed');
      });

      it('should reject duplicate server name in update', async () => {
        // Create two configurations
        const config1 = await service.createConfiguration('user123', {
          serverName: 'server-1',
          transportType: 'sse',
          url: 'https://example.com/mcp1',
          skipVerification: true,
        });

        await service.createConfiguration('user123', {
          serverName: 'server-2',
          transportType: 'sse',
          url: 'https://example.com/mcp2',
          skipVerification: true,
        });

        // Try to rename server-1 to server-2
        await expect(
          service.updateConfiguration('user123', config1.id, {
            serverName: 'server-2',
          })
        ).rejects.toThrow("Configuration with server name 'server-2' already exists for this user");
      });
    });

    describe('Partial Updates', () => {
      it('should update only serverName', async () => {
        const config = await service.createConfiguration('user123', {
          serverName: 'original-name',
          transportType: 'sse',
          url: 'https://example.com/mcp',
          authToken: 'original-token',
          skipVerification: true,
        });

        const updated = await service.updateConfiguration('user123', config.id, {
          serverName: 'updated-name',
        });

        expect(updated.id).toBe(config.id);
        expect(updated.serverName).toBe('updated-name');
        expect(updated.transportType).toBe('sse');
        expect(updated.url).toBe('https://example.com/mcp');
        expect(updated.enabled).toBe(true);
      });

      it('should update only transportType', async () => {
        const config = await service.createConfiguration('user123', {
          serverName: 'test-server',
          transportType: 'sse',
          url: 'https://example.com/mcp',
          skipVerification: true,
        });

        const updated = await service.updateConfiguration('user123', config.id, {
          transportType: 'websocket',
        });

        expect(updated.id).toBe(config.id);
        expect(updated.serverName).toBe('test-server');
        expect(updated.transportType).toBe('websocket');
        expect(updated.url).toBe('https://example.com/mcp');
      });

      it('should update only url', async () => {
        const config = await service.createConfiguration('user123', {
          serverName: 'test-server',
          transportType: 'sse',
          url: 'https://example.com/mcp',
          skipVerification: true,
        });

        const updated = await service.updateConfiguration('user123', config.id, {
          url: 'https://newdomain.com/mcp',
        });

        expect(updated.id).toBe(config.id);
        expect(updated.serverName).toBe('test-server');
        expect(updated.transportType).toBe('sse');
        expect(updated.url).toBe('https://newdomain.com/mcp');
      });

      it('should update only authToken', async () => {
        const config = await service.createConfiguration('user123', {
          serverName: 'test-server',
          transportType: 'sse',
          url: 'https://example.com/mcp',
          authToken: 'original-token',
          skipVerification: true,
        });

        const repository = service.getRepository();
        const originalEntity = await repository.findOne({ where: { id: config.id } });
        const originalEncryptedToken = originalEntity?.encrypted_auth_token;

        const updated = await service.updateConfiguration('user123', config.id, {
          authToken: 'new-token',
        });

        expect(updated.id).toBe(config.id);
        expect(updated.serverName).toBe('test-server');
        
        // Verify token was re-encrypted
        const updatedEntity = await repository.findOne({ where: { id: config.id } });
        expect(updatedEntity?.encrypted_auth_token).toBeDefined();
        expect(updatedEntity?.encrypted_auth_token).not.toBe(originalEncryptedToken);
        expect(updatedEntity?.encrypted_auth_token).not.toBe('new-token');
      });

      it('should update multiple fields at once', async () => {
        const config = await service.createConfiguration('user123', {
          serverName: 'original-name',
          transportType: 'sse',
          url: 'https://example.com/mcp',
          skipVerification: true,
        });

        const updated = await service.updateConfiguration('user123', config.id, {
          serverName: 'new-name',
          transportType: 'websocket',
          url: 'https://newdomain.com/mcp',
        });

        expect(updated.id).toBe(config.id);
        expect(updated.serverName).toBe('new-name');
        expect(updated.transportType).toBe('websocket');
        expect(updated.url).toBe('https://newdomain.com/mcp');
      });

      it('should preserve fields not included in update', async () => {
        const config = await service.createConfiguration('user123', {
          serverName: 'test-server',
          transportType: 'sse',
          url: 'https://example.com/mcp',
          authToken: 'secret-token',
          skipVerification: true,
        });

        const repository = service.getRepository();
        const originalEntity = await repository.findOne({ where: { id: config.id } });

        const updated = await service.updateConfiguration('user123', config.id, {
          serverName: 'updated-name',
        });

        const updatedEntity = await repository.findOne({ where: { id: config.id } });

        // Verify other fields unchanged
        expect(updatedEntity?.transport_type).toBe(originalEntity?.transport_type);
        expect(updatedEntity?.url).toBe(originalEntity?.url);
        expect(updatedEntity?.encrypted_auth_token).toBe(originalEntity?.encrypted_auth_token);
        expect(updatedEntity?.enabled).toBe(originalEntity?.enabled);
        expect(updatedEntity?.capabilities).toEqual(originalEntity?.capabilities);
      });
    });

    describe('Identity Preservation', () => {
      it('should preserve configuration ID', async () => {
        const config = await service.createConfiguration('user123', {
          serverName: 'test-server',
          transportType: 'sse',
          url: 'https://example.com/mcp',
          skipVerification: true,
        });

        const originalId = config.id;

        const updated = await service.updateConfiguration('user123', config.id, {
          serverName: 'new-name',
          transportType: 'websocket',
          url: 'https://newdomain.com/mcp',
        });

        expect(updated.id).toBe(originalId);
      });

      it('should preserve user ID', async () => {
        const config = await service.createConfiguration('user123', {
          serverName: 'test-server',
          transportType: 'sse',
          url: 'https://example.com/mcp',
          skipVerification: true,
        });

        await service.updateConfiguration('user123', config.id, {
          serverName: 'new-name',
        });

        const repository = service.getRepository();
        const updated = await repository.findOne({ where: { id: config.id } });

        expect(updated?.user_id).toBe('user123');
      });

      it('should update updatedAt timestamp', async () => {
        const config = await service.createConfiguration('user123', {
          serverName: 'test-server',
          transportType: 'sse',
          url: 'https://example.com/mcp',
          skipVerification: true,
        });

        const originalUpdatedAt = config.updatedAt;

        // Wait a bit to ensure timestamp difference
        await new Promise(resolve => setTimeout(resolve, 10));

        const updated = await service.updateConfiguration('user123', config.id, {
          serverName: 'new-name',
        });

        expect(updated.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
      });
    });

    describe('Token Encryption', () => {
      it('should encrypt new auth token', async () => {
        const config = await service.createConfiguration('user123', {
          serverName: 'test-server',
          transportType: 'sse',
          url: 'https://example.com/mcp',
          skipVerification: true,
        });

        await service.updateConfiguration('user123', config.id, {
          authToken: 'new-secret-token',
        });

        const repository = service.getRepository();
        const updated = await repository.findOne({ where: { id: config.id } });

        expect(updated?.encrypted_auth_token).toBeDefined();
        expect(updated?.encrypted_auth_token).not.toBe('new-secret-token');
        expect(updated?.encrypted_auth_token).toContain(':');
      });

      it('should allow removing auth token by setting empty string', async () => {
        const config = await service.createConfiguration('user123', {
          serverName: 'test-server',
          transportType: 'sse',
          url: 'https://example.com/mcp',
          authToken: 'original-token',
          skipVerification: true,
        });

        await service.updateConfiguration('user123', config.id, {
          authToken: '',
        });

        const repository = service.getRepository();
        const updated = await repository.findOne({ where: { id: config.id } });

        expect(updated?.encrypted_auth_token).toBeNull();
      });

      it('should not modify token if not included in update', async () => {
        const config = await service.createConfiguration('user123', {
          serverName: 'test-server',
          transportType: 'sse',
          url: 'https://example.com/mcp',
          authToken: 'original-token',
          skipVerification: true,
        });

        const repository = service.getRepository();
        const originalEntity = await repository.findOne({ where: { id: config.id } });
        const originalToken = originalEntity?.encrypted_auth_token;

        await service.updateConfiguration('user123', config.id, {
          serverName: 'new-name',
        });

        const updatedEntity = await repository.findOne({ where: { id: config.id } });

        expect(updatedEntity?.encrypted_auth_token).toBe(originalToken);
      });
    });

    describe('Empty Updates', () => {
      it('should handle empty update object', async () => {
        const config = await service.createConfiguration('user123', {
          serverName: 'test-server',
          transportType: 'sse',
          url: 'https://example.com/mcp',
          skipVerification: true,
        });

        const updated = await service.updateConfiguration('user123', config.id, {});

        expect(updated.id).toBe(config.id);
        expect(updated.serverName).toBe(config.serverName);
        expect(updated.transportType).toBe(config.transportType);
        expect(updated.url).toBe(config.url);
      });
    });

    describe('Server Name Uniqueness', () => {
      it('should allow updating to same server name', async () => {
        const config = await service.createConfiguration('user123', {
          serverName: 'test-server',
          transportType: 'sse',
          url: 'https://example.com/mcp',
          skipVerification: true,
        });

        const updated = await service.updateConfiguration('user123', config.id, {
          serverName: 'test-server',
          url: 'https://newdomain.com/mcp',
        });

        expect(updated.serverName).toBe('test-server');
        expect(updated.url).toBe('https://newdomain.com/mcp');
      });

      it('should allow same server name for different users', async () => {
        const config1 = await service.createConfiguration('user1', {
          serverName: 'shared-name',
          transportType: 'sse',
          url: 'https://example.com/mcp1',
          skipVerification: true,
        });

        const config2 = await service.createConfiguration('user2', {
          serverName: 'original-name',
          transportType: 'sse',
          url: 'https://example.com/mcp2',
          skipVerification: true,
        });

        // User2 can update to 'shared-name' since it's only used by user1
        const updated = await service.updateConfiguration('user2', config2.id, {
          serverName: 'shared-name',
        });

        expect(updated.serverName).toBe('shared-name');
      });
    });
  });
});

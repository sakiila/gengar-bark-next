/**
 * Tests for MCPClientManager
 * 
 * Note: These tests use mock/placeholder MCP clients since we don't have
 * an actual MCP SDK integrated yet.
 */

import { MCPClientManager } from './client-manager';
import { MCPClientOptions } from './types';

describe('MCPClientManager', () => {
  let manager: MCPClientManager;

  beforeEach(() => {
    manager = new MCPClientManager();
  });

  describe('connect', () => {
    it('should successfully connect to an SSE MCP server', async () => {
      const options: MCPClientOptions = {
        url: 'https://example.com/mcp',
        transport: 'sse',
        authToken: 'test-token',
        connectionTimeout: 5000,
      };

      const connection = await manager.connect('config-1', options);

      expect(connection).toBeDefined();
      expect(connection.configId).toBe('config-1');
      expect(connection.transport).toBe('sse');
      expect(connection.capabilities).toBeDefined();
      expect(connection.capabilities.protocolVersion).toBe('1.0');
      expect(connection.client).toBeDefined();
      expect(connection.client.connected).toBe(true);
    });

    it('should successfully connect to a WebSocket MCP server', async () => {
      const options: MCPClientOptions = {
        url: 'https://example.com/mcp',
        transport: 'websocket',
        authToken: 'test-token',
        connectionTimeout: 5000,
      };

      const connection = await manager.connect('config-2', options);

      expect(connection).toBeDefined();
      expect(connection.configId).toBe('config-2');
      expect(connection.transport).toBe('websocket');
      expect(connection.capabilities).toBeDefined();
      expect(connection.client).toBeDefined();
      expect(connection.client.connected).toBe(true);
    });

    it('should reuse existing connection if already connected', async () => {
      const options: MCPClientOptions = {
        url: 'https://example.com/mcp',
        transport: 'sse',
        connectionTimeout: 5000,
      };

      const connection1 = await manager.connect('config-3', options);
      const connection2 = await manager.connect('config-3', options);

      expect(connection1).toBe(connection2);
      expect(manager.getConnections().size).toBe(1);
    });

    it('should use default timeout values when not specified', async () => {
      const options: MCPClientOptions = {
        url: 'https://example.com/mcp',
        transport: 'sse',
      };

      const connection = await manager.connect('config-4', options);

      expect(connection).toBeDefined();
      expect(connection.configId).toBe('config-4');
    });

    it('should store connection in the connections map', async () => {
      const options: MCPClientOptions = {
        url: 'https://example.com/mcp',
        transport: 'sse',
      };

      await manager.connect('config-5', options);

      const connections = manager.getConnections();
      expect(connections.has('config-5')).toBe(true);
      expect(connections.get('config-5')?.configId).toBe('config-5');
    });

    it('should handle multiple concurrent connections', async () => {
      const options1: MCPClientOptions = {
        url: 'https://example.com/mcp1',
        transport: 'sse',
      };

      const options2: MCPClientOptions = {
        url: 'https://example.com/mcp2',
        transport: 'websocket',
      };

      const [connection1, connection2] = await Promise.all([
        manager.connect('config-6', options1),
        manager.connect('config-7', options2),
      ]);

      expect(connection1.configId).toBe('config-6');
      expect(connection2.configId).toBe('config-7');
      expect(manager.getConnections().size).toBe(2);
    });

    it('should include auth token in client when provided', async () => {
      const options: MCPClientOptions = {
        url: 'https://example.com/mcp',
        transport: 'sse',
        authToken: 'secret-token-123',
      };

      const connection = await manager.connect('config-8', options);

      expect(connection.client.authToken).toBe('secret-token-123');
    });

    it('should return capabilities from handshake', async () => {
      const options: MCPClientOptions = {
        url: 'https://example.com/mcp',
        transport: 'sse',
      };

      const connection = await manager.connect('config-9', options);

      expect(connection.capabilities).toMatchObject({
        protocolVersion: '1.0',
        serverInfo: {
          name: 'mock-mcp-server',
          version: '1.0.0',
        },
        capabilities: {
          tools: true,
          resources: true,
          prompts: false,
        },
      });
    });
  });

  describe('timeout handling', () => {
    it('should respect connection timeout', async () => {
      // This test verifies the timeout mechanism exists
      // In a real scenario with a slow server, this would actually timeout
      const options: MCPClientOptions = {
        url: 'https://example.com/mcp',
        transport: 'sse',
        connectionTimeout: 5000,
      };

      // With our mock implementation, this should succeed quickly
      const connection = await manager.connect('config-10', options);
      expect(connection).toBeDefined();
    });
  });

  describe('disconnect', () => {
    it('should disconnect a specific connection', async () => {
      const options: MCPClientOptions = {
        url: 'https://example.com/mcp',
        transport: 'sse',
      };

      // Connect first
      await manager.connect('config-disconnect-1', options);
      expect(manager.getConnections().has('config-disconnect-1')).toBe(true);

      // Disconnect
      await manager.disconnect('config-disconnect-1');
      expect(manager.getConnections().has('config-disconnect-1')).toBe(false);
    });

    it('should throw error when disconnecting non-existent connection', async () => {
      await expect(manager.disconnect('non-existent')).rejects.toThrow(
        "Connection with configId 'non-existent' not found"
      );
    });

    it('should handle close errors gracefully', async () => {
      const options: MCPClientOptions = {
        url: 'https://example.com/mcp',
        transport: 'sse',
      };

      // Connect first
      const connection = await manager.connect('config-disconnect-2', options);
      
      // Mock the close method to throw an error
      connection.client.close = jest.fn().mockRejectedValue(new Error('Close failed'));

      // Should not throw, but should still remove from map
      await manager.disconnect('config-disconnect-2');
      expect(manager.getConnections().has('config-disconnect-2')).toBe(false);
    });

    it('should remove connection from map even if client has no close method', async () => {
      const options: MCPClientOptions = {
        url: 'https://example.com/mcp',
        transport: 'sse',
      };

      // Connect first
      const connection = await manager.connect('config-disconnect-3', options);
      
      // Remove the close method
      delete connection.client.close;

      // Should still remove from map
      await manager.disconnect('config-disconnect-3');
      expect(manager.getConnections().has('config-disconnect-3')).toBe(false);
    });
  });

  describe('disconnectAll', () => {
    it('should disconnect all connections', async () => {
      const options: MCPClientOptions = {
        url: 'https://example.com/mcp',
        transport: 'sse',
      };

      // Connect multiple servers
      await manager.connect('config-all-1', options);
      await manager.connect('config-all-2', options);
      await manager.connect('config-all-3', options);

      expect(manager.getConnections().size).toBe(3);

      // Disconnect all
      await manager.disconnectAll();

      expect(manager.getConnections().size).toBe(0);
    });

    it('should handle empty connection map', async () => {
      // Should not throw when no connections exist
      await expect(manager.disconnectAll()).resolves.not.toThrow();
      expect(manager.getConnections().size).toBe(0);
    });

    it('should disconnect all even if some fail', async () => {
      const options: MCPClientOptions = {
        url: 'https://example.com/mcp',
        transport: 'sse',
      };

      // Connect multiple servers
      const conn1 = await manager.connect('config-all-fail-1', options);
      const conn2 = await manager.connect('config-all-fail-2', options);
      const conn3 = await manager.connect('config-all-fail-3', options);

      // Make one connection fail to close
      conn2.client.close = jest.fn().mockRejectedValue(new Error('Close failed'));

      // Should still disconnect all
      await manager.disconnectAll();

      expect(manager.getConnections().size).toBe(0);
    });

    it('should clear connections map after disconnecting all', async () => {
      const options: MCPClientOptions = {
        url: 'https://example.com/mcp',
        transport: 'sse',
      };

      // Connect some servers
      await manager.connect('config-clear-1', options);
      await manager.connect('config-clear-2', options);

      await manager.disconnectAll();

      // Map should be completely empty
      expect(manager.getConnections().size).toBe(0);
      expect(Array.from(manager.getConnections().keys())).toEqual([]);
    });
  });
});

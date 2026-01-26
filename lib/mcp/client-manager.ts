/**
 * MCPClientManager
 * 
 * Manages MCP client connections with timeout handling.
 * Provides connection pooling, timeout management, and transport abstraction.
 * 
 * Requirements: 6.2
 */

import { MCPClientOptions, MCPConnection } from './types';

/**
 * Manages MCP client connections for user-configured MCP servers
 */
export class MCPClientManager {
  /**
   * Map of configuration IDs to active connections
   */
  private connections: Map<string, MCPConnection>;

  /**
   * Creates a new MCPClientManager instance
   */
  constructor() {
    this.connections = new Map<string, MCPConnection>();
  }

  /**
   * Connects to an MCP server with the specified options
   * 
   * @param configId - Unique identifier for this configuration
   * @param options - Connection options including URL, transport, and timeouts
   * @returns Promise resolving to the established connection
   * @throws Error if connection fails or times out
   * 
   * Requirements: 6.2, 11.2
   */
  async connect(
    configId: string,
    options: MCPClientOptions
  ): Promise<MCPConnection> {
    // Check if connection already exists
    if (this.connections.has(configId)) {
      return this.connections.get(configId)!;
    }

    // Set default timeouts
    const connectionTimeout = options.connectionTimeout ?? 5000;
    const executionTimeout = options.executionTimeout ?? 30000;

    try {
      // Create client based on transport type
      let client: any;
      if (options.transport === 'streamablehttp') {
        client = this.createStreamableHttpClient(options);
      } else if (options.transport === 'sse') {
        client = this.createSSEClient(options);
      } else {
        client = this.createWebSocketClient(options);
      }

      // Perform MCP Initialize handshake with timeout
      const capabilities = await this.withTimeout(
        this.performHandshake(client, options),
        connectionTimeout
      );

      // Create connection object
      const connection: MCPConnection = {
        configId,
        transport: options.transport,
        client,
        capabilities,
      };

      // Store connection in map
      this.connections.set(configId, connection);

      return connection;
    } catch (error) {
      // Clean up on failure
      if (this.connections.has(configId)) {
        this.connections.delete(configId);
      }
      
      // Re-throw with context
      if (error instanceof Error) {
        if (error.message.includes('timed out')) {
          throw new Error(`Connection to MCP server timed out after ${connectionTimeout}ms: ${options.url}`);
        }
        throw new Error(`Failed to connect to MCP server: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Disconnects a specific MCP connection
   * 
   * @param configId - Configuration ID of the connection to disconnect
   * @throws Error if connection doesn't exist
   * 
   * Requirements: 6.8
   */
  async disconnect(configId: string): Promise<void> {
    // Check if connection exists
    const connection = this.connections.get(configId);
    
    if (!connection) {
      throw new Error(`Connection with configId '${configId}' not found`);
    }

    try {
      // Close the client connection
      if (connection.client && typeof connection.client.close === 'function') {
        await connection.client.close();
      }
    } catch (error) {
      // Log error but don't throw - we want to clean up even if close fails
      console.error(`Error closing connection ${configId}:`, error);
    } finally {
      // Always remove from connection map
      this.connections.delete(configId);
    }
  }

  /**
   * Disconnects all active MCP connections
   * 
   * Requirements: 6.8
   */
  async disconnectAll(): Promise<void> {
    // Get all connection IDs
    const configIds = Array.from(this.connections.keys());

    // Disconnect each connection
    // Use Promise.allSettled to ensure all connections are attempted even if some fail
    const results = await Promise.allSettled(
      configIds.map(configId => this.disconnect(configId))
    );

    // Log any errors that occurred during disconnection
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Error disconnecting ${configIds[index]}:`, result.reason);
      }
    });

    // Clear the connections map to ensure it's empty
    this.connections.clear();
  }

  /**
   * Executes a tool call on a specific MCP server
   * 
   * @param configId - Configuration ID of the MCP server
   * @param toolName - Name of the tool to execute
   * @param args - Arguments to pass to the tool
   * @returns Promise resolving to the tool execution result
   * @throws Error if connection doesn't exist or execution times out
   * 
   * Requirements: 6.3
   */
  async executeToolCall(
    configId: string,
    toolName: string,
    args: Record<string, any>
  ): Promise<any> {
    // Look up connection by configId
    const connection = this.connections.get(configId);
    
    if (!connection) {
      throw new Error(`Connection with configId '${configId}' not found`);
    }

    // Check if client is connected
    if (!connection.client || !connection.client.connected) {
      throw new Error(`MCP client for configId '${configId}' is not connected`);
    }

    try {
      // Create the tool call request
      const toolCallRequest = {
        jsonrpc: '2.0',
        id: Date.now(), // Use timestamp as unique ID
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        }
      };

      // Execute tool call with 30-second timeout
      const result = await this.withTimeout(
        connection.client.send(toolCallRequest),
        30000 // 30 seconds
      );

      return result;
    } catch (error) {
      // Re-throw with context
      if (error instanceof Error) {
        if (error.message.includes('timed out')) {
          throw new Error(`Tool call '${toolName}' timed out after 30 seconds on MCP server '${configId}'`);
        }
        throw new Error(`Failed to execute tool '${toolName}' on MCP server '${configId}': ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Lists available tools from a specific MCP server
   * 
   * @param configId - Configuration ID of the MCP server
   * @returns Promise resolving to array of available tools
   * @throws Error if connection doesn't exist
   * 
   * Requirements: 6.7
   */
  async listTools(configId: string): Promise<any[]> {
    // Look up connection by configId
    const connection = this.connections.get(configId);
    
    if (!connection) {
      throw new Error(`Connection with configId '${configId}' not found`);
    }

    // Check if client is connected
    if (!connection.client || !connection.client.connected) {
      throw new Error(`MCP client for configId '${configId}' is not connected`);
    }

    try {
      // Create the list tools request
      const listToolsRequest = {
        jsonrpc: '2.0',
        id: Date.now(), // Use timestamp as unique ID
        method: 'tools/list',
        params: {}
      };

      console.log(`[MCPClientManager] Sending tools/list request to ${configId}`);

      // Execute request with 30-second timeout
      const result = await this.withTimeout(
        connection.client.send(listToolsRequest),
        30000 // 30 seconds
      );

      console.log(`[MCPClientManager] tools/list response from ${configId}:`, JSON.stringify(result, null, 2));

      // Extract tools array from response
      // MCP protocol returns tools in result.tools
      if (result && (result as any).tools && Array.isArray((result as any).tools)) {
        console.log(`[MCPClientManager] Found ${(result as any).tools.length} tools from ${configId}`);
        return (result as any).tools;
      }

      console.log(`[MCPClientManager] No tools found in response from ${configId}`);
      // Return empty array if no tools found
      return [];
    } catch (error) {
      // Re-throw with context
      if (error instanceof Error) {
        if (error.message.includes('timed out')) {
          throw new Error(`List tools request timed out after 30 seconds on MCP server '${configId}'`);
        }
        throw new Error(`Failed to list tools on MCP server '${configId}': ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Gets available resources from a specific MCP server
   * 
   * @param configId - Configuration ID of the MCP server
   * @returns Promise resolving to array of available resources
   * @throws Error if connection doesn't exist
   * 
   * Requirements: 6.7
   */
  async getResources(configId: string): Promise<any[]> {
    // Look up connection by configId
    const connection = this.connections.get(configId);
    
    if (!connection) {
      throw new Error(`Connection with configId '${configId}' not found`);
    }

    // Check if client is connected
    if (!connection.client || !connection.client.connected) {
      throw new Error(`MCP client for configId '${configId}' is not connected`);
    }

    try {
      // Create the get resources request
      const getResourcesRequest = {
        jsonrpc: '2.0',
        id: Date.now(), // Use timestamp as unique ID
        method: 'resources/list',
        params: {}
      };

      // Execute request with 30-second timeout
      const result = await this.withTimeout(
        connection.client.send(getResourcesRequest),
        30000 // 30 seconds
      );

      // Extract resources array from response
      // MCP protocol returns resources in result.resources
      if (result && (result as any).resources && Array.isArray((result as any).resources)) {
        return (result as any).resources;
      }

      // Return empty array if no resources found
      return [];
    } catch (error) {
      // Re-throw with context
      if (error instanceof Error) {
        if (error.message.includes('timed out')) {
          throw new Error(`Get resources request timed out after 30 seconds on MCP server '${configId}'`);
        }
        throw new Error(`Failed to get resources from MCP server '${configId}': ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Creates a Streamable HTTP client for MCP
   * This implements the MCP Streamable HTTP transport protocol
   * 
   * @param options - Connection options
   * @returns MCP client instance
   * @private
   */
  private createStreamableHttpClient(options: MCPClientOptions): any {
    const baseUrl = options.url;
    const authToken = options.authToken;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };
    
    // Add authorization header if token is provided
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    return {
      type: 'streamablehttp',
      url: baseUrl,
      authToken: authToken,
      headers: headers,
      connected: false,
      
      // Connect method - for streamable HTTP, we just mark as ready
      connect: async () => {
        return { success: true };
      },
      
      // Close method
      close: async () => {
        return { success: true };
      },
      
      // Send method - makes actual HTTP requests to the MCP server
      send: async (message: any) => {
        console.log(`[StreamableHTTP] Sending request to ${baseUrl}:`, JSON.stringify(message));
        try {
          const response = await fetch(baseUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(message),
          });

          console.log(`[StreamableHTTP] Response status: ${response.status} ${response.statusText}`);

          if (!response.ok) {
            const errorText = await response.text();
            console.log(`[StreamableHTTP] Error response body:`, errorText);
            throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
          }

          const result = await response.json();
          console.log(`[StreamableHTTP] Response body:`, JSON.stringify(result, null, 2));
          
          // Handle JSON-RPC response format
          if (result.error) {
            throw new Error(result.error.message || 'MCP server returned an error');
          }
          
          // Return the result (could be in result field for JSON-RPC)
          return result.result || result;
        } catch (error) {
          if (error instanceof Error) {
            throw error;
          }
          throw new Error('Failed to communicate with MCP server');
        }
      }
    };
  }

  /**
   * Creates an SSE (Server-Sent Events) client
   * 
   * @param options - Connection options
   * @returns MCP client instance
   * @private
   */
  private createSSEClient(options: MCPClientOptions): any {
    // Mock/placeholder implementation
    // In a real implementation, this would use an actual MCP SDK
    // For now, we create a mock client that simulates SSE behavior
    
    return {
      type: 'sse',
      url: options.url,
      authToken: options.authToken,
      connected: false,
      
      // Mock connect method
      connect: async () => {
        // Simulate connection delay
        await new Promise(resolve => setTimeout(resolve, 100));
        return { success: true };
      },
      
      // Mock close method
      close: async () => {
        return { success: true };
      },
      
      // Mock send method
      send: async (message: any) => {
        // Handle different MCP protocol methods
        if (message.method === 'tools/list') {
          return {
            success: true,
            tools: [
              {
                name: 'example-tool',
                description: 'An example tool',
                inputSchema: {
                  type: 'object',
                  properties: {}
                }
              }
            ]
          };
        } else if (message.method === 'resources/list') {
          return {
            success: true,
            resources: [
              {
                uri: 'example://resource',
                name: 'Example Resource',
                description: 'An example resource',
                mimeType: 'text/plain'
              }
            ]
          };
        }
        return { success: true, response: {} };
      }
    };
  }

  /**
   * Creates a WebSocket client
   * 
   * @param options - Connection options
   * @returns MCP client instance
   * @private
   */
  private createWebSocketClient(options: MCPClientOptions): any {
    // Mock/placeholder implementation
    // In a real implementation, this would use an actual MCP SDK
    // For now, we create a mock client that simulates WebSocket behavior
    
    return {
      type: 'websocket',
      url: options.url,
      authToken: options.authToken,
      connected: false,
      
      // Mock connect method
      connect: async () => {
        // Simulate connection delay
        await new Promise(resolve => setTimeout(resolve, 100));
        return { success: true };
      },
      
      // Mock close method
      close: async () => {
        return { success: true };
      },
      
      // Mock send method
      send: async (message: any) => {
        // Handle different MCP protocol methods
        if (message.method === 'tools/list') {
          return {
            success: true,
            tools: [
              {
                name: 'example-tool',
                description: 'An example tool',
                inputSchema: {
                  type: 'object',
                  properties: {}
                }
              }
            ]
          };
        } else if (message.method === 'resources/list') {
          return {
            success: true,
            resources: [
              {
                uri: 'example://resource',
                name: 'Example Resource',
                description: 'An example resource',
                mimeType: 'text/plain'
              }
            ]
          };
        }
        return { success: true, response: {} };
      }
    };
  }

  /**
   * Performs MCP Initialize handshake with the server
   * 
   * @param client - MCP client instance
   * @param options - Connection options
   * @returns Promise resolving to server capabilities
   * @private
   */
  private async performHandshake(client: any, options: MCPClientOptions): Promise<Record<string, any>> {
    // Mock/placeholder implementation
    // In a real implementation, this would:
    // 1. Connect to the MCP server
    // 2. Send an Initialize request
    // 3. Receive and parse the Initialize response
    // 4. Return the server capabilities
    
    try {
      // Connect to the server
      await client.connect();
      
      // Mock Initialize request/response
      // In reality, this would send a proper MCP Initialize message
      const initializeRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '1.0',
          clientInfo: {
            name: 'gengar-bark',
            version: '1.0.0'
          }
        }
      };
      
      // Simulate sending the request and receiving response
      const response = await client.send(initializeRequest);
      
      // Mock capabilities response
      // In reality, this would be parsed from the actual server response
      const capabilities = {
        protocolVersion: '1.0',
        serverInfo: {
          name: 'mock-mcp-server',
          version: '1.0.0'
        },
        capabilities: {
          tools: true,
          resources: true,
          prompts: false
        }
      };
      
      // Mark client as connected
      client.connected = true;
      
      return capabilities;
    } catch (error) {
      // Clean up on handshake failure
      try {
        await client.close();
      } catch (closeError) {
        // Ignore close errors
      }
      throw error;
    }
  }

  /**
   * Wraps a promise with a timeout
   * 
   * @param promise - Promise to wrap
   * @param timeoutMs - Timeout in milliseconds
   * @returns Promise that rejects if timeout is exceeded
   * @throws Error if timeout is exceeded
   * @private
   * 
   * Requirements: 6.2, 6.3
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      // Create timeout that rejects the promise
      const timeoutId = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      // Execute the original promise
      promise
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Gets the current connection map (for testing purposes)
   * @internal
   */
  getConnections(): Map<string, MCPConnection> {
    return this.connections;
  }
}

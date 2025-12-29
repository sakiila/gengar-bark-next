/**
 * Tool Registry for the AI Agent system.
 * Manages tool registration and lookup using a registry pattern.
 * Requirements: 6.1, 6.2
 */

import { Tool, OpenAIToolDefinition, ToolParameterSchema } from './types';

/**
 * Interface for the ToolRegistry.
 */
export interface IToolRegistry {
  register(tool: Tool): void;
  get(name: string): Tool | undefined;
  getAll(): Tool[];
  getToolDefinitions(): OpenAIToolDefinition[];
}

/**
 * ToolRegistry manages tool registration and provides methods to retrieve
 * tools and generate OpenAI function definitions.
 * 
 * Implements the registry pattern where tools are registered with name,
 * description, and parameter schema (Requirement 6.1).
 * 
 * New tools are automatically included in intent matching without code
 * changes to the core agent (Requirement 6.2).
 */
export class ToolRegistry implements IToolRegistry {
  private tools: Map<string, Tool>;

  constructor() {
    this.tools = new Map<string, Tool>();
  }

  /**
   * Register a tool with the registry.
   * Tools are stored by name for quick lookup.
   * 
   * @param tool - The tool to register
   * @throws Error if a tool with the same name is already registered
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool with name "${tool.name}" is already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * Get a tool by name.
   * 
   * @param name - The name of the tool to retrieve
   * @returns The tool if found, undefined otherwise
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools.
   * 
   * @returns Array of all registered tools
   */
  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Generate OpenAI function definitions from all registered tools.
   * This allows new tools to be automatically included in AI function
   * calling without modifying core agent logic (Requirement 6.2).
   * 
   * @returns Array of OpenAI tool definitions
   */
  getToolDefinitions(): OpenAIToolDefinition[] {
    return this.getAll().map((tool) => this.toolToOpenAIDefinition(tool));
  }

  /**
   * Convert a Tool to OpenAI function definition format.
   * 
   * @param tool - The tool to convert
   * @returns OpenAI tool definition
   */
  private toolToOpenAIDefinition(tool: Tool): OpenAIToolDefinition {
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: this.normalizeParameterSchema(tool.parameters),
      },
    };
  }

  /**
   * Normalize the parameter schema to ensure it's valid for OpenAI.
   * Creates a copy to avoid mutating the original.
   * 
   * @param schema - The parameter schema to normalize
   * @returns Normalized parameter schema
   */
  private normalizeParameterSchema(schema: ToolParameterSchema): ToolParameterSchema {
    return {
      type: 'object',
      properties: { ...schema.properties },
      required: [...schema.required],
    };
  }

  /**
   * Check if a tool is registered.
   * 
   * @param name - The name of the tool to check
   * @returns true if the tool is registered, false otherwise
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get the number of registered tools.
   * 
   * @returns The count of registered tools
   */
  get size(): number {
    return this.tools.size;
  }

  /**
   * Unregister a tool by name.
   * 
   * @param name - The name of the tool to unregister
   * @returns true if the tool was removed, false if it wasn't found
   */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Clear all registered tools.
   */
  clear(): void {
    this.tools.clear();
  }
}

/**
 * Singleton instance of the ToolRegistry for global access.
 */
let globalRegistry: ToolRegistry | null = null;

/**
 * Get the global ToolRegistry instance.
 * Creates a new instance if one doesn't exist.
 * 
 * @returns The global ToolRegistry instance
 */
export function getToolRegistry(): ToolRegistry {
  if (!globalRegistry) {
    globalRegistry = new ToolRegistry();
  }
  return globalRegistry;
}

/**
 * Reset the global registry (useful for testing).
 */
export function resetToolRegistry(): void {
  globalRegistry = null;
}

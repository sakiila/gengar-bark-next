/**
 * MCP Server Templates
 * 
 * Pre-configured templates for common API-based MCP servers.
 * These templates help users quickly configure popular context sources
 * without manual configuration.
 */

/**
 * Template definition for an MCP server
 */
export interface MCPTemplate {
  /** Unique identifier for the template */
  id: string;
  
  /** Display name of the MCP server */
  name: string;
  
  /** Description of what the server provides */
  description: string;
  
  /** Transport protocol type */
  transportType: 'sse' | 'websocket' | 'streamablehttp';
  
  /** URL pattern for the server endpoint */
  urlPattern: string;
  
  /** Required fields that must be provided by the user */
  requiredFields: string[];
  
  /** Optional fields that can be provided by the user */
  optionalFields: string[];
  
  /** Link to documentation for this MCP server */
  documentation: string;
}

/**
 * Pre-configured templates for common MCP servers
 */
export const MCP_TEMPLATES: MCPTemplate[] = [
  {
    id: 'github',
    name: 'GitHub',
    description: 'Access GitHub repositories, issues, and pull requests',
    transportType: 'sse',
    urlPattern: 'https://api.github.com/mcp',
    requiredFields: ['authToken'],
    optionalFields: ['repository'],
    documentation: 'https://docs.github.com/mcp',
  },
  {
    id: 'mcd',
    name: 'McDonald',
    description: 'Access McDonald',
    transportType: 'streamablehttp',
    urlPattern: 'https://mcp.mcd.cn/mcp-servers/mcd-mcp',
    requiredFields: ['authToken'],
    optionalFields: [],
    documentation: 'https://open.mcd.cn/mcp/doc',
  }
];

/**
 * Configuration input for applying a template
 */
export interface TemplateCustomFields {
  /** Custom server name (overrides template name) */
  serverName?: string;
  
  /** Custom URL (overrides template URL pattern) */
  url?: string;
  
  /** Authentication token */
  authToken?: string;
  
  /** Additional custom fields specific to the template */
  [key: string]: string | undefined;
}

/**
 * Result of applying a template
 */
export interface AppliedTemplate {
  /** Server name for the configuration */
  serverName: string;
  
  /** Transport type */
  transportType: 'sse' | 'websocket' | 'streamablehttp';
  
  /** Server URL */
  url: string;
  
  /** Authentication token (if provided) */
  authToken?: string;
  
  /** Additional fields from the template */
  customFields: Record<string, string>;
}

/**
 * Get all available MCP server templates
 * 
 * @returns Array of all MCP templates
 */
export function getTemplates(): MCPTemplate[] {
  return [...MCP_TEMPLATES];
}

/**
 * Get a specific MCP template by ID
 * 
 * @param id - Template identifier
 * @returns The template if found, null otherwise
 */
export function getTemplateById(id: string): MCPTemplate | null {
  const template = MCP_TEMPLATES.find(t => t.id === id);
  return template ? { ...template } : null;
}

/**
 * Apply a template with custom fields to create a configuration
 * 
 * @param templateId - ID of the template to apply
 * @param customFields - Custom values to override template defaults
 * @returns Applied template configuration
 * @throws Error if template not found or required fields are missing
 */
export function applyTemplate(
  templateId: string,
  customFields: TemplateCustomFields
): AppliedTemplate {
  const template = getTemplateById(templateId);
  
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }
  
  // Check for required fields
  const missingFields = template.requiredFields.filter(
    field => !customFields[field]
  );
  
  if (missingFields.length > 0) {
    throw new Error(
      `Missing required fields for template ${templateId}: ${missingFields.join(', ')}`
    );
  }
  
  // Build the applied template
  const serverName = customFields.serverName || template.name;
  const url = customFields.url || template.urlPattern;
  const authToken = customFields.authToken;
  
  // Collect additional custom fields (excluding standard ones)
  const standardFields = ['serverName', 'url', 'authToken'];
  const additionalFields: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(customFields)) {
    if (!standardFields.includes(key) && value !== undefined) {
      additionalFields[key] = value;
    }
  }
  
  return {
    serverName,
    transportType: template.transportType,
    url,
    authToken,
    customFields: additionalFields,
  };
}

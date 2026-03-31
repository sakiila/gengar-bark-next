import type { AgentContext, Tool, ToolParameterSchema, ToolResult } from '../../types';

type GrowthbookInvoker = (params: Record<string, unknown>, context: AgentContext) => Promise<unknown>;

type GrowthbookModule = Record<string, unknown>;

const GROWTHBOOK_MODULE_PATHS = [
  '@/lib/growthbook',
  '@/lib/growthbook/services/environments',
  '@/lib/growthbook/services/projects',
  '@/lib/growthbook/services/features',
  '@/lib/growthbook/services/experiments',
  '@/lib/growthbook/services/attributes',
  '@/lib/growthbook/services/defaults',
  '@/lib/growthbook/services/metrics',
  '@/lib/growthbook/client',
  '@/lib/growthbook/defaults',
];

async function loadGrowthbookModules(): Promise<GrowthbookModule[]> {
  const modules: GrowthbookModule[] = [];
  for (const modulePath of GROWTHBOOK_MODULE_PATHS) {
    try {
      const loaded = (await import(modulePath)) as GrowthbookModule;
      modules.push(loaded);
    } catch {
      // Optional module path; ignore so wrappers remain branch-local compilable.
    }
  }
  return modules;
}

export async function invokeGrowthbook(
  functionNames: string[],
  params: Record<string, unknown>,
  context: AgentContext
): Promise<ToolResult> {
  const modules = await loadGrowthbookModules();

  for (const name of functionNames) {
    for (const module of modules) {
      const candidate = module[name];
      if (typeof candidate === 'function') {
        const invoker = candidate as GrowthbookInvoker;
        const data = await invoker(params, context);
        return {
          success: true,
          data,
          displayText: `GrowthBook tool executed: ${name}`,
        };
      }
    }
  }

  return {
    success: false,
    error: `No growthbook service function found: ${functionNames.join(', ')}`,
    displayText:
      'GrowthBook service layer is not available in this branch yet. Please complete A task (`lib/growthbook/*`) and retry.',
  };
}

export function sanitizeCreatePayload(params: Record<string, unknown>): Record<string, unknown> {
  const next = { ...params };
  delete next.owner;
  return next;
}

export function createGrowthbookTool(options: {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
  cacheable: boolean;
  functionNames: string[];
  transformParams?: (params: Record<string, unknown>) => Record<string, unknown>;
}): Tool {
  return {
    name: options.name,
    description: options.description,
    parameters: options.parameters,
    cacheable: options.cacheable,
    async execute(params: Record<string, unknown>, context: AgentContext): Promise<ToolResult> {
      try {
        const normalizedParams = options.transformParams ? options.transformParams(params) : params;
        return await invokeGrowthbook(options.functionNames, normalizedParams, context);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown GrowthBook tool error';
        return {
          success: false,
          error: message,
          displayText: `GrowthBook request failed: ${message}`,
        };
      }
    },
  };
}

export const paginationProperties: ToolParameterSchema['properties'] = {
  limit: {
    type: 'number',
    description: 'Maximum records to return (1-100).',
  },
  offset: {
    type: 'number',
    description: 'Pagination offset (>=0).',
  },
  mostRecent: {
    type: 'boolean',
    description: 'When true and offset=0, fetches most recent records first.',
  },
};

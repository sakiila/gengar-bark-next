import type { Tool } from '../../types';
import { createGrowthbookTool, paginationProperties } from './common';

export function createGetEnvironmentsTool(): Tool {
  return createGrowthbookTool({
    name: 'growthbook_get_environments',
    description: 'Get GrowthBook environments.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    cacheable: true,
    functionNames: ['getEnvironments', 'growthbookGetEnvironments'],
  });
}

export function createGetProjectsTool(): Tool {
  return createGrowthbookTool({
    name: 'growthbook_get_projects',
    description: 'Get GrowthBook projects with MCP-compatible pagination.',
    parameters: {
      type: 'object',
      properties: {
        ...paginationProperties,
      },
      required: [],
    },
    cacheable: true,
    functionNames: ['getProjects', 'growthbookGetProjects'],
  });
}

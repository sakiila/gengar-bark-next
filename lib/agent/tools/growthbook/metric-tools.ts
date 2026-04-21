import type { Tool } from '../../types';
import { createGrowthbookTool, paginationProperties } from './common';

export function createMetricTools(): Tool[] {
  return [
    createGrowthbookTool({
      name: 'growthbook_get_metrics',
      description: 'Get GrowthBook metrics or a single metric by id.',
      parameters: {
        type: 'object',
        properties: {
          project: {
            type: 'string',
            description: 'Optional project ID filter.',
          },
          metricId: {
            type: 'string',
            description: 'Optional metric ID for detail fetch.',
          },
          ...paginationProperties,
        },
        required: [],
      },
      cacheable: true,
      functionNames: ['getMetrics', 'growthbookGetMetrics'],
    }),
  ];
}

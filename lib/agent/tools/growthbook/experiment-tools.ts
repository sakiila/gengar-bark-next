import type { Tool } from '../../types';
import { createGrowthbookTool, paginationProperties } from './common';

export function createExperimentTools(): Tool[] {
  return [
    createGrowthbookTool({
      name: 'growthbook_get_experiments',
      description: 'Get GrowthBook experiments with mode and pagination support.',
      parameters: {
        type: 'object',
        properties: {
          project: {
            type: 'string',
            description: 'Optional project ID filter.',
          },
          experimentId: {
            type: 'string',
            description: 'Optional experiment ID for detail fetch.',
          },
          mode: {
            type: 'string',
            description: 'Response mode for experiment data.',
            enum: ['metadata', 'summary', 'full'],
          },
          ...paginationProperties,
        },
        required: [],
      },
      cacheable: true,
      functionNames: ['getExperiments', 'growthbookGetExperiments'],
    }),
    createGrowthbookTool({
      name: 'growthbook_get_attributes',
      description: 'Get GrowthBook attributes.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      cacheable: true,
      functionNames: ['getAttributes', 'growthbookGetAttributes'],
    }),
    createGrowthbookTool({
      name: 'growthbook_get_defaults',
      description: 'Get GrowthBook experiment defaults.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      cacheable: true,
      functionNames: ['getDefaults', 'growthbookGetDefaults'],
    }),
    createGrowthbookTool({
      name: 'growthbook_set_user_defaults',
      description: 'Set persisted user defaults for GrowthBook experiment creation.',
      parameters: {
        type: 'object',
        properties: {
          datasourceId: {
            type: 'string',
            description: 'Datasource ID.',
          },
          assignmentQueryId: {
            type: 'string',
            description: 'Assignment query ID.',
          },
          environments: {
            type: 'array',
            description: 'Default environments for experiment creation.',
            items: {
              type: 'string',
              description: 'Environment ID',
            },
          },
        },
        required: ['datasourceId', 'assignmentQueryId', 'environments'],
      },
      cacheable: false,
      functionNames: ['setUserDefaults', 'growthbookSetUserDefaults'],
    }),
    createGrowthbookTool({
      name: 'growthbook_clear_user_defaults',
      description: 'Clear persisted user defaults for GrowthBook experiment creation.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      cacheable: false,
      functionNames: ['clearUserDefaults', 'growthbookClearUserDefaults'],
    }),
  ];
}

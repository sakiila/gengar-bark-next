import type { Tool } from '../../types';
import {
  createGrowthbookTool,
  paginationProperties,
  sanitizeCreatePayload,
} from './common';

export function createFeatureTools(): Tool[] {
  return [
    createGrowthbookTool({
      name: 'growthbook_create_feature_flag',
      description: 'Create a GrowthBook feature flag.',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Feature key ID.',
          },
          valueType: {
            type: 'string',
            description: 'Value type for flag values.',
            enum: ['string', 'number', 'boolean', 'json'],
          },
          defaultValue: {
            type: 'string',
            description: 'Default value (stringified for json).',
          },
          description: {
            type: 'string',
            description: 'Human-readable feature description.',
          },
          archived: {
            type: 'boolean',
            description: 'Whether the flag should be created archived.',
          },
          project: {
            type: 'string',
            description: 'Optional project ID scope.',
          },
          fileExtension: {
            type: 'string',
            description: 'File extension to shape SDK doc snippet generation.',
          },
          customFields: {
            type: 'object',
            description: 'Optional custom fields payload.',
          },
          owner: {
            type: 'string',
            description: 'Ignored. Owner is controlled by service layer.',
          },
        },
        required: ['id', 'valueType', 'defaultValue', 'description', 'fileExtension'],
      },
      cacheable: false,
      functionNames: ['createFeatureFlag', 'growthbookCreateFeatureFlag'],
      transformParams: sanitizeCreatePayload,
    }),
    createGrowthbookTool({
      name: 'growthbook_create_force_rule',
      description: 'Create a GrowthBook force rule for an existing feature flag.',
      parameters: {
        type: 'object',
        properties: {
          featureId: {
            type: 'string',
            description: 'Target feature flag ID.',
          },
          description: {
            type: 'string',
            description: 'Optional rule description.',
          },
          fileExtension: {
            type: 'string',
            description: 'File extension to shape SDK doc snippet generation.',
          },
          condition: {
            type: 'string',
            description: 'Optional targeting condition JSON string.',
          },
          value: {
            type: 'string',
            description: 'Forced value (stringified for json).',
          },
          owner: {
            type: 'string',
            description: 'Ignored. Owner is controlled by service layer.',
          },
        },
        required: ['featureId', 'fileExtension', 'value'],
      },
      cacheable: false,
      functionNames: ['createForceRule', 'growthbookCreateForceRule'],
      transformParams: sanitizeCreatePayload,
    }),
    createGrowthbookTool({
      name: 'growthbook_get_feature_flags',
      description: 'Get GrowthBook feature flags or a single feature flag by id.',
      parameters: {
        type: 'object',
        properties: {
          project: {
            type: 'string',
            description: 'Optional project ID filter.',
          },
          featureFlagId: {
            type: 'string',
            description: 'Optional feature flag ID for detail fetch.',
          },
          ...paginationProperties,
        },
        required: [],
      },
      cacheable: true,
      functionNames: ['getFeatureFlags', 'growthbookGetFeatureFlags'],
    }),
    createGrowthbookTool({
      name: 'growthbook_list_feature_keys',
      description: 'List GrowthBook feature keys.',
      parameters: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Optional project ID filter.',
          },
        },
        required: [],
      },
      cacheable: true,
      functionNames: ['listFeatureKeys', 'growthbookListFeatureKeys'],
    }),
    createGrowthbookTool({
      name: 'growthbook_get_stale_feature_flags',
      description: 'Check stale status for provided GrowthBook feature IDs.',
      parameters: {
        type: 'object',
        properties: {
          featureIds: {
            type: 'array',
            description: 'Feature IDs to evaluate for stale status.',
            items: {
              type: 'string',
              description: 'Feature ID',
            },
          },
        },
        required: [],
      },
      cacheable: true,
      functionNames: ['getStaleFeatureFlags', 'growthbookGetStaleFeatureFlags'],
    }),
    createGrowthbookTool({
      name: 'growthbook_generate_flag_types',
      description: 'Generate feature flag types by invoking GrowthBook CLI.',
      parameters: {
        type: 'object',
        properties: {
          currentWorkingDirectory: {
            type: 'string',
            description: 'Working directory where GrowthBook CLI commands run.',
          },
        },
        required: ['currentWorkingDirectory'],
      },
      cacheable: false,
      functionNames: ['generateFlagTypes', 'growthbookGenerateFlagTypes'],
    }),
  ];
}

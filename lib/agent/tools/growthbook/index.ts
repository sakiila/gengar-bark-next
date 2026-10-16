import type { Tool } from '../../types';
import { createGetEnvironmentsTool, createGetProjectsTool } from './catalog-tools';
import { createFeatureTools } from './feature-tools';
import { createExperimentTools } from './experiment-tools';
import { createMetricTools } from './metric-tools';

export const GROWTHBOOK_TOOL_NAMES: readonly string[] = [
  'growthbook_get_environments',
  'growthbook_get_projects',
  'growthbook_create_feature_flag',
  'growthbook_create_force_rule',
  'growthbook_get_feature_flags',
  'growthbook_list_feature_keys',
  'growthbook_get_stale_feature_flags',
  'growthbook_generate_flag_types',
  'growthbook_get_experiments',
  'growthbook_get_attributes',
  'growthbook_get_defaults',
  'growthbook_set_user_defaults',
  'growthbook_clear_user_defaults',
  'growthbook_get_metrics',
];

export function createGrowthbookTools(): Tool[] {
  return [
    createGetEnvironmentsTool(),
    createGetProjectsTool(),
    ...createFeatureTools(),
    ...createExperimentTools(),
    ...createMetricTools(),
  ];
}

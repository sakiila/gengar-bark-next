import type { Tool } from '../../types';

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

/**
 * TODO(A/B merge): replace placeholder with concrete tool factories.
 * This keeps index-level integration type-safe in isolated worktrees.
 */
export function createGrowthbookTools(): Tool[] {
  return [];
}

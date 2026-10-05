import type { Launch } from '@/workspace/core-workspace';
import type { ChosenSettings } from './agent-settings';
import type { CatalogModel } from './core-agents';

function fittingEffort(
  { model, effort }: ChosenSettings,
  models: readonly CatalogModel[],
): string | null {
  const efforts = models.find(({ value }) => value === model)?.efforts ?? [];
  return efforts.some(({ value }) => value === effort) ? effort : null;
}

export function launchOf(
  cwd: string,
  chosen: ChosenSettings,
  models: readonly CatalogModel[],
): Launch {
  const { model, mode } = chosen;
  const effort = fittingEffort(chosen, models);
  return {
    cwd,
    mode,
    ...(model !== null && { model }),
    ...(effort !== null && { effort }),
  };
}

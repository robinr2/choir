import { useCallback, useMemo } from 'react';
import {
  type ModelOption,
  ModelSelectorContent,
  ModelSelectorRoot,
  ModelSelectorTrigger,
} from '@/components/assistant-ui/elements/model-selector';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CatalogChoice, CatalogModel } from './core-agents';

export type ChosenSettings = {
  model: string | null;
  effort: string | null;
  mode: string;
};

type AgentSettingsProps = Readonly<{
  models: readonly CatalogModel[];
  modes: readonly CatalogChoice[];
  chosen: ChosenSettings;
  onModel: (model: string) => void;
  onEffort: (effort: string) => void;
  onMode: (mode: string) => void;
}>;

function optionOf({ value, name, description, efforts }: CatalogModel) {
  const option: ModelOption = {
    id: value,
    name,
    efforts: efforts.map((effort) => ({ id: effort.value, name: effort.name })),
  };
  if (description) option.description = description;
  return option;
}

function useModeItems(modes: readonly CatalogChoice[]) {
  return useMemo(
    () => modes.map(({ value, name }) => ({ value, label: name })),
    [modes],
  );
}

function ModeOptions({ modes }: Readonly<{ modes: readonly CatalogChoice[] }>) {
  return (
    <SelectContent className="min-w-44">
      {modes.map(({ value, name, description }) => (
        <SelectItem key={value} value={value} title={description ?? name}>
          {name}
        </SelectItem>
      ))}
    </SelectContent>
  );
}

function ModePill({
  modes,
  mode,
  onMode,
}: Readonly<{
  modes: readonly CatalogChoice[];
  mode: string;
  onMode: (mode: string) => void;
}>) {
  const items = useModeItems(modes);
  const choose = useCallback(
    (value: string | null) => value !== null && onMode(value),
    [onMode],
  );
  return (
    <Select items={items} value={mode} onValueChange={choose}>
      <SelectTrigger
        size="sm"
        aria-label="Mode"
        className="h-7 min-w-0 shrink rounded-full px-2.5 text-xs"
      >
        <SelectValue />
      </SelectTrigger>
      <ModeOptions modes={modes} />
    </Select>
  );
}

export function AgentSettings({
  models,
  modes,
  chosen,
  onModel,
  onEffort,
  onMode,
}: AgentSettingsProps) {
  const options = useMemo(() => models.map(optionOf), [models]);
  return (
    <div className="flex min-w-0 items-center gap-1">
      <ModelSelectorRoot
        models={options}
        value={chosen.model ?? undefined}
        onValueChange={onModel}
        effort={chosen.effort ?? undefined}
        onEffortChange={onEffort}
      >
        <ModelSelectorTrigger
          variant="ghost"
          size="sm"
          aria-label="Model"
          className="min-w-0 rounded-full"
        />
        <ModelSelectorContent className="w-[26rem] max-w-[calc(100vw-2rem)]" />
      </ModelSelectorRoot>
      <ModePill modes={modes} mode={chosen.mode} onMode={onMode} />
    </div>
  );
}

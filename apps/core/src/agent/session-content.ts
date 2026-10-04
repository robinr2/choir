import type {
  ContentBlock,
  SessionConfigOption,
  SessionUpdate,
} from '@agentclientprotocol/sdk';

type PromptImage = { data: string; mimeType: string };

export type PromptContent = { text: string; images?: PromptImage[] };

const MODE = 'mode';

export function promptBlocks({
  text,
  images = [],
}: PromptContent): ContentBlock[] {
  return [
    { type: 'text', text },
    ...images.map(({ data, mimeType }) => ({
      type: 'image' as const,
      data,
      mimeType,
    })),
  ];
}

export function withConfigUpdate(
  options: SessionConfigOption[],
  update: SessionUpdate,
): SessionConfigOption[] {
  if (update.sessionUpdate === 'config_option_update') {
    return update.configOptions;
  }
  if (update.sessionUpdate !== 'current_mode_update') return options;
  return options.map((option) =>
    option.id === MODE && option.type === 'select'
      ? { ...option, currentValue: update.currentModeId }
      : option,
  );
}

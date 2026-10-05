import { useCallback, useMemo } from 'react';
import { ContextDisplayRing } from '@/components/assistant-ui/elements/context-display';
import { useConversation } from '@/conversation/conversation-context';
import type { SettingsChange } from '@/conversation/core-conversation';
import { AgentSettings } from './agent-settings';

function useChange(name: keyof SettingsChange) {
  const { conversation } = useConversation();
  return useCallback(
    (value: string) => void conversation.change({ [name]: value }),
    [conversation, name],
  );
}

export function ComposerSettings() {
  const { settings } = useConversation().state;
  const onModel = useChange('model');
  const onEffort = useChange('effort');
  const onMode = useChange('mode');
  if (!settings) return null;
  return (
    <AgentSettings
      models={settings.models}
      modes={settings.modes}
      chosen={settings}
      onModel={onModel}
      onEffort={onEffort}
      onMode={onMode}
    />
  );
}

export function ContextRing() {
  const { usage, session } = useConversation().state;
  const used = usage?.used;
  const tokens = useMemo(() => ({ totalTokens: used }), [used]);
  if (!usage) return null;
  return (
    <ContextDisplayRing
      modelContextWindow={usage.size}
      usage={tokens}
      cost={usage.cost}
      resetKey={session?.id}
    />
  );
}

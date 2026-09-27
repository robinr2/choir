import { useCallback } from 'react';
import { usePipecatClientTransportState } from '@pipecat-ai/client-react';
import { AudioLinesIcon } from 'lucide-react';
import { TooltipIconButton } from '@/components/assistant-ui/elements/tooltip-icon-button';
import { AudioVisualizerBar } from '@/components/pipecat/audio-visualizer-bar';
import { UserAudioControl } from '@/components/pipecat/user-audio-control';
import { useAgentId, useWorkspace } from '@/workspace/workspace-context';

function VoiceActivity() {
  return (
    <>
      <AudioVisualizerBar
        participantType="bot"
        barWidth={3}
        barMaxHeight={14}
        className="text-muted-foreground"
      />
      <UserAudioControl size="sm" variant="ghost" noDevicePicker />
    </>
  );
}

export function VoiceControls() {
  const agentId = useAgentId();
  const { voice, view } = useWorkspace();
  const isReady = usePipecatClientTransportState() === 'ready';
  const isOn = view.voiceAgentId === agentId;
  const toggle = useCallback(
    () => void voice.toggle(agentId),
    [voice, agentId],
  );

  return (
    <>
      {isOn && isReady && <VoiceActivity />}
      <TooltipIconButton
        tooltip="Voice"
        side="bottom"
        type="button"
        size="icon"
        className="aria-pressed:bg-active/15 aria-pressed:text-active size-7 rounded-full"
        aria-pressed={isOn}
        onClick={toggle}
      >
        <AudioLinesIcon className="size-4" />
      </TooltipIconButton>
    </>
  );
}

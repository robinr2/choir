import {
  useAuiState,
  useVoiceControls,
  useVoiceState,
} from '@assistant-ui/react';
import { MicIcon } from 'lucide-react';
import { TooltipIconButton } from '@/components/assistant-ui/elements/tooltip-icon-button';
import { AudioVisualizerBar } from '@/components/pipecat/audio-visualizer-bar';
import { UserAudioControl } from '@/components/pipecat/user-audio-control';

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

function VoiceToggle() {
  const status = useVoiceState()?.status.type;
  const isThreadRunning = useAuiState((s) => s.thread.isRunning);
  const { connect, disconnect } = useVoiceControls();
  const isOn = status === 'starting' || status === 'running';

  return (
    <TooltipIconButton
      tooltip="Voice"
      side="bottom"
      type="button"
      size="icon"
      className="aria-pressed:bg-secondary aria-pressed:text-secondary-foreground size-7 rounded-full"
      aria-pressed={isOn}
      disabled={isThreadRunning && !isOn}
      onClick={isOn ? disconnect : connect}
    >
      <MicIcon className="size-4" />
    </TooltipIconButton>
  );
}

export function VoiceControls() {
  const isRunning = useVoiceState()?.status.type === 'running';

  return (
    <>
      {isRunning && <VoiceActivity />}
      <VoiceToggle />
    </>
  );
}

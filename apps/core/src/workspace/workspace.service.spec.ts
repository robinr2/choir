import { Logger } from '@nestjs/common';
import type { AgentService } from '../agent/agent.service.js';
import { BehaviorSubject } from 'rxjs';
import type { Conversations } from '../conversations/conversations.port.js';
import { LayoutService } from '../layout/layout.service.js';
import { VoiceService } from '../voice/voice.service.js';
import { WorkspaceService } from './workspace.service.js';

it('logs a message it could not deliver', async () => {
  const logError = vi.spyOn(Logger.prototype, 'error').mockReturnValue();
  const layout = new LayoutService({
    load: async () => undefined,
    save: async () => undefined,
  });
  await layout.onModuleInit();
  const conversations = {
    workingChanges: new BehaviorSubject<ReadonlySet<string>>(new Set()),
    sendMessage: vi
      .fn<Conversations['sendMessage']>()
      .mockRejectedValue(new Error('agent exited')),
    close: vi.fn<Conversations['close']>(),
  };
  const workspace = new WorkspaceService(
    layout,
    conversations,
    new VoiceService(),
    { launch: vi.fn<AgentService['launch']>() },
  );
  const [first] = Object.keys(layout.current.panes);
  const second = await layout.openPane({ kind: 'agent' });
  workspace.sendMessage(first, second.id, 'hi');
  await vi.waitFor(() =>
    expect(logError).toHaveBeenCalledExactlyOnceWith(
      `Message to agent ${second.id} failed: Error: agent exited`,
    ),
  );
});

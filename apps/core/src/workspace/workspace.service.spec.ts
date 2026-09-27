import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Logger } from '@nestjs/common';
import { BehaviorSubject } from 'rxjs';
import type { ConversationsService } from '../conversations/conversations.service.js';
import { LayoutService } from '../layout/layout.service.js';
import { LayoutStore } from '../layout/layout.store.js';
import { VoiceService } from '../voice/voice.service.js';
import { WorkspaceService } from './workspace.service.js';

let dataDir: string;

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), 'choir-workspace-'));
});

afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

it('logs a message it could not deliver', async () => {
  const logError = vi.spyOn(Logger.prototype, 'error').mockReturnValue();
  const layout = new LayoutService(
    new LayoutStore({
      dataDir,
      coreUrl: 'http://core',
      canvasUrl: 'http://127.0.0.1:3100',
    }),
  );
  await layout.onModuleInit();
  const conversations = {
    workingChanges: new BehaviorSubject<ReadonlySet<string>>(new Set()),
    sendMessage: vi
      .fn<ConversationsService['sendMessage']>()
      .mockRejectedValue(new Error('agent exited')),
    close: vi.fn<ConversationsService['close']>(),
  };
  const workspace = new WorkspaceService(
    layout,
    conversations,
    new VoiceService(),
  );
  const [first] = Object.keys(layout.current.panes);
  const second = await layout.addAtEdge('right', { kind: 'agent' });
  workspace.sendMessage(first, second.id, 'hi');
  await vi.waitFor(() =>
    expect(logError).toHaveBeenCalledExactlyOnceWith(
      `Message to agent ${second.id} failed: Error: agent exited`,
    ),
  );
});

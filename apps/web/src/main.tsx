import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { CoreAgents } from './agents/core-agents.ts';
import { CoreRateLimits } from './agents/core-rate-limits.ts';
import App from './App.tsx';
import { CoreCanvas } from './canvas/core-canvas.ts';
import { CoreInbox } from './inbox/core-inbox.ts';
import { CoreEvents } from './lib/core-events.ts';
import { createPipecatClient } from './voice/create-pipecat-client.ts';
import { CoreWorkspace } from './workspace/core-workspace.ts';

const root = document.getElementById('root');

if (root) {
  const events = new CoreEvents();
  createRoot(root).render(
    <StrictMode>
      <App
        client={createPipecatClient()}
        events={events}
        workspace={new CoreWorkspace(events.feed('workspace'))}
        canvas={new CoreCanvas()}
        inbox={new CoreInbox(events.feed('inbox'))}
        agents={new CoreAgents()}
        rateLimits={new CoreRateLimits(events.feed('rate-limits'))}
      />
    </StrictMode>,
  );
}

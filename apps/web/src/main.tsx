import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { CoreCanvas } from './canvas/core-canvas.ts';
import { createPipecatClient } from './voice/create-pipecat-client.ts';
import { CoreWorkspace } from './workspace/core-workspace.ts';

const root = document.getElementById('root');

if (root) {
  createRoot(root).render(
    <StrictMode>
      <App
        client={createPipecatClient()}
        workspace={new CoreWorkspace()}
        canvas={new CoreCanvas()}
      />
    </StrictMode>,
  );
}

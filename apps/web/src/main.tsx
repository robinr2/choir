import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { createPipecatClient } from './voice/create-pipecat-client.ts';

const root = document.getElementById('root');

if (root) {
  createRoot(root).render(
    <StrictMode>
      <App client={createPipecatClient()} />
    </StrictMode>,
  );
}

import { Suspense, use } from 'react';
import { useWorkspace } from '@/workspace/workspace-context';

function ExcalidrawFrame() {
  const { canvas } = useWorkspace();
  const url = use(canvas.url());
  return (
    <iframe
      title="Excalidraw canvas"
      src={url}
      allow="clipboard-read; clipboard-write"
      // oxlint-disable-next-line react/iframe-missing-sandbox
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-modals" // react-doctor-disable-line react-doctor/iframe-missing-sandbox
      className="size-full border-0"
    />
  );
}

export function ExcalidrawCanvas() {
  return (
    <Suspense>
      <ExcalidrawFrame />
    </Suspense>
  );
}

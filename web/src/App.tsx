import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import { EchoRuntimeProvider } from "@/runtime/echo-runtime-provider";

function App() {
  return (
    <EchoRuntimeProvider>
      <div className="h-dvh">
        <Thread />
      </div>
    </EchoRuntimeProvider>
  );
}

export default App;

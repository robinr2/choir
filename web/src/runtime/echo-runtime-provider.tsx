import type { ReactNode } from "react";
import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  type ChatModelAdapter,
} from "@assistant-ui/react";

const echoAdapter: ChatModelAdapter = {
  async run({ messages }) {
    const last = messages.at(-1);
    const text =
      last?.content
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n") ?? "";
    return { content: [{ type: "text", text }] };
  },
};

export function EchoRuntimeProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const runtime = useLocalRuntime(echoAdapter);
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}

import { TextMessagePartProvider } from '@assistant-ui/react';
import { MarkdownText } from '@/components/assistant-ui/elements/markdown-text';

export function MarkdownBlock({ text }: Readonly<{ text: string }>) {
  return (
    <div className="bg-muted/40 max-h-96 overflow-y-auto rounded-xl px-3.5 py-2.5 text-sm">
      <TextMessagePartProvider text={text}>
        <MarkdownText />
      </TextMessagePartProvider>
    </div>
  );
}

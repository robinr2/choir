import { useAui, useAuiState } from '@assistant-ui/react';
import { textBefore } from '@/conversation/transcript';

export function SpokenText({ text }: Readonly<{ text: string }>) {
  const { query } = useAui().part;
  const upTo = useAuiState(
    (s) =>
      Number(s.message.metadata.custom.spokenUpTo) -
      textBefore(s.message.parts, query),
  );
  const spoken = Math.max(upTo, 0);

  return (
    <p
      data-slot="spoken-text"
      className="aui-md-p my-3 leading-relaxed whitespace-pre-wrap first:mt-0 last:mb-0"
    >
      <span>{text.slice(0, spoken)}</span>
      <span className="text-muted-foreground">{text.slice(spoken)}</span>
    </p>
  );
}

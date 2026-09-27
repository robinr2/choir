import type { Sender, TurnMark } from './transcript.js';

export type Continuation =
  { kind: 'withdrawn'; words: string } | { kind: 'interrupted'; heard: string };

export type FramedTurn = { prompt: string; note?: string };

function rest(words: string, text: string): string {
  if (!text.startsWith(words)) return text;
  return text.slice(words.length).trim() || text;
}

export function framed(
  continuation: Continuation | undefined,
  text: string,
): FramedTurn {
  if (continuation?.kind === 'withdrawn') {
    return {
      prompt: rest(continuation.words, text),
      note: "The user's last message was not finished. This message continues it.",
    };
  }
  if (continuation?.kind === 'interrupted') {
    return {
      prompt: text,
      note: `The user interrupted your last answer after hearing only: "${continuation.heard}".`,
    };
  }
  return { prompt: text };
}

export function contextFor(
  turns: Iterable<{
    request: { prompt: string; note?: string; mark: TurnMark };
  }>,
  prompt: string,
  voiceRules: string,
): string {
  const turn = [...turns].find(
    ({ request }) => request.prompt === prompt.trim(),
  );
  if (!turn) return '';
  const { mark, note } = turn.request;
  return [mark.aloud && voiceRules, note].filter(Boolean).join('\n\n');
}

export function fromAgent(sender: Sender, text: string): string {
  return `(A message from the agent "${sender.name}", ID ${sender.id}. Answer it with the send_message tool of the choir MCP server. It sees nothing else you write.)\n\n${text}`;
}

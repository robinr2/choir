import type { Sender } from './transcript.js';

export type Continuation =
  { kind: 'withdrawn'; words: string } | { kind: 'interrupted'; heard: string };

function rest(words: string, text: string): string {
  if (!text.startsWith(words)) return text;
  return text.slice(words.length).trim() || text;
}

export function framed(
  continuation: Continuation | undefined,
  text: string,
): string {
  if (continuation?.kind === 'withdrawn') {
    return `(The user was not finished and continues:) ${rest(continuation.words, text)}`;
  }
  if (continuation?.kind === 'interrupted') {
    return `(The user interrupted you after hearing only: "${continuation.heard}". They continue:) ${text}`;
  }
  return text;
}

export function fromAgent(sender: Sender, text: string): string {
  return `(A message from the agent "${sender.name}", ID ${sender.id}. Answer it with the send_message tool of the choir MCP server. It sees nothing else you write.)\n\n${text}`;
}

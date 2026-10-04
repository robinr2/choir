import type { ContentBlock } from '@agentclientprotocol/sdk';
import type { TranscriptMessage, TranscriptPart } from './transcript.js';

type Messages = TranscriptMessage[];

type Parts = TranscriptPart[];

export type PartMatch<Part extends TranscriptPart> = (
  part: TranscriptPart,
) => part is Part;

type Prose = Extract<TranscriptPart, { text: string }>;

function isProse(part?: TranscriptPart): part is Prose {
  return part !== undefined && 'text' in part;
}

export function contentPart(block: ContentBlock): TranscriptPart[] {
  if (block.type === 'text') return [{ type: 'text', text: block.text }];
  if (block.type !== 'image') return [];
  return [
    { type: 'image', image: `data:${block.mimeType};base64,${block.data}` },
  ];
}

export function withPart(parts: Parts, part: TranscriptPart): Parts {
  const last = parts.at(-1);
  if (!isProse(part) || !isProse(last) || last.type !== part.type) {
    return [...parts, part];
  }
  return parts.with(parts.length - 1, { ...part, text: last.text + part.text });
}

export function withMessage(
  messages: Messages,
  message: Omit<TranscriptMessage, 'id'>,
): Messages {
  return [...messages, { id: `m${messages.length}`, ...message }];
}

export function withReply(
  messages: Messages,
  change: (parts: Parts) => Parts,
): Messages {
  const last = messages.at(-1);
  if (last?.role === 'assistant') {
    return messages.with(messages.length - 1, {
      ...last,
      parts: change(last.parts),
    });
  }
  const parts = change([]);
  if (parts.length === 0) return messages;
  return withMessage(messages, { role: 'assistant', parts });
}

export function withUserContent(
  messages: Messages,
  block: ContentBlock,
): Messages {
  const last = messages.at(-1);
  const added = contentPart(block);
  if (last?.role !== 'user') {
    return withMessage(messages, { role: 'user', parts: added });
  }
  const parts = added.reduce(withPart, last.parts);
  return messages.with(messages.length - 1, { ...last, parts });
}

function mapParts(
  messages: Messages,
  change: (part: TranscriptPart) => TranscriptPart,
): Messages {
  return messages.map((message) => ({
    ...message,
    parts: message.parts.map(change),
  }));
}

export function upsertPart<Part extends TranscriptPart>(
  messages: Messages,
  matches: PartMatch<Part>,
  change: (part: Part) => Part,
  created: () => Part | undefined,
): Messages {
  if (messages.some(({ parts }) => parts.some(matches))) {
    return mapParts(messages, (part) => (matches(part) ? change(part) : part));
  }
  const fresh = created();
  if (!fresh) return messages;
  return withReply(messages, (parts) => [...parts, change(fresh)]);
}

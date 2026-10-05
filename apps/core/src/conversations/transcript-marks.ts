import type {
  TranscriptMessage,
  TranscriptPart,
  TurnMark,
} from './transcript.js';

function textOf(parts: TranscriptPart[]): string {
  return parts.map((part) => (part.type === 'text' ? part.text : '')).join('');
}

function shown(parts: TranscriptPart[], text?: string): TranscriptPart[] {
  if (text === undefined) return parts;
  const others = parts.filter((part) => part.type !== 'text');
  return [{ type: 'text', text }, ...others];
}

function replyMarks(mark: TurnMark): Partial<TranscriptMessage> {
  if (!mark.aloud) return {};
  const { heard } = mark;
  return { spoken: true, ...(heard !== undefined && { heard }) };
}

export function withMarks(
  messages: TranscriptMessage[],
  marks: ReadonlyMap<string, TurnMark>,
): TranscriptMessage[] {
  let mark: TurnMark = {};
  return messages.map((message) => {
    if (message.role === 'assistant')
      return { ...message, ...replyMarks(mark) };
    mark = marks.get(textOf(message.parts)) ?? {};
    return {
      ...message,
      parts: shown(message.parts, mark.text),
      ...(mark.from && { from: mark.from }),
    };
  });
}

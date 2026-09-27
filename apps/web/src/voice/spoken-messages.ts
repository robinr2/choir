import {
  spokenTextsOf,
  type ShownMessage,
  type TranscriptMessage,
  userTurnsIn,
} from '@/conversation/transcript';
import { spokenLengths } from './spoken-lengths';
import type { ReplySpeech } from './spoken-reply';

type Reply = {
  turn: number;
  first: TranscriptMessage;
  messages: TranscriptMessage[];
};

function repliesIn(messages: readonly TranscriptMessage[]): Reply[] {
  const replies = new Map<number, Reply>();
  let turn = 0;
  for (const message of messages) {
    const reply = replies.get(turn);
    if (message.role === 'user') turn += 1;
    else if (reply) reply.messages.push(message);
    else replies.set(turn, { turn, first: message, messages: [message] });
  }
  return [...replies.values()];
}

function lengthsOf(texts: readonly string[], spoken: string | undefined) {
  if (spoken === undefined) return texts.map(({ length }) => length);
  return spokenLengths(texts, spoken);
}

function spokenUpTo(
  { messages }: Reply,
  spoken: string | undefined,
): [TranscriptMessage, number][] {
  const lengths = lengthsOf(messages.flatMap(spokenTextsOf), spoken);
  let first = 0;
  return messages.map((message) => {
    const upTo = lengths.slice(first, first + spokenTextsOf(message).length);
    first += upTo.length;
    return [message, upTo.reduce((sum, length) => sum + length, 0)];
  });
}

export function withSpeech(
  messages: readonly TranscriptMessage[],
  speech: ReplySpeech,
): ShownMessage[] {
  const liveTurn = speech.live ? userTurnsIn(messages) : -1;
  const shown = new Map(
    repliesIn(messages)
      .filter(({ first }) => first.spoken)
      .flatMap((reply) =>
        spokenUpTo(
          reply,
          reply.turn === liveTurn ? speech.spoken : reply.first.heard,
        ),
      ),
  );
  return messages.map((message) => {
    const upTo = shown.get(message);
    return upTo === undefined ? message : { ...message, spokenUpTo: upTo };
  });
}

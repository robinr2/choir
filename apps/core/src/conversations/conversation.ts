import type { AcpRuntimeHandle, AcpSessionRecord } from 'acpx/runtime';
import { BehaviorSubject } from 'rxjs';
import type { TranscriptMessage, TurnMark } from './transcript.js';
import { TurnGate } from './turn-gate.js';

export type Conversation = {
  id: string;
  snapshot: BehaviorSubject<TranscriptMessage[]>;
  record: Pick<AcpSessionRecord, 'messages'>;
  marks: Map<string, TurnMark>;
  gate: TurnGate;
  opened?: Promise<AcpRuntimeHandle>;
};

export function newConversation(id: string): Conversation {
  return {
    id,
    snapshot: new BehaviorSubject<TranscriptMessage[]>([]),
    record: { messages: [] },
    marks: new Map(),
    gate: new TurnGate(),
  };
}

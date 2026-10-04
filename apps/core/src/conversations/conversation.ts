import { BehaviorSubject } from 'rxjs';
import type { AgentConversation } from '../agent/prompt-turn.js';
import type {
  HistoryEntry,
  TranscriptMessage,
  TurnMark,
} from './transcript.js';
import { TurnGate } from './turn-gate.js';

export type Conversation = {
  id: string;
  snapshot: BehaviorSubject<TranscriptMessage[]>;
  history: HistoryEntry[];
  marks: Map<string, TurnMark>;
  gate: TurnGate;
  opened?: Promise<AgentConversation>;
};

export function newConversation(id: string): Conversation {
  return {
    id,
    snapshot: new BehaviorSubject<TranscriptMessage[]>([]),
    history: [],
    marks: new Map(),
    gate: new TurnGate(),
  };
}

import type { PromptContent } from '../agent/session-content.js';
import type { TurnMark } from './transcript.js';

export type TurnKind = {
  early: boolean;
  voice: boolean;
};

export type TurnRequest = {
  prompt: string;
  note?: string;
  words: string;
  early: boolean;
  mark: TurnMark;
  images?: PromptContent['images'];
};

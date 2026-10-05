import { useAssistantDataUI } from '@assistant-ui/react';
import { CompactionData } from './compaction-ui';
import { ElicitationData } from './elicitation-ui';

const ELICITATION = { name: 'elicitation', render: ElicitationData };

const COMPACTION = { name: 'compaction', render: CompactionData };

export function ChatData() {
  useAssistantDataUI(ELICITATION);
  useAssistantDataUI(COMPACTION);
  return null;
}

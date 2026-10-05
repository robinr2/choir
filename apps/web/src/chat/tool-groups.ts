import { toolDetailsIn } from '@/conversation/thread-message';

type GroupedPart = {
  type: string;
  approval?: unknown;
  artifact?: unknown;
};

export function standsAlone(part: GroupedPart): boolean {
  const { question, diffs } = toolDetailsIn(part.artifact);
  return (
    part.approval !== undefined || question !== undefined || diffs.length > 0
  );
}

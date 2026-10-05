import { structuredPatch, type StructuredPatchHunk } from 'diff';
import type { DiffLine } from '@/components/assistant-ui/elements/code-diff';
import type { ToolCallPart } from '@/conversation/transcript';

type FileDiff = ToolCallPart['diffs'][number];

export type ShownDiff = {
  filename: string;
  additions: number;
  deletions: number;
  lines: DiffLine[];
};

const KINDS: Record<string, DiffLine['kind']> = {
  '+': 'added',
  '-': 'removed',
  ' ': 'context',
};

function lineOf(line: string): DiffLine[] {
  const kind = KINDS[line.charAt(0)];
  return kind ? [{ kind, text: line.slice(1) }] : [];
}

function headerOf(hunk: StructuredPatchHunk): DiffLine {
  const { oldStart, oldLines, newStart, newLines } = hunk;
  const text = `@@ -${oldStart},${oldLines} +${newStart},${newLines} @@`;
  return { kind: 'context', text };
}

function countOf(lines: readonly DiffLine[], kind: DiffLine['kind']): number {
  return lines.filter((line) => line.kind === kind).length;
}

export function shownDiff(
  { oldText, newText }: FileDiff,
  name: string,
): ShownDiff {
  const { hunks } = structuredPatch(name, name, oldText ?? '', newText);
  const lines = hunks.flatMap((hunk) =>
    (oldText === null ? [] : [headerOf(hunk)]).concat(
      hunk.lines.flatMap(lineOf),
    ),
  );
  return {
    filename: name,
    additions: countOf(lines, 'added'),
    deletions: countOf(lines, 'removed'),
    lines,
  };
}

export function shownPath(path: string, folder: string | undefined): string {
  const prefix = `${folder}/`;
  return folder && path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

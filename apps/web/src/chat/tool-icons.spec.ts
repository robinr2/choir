import {
  FilePenIcon,
  FileSearchIcon,
  GlobeIcon,
  ListChecksIcon,
  ShieldQuestionIcon,
  TerminalIcon,
  Trash2Icon,
} from 'lucide-react';
import { expect, test } from 'vitest';
import { toolIconOf } from './tool-icons';

test('picks an icon for each kind of tool', () => {
  expect(
    [
      'edit',
      'delete',
      'move',
      'read',
      'search',
      'execute',
      'fetch',
      'switch_mode',
      'think',
    ].map(toolIconOf),
  ).toEqual([
    FilePenIcon,
    Trash2Icon,
    FilePenIcon,
    FileSearchIcon,
    FileSearchIcon,
    TerminalIcon,
    GlobeIcon,
    ListChecksIcon,
    ShieldQuestionIcon,
  ]);
});

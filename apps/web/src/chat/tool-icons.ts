import {
  FilePenIcon,
  FileSearchIcon,
  GlobeIcon,
  ListChecksIcon,
  type LucideIcon,
  ShieldQuestionIcon,
  TerminalIcon,
  Trash2Icon,
} from 'lucide-react';

const ICONS: Readonly<Record<string, LucideIcon>> = {
  edit: FilePenIcon,
  delete: Trash2Icon,
  move: FilePenIcon,
  read: FileSearchIcon,
  search: FileSearchIcon,
  execute: TerminalIcon,
  fetch: GlobeIcon,
  switch_mode: ListChecksIcon,
};

export function toolIconOf(kind: string): LucideIcon {
  return ICONS[kind] ?? ShieldQuestionIcon;
}

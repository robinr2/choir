import { AUTO } from '../layout/column.js';
import type { Column, Layout, Space } from '../layout/layout.schemas.js';

function columnOf(text: string): Column {
  const names = text.trim().split(/\s+/);
  const marked = names.findIndex((name) => /[*^]$/.test(name));
  return {
    id: `column ${text.replaceAll(/[*^]/g, '').trim()}`,
    width: 0.5,
    fullWidth: false,
    activeTile: Math.max(marked, 0),
    tiles: names.map((name) => ({
      paneId: name.replace(/[*^]$/, ''),
      height: AUTO,
    })),
  };
}

export function space(text: string, restoresPrevious = false): Space {
  const parts = text.trim() === '' ? [] : text.split('|');
  return {
    id: `workspace ${text}`,
    columns: parts.map(columnOf),
    activeColumn: Math.max(
      parts.findIndex((part) => part.includes('*')),
      0,
    ),
    restoresPrevious,
  };
}

function tileText(column: Column, index: number, focused: boolean): string {
  const name = column.tiles[index].paneId;
  if (index !== column.activeTile) return name;
  if (focused) return `${name}*`;
  return index === 0 ? name : `${name}^`;
}

export function sketch({ columns, activeColumn }: Space): string {
  return columns
    .map((column, index) =>
      column.tiles
        .map((_, tile) => tileText(column, tile, index === activeColumn))
        .join(' '),
    )
    .join(' | ');
}

export function layout(texts: string[], activeWorkspace = 0): Layout {
  return { workspaces: texts.map((text) => space(text)), activeWorkspace };
}

export function sketches({ workspaces, activeWorkspace }: Layout): string[] {
  return workspaces.map((workspace, index) =>
    index === activeWorkspace ? `> ${sketch(workspace)}` : sketch(workspace),
  );
}

export function after(change: (strip: Space) => Space, text: string): string {
  return sketch(change(space(text)));
}

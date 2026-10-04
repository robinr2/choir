import { z } from 'zod';

export type Height = { auto: number } | { fixed: number };

export type Tile = { paneId: string; height: Height };

export type Column = {
  id: string;
  width: number;
  fullWidth: boolean;
  activeTile: number;
  tiles: Tile[];
};

export type ColumnSize = { width: number; fullWidth: boolean };

export type Space = {
  id: string;
  columns: Column[];
  activeColumn: number;
  restoresPrevious: boolean;
};

export type Layout = { workspaces: Space[]; activeWorkspace: number };

export const paneIdSchema = z.uuid();

export const agentNameSchema = z.string().trim().min(1).max(40);

export const openableKindSchema = z.enum(['agent', 'excalidraw']);

export type OpenableKind = z.infer<typeof openableKindSchema>;

export type PaneContent =
  { kind: 'empty' } | { kind: 'agent'; name: string } | { kind: 'excalidraw' };

export type WorkspaceState = {
  layout: Layout;
  panes: Record<string, PaneContent>;
  nextNumber: number;
};

export type Agent = { id: string; name: string };

export type Pane = { id: string } & PaneContent;

export type NewPane = { kind: 'empty' } | { kind: 'agent'; name?: string };

const index = z.int().nonnegative();

const proportion = z.number().nonnegative().max(10_000);

const SPACE_ACTIONS = [
  'focusColumnLeft',
  'focusColumnRight',
  'focusWindowUp',
  'focusWindowDown',
  'moveColumnLeft',
  'moveColumnRight',
  'moveWindowUp',
  'moveWindowDown',
  'consumeOrExpelWindowLeft',
  'consumeOrExpelWindowRight',
  'consumeWindowIntoColumn',
  'expelWindowFromColumn',
  'resetWindowHeight',
  'maximizeColumn',
] as const;

const WORKSPACE_ACTIONS = [
  'focusWorkspaceUp',
  'focusWorkspaceDown',
  'moveWindowToWorkspaceUp',
  'moveWindowToWorkspaceDown',
  'moveColumnToWorkspaceUp',
  'moveColumnToWorkspaceDown',
  'moveWorkspaceUp',
  'moveWorkspaceDown',
] as const;

export type SpaceActionName = (typeof SPACE_ACTIONS)[number];

export type WorkspaceActionName = (typeof WORKSPACE_ACTIONS)[number];

export const layoutActionSchema = z.union([
  z.object({ action: z.enum(SPACE_ACTIONS) }),
  z.object({ action: z.enum(WORKSPACE_ACTIONS) }),
  z.object({
    action: z.enum(['setColumnWidth', 'setWindowHeight']),
    change: z.number().min(-10_000).max(10_000),
  }),
  z.object({
    action: z.literal('expandColumnToAvailableWidth'),
    visibleColumns: z.array(z.uuid()),
  }),
  z.object({ action: z.literal('focusPane'), paneId: paneIdSchema }),
  z.object({ action: z.literal('focusColumn'), columnId: z.uuid() }),
  z.object({ action: z.literal('focusWorkspace'), workspaceId: z.uuid() }),
  z.object({
    action: z.literal('movePane'),
    paneId: paneIdSchema,
    column: index,
    tile: index.optional(),
  }),
  z.object({
    action: z.literal('resizePane'),
    paneId: paneIdSchema,
    width: proportion.optional(),
    height: z.number().min(0).max(1).optional(),
  }),
]);

export type LayoutAction = z.infer<typeof layoutActionSchema>;

export type SpaceAction = Extract<
  LayoutAction,
  | { action: SpaceActionName }
  | { change: number }
  | { visibleColumns: string[] }
>;

export type WorkspaceAction = Exclude<LayoutAction, SpaceAction>;

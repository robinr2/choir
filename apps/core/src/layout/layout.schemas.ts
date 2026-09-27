import { z } from 'zod';
import type { LayoutNode } from './layout-tree.js';

export const paneIdSchema = z.uuid();

export const agentNameSchema = z.string().trim().min(1).max(40);

const splitSchema = z.object({
  type: z.literal('split'),
  direction: z.enum(['row', 'column']),
  get children() {
    return z.array(layoutNodeSchema);
  },
  splitPercentages: z.array(z.number().positive()),
});

function splitsEvenly({
  children,
  splitPercentages,
}: z.infer<typeof splitSchema>): boolean {
  const total = splitPercentages.reduce((sum, p) => sum + p, 0);
  return (
    children.length >= 2 &&
    children.length === splitPercentages.length &&
    Math.round(total) === 100
  );
}

const layoutNodeSchema: z.ZodType<LayoutNode> = z.union([
  paneIdSchema,
  splitSchema.refine(
    splitsEvenly,
    'A split needs two or more panes and one percentage per pane, adding up to 100',
  ),
]);

export const layoutSchema = layoutNodeSchema.nullable();

export const openableKindSchema = z.enum(['agent', 'excalidraw']);

export type OpenableKind = z.infer<typeof openableKindSchema>;

const paneContentSchema = z.union([
  z.object({ kind: z.literal('empty') }),
  z.object({ kind: z.literal('agent'), name: agentNameSchema }),
  z.object({ kind: z.literal('excalidraw') }),
]);

export type PaneContent = z.infer<typeof paneContentSchema>;

const nextNumberSchema = z.number().int().positive();

const currentStateSchema = z.object({
  layout: layoutSchema,
  panes: z.record(paneIdSchema, paneContentSchema),
  nextNumber: nextNumberSchema,
});

const agentsOnlyStateSchema = z
  .object({
    layout: layoutSchema,
    agents: z.record(paneIdSchema, z.object({ name: agentNameSchema })),
    nextNumber: nextNumberSchema,
  })
  .transform(({ layout, agents, nextNumber }) => ({
    layout,
    panes: Object.fromEntries(
      Object.entries(agents).map(([id, { name }]) => [
        id,
        { kind: 'agent' as const, name },
      ]),
    ),
    nextNumber,
  }));

export const workspaceStateSchema = z.union([
  currentStateSchema,
  agentsOnlyStateSchema,
]);

export type WorkspaceState = z.infer<typeof currentStateSchema>;

export const edgeSchema = z.enum(['left', 'right', 'top', 'bottom']);

export const splitKindSchema = z.enum(['vertical', 'horizontal']);

export type SplitKind = z.infer<typeof splitKindSchema>;

export type Agent = { id: string; name: string };

export type Pane = { id: string } & PaneContent;

export type NewPane = { kind: 'empty' } | { kind: 'agent'; name?: string };

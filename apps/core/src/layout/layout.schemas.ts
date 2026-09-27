import { z } from 'zod';
import type { LayoutNode } from './layout-tree.js';

export const agentIdSchema = z.uuid();

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
  agentIdSchema,
  splitSchema.refine(
    splitsEvenly,
    'A split needs two or more panes and one percentage per pane, adding up to 100',
  ),
]);

export const layoutSchema = layoutNodeSchema.nullable();

const agentSchema = z.object({ name: agentNameSchema });

export const workspaceStateSchema = z.object({
  layout: layoutSchema,
  agents: z.record(agentIdSchema, agentSchema),
  nextNumber: z.number().int().positive(),
});

export type WorkspaceState = z.infer<typeof workspaceStateSchema>;

export const edgeSchema = z.enum(['left', 'right', 'top', 'bottom']);

export const splitKindSchema = z.enum(['vertical', 'horizontal']);

export type SplitKind = z.infer<typeof splitKindSchema>;

export type Agent = { id: string; name: string };

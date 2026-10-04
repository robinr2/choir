import type { PromptResponse } from '@agentclientprotocol/sdk';
import { z } from 'zod';

const tokenCountSchema = z.object({
  inputTokens: z.number(),
  cachedInputTokens: z.number(),
  cachedWriteTokens: z.number(),
  outputTokens: z.number(),
});

const resultSchema = z
  .object({
    _meta: z.object({ quota: z.object({ token_count: tokenCountSchema }) }),
  })
  .transform(({ _meta: meta }) => meta.quota.token_count);

export type TurnUsage = z.infer<typeof tokenCountSchema>;

export function turnUsage(
  result: PromptResponse | undefined,
): TurnUsage | undefined {
  return resultSchema.safeParse(result).data;
}

export function describeUsage(usage: TurnUsage | undefined): string {
  if (!usage) return 'no token usage reported';
  return `cache read ${usage.cachedInputTokens}, cache write ${usage.cachedWriteTokens}, input ${usage.inputTokens}, output ${usage.outputTokens}`;
}

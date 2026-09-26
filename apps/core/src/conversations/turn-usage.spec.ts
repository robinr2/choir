import { describeUsage, turnUsage } from './turn-usage.js';

const tokenCount = {
  inputTokens: 2,
  cachedInputTokens: 12151,
  cachedWriteTokens: 38,
  outputTokens: 6,
  totalTokens: 12197,
};

describe('turnUsage', () => {
  it('reads the token count a turn reports', () => {
    expect(
      turnUsage({
        status: 'completed',
        _meta: { quota: { token_count: tokenCount } },
      }),
    ).toEqual({
      inputTokens: 2,
      cachedInputTokens: 12151,
      cachedWriteTokens: 38,
      outputTokens: 6,
    });
  });

  it('reads nothing from a turn without a token count', () => {
    expect(turnUsage({ status: 'cancelled' })).toBeUndefined();
    expect(
      turnUsage({ status: 'failed', error: { message: 'agent exited' } }),
    ).toBeUndefined();
  });
});

describe('describeUsage', () => {
  it('describes the cached and uncached tokens', () => {
    expect(
      describeUsage(
        turnUsage({
          status: 'completed',
          _meta: { quota: { token_count: tokenCount } },
        }),
      ),
    ).toBe('cache read 12151, cache write 38, input 2, output 6');
  });

  it('says when no usage was reported', () => {
    expect(describeUsage(undefined)).toBe('no token usage reported');
  });
});

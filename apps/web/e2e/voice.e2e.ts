import { expect, test, type Page } from '@playwright/test';

declare global {
  interface Window {
    peerConnections: RTCPeerConnection[];
  }
}

const SENTENCE = /quick brown fox jumps over the lazy dog/i;

function recordPeerConnections(): void {
  const Native = window.RTCPeerConnection;
  window.peerConnections = [];
  window.RTCPeerConnection = class extends Native {
    constructor(configuration?: RTCConfiguration) {
      super(configuration);
      window.peerConnections.push(this);
    }
  };
}

function receivedAudioEnergy(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const reports = await Promise.all(
      window.peerConnections.map((connection) => connection.getStats()),
    );
    return reports
      .flatMap((report) => Array.from(report.values()))
      .filter((stat) => stat.type === 'inbound-rtp' && stat.kind === 'audio')
      .reduce((energy, stat) => energy + (stat.totalAudioEnergy ?? 0), 0);
  });
}

test('answers a spoken sentence with Claude Code, out loud and with a tool call', async ({
  page,
}) => {
  await page.addInitScript(recordPeerConnections);
  await page.goto('/');

  await page.getByRole('button', { name: 'Voice' }).click();

  const asked = page
    .locator('[data-slot="aui_user-message-root"]')
    .filter({ hasText: SENTENCE })
    .first();
  await expect(asked).toBeVisible({ timeout: 90_000 });
  const answer = page.locator('[data-slot="aui_assistant-message-root"]').last();
  await expect(answer.getByRole('button', { name: /tool call/ })).toBeVisible({
    timeout: 120_000,
  });
  await expect(answer).toContainText(/words/i, { timeout: 120_000 });
  await expect
    .poll(() => receivedAudioEnergy(page), { timeout: 60_000 })
    .toBeGreaterThan(0.01);
  await expect(page.locator('audio')).toHaveJSProperty('paused', false);
});

import { expect, test, type Locator, type Page } from '@playwright/test';

declare global {
  interface Window {
    peerConnections: RTCPeerConnection[];
  }
}

const REQUEST = /new agent/i;
const HELLO = /hello/i;

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

function agentMessages(pane: Locator): Locator {
  return pane.locator('[data-slot="agent-message-root"]');
}

async function askForANewAgentByVoice(page: Page): Promise<Locator> {
  await page.goto('/');
  const first = page.getByRole('region', { name: 'agent 1' });
  await first.getByRole('button', { name: 'Voice' }).click();
  await expect(
    first
      .locator('[data-slot="aui_spoken-message-root"][data-role="user"]')
      .filter({ hasText: REQUEST })
      .first(),
  ).toBeVisible({ timeout: 90_000 });
  await first.getByRole('button', { name: /mute microphone/i }).click();
  return first;
}

async function newAgentPane(page: Page): Promise<[Locator, string]> {
  await expect(page.locator('section[data-voice]')).toHaveCount(2, {
    timeout: 120_000,
  });
  const pane = page.locator('section[data-voice="false"]');
  return [pane, (await pane.getAttribute('aria-label')) ?? ''];
}

test('starts a new agent by voice and hears back from it by name', async ({
  page,
}) => {
  await page.addInitScript(recordPeerConnections);
  const first = await askForANewAgentByVoice(page);
  const [second, name] = await newAgentPane(page);
  await expect(agentMessages(second).first()).toContainText('agent 1', {
    timeout: 120_000,
  });
  await expect(
    agentMessages(first).filter({ hasText: name }).first(),
  ).toContainText(HELLO, { timeout: 180_000 });
  await expect
    .poll(() => receivedAudioEnergy(page), { timeout: 60_000 })
    .toBeGreaterThan(0.01);
});

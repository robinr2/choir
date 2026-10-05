import { expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { CATALOG } from '@/test/fake-agents';
import { AgentSettings } from './agent-settings';

const RENAMED_MODES = [
  { value: 'default', name: 'Ask first', description: null },
  { value: 'plan', name: 'Planning', description: null },
];

const NOTHING_CHOSEN = { model: null, effort: null, mode: 'plan' };

test('leaves the model and effort open when none is chosen', async () => {
  const screen = await render(
    <AgentSettings
      models={CATALOG.models}
      modes={CATALOG.modes}
      chosen={NOTHING_CHOSEN}
      onModel={vi.fn<(model: string) => void>()}
      onEffort={vi.fn<(effort: string) => void>()}
      onMode={vi.fn<(mode: string) => void>()}
    />,
  );
  await expect
    .element(screen.getByRole('combobox', { name: 'Model', exact: true }))
    .toHaveTextContent('Default (Opus)');
  await expect
    .element(screen.getByRole('combobox', { name: 'Mode', exact: true }))
    .toHaveTextContent('Plan');
});

test('follows the modes and the handler it was last given', async () => {
  const first = vi.fn<(mode: string) => void>();
  const last = vi.fn<(mode: string) => void>();
  const props = {
    models: CATALOG.models,
    chosen: NOTHING_CHOSEN,
    onModel: vi.fn<(model: string) => void>(),
    onEffort: vi.fn<(effort: string) => void>(),
  };
  const screen = await render(
    <AgentSettings {...props} modes={CATALOG.modes} onMode={first} />,
  );
  await screen.rerender(
    <AgentSettings {...props} modes={RENAMED_MODES} onMode={last} />,
  );
  const mode = screen.getByRole('combobox', { name: 'Mode', exact: true });
  await expect.element(mode).toHaveTextContent('Planning');
  await mode.click();
  await page.getByRole('option', { name: 'Ask first' }).click();
  expect(first).not.toHaveBeenCalled();
  expect(last).toHaveBeenCalledExactlyOnceWith('default');
});

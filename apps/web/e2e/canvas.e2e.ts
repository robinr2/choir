import { expect, test, type Locator, type Page } from '@playwright/test';

const MAGENTA = '#ff00ff';

const MAGENTA_PIXEL = 0xffff00ff;

const DRAW = `Use the create_element tool of the excalidraw MCP server to draw one rectangle at x 100, y 100 with width 300, height 200, backgroundColor ${MAGENTA}, strokeColor ${MAGENTA} and fillStyle solid. Do nothing else.`;

async function openInNewPane(page: Page, kind: string): Promise<void> {
  const opened = await page.request.post('/workspace/panes');
  expect(opened.ok()).toBe(true);
  const empty = page.getByRole('region', { name: 'New pane' });
  await empty.getByRole('button', { name: kind }).click();
  await expect(empty).toHaveCount(0);
}

async function openCanvasAndAgent(page: Page) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await openInNewPane(page, 'Excalidraw');
  const canvasPane = page.getByRole('region', { name: 'Excalidraw' });
  await openInNewPane(page, 'Agent');
  const scene = canvasPane
    .frameLocator('iframe[title="Excalidraw canvas"]')
    .locator('canvas.excalidraw__canvas.static');
  await expect(scene).toBeVisible({ timeout: 30_000 });
  const drawer = page.locator('section[data-kind="agent"]').last();
  return { canvasPane, drawer, scene };
}

function magentaPixels(scene: Locator): Promise<number> {
  return scene.evaluate((element: HTMLCanvasElement, pixel: number) => {
    const { width, height } = element;
    const image = element.getContext('2d')?.getImageData(0, 0, width, height);
    const pixels = new Uint32Array(image?.data.buffer ?? new ArrayBuffer(0));
    return pixels.filter((value) => value === pixel).length;
  }, MAGENTA_PIXEL);
}

async function ask(agent: Locator, text: string): Promise<void> {
  await agent.getByRole('textbox').fill(text);
  await agent.getByRole('textbox').press('Enter');
}

test('draws the shape an agent creates through the Excalidraw MCP server in the canvas pane', async ({
  page,
}) => {
  const { canvasPane, drawer, scene } = await openCanvasAndAgent(page);
  expect(await magentaPixels(scene)).toBe(0);
  await ask(drawer, DRAW);
  await expect
    .poll(() => magentaPixels(scene), { timeout: 180_000 })
    .toBeGreaterThan(1000);
  await drawer.getByRole('button', { name: 'Close' }).click();
  await canvasPane.getByRole('button', { name: 'Close' }).click();
});

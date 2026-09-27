import { expect, test, type Locator, type Page } from '@playwright/test';

const MAGENTA = '#ff00ff';

const DRAW = `Use the create_element tool of the excalidraw MCP server to draw one rectangle at x 100, y 100 with width 300, height 200, backgroundColor ${MAGENTA}, strokeColor ${MAGENTA} and fillStyle solid. Do nothing else.`;

async function openInNewPane(
  page: Page,
  from: Locator,
  kind: string,
): Promise<void> {
  await from.getByRole('button', { name: 'Split vertically' }).click();
  const empty = page.getByRole('region', { name: 'New pane' });
  await empty.getByRole('button', { name: kind }).click();
  await expect(empty).toHaveCount(0);
}

function magentaPixels(canvas: Locator): Promise<number> {
  return canvas.evaluate((element: HTMLCanvasElement) => {
    const context = element.getContext('2d');
    if (!context) return 0;
    const { data } = context.getImageData(0, 0, element.width, element.height);
    let count = 0;
    for (let index = 0; index < data.length; index += 4) {
      const [red, green, blue] = data.subarray(index, index + 3);
      if (red > 240 && green < 20 && blue > 240) count += 1;
    }
    return count;
  });
}

test('draws the shape an agent creates through the Excalidraw MCP server in the canvas pane', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  const first = page.locator('section[data-kind]').first();
  await openInNewPane(page, first, 'Excalidraw');
  const canvasPane = page.getByRole('region', { name: 'Excalidraw' });
  await openInNewPane(page, canvasPane, 'Agent');
  const drawer = page.locator('section[data-kind="agent"]').last();
  const scene = canvasPane
    .frameLocator('iframe[title="Excalidraw canvas"]')
    .locator('canvas.excalidraw__canvas.static');
  await expect(scene).toBeVisible({ timeout: 30_000 });
  expect(await magentaPixels(scene)).toBe(0);
  await drawer.getByRole('textbox').fill(DRAW);
  await drawer.getByRole('textbox').press('Enter');
  await expect
    .poll(() => magentaPixels(scene), { timeout: 180_000 })
    .toBeGreaterThan(1000);
  await drawer.getByRole('button', { name: 'Close' }).click();
  await canvasPane.getByRole('button', { name: 'Close' }).click();
});

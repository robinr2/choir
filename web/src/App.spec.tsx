import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import App from './App';

async function send(
  screen: Awaited<ReturnType<typeof render>>,
  text: string,
): Promise<void> {
  await screen.getByRole('textbox').fill(text);
  await screen.getByRole('button', { name: 'Send message' }).click();
}

test('echoes a sent message back as the reply', async () => {
  const screen = await render(<App />);
  await send(screen, 'hello choir');
  await expect.element(screen.getByText('hello choir').nth(1)).toBeVisible();
});

test('echoes only the latest message', async () => {
  const screen = await render(<App />);
  await send(screen, 'first');
  await expect.element(screen.getByText('first').nth(1)).toBeVisible();
  await send(screen, 'second');
  await expect.element(screen.getByText('second').nth(1)).toBeVisible();
  await expect
    .element(screen.getByText('first').nth(2))
    .not.toBeInTheDocument();
});

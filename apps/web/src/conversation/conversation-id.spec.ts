import { expect, test, vi } from 'vitest';
import { conversationIdOf } from './conversation-id';

const ID = '0b6f2c9e-3f5d-4a8e-9c1b-2d7e6f5a4b3c';

test('reopens the conversation named in the address', () => {
  const history = { replaceState: vi.fn<History['replaceState']>() };
  expect(conversationIdOf({ search: `?conversation=${ID}` }, history)).toBe(ID);
  expect(history.replaceState).not.toHaveBeenCalled();
});

test('starts a new conversation and keeps it in the address', () => {
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(ID);
  const history = { replaceState: vi.fn<History['replaceState']>() };
  expect(conversationIdOf({ search: '?voice=on' }, history)).toBe(ID);
  expect(history.replaceState).toHaveBeenCalledExactlyOnceWith(
    null,
    '',
    `?voice=on&conversation=${ID}`,
  );
});

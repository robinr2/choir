import { callerOf } from './choir-server.js';

it('takes the calling agent from the request header', () => {
  const request = new Request('http://core/mcp', {
    headers: { 'X-Choir-Agent': 'a1' },
  });
  expect(callerOf(request)).toBe('a1');
  expect(callerOf(new Request('http://core/mcp'))).toBe('');
  expect(callerOf(undefined)).toBe('');
});

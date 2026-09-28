import { containing, preview } from './listing.js';

describe('preview', () => {
  it('keeps a text of ten words or fewer whole, on one line', () => {
    expect(preview('')).toBe('');
    expect(preview('  one\n two\tthree  ')).toBe('one two three');
    expect(preview('1 2 3 4 5 6 7 8 9 10')).toBe('1 2 3 4 5 6 7 8 9 10');
  });

  it('cuts a longer text after ten words', () => {
    expect(preview('1 2 3 4 5 6 7 8 9 10 11')).toBe('1 2 3 4 5 6 7 8 9 10 …');
  });
});

it('searches for the text as it is typed', () => {
  expect(containing('login')).toBe('%login%');
  expect(containing('50%_off\\now')).toBe('%50\\%\\_off\\\\now%');
});

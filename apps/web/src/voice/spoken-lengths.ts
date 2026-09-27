type Word = { key: string; end: number };

type PartWord = Word & { part: number };

const WORD = /\S+/g;
const LOOKAHEAD = 8;

function keyOf(word: string): string {
  return word.replaceAll(/[^\p{L}\p{N}]/gu, '');
}

function wordsIn(text: string): Word[] {
  return [...text.matchAll(WORD)]
    .map((match) => ({
      key: keyOf(match[0]),
      end: match.index + match[0].length,
    }))
    .filter(({ key }) => key !== '');
}

function lastSpoken(words: readonly PartWord[], spoken: readonly Word[]) {
  const collator = new Intl.Collator(undefined, { sensitivity: 'base' });
  let next = 0;
  for (const { key } of spoken) {
    const found = words
      .slice(next, next + LOOKAHEAD)
      .findIndex((word) => collator.compare(word.key, key) === 0);
    next += found + 1;
  }
  return words[next - 1];
}

export function spokenLengths(
  texts: readonly string[],
  spoken: string,
): number[] {
  const words = texts.flatMap((text, part) =>
    wordsIn(text).map(({ key, end }) => ({ key, end, part })),
  );
  const reached = lastSpoken(words, wordsIn(spoken));
  return texts.map((text, part) => {
    if (!reached || part > reached.part) return 0;
    return part < reached.part ? text.length : reached.end;
  });
}

export class SpaceGaps {
  #gaps: number[] = [];

  get open(): boolean {
    return this.#gaps.length > 0;
  }

  shown(index: number): number {
    return this.#gaps.reduce(
      (shown, gap) => (gap <= shown ? shown + 1 : shown),
      index,
    );
  }

  add(at: number): void {
    this.#gaps = [...this.#gaps, at].toSorted((a, b) => a - b);
  }

  collapse(): (shown: number) => number {
    const gaps = this.#gaps;
    this.#gaps = [];
    return (shown) => shown - gaps.filter((gap) => gap < shown).length;
  }
}

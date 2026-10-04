const HISTORY_LIMIT = 150;

const DECELERATION = 0.997;

type Event = { delta: number; timestamp: number };

export class SwipeTracker {
  #history: Event[] = [];
  #pos = 0;

  get pos(): number {
    return this.#pos;
  }

  push(delta: number, timestamp: number): void {
    const last = this.#history.at(-1);
    if (last && timestamp < last.timestamp) return;
    this.#history = [...this.#history, { delta, timestamp }].filter(
      (event) => timestamp <= event.timestamp + HISTORY_LIMIT,
    );
    this.#pos += delta;
  }

  velocity(): number {
    const first = this.#history[0];
    const last = this.#history.at(-1);
    if (!first || !last) return 0;
    const seconds = (last.timestamp - first.timestamp) / 1000;
    if (seconds === 0) return 0;
    const total = this.#history.reduce((sum, { delta }) => sum + delta, 0);
    return total / seconds;
  }

  projectedEndPos(): number {
    return this.#pos - this.velocity() / (1000 * Math.log(DECELERATION));
  }
}

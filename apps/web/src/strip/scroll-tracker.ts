export class ScrollTracker {
  readonly #tick: number;
  #last = 0;
  #sum = 0;

  constructor(tick: number) {
    this.#tick = tick;
  }

  accumulate(amount: number): number {
    if (Math.sign(this.#last) === -Math.sign(amount)) this.#sum = 0;
    this.#last = amount;
    this.#sum += amount;
    const ticks = Math.trunc(this.#sum / this.#tick);
    this.#sum -= ticks * this.#tick;
    return ticks;
  }
}

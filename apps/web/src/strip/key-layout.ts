export type LayoutMap = ReadonlyMap<string, string>;

const US_NAMES: LayoutMap = new Map();

export class KeyLayout {
  readonly #navigator: Navigator;
  readonly #listeners = new Set<() => void>();
  #map = US_NAMES;

  constructor(navigator: Navigator) {
    this.#navigator = navigator;
  }

  readonly getSnapshot = (): LayoutMap => this.#map;

  readonly subscribe = (changed: () => void): (() => void) => {
    this.#listeners.add(changed);
    return () => this.#listeners.delete(changed);
  };

  async load(): Promise<void> {
    const keyboard = this.#navigator.keyboard;
    if (!keyboard) return;
    const map = await keyboard.getLayoutMap().catch(() => {});
    if (!map) return;
    this.#map = map;
    this.#listeners.forEach((changed) => changed());
  }
}

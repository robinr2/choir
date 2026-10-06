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
    this.#load();
    return () => this.#listeners.delete(changed);
  };

  #load(): void {
    void this.#navigator.keyboard?.getLayoutMap().then(
      (map) => this.#show(map),
      () => {},
    );
  }

  #show(map: LayoutMap): void {
    this.#map = map;
    this.#listeners.forEach((changed) => changed());
  }
}

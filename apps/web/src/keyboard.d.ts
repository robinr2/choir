interface KeyboardLayoutMap extends ReadonlyMap<string, string> {}

interface Keyboard {
  getLayoutMap(): Promise<KeyboardLayoutMap>;
}

interface Navigator {
  readonly keyboard?: Keyboard;
}

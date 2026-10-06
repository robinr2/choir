export const HOLD_DELAY = 500;

const OTHER_MODIFIERS = ['ctrlKey', 'shiftKey', 'metaKey'] as const;

function aloneAlt(event: KeyboardEvent): boolean {
  return (
    event.key === 'Alt' && !OTHER_MODIFIERS.some((modifier) => event[modifier])
  );
}

export class AltHold {
  readonly #target: Window;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #shown = false;

  constructor(target: Window) {
    this.#target = target;
  }

  readonly getSnapshot = (): boolean => this.#shown;

  readonly subscribe = (changed: () => void): (() => void) => {
    const target = this.#target;
    const controller = new AbortController();
    const { signal } = controller;
    const capture = { capture: true, signal };
    const dismiss = () => this.#dismiss(changed);
    target.addEventListener(
      'keydown',
      (event) => this.#keydown(event, changed),
      capture,
    );
    for (const type of ['keyup', 'pointerdown', 'wheel', 'blur']) {
      target.addEventListener(type, dismiss, capture);
    }
    return () => {
      controller.abort();
      this.#dismiss(changed);
    };
  };

  #keydown(event: KeyboardEvent, changed: () => void): void {
    if (event.repeat && aloneAlt(event)) return;
    this.#dismiss(changed);
    if (aloneAlt(event)) {
      this.#timer = setTimeout(() => this.#set(true, changed), HOLD_DELAY);
    }
  }

  #dismiss(changed: () => void): void {
    clearTimeout(this.#timer);
    this.#set(false, changed);
  }

  #set(shown: boolean, changed: () => void): void {
    if (this.#shown === shown) return;
    this.#shown = shown;
    changed();
  }
}

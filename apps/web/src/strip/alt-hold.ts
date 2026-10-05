export const HOLD_DELAY = 500;

const OTHER_MODIFIERS = ['ctrlKey', 'shiftKey', 'metaKey'] as const;

function aloneAlt(event: KeyboardEvent): boolean {
  return (
    event.key === 'Alt' && !OTHER_MODIFIERS.some((modifier) => event[modifier])
  );
}

export class AltHold {
  readonly #report: (shown: boolean) => void;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #shown = false;

  constructor(report: (shown: boolean) => void) {
    this.#report = report;
  }

  subscribe(target: Window): () => void {
    const controller = new AbortController();
    const { signal } = controller;
    const capture = { capture: true, signal };
    const dismiss = () => this.#dismiss();
    target.addEventListener(
      'keydown',
      (event) => this.#keydown(event),
      capture,
    );
    for (const type of ['keyup', 'pointerdown', 'wheel', 'blur']) {
      target.addEventListener(type, dismiss, capture);
    }
    return () => {
      controller.abort();
      clearTimeout(this.#timer);
    };
  }

  #keydown(event: KeyboardEvent): void {
    if (event.repeat && aloneAlt(event)) return;
    this.#dismiss();
    if (aloneAlt(event)) {
      this.#timer = setTimeout(() => this.#set(true), HOLD_DELAY);
    }
  }

  #dismiss(): void {
    clearTimeout(this.#timer);
    this.#set(false);
  }

  #set(shown: boolean): void {
    if (this.#shown === shown) return;
    this.#shown = shown;
    this.#report(shown);
  }
}

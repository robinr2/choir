import { send } from '@/lib/live-store';

type Canvas = { url: string };

export class CoreCanvas {
  #url?: Promise<string>;

  url(): Promise<string> {
    this.#url ??= send('GET', '/canvas')
      .then((response) => response.json())
      .then(({ url }: Canvas) => url);
    return this.#url;
  }
}

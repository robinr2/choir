import {
  AnimatePresence,
  domAnimation,
  LazyMotion,
  MotionConfig,
} from 'motion/react';
import * as m from 'motion/react-m';
import { useEffect, useSyncExternalStore } from 'react';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { AltHold } from './alt-hold';
import { type HintGroup, type HintRow, keyHints } from './key-hints';
import { KeyLayout } from './key-layout';
import { SHEET, SHEET_HIDDEN } from './timings';

const hold = new AltHold(window);

const keyLayout = new KeyLayout(navigator);

function useKeyLayout() {
  useEffect(() => {
    void keyLayout.load();
  }, []);
  return useSyncExternalStore(keyLayout.subscribe, keyLayout.getSnapshot);
}

function useAltHeld(): boolean {
  return useSyncExternalStore(hold.subscribe, hold.getSnapshot);
}

function Keys({ modifiers, keys }: Readonly<Omit<HintRow, 'label'>>) {
  return (
    <KbdGroup className="shrink-0">
      {modifiers.map((modifier) => (
        <Kbd key={modifier}>{modifier}</Kbd>
      ))}
      {keys.map((key, index) => (
        <span key={key} className="inline-flex items-center gap-1">
          {index > 0 && <span className="text-muted-foreground">/</span>}
          <Kbd>{key}</Kbd>
        </span>
      ))}
    </KbdGroup>
  );
}

const SHOWN = { y: 0, opacity: 1 };

function Section({ name, rows }: Readonly<HintGroup>) {
  return (
    <section className="mb-3 break-inside-avoid">
      <h3 className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
        {name}
      </h3>
      {rows.map(({ label, ...keys }) => (
        <div
          key={label}
          className="flex items-center justify-between gap-3 py-0.5 text-sm"
        >
          <span className="min-w-0">{label}</span>
          <Keys {...keys} />
        </div>
      ))}
    </section>
  );
}

const MIN_ZOOM = 0.5;

function fitInto(room: number) {
  return (sheet: HTMLDivElement) => {
    sheet.style.zoom = '';
    const natural = sheet.getBoundingClientRect().height;
    sheet.style.zoom = String(Math.max(MIN_ZOOM, Math.min(1, room / natural)));
    return () => {};
  };
}

type HintProps = Readonly<{ overview: boolean; height: number }>;

function Sheet({ overview, height }: HintProps) {
  const layout = useKeyLayout();
  return (
    <m.div
      data-slot="key-hint"
      aria-hidden
      initial={SHEET_HIDDEN}
      animate={SHOWN}
      exit={SHEET_HIDDEN}
      transition={SHEET}
      className="pointer-events-none absolute inset-x-0 bottom-0 z-20"
    >
      <div
        ref={fitInto(height / 3)}
        className="bg-background/80 text-foreground overflow-hidden border-t px-4 py-3 shadow-lg backdrop-blur-md"
      >
        <div className="columns-[18rem] gap-6">
          {keyHints(overview, layout).map((group) => (
            <Section key={group.name} {...group} />
          ))}
        </div>
      </div>
    </m.div>
  );
}

export function KeyHint({ overview, height }: HintProps) {
  const held = useAltHeld();
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="never">
        <AnimatePresence>
          {held && <Sheet overview={overview} height={height} />}
        </AnimatePresence>
      </MotionConfig>
    </LazyMotion>
  );
}

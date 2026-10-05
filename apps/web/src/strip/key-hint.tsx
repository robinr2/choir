import {
  AnimatePresence,
  domAnimation,
  LazyMotion,
  MotionConfig,
} from 'motion/react';
import * as m from 'motion/react-m';
import { useCallback, useEffect, useState } from 'react';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { AltHold } from './alt-hold';
import { type HintGroup, type HintRow, keyHints } from './key-hints';
import { SHEET } from './timings';

function useAltHeld(): boolean {
  const [held, setHeld] = useState(false);
  useEffect(() => new AltHold(setHeld).subscribe(window), []);
  return held;
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

const HIDDEN = { y: '100%', opacity: 0 };

const SHOWN = { y: 0, opacity: 1 };

function Section({ name, rows }: Readonly<HintGroup>) {
  return (
    <section className="mb-3 break-inside-avoid">
      <h3 className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
        {name}
      </h3>
      {rows.map(({ label, ...keys }) => (
        <div
          key={`${label}${keys.modifiers.join()}`}
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

const ZOOM_STEP = 0.05;

function fitInto(room: number) {
  return (sheet: HTMLDivElement) => {
    let zoom = 1;
    sheet.style.zoom = '1';
    while (zoom > MIN_ZOOM && sheet.getBoundingClientRect().height > room) {
      zoom -= ZOOM_STEP;
      sheet.style.zoom = String(zoom);
    }
  };
}

type HintProps = Readonly<{ overview: boolean; height: number }>;

function Sheet({ overview, height }: HintProps) {
  const fit = useCallback(
    (sheet: HTMLDivElement) => {
      const refit = fitInto(height / 3);
      refit(sheet);
      const observer = new ResizeObserver(() => refit(sheet));
      observer.observe(sheet);
      return () => observer.disconnect();
    },
    [height],
  );
  return (
    <m.div
      ref={fit}
      data-slot="key-hint"
      aria-hidden
      initial={HIDDEN}
      animate={SHOWN}
      exit={HIDDEN}
      transition={SHEET}
      className="bg-background/80 text-foreground pointer-events-none absolute inset-x-0 bottom-0 z-20 overflow-hidden border-t px-4 py-3 shadow-lg backdrop-blur-md"
    >
      <div className="columns-[18rem] gap-6">
        {keyHints(overview).map((group) => (
          <Section key={group.name} {...group} />
        ))}
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

import { useState, useSyncExternalStore } from 'react';
import { QuotaBanner } from '@/components/assistant-ui/elements/quota-banner';
import { useRateLimits } from './rate-limits-context';
import { quotaWindows } from './quota-windows';

export function Quota() {
  const rateLimits = useRateLimits();
  const { windows } = useSyncExternalStore(
    rateLimits.subscribe,
    rateLimits.getSnapshot,
  );
  const [now] = useState(Date.now);
  const shown = quotaWindows(windows, now);
  if (shown.length === 0) return null;
  return <QuotaBanner windows={shown} />;
}

const DATE_TIME = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function dateTime(iso: string): string {
  return DATE_TIME.format(new Date(iso));
}

function padded(value: number): string {
  return String(value).padStart(2, '0');
}

export function localInput(iso: string | null): string {
  if (iso === null) return '';
  const time = new Date(iso);
  const date = `${time.getFullYear()}-${padded(time.getMonth() + 1)}-${padded(time.getDate())}`;
  return `${date}T${padded(time.getHours())}:${padded(time.getMinutes())}`;
}

export function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

const PARAMETER = 'conversation';

export function conversationIdOf(
  location: Pick<Location, 'search'>,
  history: Pick<History, 'replaceState'>,
): string {
  const parameters = new URLSearchParams(location.search);
  const existing = parameters.get(PARAMETER);
  if (existing) return existing;
  const id = crypto.randomUUID();
  parameters.set(PARAMETER, id);
  history.replaceState(null, '', `?${parameters}`);
  return id;
}

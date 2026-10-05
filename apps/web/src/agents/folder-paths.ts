export const ROOT = '/';

export function pathsTo(path: string): string[] {
  const names = path.split('/').filter(Boolean);
  return [
    ROOT,
    ...names.map((_, index) => `/${names.slice(0, index + 1).join('/')}`),
  ];
}

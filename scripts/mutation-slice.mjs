import { globSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const [app, index, total] = process.argv.slice(2);
const root = path.join(import.meta.dirname, '..', 'apps', app);
const { mutate } = JSON.parse(readFileSync(path.join(root, 'stryker.config.json'), 'utf8'));
const included = mutate.filter((glob) => !glob.startsWith('!'));
const excluded = mutate.filter((glob) => glob.startsWith('!')).map((glob) => glob.slice(1));

const files = globSync(included, { cwd: root })
  .filter((file) => !excluded.some((glob) => path.matchesGlob(file, glob)))
  .map((file) => ({ file, size: statSync(path.join(root, file)).size }))
  .sort((first, second) => second.size - first.size || first.file.localeCompare(second.file));

const slices = Array.from({ length: Number(total) }, () => ({ size: 0, files: [] }));
for (const { file, size } of files) {
  const lightest = slices.reduce((first, second) => (second.size < first.size ? second : first));
  lightest.files.push(file);
  lightest.size += size;
}

const slice = slices[Number(index)];
if (!slice?.files.length) {
  console.error(`No files to mutate in slice ${index} of ${total} for ${app}`);
  process.exit(1);
}
console.log(slice.files.join(','));

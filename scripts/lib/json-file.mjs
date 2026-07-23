import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export function writeJson(dir, fileName, data) {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, fileName);
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf8');
  return path;
}

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function readTable(dir, name) {
  return JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8'));
}

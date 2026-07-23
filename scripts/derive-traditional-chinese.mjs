// Derives the zh_TW (Traditional Chinese) locale from zh_CN (Simplified Chinese)
// via OpenCC character/phrase conversion. There is no dedicated Traditional
// Chinese ZTable, so zh_TW is not extracted directly like other locales;
// it is always regenerated from the already-extracted/translated zh_CN files.
//
// Usage:
//   node scripts/derive-traditional-chinese.mjs [--locales-dir <dir>]

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as OpenCC from 'opencc-js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const args = { localesDir: join(ROOT, 'src/locales') };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--locales-dir') args.localesDir = argv[++i];
  }
  return args;
}

function convertDeep(value, convert) {
  if (typeof value === 'string') return convert(value);
  if (Array.isArray(value)) return value.map((v) => convertDeep(v, convert));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = convertDeep(v, convert);
    return out;
  }
  return value;
}

function main() {
  const { localesDir } = parseArgs(process.argv.slice(2));
  const convert = OpenCC.Converter({ from: 'cn', to: 'tw' });
  const srcDir = join(localesDir, 'zh_CN');
  const destDir = join(localesDir, 'zh_TW');
  mkdirSync(destDir, { recursive: true });

  for (const fileName of ['bpsr-bp-ui.json', 'game-data.json']) {
    const src = JSON.parse(readFileSync(join(srcDir, fileName), 'utf8'));
    const converted = convertDeep(src, convert);
    writeFileSync(join(destDir, fileName), JSON.stringify(converted, null, 2) + '\n', 'utf8');
    console.log(`[derive-traditional-chinese] wrote ${fileName} to ${join(destDir, fileName)}`);
  }
}

main();

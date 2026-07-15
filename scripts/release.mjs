// Bumps the project version (package.json / Cargo.toml / tauri.conf.json),
// prepends an entry to the in-app changelog data, then commits, tags, pushes,
// and creates a GitHub Release for it.
//
// Usage:
//   node scripts/release.mjs --bump <patch|minor|major> --notes-json <path> [--dry-run]
//
// --notes-json points to a JSON file shaped as:
//   { "summary": { "ja": "...", "en": "..." },
//     "changes": { "ja": ["...", "..."], "en": ["...", "..."] } }
//
// --dry-run writes the file changes to the working tree for inspection
// (via `git diff`) but skips commit/tag/push/gh release create.

import { readFileSync, writeFileSync, existsSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const PACKAGE_JSON = join(ROOT, 'package.json');
const CARGO_TOML = join(ROOT, 'src-tauri/Cargo.toml');
const CARGO_LOCK = join(ROOT, 'src-tauri/Cargo.lock'); // gitignored; local convenience only
const TAURI_CONF = join(ROOT, 'src-tauri/tauri.conf.json');
const CHANGELOG_JSON = join(ROOT, 'src/about/changelog.json');
const CARGO_CRATE_NAME = 'bpsr-build-planner';

const TARGET_FILES_FOR_GIT = [
  'package.json',
  'src-tauri/Cargo.toml',
  'src-tauri/tauri.conf.json',
  'src/about/changelog.json',
];

function parseArgs(argv) {
  const args = { bump: undefined, notesJson: undefined, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--bump') args.bump = argv[++i];
    else if (a === '--notes-json') args.notesJson = argv[++i];
    else if (a === '--dry-run') args.dryRun = true;
    else throw new Error(`unknown argument: ${a}`);
  }
  if (!['patch', 'minor', 'major'].includes(args.bump)) {
    throw new Error('--bump must be one of: patch, minor, major');
  }
  if (!args.notesJson) {
    throw new Error('--notes-json <path> is required');
  }
  return args;
}

function run(cmd, cmdArgs, opts = {}) {
  const result = spawnSync(cmd, cmdArgs, { cwd: ROOT, encoding: 'utf-8', ...opts });
  if (result.error) throw result.error;
  return result;
}

function runOrThrow(cmd, cmdArgs, opts = {}) {
  const result = run(cmd, cmdArgs, opts);
  if (result.status !== 0) {
    throw new Error(
      `${cmd} ${cmdArgs.join(' ')} failed (exit ${result.status}):\n${result.stderr || result.stdout}`,
    );
  }
  return result.stdout.trim();
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function writeJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}

function bumpVersion(current, kind) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(current);
  if (!m) throw new Error(`invalid version in package.json: ${current}`);
  let [major, minor, patch] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (kind === 'major') {
    major++;
    minor = 0;
    patch = 0;
  } else if (kind === 'minor') {
    minor++;
    patch = 0;
  } else {
    patch++;
  }
  return `${major}.${minor}.${patch}`;
}

// Replaces the `version = "..."` line inside the [package] section only, so
// dependency version specifiers elsewhere in the file are never touched.
function patchCargoTomlVersion(text, newVersion) {
  const lines = text.split('\n');
  let inPackage = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\[package\]\s*$/.test(line)) {
      inPackage = true;
      continue;
    }
    if (inPackage && /^\[.+\]\s*$/.test(line)) break;
    if (inPackage && /^version\s*=\s*"/.test(line)) {
      lines[i] = line.replace(/"[^"]*"/, `"${newVersion}"`);
      return lines.join('\n');
    }
  }
  throw new Error('version line not found in [package] section of Cargo.toml');
}

// Best-effort local Cargo.lock update (this file is gitignored; it exists so
// a subsequent local `cargo build` doesn't immediately see a stale lockfile).
function patchCargoLockVersion(text, crateName, newVersion) {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === `name = "${crateName}"` && /^version\s*=\s*"/.test(lines[i + 1] ?? '')) {
      lines[i + 1] = lines[i + 1].replace(/"[^"]*"/, `"${newVersion}"`);
      return lines.join('\n');
    }
  }
  return null;
}

function validateNotes(notes) {
  const ok =
    notes &&
    typeof notes.summary?.ja === 'string' &&
    typeof notes.summary?.en === 'string' &&
    Array.isArray(notes.changes?.ja) &&
    Array.isArray(notes.changes?.en);
  if (!ok) {
    throw new Error(
      'notes-json must be shaped as { summary: { ja, en }, changes: { ja: [...], en: [...] } }',
    );
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const notes = readJson(args.notesJson);
  validateNotes(notes);

  const pkg = readJson(PACKAGE_JSON);
  const currentVersion = pkg.version;
  const newVersion = bumpVersion(currentVersion, args.bump);
  const tag = `v${newVersion}`;

  // Preflight: the 4 files this script touches must have no pending changes,
  // so the diff it produces is exactly (and only) this release's change.
  const status = runOrThrow('git', ['status', '--porcelain', '--', ...TARGET_FILES_FOR_GIT]);
  if (status) {
    throw new Error(
      `working tree has pending changes in files this script manages:\n${status}\nCommit or discard them first.`,
    );
  }

  if (!args.dryRun) {
    const branch = runOrThrow('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
    if (branch !== 'main') {
      throw new Error(`must be on branch 'main' to release (currently on '${branch}')`);
    }
    const auth = run('gh', ['auth', 'status']);
    if (auth.status !== 0) {
      throw new Error(
        `gh CLI is not authenticated. Run 'gh auth login' first.\n${auth.stderr || auth.stdout}`,
      );
    }
    const remoteTag = runOrThrow('git', ['ls-remote', '--tags', 'origin', tag]);
    if (remoteTag) {
      throw new Error(`tag ${tag} already exists on origin`);
    }
  }

  console.log(`${currentVersion} -> ${newVersion} (${tag})`);

  // package.json
  pkg.version = newVersion;
  writeJson(PACKAGE_JSON, pkg);

  // tauri.conf.json
  const tauriConf = readJson(TAURI_CONF);
  tauriConf.version = newVersion;
  writeJson(TAURI_CONF, tauriConf);

  // Cargo.toml
  const cargoToml = readFileSync(CARGO_TOML, 'utf-8');
  writeFileSync(CARGO_TOML, patchCargoTomlVersion(cargoToml, newVersion));

  // Cargo.lock (best effort, not committed)
  if (existsSync(CARGO_LOCK)) {
    const cargoLock = readFileSync(CARGO_LOCK, 'utf-8');
    const patched = patchCargoLockVersion(cargoLock, CARGO_CRATE_NAME, newVersion);
    if (patched) writeFileSync(CARGO_LOCK, patched);
  }

  // changelog.json
  const changelog = readJson(CHANGELOG_JSON);
  changelog.entries.unshift({
    version: newVersion,
    date: new Date().toISOString(),
    summary: notes.summary,
    changes: notes.changes,
  });
  writeJson(CHANGELOG_JSON, changelog);

  if (args.dryRun) {
    console.log('--dry-run: files updated on disk, no commit/tag/push/release created.');
    console.log("Review with 'git diff', then re-run without --dry-run to publish,");
    console.log(`or discard with 'git checkout -- ${TARGET_FILES_FOR_GIT.join(' ')}'.`);
    return;
  }

  runOrThrow('git', ['add', ...TARGET_FILES_FOR_GIT]);
  runOrThrow('git', [
    'commit',
    '-m',
    `bump(version): update project version to ${newVersion} in package.json/Cargo.toml/tauri.conf.json`,
  ]);
  runOrThrow('git', ['tag', '-a', tag, '-m', tag]);
  runOrThrow('git', ['push', 'origin', 'main']);
  try {
    runOrThrow('git', ['push', 'origin', tag]);
  } catch (err) {
    console.error(String(err));
    console.error(`commit & push succeeded, but pushing tag ${tag} failed.`);
    console.error(`Recover with: git push origin ${tag}`);
    process.exit(1);
  }

  // GitHub Release body is Japanese-only (few non-Japanese readers use the
  // Releases page directly; the in-app dialog covers both languages).
  const notesMd = [`## ${notes.summary.ja}`, '', ...notes.changes.ja.map((n) => `- ${n}`)].join(
    '\n',
  );
  const tmpDir = mkdtempSync(join(tmpdir(), 'bpsr-release-'));
  const notesMdPath = join(tmpDir, 'notes.md');
  writeFileSync(notesMdPath, notesMd + '\n');

  try {
    const url = runOrThrow('gh', [
      'release',
      'create',
      tag,
      '--title',
      tag,
      '--notes-file',
      notesMdPath,
    ]);
    console.log(url);
  } catch (err) {
    console.error(String(err));
    console.error(`commit, tag, and push succeeded, but 'gh release create' failed.`);
    console.error(`Recover with: gh release create ${tag} --title ${tag} --notes-file <path>`);
    console.error(`(Japanese release notes were written to: ${notesMdPath})`);
    process.exit(1);
  }
}

main();

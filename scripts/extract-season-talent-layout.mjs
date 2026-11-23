// Extracts the node layout (coordinates) of the season talent trees (祈願心相晶) from AssetStudio
// "Dump" text exports of the UI prefabs `ui/prefabs/season_talent/season_talent_<season>_<templateId>`,
// and writes src/data/season-talent-layout.json.
//
// SeasonTalentTreeTable (ZTable) has no coordinates: the game places each node by the RectTransform
// of the GameObject named `season_talent_<nodeId>` inside the template's prefab.
//
// Input: a directory with two sub-directories exported from AssetStudio (Dump, one .txt per asset):
//   GameObject/     - GameObjects of the bundles that contain the season_talent prefabs
//   RectTransform/  - ALL RectTransforms of the same bundles (not filtered by container: most
//                     RectTransforms have no container set)
// File names must keep AssetStudio's "<name> #<index>.txt" numbering, because the index order is
// used to recover each RectTransform's own PathID (see resolveOwnIds).
//
// Usage:
//   node scripts/extract-season-talent-layout.mjs <dump dir> [--out <dir>]

import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeJson } from './lib/json-file.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const dumpDir = args.find((a) => !a.startsWith('--'));
const outIdx = args.indexOf('--out');
const outDir = outIdx >= 0 ? args[outIdx + 1] : join(ROOT, 'src', 'data');
if (!dumpDir) {
  console.error('Usage: node scripts/extract-season-talent-layout.mjs <dump dir> [--out <dir>]');
  process.exit(1);
}

const PATH_ID = /m_PathID = (-?\d+)/g;

function readVec2(text, field) {
  const m = text.match(
    new RegExp(field + String.raw`\s+float x = (-?[0-9.eE+-]+)\s+float y = (-?[0-9.eE+-]+)`),
  );
  return m ? [Number(m[1]), Number(m[2])] : null;
}

function loadGameObjects(dir) {
  return readdirSync(dir).map((file) => {
    const text = readFileSync(join(dir, file), 'utf8');
    return {
      name: text.match(/m_Name = "(.*)"/)?.[1] ?? null,
      // m_Component[0] is always the GameObject's own (Rect)Transform.
      transformId: [...text.matchAll(PATH_ID)].map((m) => m[1])[0],
    };
  });
}

function loadRectTransforms(dir) {
  return readdirSync(dir)
    .map((file) => {
      const text = readFileSync(join(dir, file), 'utf8');
      const [beforeFather, afterFather] = text.split('PPtr<Transform> m_Father');
      // beforeFather: m_GameObject PathID, then m_Children PathIDs.
      const children = [...beforeFather.matchAll(PATH_ID)].slice(1).map((m) => m[1]);
      return {
        index: Number(file.match(/#(\d+)/)?.[1] ?? NaN),
        father: afterFather.match(/m_PathID = (-?\d+)/)[1],
        children,
        pos: readVec2(text, 'm_AnchoredPosition'),
        size: readVec2(text, 'm_SizeDelta'),
      };
    })
    .filter((r) => Number.isFinite(r.index))
    .sort((a, b) => a.index - b.index);
}

// A RectTransform dump does not contain its own PathID. Within one serialized file, objects are
// stored (and numbered by AssetStudio) in ascending signed PathID order, so the RectTransforms of a
// bundle (a run of consecutive indices) map 1:1 onto the sorted set of PathIDs referenced as
// children/fathers inside that run. The mapping is verified by checking every parent-child link.
// A surplus of one candidate (a child that is a plain Transform, not dumped) is resolved by trying
// to drop each candidate.
function resolveOwnIds(rects) {
  const blocks = [];
  let cur = [];
  for (const r of rects) {
    if (cur.length && r.index - cur.at(-1).index > 50) {
      blocks.push(cur);
      cur = [];
    }
    cur.push(r);
  }
  if (cur.length) blocks.push(cur);

  const cmp = (a, b) => (BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0);
  const countBad = (block, ids) => {
    const byId = new Map(block.map((r, i) => [ids[i], r]));
    let bad = 0;
    block.forEach((r, i) => {
      for (const c of r.children) if (byId.get(c)?.father !== ids[i]) bad++;
    });
    return bad;
  };

  for (const block of blocks) {
    const childIds = new Set(block.flatMap((r) => r.children));
    const topFathers = [...new Set(block.map((r) => r.father))].filter(
      (f) => f !== '0' && !childIds.has(f),
    );
    const candidates = [...new Set([...topFathers, ...childIds])].sort(cmp);
    let ids = null;
    if (candidates.length === block.length && countBad(block, candidates) === 0) {
      ids = candidates;
    } else if (candidates.length === block.length + 1) {
      for (let k = 0; k < candidates.length && !ids; k++) {
        const trial = candidates.filter((_, i) => i !== k);
        if (countBad(block, trial) === 0) ids = trial;
      }
    }
    if (!ids) {
      console.warn(`skip block #${block[0].index}: could not resolve PathIDs`);
      continue;
    }
    block.forEach((r, i) => (r.id = ids[i]));
  }
}

const gameObjects = loadGameObjects(join(dumpDir, 'GameObject'));
const rects = loadRectTransforms(join(dumpDir, 'RectTransform'));
resolveOwnIds(rects);

const nameByTransform = new Map(gameObjects.map((g) => [g.transformId, g.name]));
const rectById = new Map(rects.filter((r) => r.id).map((r) => [r.id, r]));

const seasonTalents = JSON.parse(
  readFileSync(join(ROOT, 'src', 'data', 'season-talents.json'), 'utf8'),
);
const { seasonId } = seasonTalents;

const layout = {};
for (const templateId of Object.keys(seasonTalents.templates)) {
  const prefabName = `season_talent_${seasonId}_${templateId}`;
  const prefab = gameObjects.find((g) => g.name === prefabName);
  const prefabRect = prefab && rectById.get(prefab.transformId);
  if (!prefabRect) {
    console.warn(`template ${templateId}: prefab ${prefabName} not found`);
    continue;
  }
  const nodes = {};
  for (const childId of prefabRect.children) {
    const m = nameByTransform.get(childId)?.match(/^season_talent_(\d+)$/);
    const rect = rectById.get(childId);
    if (m && rect) nodes[m[1]] = rect.pos;
  }
  const expected = Object.entries(seasonTalents.treeNodes)
    .filter(([, n]) => String(n.templateId) === templateId)
    .map(([id]) => id);
  const missing = expected.filter((id) => !nodes[id]);
  if (missing.length) console.warn(`template ${templateId}: missing nodes ${missing.join(',')}`);
  layout[templateId] = { nodes };
}

const path = writeJson(outDir, 'season-talent-layout.json', {
  // Unity UI coordinates of each node's center relative to the prefab center (+y is up).
  seasonId,
  templates: layout,
});
console.log(`wrote ${path} (${Object.keys(layout).length} templates)`);

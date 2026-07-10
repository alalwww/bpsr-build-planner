// Extracts master-data tables from the raw ZTable dumps
// (../../BPSRData/ZTable/<language>/*.json) into:
//
//   1. Language-independent structural data under src/data/ (equipment.json,
//      skills.json, classes.json) - read once from a single language folder,
//      since non-text fields are identical across languages.
//   2. Per-locale display text under src/locales/<locale>/game-data.json,
//      keyed by the same ids as the structural files (items/skills/classes/
//      parts/attributes sections).
//
// "Ability" (アビリティ/Talent) selection candidates are NOT extracted
// separately: ProfessionSystemTable.TalentSkill references ids in the same
// SkillTable as NormalSkill/NormalAttackSkill/etc, so they are covered by
// skills.json + the per-class reference arrays in classes.json.
//
// Usage:
//   node scripts/extract-ztable.mjs [--src <ZTable dir>] [--data-out <dir>] [--locales-out <dir>]

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ZTable directory name -> locale directory name used under src/locales.
const LOCALES = {
  japanese: 'ja_JP',
  english: 'en_US',
};

// Structural (non-text) fields are identical across languages, so they only
// need to be read from one language folder.
const STRUCTURAL_LANG_DIR = 'japanese';

function parseArgs(argv) {
  const args = {
    src: join(ROOT, '../../BPSRData/ZTable'),
    dataOut: join(ROOT, 'src/data'),
    localesOut: join(ROOT, 'src/locales'),
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--src') args.src = argv[++i];
    else if (argv[i] === '--data-out') args.dataOut = argv[++i];
    else if (argv[i] === '--locales-out') args.localesOut = argv[++i];
  }
  return args;
}

function readTable(dir, name) {
  return JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8'));
}

function writeJson(dir, fileName, data) {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, fileName);
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf8');
  return path;
}

// Talent値 → ロールスキル(DutySkill)IDの対応。SkillTableのiconが
// ui/textures/dutyskill/ 配下のスキル群がロールスキルに相当する。
// Talent=1: DPS, Talent=2: ヒーラー/サポート, Talent=3: タンク
const TALENT_ROLE_SKILLS = {
  1: [3011, 3012, 3013, 3014],
  2: [3311, 3312, 3313, 3314],
  3: [3611, 3612, 3613, 3614],
};

// classes.json: ProfessionSystemTable keyed by ProfessionId. IsOpen:false
// entries are kept as-is - excluding unimplemented classes from selection UI
// is the consumer's responsibility, not the data layer's.
function extractClasses(langDir) {
  const professionSystemTable = readTable(langDir, 'ProfessionSystemTable');
  const result = {};
  for (const prof of Object.values(professionSystemTable)) {
    result[prof.ProfessionId] = {
      id: prof.ProfessionId,
      element: prof.Element,
      talent: prof.Talent,
      isOpen: prof.IsOpen,
      attackShow: prof.AttackShow,
      strOrIntOrDexShow: prof.StrOrIntOrDexShow,
      icon: prof.Icon ? prof.Icon.split('/').pop() : '',
      normalAttackSkill: prof.NormalAttackSkill,
      specialSkill: prof.SpecialSkill,
      ultimateSkill: prof.UltimateSkill,
      normalSkill: prof.NormalSkill,
      talentSkill: prof.TalentSkill,
      roleSkill: TALENT_ROLE_SKILLS[prof.Talent] ?? [],
      showTalentStage: Array.isArray(prof.ShowTalentStage) ? prof.ShowTalentStage : [],
      talentColor: prof.TalentColor ?? '',
    };
  }
  return result;
}

function collectReferencedSkillIds(classes, langDir) {
  const ids = new Set();
  const fields = [
    'normalAttackSkill',
    'specialSkill',
    'ultimateSkill',
    'normalSkill',
    'talentSkill',
    'roleSkill',
  ];
  for (const cls of Object.values(classes)) {
    for (const field of fields) {
      for (const id of cls[field] ?? []) ids.add(id);
    }
  }
  // SkillSystemTable はプレイヤー選択可能スキルの正式リスト。
  // ProfessionSystemTable に直接載らない型変化スキル (例: 2301 スラップビート) もここに含まれる。
  const skillSystemTable = readTable(langDir, 'SkillSystemTable');
  for (const entry of Object.values(skillSystemTable)) {
    ids.add(entry.SkillBaseId);
  }
  return ids;
}

// skills.json: only the subset of SkillTable actually referenced by a class
// (SkillTable as a whole also contains field marks, monster-only skills etc.
// that are not player-selectable).
function extractSkills(langDir, referencedSkillIds) {
  const skillTable = readTable(langDir, 'SkillTable');
  const skillSystemTable = readTable(langDir, 'SkillSystemTable');
  const skillUpgradeTable = readTable(langDir, 'SkillUpgradeTable');

  // Build upgradeId → maxRank (max SlotNumber) map
  const maxRankByUpgradeId = {};
  for (const entry of Object.values(skillUpgradeTable)) {
    const cur = maxRankByUpgradeId[entry.UpgradeId] ?? 0;
    maxRankByUpgradeId[entry.UpgradeId] = Math.max(cur, entry.SlotNumber);
  }
  // Build skillBaseId → upgradeId map
  const upgradeIdBySkillId = {};
  for (const entry of Object.values(skillSystemTable)) {
    upgradeIdBySkillId[entry.SkillBaseId] = entry.UpgradeId;
  }

  const result = {};
  for (const id of referencedSkillIds) {
    const entry = skillTable[String(id)];
    if (!entry) {
      console.warn(`[extract-ztable] no SkillTable entry for referenced skill id ${id}, skipping`);
      continue;
    }
    const upgradeId = upgradeIdBySkillId[id];
    const maxRank = upgradeId != null ? (maxRankByUpgradeId[upgradeId] ?? 0) : 0;
    result[id] = {
      id,
      icon: entry.Icon || '',
      skillType: entry.SkillType,
      maxRank,
    };
  }
  return result;
}

// battle-imagines.json: SkillAoyiTable の全エントリ。
//   id: エントリID (3901-3983)
//   rarityType: 1=エリート(bg_on_1), 2=ボス/キャラ(bg_on_2)
//   icon, showSkillType, maxRank, skillId: 既存フィールド
//   baseFv: G0時のベースFV (SkillFightLevelTable.Level=1 のFightValue)
//   fightValues: [G1,G2,...Gmax] の累積FV (SkillAoyiStarTable)
//   passiveEffects: [[attrId, r0, r1, r2, r3, r4, r5], ...] (type=1 stat加算)
//   bufPassiveEffects: [[buffId, [r0p1,r0p2,...], [r1p1,...], ...r5], ...] (type=3 バフ効果パラメータ)
function extractBattleImagines(langDir) {
  const aoyiTable = readTable(langDir, 'SkillAoyiTable');
  const starTable = readTable(langDir, 'SkillAoyiStarTable');
  const skillFightLevelTable = readTable(langDir, 'SkillFightLevelTable');

  // SkillFightLevelTable から各SkillId の Level=1 FightValue をインデックス化 (= G0ベースFV)
  const baseFvBySkillId = {};
  for (const entry of Object.values(skillFightLevelTable)) {
    if (entry.Level === 1 && entry.SkillId >= 3900) {
      baseFvBySkillId[entry.SkillId] = entry.FightValue ?? 0;
    }
  }

  // Build rank map: aoyiId -> level (1-5) -> { type1: {attrId->val}, buffPar: number[], fightValue: number }
  const rankMap = {};
  for (const entry of Object.values(starTable)) {
    const aoyiId = entry.SkillId;
    const level = entry.Level;
    if (!rankMap[aoyiId]) rankMap[aoyiId] = {};
    const type1 = {};
    for (const [t, attrId, val] of entry.TransformationType || []) {
      if (t === 1) type1[attrId] = val;
    }
    rankMap[aoyiId][level] = {
      type1,
      buffPar: entry.BuffPar?.[0] ?? [],
      fightValue: entry.FightValue ?? 0,
    };
  }

  const usedBattleImagineAttrIds = new Set();
  const result = {};
  for (const entry of Object.values(aoyiTable)) {
    const numMatch = String(entry.ArtPreview).match(/(\d+)$/);
    const iconNum = numMatch ? numMatch[1].padStart(3, '0') : '';
    const r0Params = entry.BuffPar?.[0] ?? [];
    const rankData = rankMap[entry.Id] ?? {};

    // type=1 passive effects: [attrId, r0, r1, r2, r3, r4, r5]
    const r0Type1 = (entry.TransformationType || []).filter(([t]) => t === 1);
    const passiveEffects = r0Type1.map(([, attrId, r0val]) => {
      usedBattleImagineAttrIds.add(attrId);
      const row = [attrId, r0val];
      for (let lv = 1; lv <= 5; lv++) row.push(rankData[lv]?.type1[attrId] ?? r0val);
      return row;
    });

    // type=3 passive effects: [buffId, [r0params], [r1params], ..., [r5params]]
    const r0Type3 = (entry.TransformationType || []).filter(([t]) => t === 3);
    const bufPassiveEffects = r0Type3.map(([, buffId]) => {
      const paramsPerRank = [r0Params];
      for (let lv = 1; lv <= 5; lv++) paramsPerRank.push(rankData[lv]?.buffPar ?? r0Params);
      return [buffId, ...paramsPerRank];
    });

    // fight values per rank (1-5) from SkillAoyiStarTable.FightValue (cumulative)
    const fightValues = [];
    const maxRank = entry.ResonanceMaxLv ?? 5;
    for (let lv = 1; lv <= maxRank; lv++) fightValues.push(rankData[lv]?.fightValue ?? 0);

    // G0ベースFV: SkillFightLevelTable.Level=1 のFightValue
    const baseFv = baseFvBySkillId[entry.Id] ?? 0;

    result[entry.Id] = {
      id: entry.Id,
      rarityType: entry.RarityType ?? 1,
      icon: iconNum ? `skill_aoyi_skill_icon_${iconNum}` : '',
      showSkillType: entry.ShowSkillType,
      maxRank,
      skillId: entry.Index,
      baseFv,
      fightValues,
      ...(passiveEffects.length > 0 ? { passiveEffects } : {}),
      ...(bufPassiveEffects.length > 0 ? { bufPassiveEffects } : {}),
    };
  }
  return { battleImagines: result, usedBattleImagineAttrIds };
}

// skill-fight-values.json: SkillFightLevelTable から参照スキルの Lv別 FightValue を抽出。
//   result[skillId][level-1] = FightValue
function extractSkillFightValues(langDir, referencedSkillIds) {
  const fightLvlTable = readTable(langDir, 'SkillFightLevelTable');
  const result = {};
  for (const entry of Object.values(fightLvlTable)) {
    if (!referencedSkillIds.has(entry.SkillId)) continue;
    if (!result[entry.SkillId]) result[entry.SkillId] = [];
    result[entry.SkillId][entry.Level - 1] = entry.FightValue ?? 0;
  }
  return result;
}

// skill-rank-fight-values.json: WeaponStarTable からスキルのランク(G1-G6)別 FightValue を抽出。
//   result[skillId][rank-1] = FightValue  (rank 1=G1 ... 6=G6)
function extractSkillRankFightValues(langDir, referencedSkillIds) {
  const weaponStarTable = readTable(langDir, 'WeaponStarTable');
  const result = {};
  for (const entry of Object.values(weaponStarTable)) {
    if (!referencedSkillIds.has(entry.SkillId)) continue;
    if (!result[entry.SkillId]) result[entry.SkillId] = [];
    result[entry.SkillId][entry.Level - 1] = entry.FightValue ?? 0;
  }
  return result;
}

// refine.json: 精錬効果データ。
//   partRefineIds[partId][professionId] → RefineId (EquipPartTable.RefineId 由来)
//   refineById[RefineId].cumulative[level-1] → [[attrId, value], ...]  (累積効果)
//   refineById[RefineId].milestones[level]   → [[attrId, value], ...]  (Lv.5/10/15/20/25/30)
// cumulative はEquipRefineTable.RefineEffect、milestones はRefineLevelEffect に対応する。
function extractRefineData(langDir) {
  const partTable = readTable(langDir, 'EquipPartTable');
  const refineTable = readTable(langDir, 'EquipRefineTable');

  const partRefineIds = {};
  for (const part of Object.values(partTable)) {
    if (!Array.isArray(part.RefineId) || part.RefineId.length === 0) continue;
    const profMap = {};
    for (const [profId, refineId] of part.RefineId) {
      profMap[profId] = refineId;
    }
    partRefineIds[part.Id] = profMap;
  }

  const refineById = {};
  for (const entry of Object.values(refineTable)) {
    const group = (refineById[entry.RefineId] ??= {
      cumulative: [],
      milestones: {},
      fightValues: [],
    });
    // RefineEffect: [[type, attrId, value], ...] → [[attrId, value], ...]
    // cumulative は 0始まり (index = RefineLevel - 1)
    group.cumulative[entry.RefineLevel - 1] = entry.RefineEffect.map(
      // eslint-disable-next-line no-unused-vars
      ([_type, attrId, value]) => [attrId, value],
    );
    group.fightValues[entry.RefineLevel - 1] = entry.FightValue ?? 0;
    if (entry.RefineLevelEffect.length > 0) {
      group.milestones[entry.RefineLevel] = entry.RefineLevelEffect.map(
        // eslint-disable-next-line no-unused-vars
        ([_type, attrId, value]) => [attrId, value],
      );
    }
  }

  return { partRefineIds, refineById };
}

// suits.json: EquipSuitTable × EquipAttrSchoolLibTable → セット効果データ
//   { [suitId]: { tiers: [{ limitNum, fightValue, effects: { [schoolId]: buffId } }] } }
//     limitNum: 発動に必要な装備数
//     fightValue: 能力スコア加算値 (全クラス共通)
//     effects: { schoolId → AttrEffect buffId } (TalentSchoolId=[] は "101" にリマップ)
function extractSuits(langDir) {
  const suitTable = readTable(langDir, 'EquipSuitTable');
  const schoolLibTable = readTable(langDir, 'EquipAttrSchoolLibTable');

  const schoolLibByLibId = {};
  for (const entry of Object.values(schoolLibTable)) {
    (schoolLibByLibId[entry.AttrLibId] ??= []).push(entry);
  }

  const bySuitId = {};
  for (const entry of Object.values(suitTable)) {
    (bySuitId[entry.SuitId] ??= []).push(entry);
  }

  const result = {};
  for (const [suitId, entries] of Object.entries(bySuitId)) {
    const tiers = entries
      .sort((a, b) => a.LimitNum - b.LimitNum)
      .map((entry) => {
        const rawLibId = Array.isArray(entry.SuitAttrLibId) ? entry.SuitAttrLibId : [];
        const [tableType, libId] = rawLibId;
        let fightValue = 0;
        const effects = {};
        if (tableType === 2 && libId) {
          for (const libEntry of schoolLibByLibId[libId] ?? []) {
            if (fightValue === 0) fightValue = libEntry.FightValue?.[0]?.[0] ?? 0;
            const buffId = libEntry.AttrEffect?.[0]?.[1];
            if (buffId) {
              const schoolId =
                (libEntry.TalentSchoolId ?? []).length === 0
                  ? '101'
                  : String(libEntry.TalentSchoolId[0]);
              effects[schoolId] = buffId;
            }
          }
        }
        return { limitNum: entry.LimitNum, fightValue, effects };
      });
    result[suitId] = { tiers };
  }
  return result;
}

// enchants.json: EnchantId → available enchant items with effects.
//   Gem-based (EnchantId 1001–1003, Gs≤100): flat list from RecommendedGem.
//   Seal-based (EnchantId 2001–2004, Gs>100): from EnchantItemList; each base item
//     includes "refined" and "perfect" variants at baseId+1 / baseId+2.
//   effects: [[attrId, value], ...] from EnchantItemEffect + EnchantItemPar.
function extractEnchants(langDir) {
  const enchantTable = readTable(langDir, 'EquipEnchantTable');
  const enchantItemTable = readTable(langDir, 'EquipEnchantItemTable');
  const itemTable = readTable(langDir, 'ItemTable');

  // Build map: enchantId → Type=1 entry (initial attachment, not 製精)
  const enchantByIdType1 = new Map();
  for (const entry of Object.values(enchantTable)) {
    if (entry.EnchantType === 1 && !enchantByIdType1.has(entry.EnchantId)) {
      enchantByIdType1.set(entry.EnchantId, entry);
    }
  }

  const enchantSets = {};
  const usedEnchantItemIds = new Set();
  const usedEnchantAttrIds = new Set();

  function getEffects(itemId) {
    const e = enchantItemTable[String(itemId)];
    if (!e) return [];
    return e.EnchantItemEffect.map(([, attrId], i) => {
      usedEnchantAttrIds.add(attrId);
      return [attrId, e.EnchantItemPar[i]?.[0] ?? 0];
    });
  }

  // Gem-based (EnchantId 1001–1003): all use identical RecommendedGem list (grades 1–5)
  for (const enchantId of [1001, 1002, 1003]) {
    const entry = enchantByIdType1.get(enchantId);
    if (!entry) continue;
    const items = [];
    for (const id of entry.RecommendedGem) {
      const item = itemTable[String(id)];
      if (!item) continue;
      usedEnchantItemIds.add(id);
      const enchantData = enchantItemTable[String(id)];
      const cost = enchantData?.OrdinaryConsume ?? [];
      for (const [costItemId] of cost) usedEnchantItemIds.add(costItemId);
      items.push({
        id,
        quality: item.Quality,
        icon: item.Icon || '',
        level: enchantData?.EnchantItemLevel ?? 0,
        cost,
        effects: getEffects(id),
        fightValue: enchantData?.FightValue ?? 0,
      });
    }
    enchantSets[enchantId] = items;
  }

  // Seal-based (EnchantId 2001–2004): base item + 精 (id+1) + 極 (id+2) variants
  for (const enchantId of [2001, 2002, 2003, 2004]) {
    const entry = enchantByIdType1.get(enchantId);
    if (!entry || entry.EnchantItemList.length === 0) continue;
    const items = [];
    for (const baseId of entry.EnchantItemList) {
      const item = itemTable[String(baseId)];
      if (!item) continue;
      usedEnchantItemIds.add(baseId);
      const baseEnchantData = enchantItemTable[String(baseId)];
      const baseCost = baseEnchantData?.OrdinaryConsume ?? [];
      for (const [costItemId] of baseCost) usedEnchantItemIds.add(costItemId);
      const sealItem = {
        id: baseId,
        quality: item.Quality,
        icon: item.Icon || '',
        level: baseEnchantData?.EnchantItemLevel ?? 0,
        cost: baseCost,
        effects: getEffects(baseId),
        fightValue: baseEnchantData?.FightValue ?? 0,
      };
      for (const [key, varOffset] of [
        ['refined', 1],
        ['perfect', 2],
      ]) {
        const varId = baseId + varOffset;
        if (itemTable[String(varId)] && enchantItemTable[String(varId)]) {
          usedEnchantItemIds.add(varId);
          const varEnchantData = enchantItemTable[String(varId)];
          const varCost = varEnchantData?.OrdinaryConsume ?? [];
          for (const [costItemId] of varCost) usedEnchantItemIds.add(costItemId);
          sealItem[key] = {
            id: varId,
            cost: varCost,
            effects: getEffects(varId),
            fightValue: varEnchantData?.FightValue ?? 0,
          };
        }
      }
      items.push(sealItem);
    }
    enchantSets[enchantId] = items;
  }

  return { enchantSets, usedEnchantItemIds, usedEnchantAttrIds };
}

// equipment.json: EquipTable grouped by EquipPart (slot). Each item includes:
//   baseStats: [[attrId, min, max], ...] from BasicAttrLibId → EquipAttr(School)LibTable
//   fixedEvolutionStats: { [talentSchoolId]: [[effectType, attrId, value, isPercent], ...] }
//     from AdvancedAttrLibId → EquipAttrSchoolLibTable.
//     TalentSchoolId ごとに固定進化ステータスを格納(シリーズ武器のみ非空)。
//     isPercent: true なら value/100 で % 表示、false ならフラット値として表示する。
//
// BasicAttrLibId / AdvancedAttrLibId の共通フォーマット: [tableType, libId, ...]
//   tableType 1 → EquipAttrLibTable       (低〜中レベル装備)
//   tableType 2 → EquipAttrSchoolLibTable  (Lv70+ シリーズ装備)
// 改鋳進化ステータスは RecastingAttrLibId → EquipAttrLibTable から抽出する。
// reforgeEvoFvMin/Max は改鋳スロットの FightValue 範囲 (perfectline 0/100 時)。
// Reforgeなしは全て 0。

function extractEquipment(langDir) {
  const equipTable = readTable(langDir, 'EquipTable');
  const equipWeaponTable = readTable(langDir, 'EquipWeaponTable');
  const itemTable = readTable(langDir, 'ItemTable');
  const equipAttrLibTable = readTable(langDir, 'EquipAttrLibTable');
  const equipAttrSchoolLibTable = readTable(langDir, 'EquipAttrSchoolLibTable');
  const profileAttrTable = readTable(langDir, 'ProfileAttrTable');
  const professionSystemTable = readTable(langDir, 'ProfessionSystemTable');

  // ProfileAttrTable を AttrId でインデックス化(isPercent 判定に使用)。
  // 装備ボーナスAttrId (末尾2) の「末尾0」のエントリが ProfileAttrTable に存在する場合は
  // % 表示ステータス、存在しない場合はフラット値。
  const profileAttrByAttrId = Object.fromEntries(
    Object.values(profileAttrTable).map((e) => [e.AttrId, e]),
  );

  // ProfessionId → ShowTalentStage([type1Id, type2Id]) マッピング。
  // EquipAttrSchoolLibTable の TalentSchoolId=[] (空配列) エントリは一部クラス
  // (stormBlade 等) において type1 を表すが、String([])="" となるため
  // UI 側の talentSchoolIds[0] と一致しない。このマップで適切な type1 Id に変換する。
  const profToTalentSchools = new Map(
    Object.values(professionSystemTable)
      .filter((p) => Array.isArray(p.ShowTalentStage) && p.ShowTalentStage.length >= 2)
      .map((p) => [p.ProfessionId, p.ShowTalentStage]),
  );

  // 両テーブルを AttrLibId でグループ化（同一AttrLibId/AllowPartの異なる複数エントリに対応）。
  function buildLibIndex(table) {
    const index = {};
    for (const entry of Object.values(table)) {
      (index[entry.AttrLibId] ??= []).push(entry);
    }
    return index;
  }
  const attrLibByLibId = buildLibIndex(equipAttrLibTable);
  const schoolLibByLibId = buildLibIndex(equipAttrSchoolLibTable);

  // EquipAttrSchoolLibTable のエントリから fixedEvolutionStats を構築するヘルパー。
  // advLibIds に含まれる各 libId のエントリを TalentSchoolId でグループ化し、
  // effectType/isPercent を解決した効果配列を返す。
  // professionId を渡すと TalentSchoolId=[] → type1 TalentSchoolId への変換も行う。
  function buildFixedEvoStats(advLibIds, professionId) {
    const stats = {};
    for (const libId of advLibIds) {
      for (const entry of schoolLibByLibId[libId] ?? []) {
        const key = String(entry.TalentSchoolId ?? '');
        const effects = (stats[key] ??= []);
        for (let i = 0; i < entry.AttrEffect.length; i++) {
          const [effectType, attrId] = entry.AttrEffect[i];
          const [min, max] = entry.AttrEffectConfig[i] ?? [0, 0];
          const [fvMin, fvMax] = entry.FightValue?.[i] ?? [0, 0];
          const isPercent = effectType === 3 || Boolean(profileAttrByAttrId[attrId - 2]);
          effects.push([effectType, attrId, min, max, isPercent, fvMin, fvMax]);
          usedFixedEvoAttrIds.add(attrId);
        }
      }
    }
    // TalentSchoolId=[] → type1 TalentSchoolId にリマップ。
    // 武器は professionId から ShowTalentStage を参照。防具など professionId が
    // ない場合は ZTable 上の [] が常に stormBlade type1 (101) を指すため固定値で補完。
    if ('' in stats) {
      const talentIds = profToTalentSchools.get(professionId);
      const type1Key = talentIds ? String(talentIds[0]) : '101';
      stats[type1Key] = stats[''];
      delete stats[''];
    }
    return stats;
  }

  // 伝説刻印: AllowPart=[] は防具部位には適用されない(武器/アクセサリのみ)。
  const LEGENDARY_ARMOR_PARTS = new Set([201, 202, 203, 204, 208, 209]);
  // 防具刻印の中でも %表示になるステータス(筋力/知力/敏捷は値/100が%)。
  const LEGENDARY_ARMOR_PERCENT_ATTR_IDS = new Set([11014, 11024, 11034]);

  // QualityChildAttrLibId から部位別の選択可能刻印ステータスを抽出する。
  // libId < 5000000 (テスト/プレースホルダ) は除外。
  // 戻り値: [{ effectType, attrId, isPercent, values: number[] }, ...] | null
  // 武器/アクセサリは全ステータス%、防具は筋力/知力/敏捷のみ%(他は実数値加算)。
  function buildLegendaryAffixEntries(libId, equipPart) {
    if (!libId || libId < 5000000) return null;
    const entries = (attrLibByLibId[libId] ?? []).filter(
      (e) =>
        (e.AllowPart.length > 0 && e.AllowPart.includes(equipPart)) ||
        (e.AllowPart.length === 0 && !LEGENDARY_ARMOR_PARTS.has(equipPart)),
    );
    if (entries.length === 0) return null;
    const isArmorPart = LEGENDARY_ARMOR_PARTS.has(equipPart);
    // 同一 effectType+attrId の複数エントリが各段階のティアを表す。
    const byEffect = new Map();
    for (const e of entries) {
      const [effectType, attrId] = e.AttrEffect[0];
      const key = `${effectType}_${attrId}`;
      if (!byEffect.has(key)) {
        const isPercent = !isArmorPart || LEGENDARY_ARMOR_PERCENT_ATTR_IDS.has(attrId);
        byEffect.set(key, { effectType, attrId, isPercent, pairs: [] });
      }
      const data = byEffect.get(key);
      const val = e.AttrEffectConfig[0]?.[0] ?? 0;
      const fv = e.FightValue[0]?.[0] ?? 0;
      data.pairs.push({ val, fv });
    }
    return [...byEffect.values()].map(({ effectType, attrId, isPercent, pairs }) => {
      pairs.sort((a, b) => a.val - b.val);
      return {
        effectType,
        attrId,
        isPercent,
        values: pairs.map((p) => p.val),
        fightValues: pairs.map((p) => p.fv),
      };
    });
  }

  // EquipBreakThroughTable: EquipId → BT エントリ配列 のマップを構築。
  // 突破後の装備は EquipTable に存在しないため、ここから合成アイテムを生成する。
  const btTable = readTable(langDir, 'EquipBreakThroughTable');
  const btByEquipId = new Map();
  for (const entry of Object.values(btTable)) {
    const arr = btByEquipId.get(entry.EquipId) ?? [];
    arr.push(entry);
    btByEquipId.set(entry.EquipId, arr);
  }

  const equipmentIds = Object.keys(equipTable)
    .map(Number)
    .sort((a, b) => a - b);

  const byPart = {};
  const usedAttrIds = new Set();
  const usedFixedEvoAttrIds = new Set();
  const usedLegendaryAttrIds = new Set();

  for (const id of equipmentIds) {
    const equip = equipTable[String(id)];
    const itemEntry = itemTable[String(id)];
    if (!itemEntry) {
      console.warn(`[extract-ztable] no ItemTable entry for equipment id ${id}, skipping`);
      continue;
    }
    const weaponEntry = equipWeaponTable[String(id)];

    // BasicAttrLibId の形式: [tableType, libId, ...]
    //   tableType 1 → attrLibByLibId (EquipAttrLibTable)
    //   tableType 2 → schoolLibByLibId (EquipAttrSchoolLibTable)
    const rawLibId = Array.isArray(equip.BasicAttrLibId) ? equip.BasicAttrLibId : [];
    const [attrLibType, ...attrLibIds] = rawLibId;
    const lookupMap = attrLibType === 2 ? schoolLibByLibId : attrLibByLibId;
    const baseStats = [];
    for (const libId of attrLibIds) {
      const entries = lookupMap[libId] ?? [];
      // 部位(EquipPart)が AllowPart に含まれるエントリを選択
      const match = entries.find((e) => (e.AllowPart ?? []).includes(equip.EquipPart));
      if (match) {
        for (let i = 0; i < match.AttrEffect.length; i++) {
          const [, attrId] = match.AttrEffect[i];
          const [min, max] = match.AttrEffectConfig[i] ?? [0, 0];
          const [fvMin, fvMax] = match.FightValue?.[i] ?? [0, 0];
          baseStats.push([attrId, min, max, fvMin, fvMax]);
          usedAttrIds.add(attrId);
        }
        break;
      }
    }

    // AdvancedAttrLibId の処理:
    //   type=1 → EquipAttrLibTable: 装備IDごとに固定の Evo1/Evo2 ステータス
    //   type=2 → EquipAttrSchoolLibTable: TalentSchoolId ごとに固定進化ステータス(シリーズ装備)
    const rawAdvId = Array.isArray(equip.AdvancedAttrLibId) ? equip.AdvancedAttrLibId : [];
    const [advLibType, ...advLibIds] = rawAdvId;
    const evo = [];
    const fixedEvolutionStats = {};
    if (advLibType === 1) {
      // Evo1/Evo2 を装備IDごとに固定ステータスとして格納する。
      // advLibIds の各 libId が Evo スロット 1 枚に対応する。
      for (const libId of advLibIds) {
        const entries = attrLibByLibId[libId] ?? [];
        const match = entries.find((e) => (e.AllowPart ?? []).includes(equip.EquipPart));
        if (match) {
          const [, attrId] = match.AttrEffect[0];
          const [min, max] = match.AttrEffectConfig[0] ?? [0, 0];
          const [fvMin, fvMax] = match.FightValue?.[0] ?? [0, 0];
          evo.push([attrId, min, max, fvMin, fvMax]);
          usedAttrIds.add(attrId);
        }
      }
    } else if (advLibType === 2) {
      Object.assign(fixedEvolutionStats, buildFixedEvoStats(advLibIds, weaponEntry?.ProfessionId));
    }

    // 改鋳進化ステータス: RecastingAttrLibId → EquipAttrLibTable から抽出。
    let reforgeMaxPerfectline = 0;
    let reforgeEvoMin = 0;
    let reforgeEvoMax = 0;
    let reforgeEvoFvMin = 0;
    let reforgeEvoFvMax = 0;
    const rawRecastId = Array.isArray(equip.RecastingAttrLibId) ? equip.RecastingAttrLibId : [];
    if (rawRecastId.length >= 2) {
      const recastLibId = rawRecastId[1];
      const recastEntries = attrLibByLibId[recastLibId] ?? [];
      const recastMatch = recastEntries.find((e) => {
        const ap = e.AllowPart;
        return Array.isArray(ap) ? ap.includes(equip.EquipPart) : ap === equip.EquipPart;
      });
      if (recastMatch) {
        [reforgeEvoMin, reforgeEvoMax] = recastMatch.AttrEffectConfig[0] ?? [0, 0];
        [reforgeEvoFvMin, reforgeEvoFvMax] = recastMatch.FightValue?.[0] ?? [0, 0];
        reforgeMaxPerfectline = equip.EquipGs <= 80 ? 8 : 100;
      }
    }

    // 伝説刻印: QualityChildAttrLibId から選択可能ステータスを抽出。
    const rawAffixIds = Array.isArray(equip.QualityChildAttrLibId)
      ? equip.QualityChildAttrLibId
      : [];
    const affixLibId = rawAffixIds.length >= 2 ? rawAffixIds[1] : 0;
    const legendaryAffix = buildLegendaryAffixEntries(affixLibId, equip.EquipPart);
    if (legendaryAffix) {
      for (const { attrId } of legendaryAffix) usedLegendaryAttrIds.add(attrId);
    }

    const part = (byPart[equip.EquipPart] ??= {});
    part[id] = {
      id,
      part: equip.EquipPart,
      equipGs: equip.EquipGs,
      quality: itemEntry.Quality,
      icon: itemEntry.Icon || '',
      ...(weaponEntry ? { weaponProfessionId: weaponEntry.ProfessionId } : {}),
      baseStats,
      evo,
      reforgeMaxPerfectline,
      reforgeEvoMin,
      reforgeEvoMax,
      reforgeEvoFvMin,
      reforgeEvoFvMax,
      fixedEvolutionStats,
      ...(legendaryAffix ? { legendaryAffix } : {}),
      ...(equip.EnchantId ? { enchantId: equip.EnchantId } : {}),
      ...(equip.SuitId ? { suitId: equip.SuitId } : {}),
      // BreakThrough グループ: BT を持つ装備は btGroupId=自身ID, btTime=0 を付与する。
      ...(btByEquipId.has(id) ? { btGroupId: id, btTime: 0 } : {}),
    };
  }

  // EquipBreakThroughTable から突破後装備の合成アイテムを生成する。
  // ID = BreakThroughTable.Id + 8000000 (例: BT entry Id=1 → synId=8000001)
  for (const [equipId, btEntries] of btByEquipId) {
    // ベースアイテムを byPart から検索
    let baseItem = null;
    for (const partItems of Object.values(byPart)) {
      if (partItems[equipId]) {
        baseItem = partItems[equipId];
        break;
      }
    }
    if (!baseItem) {
      console.warn(`[extract-ztable] BT base item not found for EquipId=${equipId}, skipping`);
      continue;
    }

    for (const btEntry of btEntries.sort((a, b) => a.BreakThroughTime - b.BreakThroughTime)) {
      const synId = btEntry.Id + 8000000;
      const btPart = baseItem.part;

      // BasicAttrLibId=[] はベースアイテムの basicStats を引き継ぐ(BT1 等)。
      // それ以外は btEntry の BasicAttrLibId から新しい basicStats を生成する。
      let baseStats;
      if (!btEntry.BasicAttrLibId || btEntry.BasicAttrLibId.length === 0) {
        baseStats = [...baseItem.baseStats];
      } else {
        const [btLibType, ...btLibIds] = btEntry.BasicAttrLibId;
        const btLookupMap = btLibType === 2 ? schoolLibByLibId : attrLibByLibId;
        baseStats = [];
        for (const libId of btLibIds) {
          const entries = btLookupMap[libId] ?? [];
          const match = entries.find((e) => (e.AllowPart ?? []).includes(btPart));
          if (match) {
            for (let i = 0; i < match.AttrEffect.length; i++) {
              const [, attrId] = match.AttrEffect[i];
              const [min, max] = match.AttrEffectConfig[i] ?? [0, 0];
              const [fvMin, fvMax] = match.FightValue?.[i] ?? [0, 0];
              baseStats.push([attrId, min, max, fvMin, fvMax]);
              usedAttrIds.add(attrId);
            }
            break;
          }
        }
      }

      // AdvancedAttrLibId の処理(ベースアイテムと同じロジック)。
      const rawAdvId = Array.isArray(btEntry.AdvancedAttrLibId) ? btEntry.AdvancedAttrLibId : [];
      const [advLibType, ...advLibIds] = rawAdvId;
      const evo = [];
      const fixedEvolutionStats = {};
      if (advLibType === 1) {
        for (const libId of advLibIds) {
          const entries = attrLibByLibId[libId] ?? [];
          const match = entries.find((e) => (e.AllowPart ?? []).includes(btPart));
          if (match) {
            const [, attrId] = match.AttrEffect[0];
            const [min, max] = match.AttrEffectConfig[0] ?? [0, 0];
            const [fvMin, fvMax] = match.FightValue?.[0] ?? [0, 0];
            evo.push([attrId, min, max, fvMin, fvMax]);
            usedAttrIds.add(attrId);
          }
        }
      } else if (advLibType === 2) {
        Object.assign(
          fixedEvolutionStats,
          buildFixedEvoStats(advLibIds, baseItem.weaponProfessionId),
        );
      }

      let btReforgeMaxPl = baseItem.reforgeMaxPerfectline;
      let btReforgeMin = baseItem.reforgeEvoMin;
      let btReforgeMax = baseItem.reforgeEvoMax;
      let btReforgeFvMin = baseItem.reforgeEvoFvMin;
      let btReforgeFvMax = baseItem.reforgeEvoFvMax;
      const rawBtRecastId = Array.isArray(btEntry.RecastingAttrLibId)
        ? btEntry.RecastingAttrLibId
        : [];
      if (rawBtRecastId.length >= 2) {
        const btRecastLibId = rawBtRecastId[1];
        const btRecastEntries = attrLibByLibId[btRecastLibId] ?? [];
        const btRecastMatch = btRecastEntries.find((e) => {
          const ap = e.AllowPart;
          return Array.isArray(ap) ? ap.includes(btPart) : ap === btPart;
        });
        if (btRecastMatch) {
          [btReforgeMin, btReforgeMax] = btRecastMatch.AttrEffectConfig[0] ?? [0, 0];
          [btReforgeFvMin, btReforgeFvMax] = btRecastMatch.FightValue?.[0] ?? [0, 0];
          btReforgeMaxPl = btEntry.EquipGs <= 80 ? 8 : 100;
        }
      }

      const partItems = (byPart[btPart] ??= {});
      partItems[synId] = {
        id: synId,
        part: btPart,
        equipGs: btEntry.EquipGs,
        quality: baseItem.quality,
        icon: baseItem.icon,
        ...(baseItem.weaponProfessionId != null
          ? { weaponProfessionId: baseItem.weaponProfessionId }
          : {}),
        baseStats,
        evo,
        reforgeMaxPerfectline: btReforgeMaxPl,
        reforgeEvoMin: btReforgeMin,
        reforgeEvoMax: btReforgeMax,
        reforgeEvoFvMin: btReforgeFvMin,
        reforgeEvoFvMax: btReforgeFvMax,
        fixedEvolutionStats,
        // BT アイテムは ZTable に QualityChildAttrLibId がないためベースアイテムの刻印を継承。
        ...(baseItem.legendaryAffix ? { legendaryAffix: baseItem.legendaryAffix } : {}),
        ...(baseItem.enchantId ? { enchantId: baseItem.enchantId } : {}),
        ...(baseItem.suitId ? { suitId: baseItem.suitId } : {}),
        btGroupId: equipId,
        btTime: btEntry.BreakThroughTime,
      };
    }
  }

  return { byPart, usedAttrIds, usedFixedEvoAttrIds, usedLegendaryAttrIds };
}

// talent-tree.json: 武器熟練ツリーのノード・ツリー構造・ステージ定義。
//   nodes[id]: { weaponGroup, icon, type, effects, buffValueKeys, buffPars, cost, unlockConsume? }
//     TalentEffect フォーマット:
//       [[1, attrId, value]]           → ステータス加算
//       [[3, buffId, 1]]               → バフ効果 (パラメータは BuffPar が 0 でないとき有効)
//       [[4, paramIdx, attrId, ratio]] → 比率変換効果 (例: 敏捷8ptにつき物理攻撃力+1pt)
//       [[6, fromSkillId, toSkillId]]  → スキル置き換え
//   stagesByWeaponType[weaponType]: ビルドタイプ定義配列 (TalentStageTable)
//   treeNodesByWeaponType[weaponType]: ツリーノード配列 (TalentTreeTable)
//     WeaponType は ProfessionSystemTable.Id と一致しないことに注意。
//     WeaponType 1=ストームブレード, 2=フロストメイジ, 3=ツインストライカー, 4=ゲイルランサー
//     WeaponType 5=ヴァーダントオラクル, 8=サンダーフラッシュ, 9=ヘヴィガーディアン,
//     WeaponType 11=ディバインアーチャー, 12=シールドファイター, 13=ビートパフォーマー
//     ※ WeaponType 14=ルーシィ, 15=ナツ は TalentStageTable に存在しない (コラボ/特殊クラス)
function extractTalentTree(langDir) {
  const talentTable = readTable(langDir, 'TalentTable');
  const talentTreeTable = readTable(langDir, 'TalentTreeTable');
  const talentStageTable = readTable(langDir, 'TalentStageTable');

  const nodes = {};
  const usedTalentAttrIds = new Set();
  for (const entry of Object.values(talentTable)) {
    nodes[entry.Id] = {
      weaponGroup: entry.WeaponGroup,
      icon: entry.TalentIcon || '',
      type: entry.TalentType,
      effects: entry.TalentEffect,
      buffValueKeys: entry.BuffValueKey,
      buffPars: entry.BuffPar,
      cost: entry.TalentPointsConsume,
      fightValue: entry.FightValue ?? 0,
      ...(entry.UnlockConsume.length > 0 ? { unlockConsume: entry.UnlockConsume } : {}),
    };
    for (const eff of entry.TalentEffect) {
      if (eff[0] === 1 && typeof eff[1] === 'number') usedTalentAttrIds.add(eff[1]);
    }
  }

  const stagesByWeaponType = {};
  for (const entry of Object.values(talentStageTable)) {
    (stagesByWeaponType[entry.WeaponType] ??= []).push({
      id: entry.Id,
      // name は言語依存のため game-data.json の talentStages セクションへ移動
      stage: entry.TalentStage,
      bdType: entry.BdType,
      rootId: entry.RootId,
      recommendTalent: entry.RecommendTalent,
      factor: entry.Factor,
      recommendModEffectId: entry.RecommendModEffectId,
      mainAttrShow: entry.MainAttrShow,
    });
  }

  const treeNodesByWeaponType = {};
  for (const entry of Object.values(talentTreeTable)) {
    (treeNodesByWeaponType[entry.WeaponType] ??= []).push({
      id: entry.Id,
      talentId: entry.TalentId,
      stage: entry.TalentStage,
      bdType: entry.BdType,
      preNodes: entry.PreTalent,
      nextNodes: entry.NextTalent,
      position: entry.TalentPosition,
      // Unlock: [[type, value], ...] — type=3 は総消費ポイントが value 以上で解放
      ...(entry.Unlock?.length > 0 ? { unlock: entry.Unlock } : {}),
    });
  }

  return { nodes, stagesByWeaponType, treeNodesByWeaponType, usedTalentAttrIds };
}

// season-talents.json: 潜在心相晶ノードの構造データと効果。
//   templates[id]: { sortId, advancedEffectId, rootNodeId, icon, unlockCondition }
//   treeNodes[id]: { templateId, nodeType, groupId, preNodes, nextNodes, unlockCondition, sameGroupId }
//     NodeType 1 = 通常ノード (groupId → ordinaryEffects)
//     NodeType 2 = 幻影因子スロット (groupId → intermediateSlots)
//   ordinaryEffects[groupId]: 通常ノード効果 (SeasonTalentEffectOrdinaryTable)
//   intermediateSlots[id]: 幻影因子スロット定義 (SeasonTalentEffectIntermediateTable)
//     factorTypes: 装着可能な FactorItemTypeId リスト (空=制限なし)
//     professionIds: 特定クラス限定スロット (空=全クラス)
//   advancedEffects[id]: 高級ノード効果 (SeasonTalentEffectAdvancedTable)
//     effectId は SeasonTalentTemplateTable.AdvancedEffectId と対応
//   bondSlots[id]: 絆スロット定義 (SeasonTalentAdvancedHoleTable)
function extractSeasonTalents(langDir) {
  const templateTable = readTable(langDir, 'SeasonTalentTemplateTable');
  const treeTable = readTable(langDir, 'SeasonTalentTreeTable');
  const ordinaryTable = readTable(langDir, 'SeasonTalentEffectOrdinaryTable');
  const intermediateTable = readTable(langDir, 'SeasonTalentEffectIntermediateTable');
  const advancedTable = readTable(langDir, 'SeasonTalentEffectAdvancedTable');
  const holeTable = readTable(langDir, 'SeasonTalentAdvancedHoleTable');

  const templates = {};
  for (const entry of Object.values(templateTable)) {
    templates[entry.Id] = {
      sortId: entry.SortId,
      advancedEffectId: entry.AdvancedEffectId,
      rootNodeId: entry.NoteRootId,
      icon: entry.BigIconNormal,
      unlockCondition: entry.UnlockCondition,
    };
  }

  const treeNodes = {};
  for (const entry of Object.values(treeTable)) {
    treeNodes[entry.Id] = {
      templateId: entry.TemplateId,
      nodeType: entry.NodeType,
      groupId: entry.GroupId,
      preNodes: entry.PreNode,
      nextNodes: entry.NextNode,
      unlockCondition: entry.UnlockCondition,
      sameGroupId: entry.SameNodeGroupId,
    };
  }

  // ordinaryEffects は groupId をキーとする (SeasonTalentTreeTable.GroupId で参照)
  const ordinaryEffects = {};
  for (const entry of Object.values(ordinaryTable)) {
    ordinaryEffects[entry.GroupId] = {
      id: entry.Id,
      level: entry.Level,
      effects: entry.Effect,
      buffValueKeys: entry.BuffValueKey,
      buffPars: entry.BuffPar,
      icon: entry.IconNormal,
      unlockConsume: entry.UnlockConsume,
      fightValue: entry.FightValue ?? 0,
    };
  }

  // intermediateSlots は Id をキーとする (SeasonTalentTreeTable.GroupId = この Id)
  const intermediateSlots = {};
  for (const entry of Object.values(intermediateTable)) {
    intermediateSlots[entry.Id] = {
      factorTypes: entry.FactorType,
      professionIds: entry.ProfessionId,
      icon: entry.Icon,
    };
  }

  const advancedEffects = {};
  for (const entry of Object.values(advancedTable)) {
    advancedEffects[entry.Id] = {
      effectId: entry.EffectId,
      level: entry.Level,
      effects: entry.Effect,
      buffValueKeys: entry.BuffValueKey,
      buffPars: entry.BuffPar,
      icon: entry.Icon,
      unlockFraction: entry.UnlockFraction,
      fightValue: entry.FightValue ?? 0,
    };
  }

  const bondSlots = {};
  for (const entry of Object.values(holeTable)) {
    bondSlots[entry.Id] = {
      templateId: entry.TempId,
      slotIndex: entry.HoleId,
      unlockCondition: entry.UnlockCondition,
    };
  }

  return { templates, treeNodes, ordinaryEffects, intermediateSlots, advancedEffects, bondSlots };
}

// phantom-factors.json: 潜在心相晶に装着する幻影因子データ。
//   factorTypes[typeId]: タイプ名 (1=共通攻撃, 2=共通防御, 3=クラス攻撃, 4=クラス防御, 5=クラス狂想)
//   byClass[factorItemClass]:
//     typeId: FactorItemTypeId
//     professionIds: 対象クラス [] (空=全クラス共通)
//     grades: G1-G10 の効果配列 (FactorItemLevel 昇順)
//       { id, level, effects: [[effectType, buffId/attrId, param]], buffPars? }
//       effectType=1: ステータス加算 (attrId で直接参照, 13002=極性攻撃力, 13202=恒常性防御力等)
//       effectType=3: バフ効果 (buffId → BuffTable, クラス固有複雑効果)
//   FactorItemClass の命名規則: 200101-200811 がクラス別X1-X11, 200901-200911 が極性X1-X11,
//     201001-201011 が恒常性X1-X11 等
function extractPhantomFactors(langDir) {
  const typeTable = readTable(langDir, 'SeasonTalentFactorTypeTable');
  const factorTable = readTable(langDir, 'SeasonTalentFactorItemTable');
  const itemTable = readTable(langDir, 'ItemTable');

  const factorTypes = {};
  for (const entry of Object.values(typeTable)) {
    factorTypes[entry.Id] = entry.Name;
  }

  // ItemTable Id → Icon の高速ルックアップ
  const itemIconById = {};
  for (const entry of Object.values(itemTable)) {
    if (entry.Icon) itemIconById[entry.Id] = entry.Icon;
  }

  const byClass = {};
  const usedPhantomFactorItemIds = new Set();
  const usedPhantomFactorAttrIds = new Set();
  for (const entry of Object.values(factorTable)) {
    const cls = entry.FactorItemClass;
    if (!byClass[cls]) {
      byClass[cls] = {
        typeId: entry.FactorItemTypeId,
        professionIds: entry.ProfessionId,
        grades: [],
      };
    }
    usedPhantomFactorItemIds.add(entry.Id);
    for (const eff of entry.FactorItemEffect) {
      if (eff[0] === 1 && typeof eff[1] === 'number') usedPhantomFactorAttrIds.add(eff[1]);
    }
    byClass[cls].grades.push({
      id: entry.Id,
      level: entry.FactorItemLevel,
      effects: entry.FactorItemEffect,
      ...(entry.FactorItemPar.length > 0 ? { buffPars: entry.FactorItemPar } : {}),
      fightValue: entry.FightValue ?? 0,
    });
  }
  for (const cls of Object.values(byClass)) {
    cls.grades.sort((a, b) => a.level - b.level);
    // G1 アイテムのアイコンをクラスアイコンとして付与
    const g1Id = cls.grades[0]?.id;
    if (g1Id && itemIconById[g1Id]) cls.icon = itemIconById[g1Id];
  }

  return { factorTypes, byClass, usedPhantomFactorItemIds, usedPhantomFactorAttrIds };
}

// AttrDescription.json のテキストから表示名を抽出する。
// "幸運の一撃のダメージ+{*Decision.unmarkpercent(1)*}" → "幸運の一撃のダメージ"
// "ダメージ系のマスタリースキルが魔法増強を{*...*}上昇させる" → "ダメージ系のマスタリースキルが魔法増強を上昇させる"
function nameFromAttrDesc(description) {
  return description
    .replace(/[+]\{[^}]+\}.*$/s, '') // "+{*...*}" 以降を除去
    .replace(/\{[^}]+\}/g, '') // 残った "{*...*}" を除去
    .replace(/を上昇させる$/, 'を上昇させる') // "を上昇させる" は保持(末尾処理なし)
    .replace(/。\s*$/, '') // 末尾の。を除去
    .trim();
}

// 伝説刻印のtype=3効果ID(2400001/2400002)はどのテーブルにも名前がないため言語別にハードコード。
const LEGENDARY_SPECIAL_ATTR_NAMES = {
  japanese: { 2400001: '物理攻撃力ボーナス', 2400002: '魔法攻撃力ボーナス' },
  english: { 2400001: 'ATK Bonus', 2400002: 'MATK Bonus' },
};

// FightAttrTable.AttrAdd → 対応する ProfileAttrTable の display AttrId。
// ProfileAttrTable に直接エントリが存在しないフラット値AttrIdのために使用。
// 確認済みの対応: 11122→ファスト(11930), 11132→幸運(11780), 11142→器用さ(11940)
const FLAT_STAT_DISPLAY_ATTR_IDS = {
  11112: null,
  11122: 11930,
  11132: 11780,
  11142: 11940,
  11152: null,
};

function extractLocaleText(
  langDir,
  {
    classes,
    skillIds,
    equipmentByPart,
    equipAttrIds,
    fixedEvoAttrIds,
    legendaryAttrIds,
    enchantItemIds,
    enchantAttrIds,
    phantomFactorItemIds,
    phantomFactorAttrIds,
    talentAttrIds,
    battleImagineAttrIds,
    localeName,
  },
) {
  const itemTable = readTable(langDir, 'ItemTable');
  const equipWeaponTable = readTable(langDir, 'EquipWeaponTable');
  const skillTable = readTable(langDir, 'SkillTable');
  const professionSystemTable = readTable(langDir, 'ProfessionSystemTable');
  const equipPartTable = readTable(langDir, 'EquipPartTable');
  const profileAttrTable = readTable(langDir, 'ProfileAttrTable');
  const attrDescTable = readTable(langDir, 'AttrDescription');
  const fightAttrTable = readTable(langDir, 'FightAttrTable');
  // FightAttrTable: AttrAdd → OfficialName のマップ。
  // ProfileAttrTable / AttrDescription に存在しない AttrId (11112=会心, 11152=万能 等) の
  // フォールバックとして使用する。
  const fightAttrNameByAdd = new Map(
    Object.values(fightAttrTable)
      .filter((e) => e.AttrAdd && e.OfficialName)
      .map((e) => [e.AttrAdd, e.OfficialName]),
  );

  const items = {};
  for (const part of Object.values(equipmentByPart)) {
    for (const [id, itemData] of Object.entries(part)) {
      const numId = Number(id);
      // BT 合成アイテム (synId >= 8000000): btGroupId のベース装備と同じ名称・説明を使用する。
      if (numId >= 8000000) {
        const baseId = String(itemData.btGroupId);
        const baseItemEntry = itemTable[baseId];
        const baseWeaponEntry = equipWeaponTable[baseId];
        items[id] = {
          name: baseItemEntry?.Name ?? '',
          description: baseItemEntry?.Description || '',
          flavorText: baseItemEntry?.Description2 || '',
          ...(baseWeaponEntry ? { weaponName: baseWeaponEntry.Name } : {}),
        };
        continue;
      }
      const itemEntry = itemTable[id];
      const weaponEntry = equipWeaponTable[id];
      items[id] = {
        name: itemEntry.Name,
        description: itemEntry.Description || '',
        flavorText: itemEntry.Description2 || '',
        ...(weaponEntry ? { weaponName: weaponEntry.Name } : {}),
      };
    }
  }

  // 装着効果アイテム(宝石/刻印)の名前を items セクションに追加
  for (const id of enchantItemIds) {
    if (items[String(id)]) continue; // 装備IDと重複する場合は上書きしない
    const itemEntry = itemTable[String(id)];
    if (itemEntry) {
      items[String(id)] = { name: itemEntry.Name, description: itemEntry.Description || '' };
    }
  }

  // 幻影因子アイテムの名前/説明を items セクションに追加 (IDs 20010001+)
  for (const id of phantomFactorItemIds) {
    if (items[String(id)]) continue;
    const itemEntry = itemTable[String(id)];
    if (itemEntry) {
      items[String(id)] = { name: itemEntry.Name, description: itemEntry.Description || '' };
    }
  }

  const bdTagTable = readTable(langDir, 'BdTagTable');
  const skillEffectTable = readTable(langDir, 'SkillEffectTable');

  // スキルのタグ表示(skillLabel): EffectIDs→SkillEffectTable.Tags→BdTagTable.TagName を
  // Tags配列の順序で必要な数だけ解決する。
  function resolveSkillLabel(effectIds) {
    if (!effectIds?.length) return [];
    const tagIds = [];
    const seen = new Set();
    for (const effectId of effectIds) {
      for (const tagId of skillEffectTable[String(effectId)]?.Tags ?? []) {
        if (!seen.has(tagId)) {
          seen.add(tagId);
          tagIds.push(tagId);
        }
      }
    }
    return tagIds.map((tagId) => bdTagTable[String(tagId)]?.TagName).filter(Boolean);
  }

  const skills = {};
  for (const id of skillIds) {
    const entry = skillTable[String(id)];
    if (!entry) continue;
    const skillLabel = resolveSkillLabel(entry.EffectIDs);
    skills[id] = {
      name: entry.Name,
      description: entry.Desc || '',
      ...(skillLabel.length > 0 ? { skillLabel } : {}),
    };
  }

  const classText = {};
  for (const id of Object.keys(classes)) {
    const entry = professionSystemTable[id];
    if (!entry) continue;
    classText[id] = { name: entry.Name, intro: entry.Intro || '' };
  }

  const parts = {};
  for (const part of Object.values(equipPartTable)) {
    parts[part.Id] = part.PartName;
  }

  const attributes = {};
  for (const attr of Object.values(profileAttrTable)) {
    attributes[attr.AttrId] = attr.Name;
  }
  // EquipAttrLibTable や EquipRefineTable が使う AttrId (末尾2) は
  // ProfileAttrTable に存在しない。対応する末尾0エントリの名前をエイリアスとして追加。
  // 例: 11442(幻夢強度)→11440, 11332(物理攻撃力)→11330, 11042(耐久力)→11040
  const attrByAttrId = Object.fromEntries(
    Object.values(profileAttrTable).map((e) => [e.AttrId, e]),
  );
  // 精錬系の固定エイリアス
  for (const [bonusId, displayId] of [
    [11412, 11410],
    [11422, 11420],
    [11432, 11430],
  ]) {
    if (!attributes[bonusId] && attrByAttrId[displayId]) {
      attributes[bonusId] = attrByAttrId[displayId].Name;
    }
  }
  // 装備基礎ステータス系 (EquipAttrLibTableで実際に使われたAttrId) を自動追加
  for (const attrId of equipAttrIds) {
    if (!attributes[attrId] && attrByAttrId[attrId - 2]) {
      attributes[attrId] = attrByAttrId[attrId - 2].Name;
    }
  }
  // 固定進化ステータス系 AttrId の名前を解決して追加。
  // 解決優先順位:
  //   1. 既存エントリ (ProfileAttrTable 直接)
  //   2. 標準エイリアス (attrId-2 → ProfileAttrTable)
  //   3. フラット値エイリアス (FLAT_STAT_DISPLAY_ATTR_IDS → ProfileAttrTable)
  //   4. AttrDescription.json の表示名(type=3 特殊効果)
  const attrDescById = Object.fromEntries(Object.values(attrDescTable).map((e) => [e.Id, e]));
  for (const attrId of fixedEvoAttrIds) {
    if (attributes[attrId]) continue;
    if (attrByAttrId[attrId - 2]) {
      attributes[attrId] = attrByAttrId[attrId - 2].Name;
    } else if (
      FLAT_STAT_DISPLAY_ATTR_IDS[attrId] &&
      attrByAttrId[FLAT_STAT_DISPLAY_ATTR_IDS[attrId]]
    ) {
      attributes[attrId] = attrByAttrId[FLAT_STAT_DISPLAY_ATTR_IDS[attrId]].Name;
    } else if (attrDescById[attrId]) {
      attributes[attrId] = nameFromAttrDesc(attrDescById[attrId].Description);
    } else if (fightAttrNameByAdd.has(attrId)) {
      // ProfileAttrTable / AttrDescription 両方に存在しない AttrId は FightAttrTable の
      // OfficialName をフォールバックとして使用する (11112=会心, 11152=万能 等)。
      attributes[attrId] = fightAttrNameByAdd.get(attrId);
    }
  }
  // 基礎ステータス系 AttrId も同様にフォールバック解決を試みる。
  for (const attrId of equipAttrIds) {
    if (attributes[attrId]) continue;
    if (fightAttrNameByAdd.has(attrId)) {
      attributes[attrId] = fightAttrNameByAdd.get(attrId);
    }
  }
  // 伝説刻印 AttrId の名前を解決して追加。
  // x14 系 (11014/11024/11034): attrId-2 が ProfileAttrTable に存在。
  // x34 系 (11334/11344): attrId-4 が ProfileAttrTable に存在。
  // type=3 効果ID (2400001/2400002): テーブルに存在しないためハードコード名を使用。
  for (const attrId of legendaryAttrIds) {
    if (attributes[attrId]) continue;
    if (attrByAttrId[attrId - 2]) {
      attributes[attrId] = attrByAttrId[attrId - 2].Name;
    } else if (attrByAttrId[attrId - 4]) {
      attributes[attrId] = attrByAttrId[attrId - 4].Name;
    } else if (fightAttrNameByAdd.has(attrId)) {
      attributes[attrId] = fightAttrNameByAdd.get(attrId);
    }
  }
  // type=3 刻印効果IDのハードコード名 (2400001/2400002)
  const specialNames = LEGENDARY_SPECIAL_ATTR_NAMES[localeName] ?? {};
  for (const [id, name] of Object.entries(specialNames)) {
    if (!attributes[Number(id)]) attributes[Number(id)] = name;
  }
  // 装着効果(宝石/刻印)で使われる AttrId の名前を解決して追加。
  for (const attrId of enchantAttrIds) {
    if (attributes[attrId]) continue;
    if (attrByAttrId[attrId - 2]) {
      attributes[attrId] = attrByAttrId[attrId - 2].Name;
    } else if (
      FLAT_STAT_DISPLAY_ATTR_IDS[attrId] &&
      attrByAttrId[FLAT_STAT_DISPLAY_ATTR_IDS[attrId]]
    ) {
      attributes[attrId] = attrByAttrId[FLAT_STAT_DISPLAY_ATTR_IDS[attrId]].Name;
    } else if (fightAttrNameByAdd.has(attrId)) {
      attributes[attrId] = fightAttrNameByAdd.get(attrId);
    } else if (attrDescById[attrId]) {
      attributes[attrId] = nameFromAttrDesc(attrDescById[attrId].Description);
    }
  }
  // 武器熟練ツリー statボーナス AttrId の解決 (Type=1 効果の attrId)
  for (const attrId of talentAttrIds) {
    if (attributes[attrId]) continue;
    if (attrByAttrId[attrId]) {
      attributes[attrId] = attrByAttrId[attrId].Name;
    } else if (attrByAttrId[attrId - 2]) {
      attributes[attrId] = attrByAttrId[attrId - 2].Name;
    } else if (fightAttrNameByAdd.has(attrId)) {
      attributes[attrId] = fightAttrNameByAdd.get(attrId);
    }
  }
  // 幻影因子 stat AttrId の解決 (極性=13002, 恒常性=13202, 11044=耐久力% 等)
  // 解決順: ProfileAttrTable直接 → attrId-2 → attrId-4 (% ボーナス系) → FightAttrTable
  for (const attrId of phantomFactorAttrIds) {
    if (attributes[attrId]) continue;
    if (attrByAttrId[attrId]) {
      attributes[attrId] = attrByAttrId[attrId].Name;
    } else if (attrByAttrId[attrId - 2]) {
      attributes[attrId] = attrByAttrId[attrId - 2].Name;
    } else if (attrByAttrId[attrId - 4]) {
      attributes[attrId] = attrByAttrId[attrId - 4].Name;
    } else if (fightAttrNameByAdd.has(attrId)) {
      attributes[attrId] = fightAttrNameByAdd.get(attrId);
    } else {
      console.warn(`[extract-ztable] no attribute name for phantom factor attrId ${attrId}`);
    }
  }
  // バトルイマジン パッシブ効果 AttrId の解決 (13152=風属性ボーナス 等、末尾2桁のみ
  // 定義されテーブルに存在しないケースがある)。
  // 解決順: ProfileAttrTable直接 → attrId-2 → attrId-4 → FightAttrTable
  for (const attrId of battleImagineAttrIds) {
    if (attributes[attrId]) continue;
    if (attrByAttrId[attrId]) {
      attributes[attrId] = attrByAttrId[attrId].Name;
    } else if (attrByAttrId[attrId - 2]) {
      attributes[attrId] = attrByAttrId[attrId - 2].Name;
    } else if (attrByAttrId[attrId - 4]) {
      attributes[attrId] = attrByAttrId[attrId - 4].Name;
    } else if (fightAttrNameByAdd.has(attrId)) {
      attributes[attrId] = fightAttrNameByAdd.get(attrId);
    } else {
      console.warn(`[extract-ztable] no attribute name for battle imagine attrId ${attrId}`);
    }
  }

  // talents: TalentTable の名前と説明文。
  //   type=1 (stat bonus): attrId→名前を解決し "名前 +val" 形式で生成。ただしattrIdが
  //     "%final"系バリアント(平坦statの"+2"IDが多いが例外もある。単位はいずれも1/10000)の
  //     場合は "名前 +val/100%" 形式で生成する:
  //     - 11324/11334/11344/11354: src/build-planner/stats/attrMaps.ts の IMAGINE_PCT_FINAL と
  //       同じID(例: ヘヴィガーディアン「癒しの砂」attrId 11324→最大HP、value 1000→+10%)
  //     - 11722: 攻撃速度の%final variant(例: ディバインアーチャー「迅射」、value 300→+3%。
  //       誤って"攻撃速度 +300"と表示されていたバグ報告により追加)
  //   type=3 (buff効果): AttrDescription[buffId].Description を使用（TalentDesは中国語プレースホルダ）
  //   type=4 (条件ボーナス): TalentDes を使用。type=1と併用時はtype1Descsの後にTalentDesを
  //     追記する(例: シールドファイター/ヘヴィガーディアン「筋力変換」talentId 901/1206:
  //     [[1,11352,3300],[4,0,11352,6667]] → "物理防御 +3300<br><br>筋力3ptにつき物理防御力+2pt。"。
  //     type=1のみを見て早期returnすると、TalentDes側にしかない変換率の説明が欠落するため)
  //   type=6 (スキル置換): TalentDes を使用。同時にtype=3がある場合はADを結合
  const TALENT_DES_PLACEHOLDER = '力量+10';
  // "%final"系バリアントのattrId集合(型番の末尾が4のIDが多いが11722のように例外もある)。
  const FINAL_PCT_ATTR_IDS = new Set([11324, 11334, 11344, 11354, 11722]);
  const talentTable = readTable(langDir, 'TalentTable');
  // attrId → 表示名の解決（ProfileAttrTable + FightAttrTable + attributes[] fallback）
  function resolveAttrName(attrId) {
    return (
      attrByAttrId[attrId]?.Name ||
      attrByAttrId[attrId - 2]?.Name ||
      fightAttrNameByAdd.get(attrId) ||
      attributes[attrId] ||
      String(attrId)
    );
  }
  const talents = {};
  for (const entry of Object.values(talentTable)) {
    const effects = entry.TalentEffect || [];
    const hasType4 = effects.some((e) => e[0] === 4);
    const hasType6 = effects.some((e) => e[0] === 6);
    const type3Descs = effects
      .filter((e) => e[0] === 3)
      .map((e) => attrDescTable[String(e[1])]?.Description || '')
      .filter((d) => d.length > 0);
    const type1Descs = effects
      .filter((e) => e[0] === 1)
      .map((e) =>
        FINAL_PCT_ATTR_IDS.has(e[1])
          ? `${resolveAttrName(e[1])} +${e[2] / 100}%`
          : `${resolveAttrName(e[1])} +${e[2]}`,
      );
    const talentDes =
      entry.TalentDes && entry.TalentDes !== TALENT_DES_PLACEHOLDER ? entry.TalentDes : '';
    let des = '';
    if (hasType6) {
      des =
        type3Descs.length > 0
          ? [talentDes, ...type3Descs].filter(Boolean).join('<br><br>')
          : talentDes;
    } else if (type3Descs.length > 0) {
      des = type3Descs.join('<br><br>');
    } else if (type1Descs.length > 0) {
      des =
        hasType4 && talentDes
          ? [type1Descs.join('<br>'), talentDes].join('<br><br>')
          : type1Descs.join('<br>');
    } else {
      des = talentDes;
    }
    talents[entry.Id] = {
      name: entry.TalentName,
      ...(des ? { description: des } : {}),
    };
  }

  // seasonTalents: SeasonTalentTemplateTable と SeasonTalentEffectOrdinaryTable の名前。
  //   templates[id]: 心相晶の名称
  //   ordinaryEffects[groupId]: 通常ノードの名称
  //   advancedEffects[id]: 高級ノードの名称
  //   intermediateSlots[id]: 幻影スロットの表示名 (共通攻撃/クラス攻撃等)
  //   bondSlots[id]: 絆スロット名 (絆スロット1/2/...)
  const stTemplateTable = readTable(langDir, 'SeasonTalentTemplateTable');
  const stOrdinaryTable = readTable(langDir, 'SeasonTalentEffectOrdinaryTable');
  const stAdvancedTable = readTable(langDir, 'SeasonTalentEffectAdvancedTable');
  const stIntermediateTable = readTable(langDir, 'SeasonTalentEffectIntermediateTable');
  const stHoleTable = readTable(langDir, 'SeasonTalentAdvancedHoleTable');
  const seasonTalents = {
    templates: Object.fromEntries(
      Object.values(stTemplateTable).map((e) => [e.Id, e.TemplateName]),
    ),
    ordinaryEffects: Object.fromEntries(
      Object.values(stOrdinaryTable).map((e) => [e.GroupId, e.Name]),
    ),
    advancedEffects: Object.fromEntries(Object.values(stAdvancedTable).map((e) => [e.Id, e.Name])),
    intermediateSlots: Object.fromEntries(
      Object.values(stIntermediateTable).map((e) => [e.Id, e.Name]),
    ),
    bondSlots: Object.fromEntries(Object.values(stHoleTable).map((e) => [e.Id, e.Name])),
  };

  // battleImagines: SkillAoyiTable の名称・台詞 と SkillTable[aoyiId] のアクティブ効果説明。
  // ItemTable[AoyiItemId].Description はアクティブスキル説明が不正確なため使用しない。
  // passiveBufDescriptions: type=3 バフ効果のテンプレートにパラメータを代入した文字列(ランク別)。
  // activeEffectParams: SkillEffectTable.SkillAttrDes のラベルとランク別(G0-G5)解決済み値ペア。
  //   format: [[label, [r0val, r1val, r2val, r3val, r4val, r5val]], ...]
  //   ランク非依存の値("15秒"等)は全6要素が同一文字列となる。
  const aoyiTable = readTable(langDir, 'SkillAoyiTable');
  const aoyiStarTableForLocale = readTable(langDir, 'SkillAoyiStarTable');
  const damageAttrTable = readTable(langDir, 'DamageAttrTable');
  const skillFightLvlTable = readTable(langDir, 'SkillFightLevelTable');

  // Build per-rank BuffPar map: aoyiId -> level(1-5) -> number[]
  const aoyiRankBufPar = {};
  // Build per-rank FloatParameter map: aoyiId -> level(1-5) -> { key: number }
  const aoyiRankFloatPar = {};
  for (const entry of Object.values(aoyiStarTableForLocale)) {
    (aoyiRankBufPar[entry.SkillId] ??= {})[entry.Level] = entry.BuffPar?.[0] ?? [];
    const floatMap = Object.fromEntries(
      (entry.FloatParameter || []).map(([k, v]) => [k, Number(v)]),
    );
    (aoyiRankFloatPar[entry.SkillId] ??= {})[entry.Level] = floatMap;
  }

  // Build effectId -> base FloatParameter map from SkillFightLevelTable
  const fightLvlFloatPar = {};
  // Build aoyiSkillId -> PVECoolTime map for リキャスト display
  const pveCoolTimeBySkillId = {};
  for (const entry of Object.values(skillFightLvlTable)) {
    fightLvlFloatPar[entry.Id] = Object.fromEntries(
      (entry.FloatParameter || []).map(([k, v]) => [k, Number(v)]),
    );
    if (entry.SkillId && entry.PVECoolTime > 0)
      pveCoolTimeBySkillId[entry.SkillId] = entry.PVECoolTime;
  }

  // Build SkillId -> first SkillEffectTable entry map
  const skillEffectBySkillId = {};
  for (const entry of Object.values(skillEffectTable)) {
    if (!skillEffectBySkillId[entry.SkillId]) skillEffectBySkillId[entry.SkillId] = entry;
  }

  // Substitute {*Decision.fn(N)*} placeholders with computed values from params array
  function substituteBuffParams(template, params) {
    return template.replace(/\{\*Decision\.(\w+)\((\d+)\)\*\}/g, (_, fnName, idxStr) => {
      const val = params[parseInt(idxStr) - 1];
      if (val == null) return '';
      if (fnName === 'unmarkpercent') {
        const pct = val / 100;
        const str = pct % 1 === 0 ? String(Math.round(pct)) : String(parseFloat(pct.toFixed(2)));
        return str + '%';
      }
      if (fnName === 'unmarktime') {
        const secs = val / 1000;
        return secs % 1 === 0 ? String(secs) : String(parseFloat(secs.toFixed(1)));
      }
      return String(val); // unmarknormal etc.
    });
  }

  // Resolve skill formula tokens in a SkillAttrDes value string.
  // rank: 0-5, aoyiId: for FloatParameter rank increments, effectId: for base FloatParameter.
  function resolveSkillAttrDesValue(formula, rank, aoyiId, effectId) {
    let result = formula;
    // {*skillpara.damageMerge({ids},{N},"field","format")*}
    // PVEDamageRadio has one entry per rank (index 0=G0..5=G5).
    result = result.replace(
      /\{\*skillpara\.damageMerge\(\{([^}]+)\},\{[^}]+\},"([^"]+)","([^"]+)"\)\*\}/g,
      (_, idsStr, fieldName, format) => {
        const ids = idsStr.split(',').map((s) => s.trim());
        let total = 0;
        for (const id of ids) {
          const entry = damageAttrTable[id];
          if (!entry) continue;
          const arr = entry[fieldName];
          if (Array.isArray(arr) && arr.length > 0) {
            total += arr[Math.min(rank, arr.length - 1)];
          } else if (typeof arr === 'number') {
            total += arr;
          }
        }
        if (format === 'up') return `${Math.round(total / 100)}%`;
        return String(total);
      },
    );
    // {*skillpara.effect("key","format")*}
    // value = SkillFightLevelTable[effectId].FloatParameter["key"]
    //       + SkillAoyiStarTable[aoyiId][rank].FloatParameter["key"]  (rank>0 のみ)
    result = result.replace(
      /\{\*skillpara\.effect\("([^"]+)","([^"]+)"\)\*\}/g,
      (_, key, format) => {
        const base = fightLvlFloatPar[String(effectId)]?.[key] ?? 0;
        const increment = rank > 0 ? (aoyiRankFloatPar[aoyiId]?.[rank]?.[key] ?? 0) : 0;
        const total = base + increment;
        if (format === 'up') {
          const pct = total / 100;
          return (
            (pct % 1 === 0 ? String(Math.round(pct)) : String(parseFloat(pct.toFixed(2)))) + '%'
          );
        }
        return String(total);
      },
    );
    return result.replace(/<br>/gi, ' ').trim();
  }

  const battleImagines = {};
  for (const entry of Object.values(aoyiTable)) {
    const sk = skillTable[String(entry.Id)];
    const r0Params = entry.BuffPar?.[0] ?? [];
    const rankBufPar = aoyiRankBufPar[entry.Id] ?? {};

    // type=3 passive effects: pre-render description per rank (0-5)
    const r0Type3 = (entry.TransformationType || []).filter(([t]) => t === 3);
    const passiveBufDescriptions = r0Type3
      .map(([, buffId]) => {
        const template = attrDescTable[String(buffId)]?.Description || '';
        if (!template) return null;
        const rendered = [];
        for (let rank = 0; rank <= 5; rank++) {
          const params = rank === 0 ? r0Params : (rankBufPar[rank] ?? r0Params);
          rendered.push(substituteBuffParams(template, params));
        }
        return rendered;
      })
      .filter(Boolean);

    // activeEffectParams: label + per-rank values from SkillEffectTable.SkillAttrDes
    // [[label, [r0val, r1val, r2val, r3val, r4val, r5val]], ...]
    const effectEntry = skillEffectBySkillId[entry.Id];
    const activeEffectParams = [];
    if (effectEntry?.SkillAttrDes) {
      for (const [label, formula] of effectEntry.SkillAttrDes) {
        if (!label) continue;
        if (!formula) {
          const coolTime = pveCoolTimeBySkillId[entry.Id];
          const val = coolTime ? `${coolTime}秒` : '';
          activeEffectParams.push([label, [val, val, val, val, val, val]]);
        } else {
          const vals = [];
          for (let rank = 0; rank <= 5; rank++) {
            vals.push(resolveSkillAttrDesValue(formula, rank, entry.Id, effectEntry.Id));
          }
          activeEffectParams.push([label, vals]);
        }
      }
    }

    const imagineSkillLabel = resolveSkillLabel(sk?.EffectIDs);

    battleImagines[entry.Id] = {
      name: entry.ResonanceObject,
      dialogue: entry.Dialogue || '',
      ...(sk?.Name ? { activeSkillName: sk.Name } : {}),
      ...(sk?.Desc ? { description: sk.Desc } : {}),
      ...(passiveBufDescriptions.length > 0 ? { passiveBufDescriptions } : {}),
      ...(activeEffectParams.length > 0 ? { activeEffectParams } : {}),
      ...(imagineSkillLabel.length > 0 ? { skillLabel: imagineSkillLabel } : {}),
    };
  }

  // uiLabels: FunctionTable 内のゲーム公式 UI ラベル。
  // ビルドプランナー側の手動翻訳 (bpsr-bp-ui.json) の代わりに、翻訳済みゲームデータを
  // 直接参照することで翻訳漏れ・表記揺れを防ぐ。
  const UI_LABEL_FUNC_IDS = {
    talentTab: 104200, // "アビリティ" / "Talents"
    skillTab: 200500, // "スキル" / "Skills"
    normalSkill: 200502, // "一般スキル" / "Normal Skill"
    roleSkill: 200503, // "ロールスキル" / "Role skills"
    battleImagine: 200501, // "バトルイマジン" / "Battle Imagine"
  };
  const funcTable = readTable(langDir, 'FunctionTable');
  const funcById = {};
  for (const item of Object.values(funcTable)) funcById[item.Id] = item;
  const uiLabels = {};
  for (const [key, id] of Object.entries(UI_LABEL_FUNC_IDS)) {
    uiLabels[key] = funcById[id]?.Name ?? '';
  }
  // GuideNewReturnTable ID4 → talent points label ("アビリティポイント" / "Talent Points")
  const guideNewReturnTable = readTable(langDir, 'GuideNewReturnTable');
  const guideArr = Array.isArray(guideNewReturnTable)
    ? guideNewReturnTable
    : Object.values(guideNewReturnTable);
  uiLabels.talentPoints = guideArr.find((x) => x.Id === 4)?.Title ?? '';

  // talentStages: TalentStageTable の名称 (ステージ名・型名)。
  // talent-tree.json (構造データ) から分離し、言語別の表示名としてここに格納する。
  const stageTableForLocale = readTable(langDir, 'TalentStageTable');
  const talentStages = {};
  for (const entry of Object.values(stageTableForLocale)) {
    const names = Array.isArray(entry.Name) ? entry.Name.filter(Boolean) : [];
    talentStages[entry.Id] = {
      stageName: names[0] ?? null, // "クラスR1" / "Expertise I"
      typeName: names[1] ?? null, // "雷刃型" / "Iaido Slash Spec"
    };
  }

  // moduleEffects: ModEffectTable の EffectID → EffectName (ロケール別)
  const modEffectTableLocale = readTable(langDir, 'ModEffectTable');
  const moduleEffects = {};
  for (const entry of Object.values(modEffectTableLocale)) {
    if (!moduleEffects[entry.EffectID] && entry.EffectName) {
      moduleEffects[entry.EffectID] = entry.EffectName;
    }
  }

  // attrDescs: AttrDescription + TempAttrTable から effectType=3/5 用の説明テンプレート
  // テンプレート形式: {*Decision.unmarkpercent(N)*} → {pN}, {*tempAttr.un*} → {v}
  const attrDescs = {};
  try {
    const attrDescTable = readTable(langDir, 'AttrDescription');
    const attrDescData = Array.isArray(attrDescTable)
      ? attrDescTable
      : Object.values(attrDescTable);
    for (const e of attrDescData) {
      if (e.Id && e.Description) {
        attrDescs[String(e.Id)] = e.Description.replace(
          /\{[*]Decision\.unmarkpercent\((\d+)\)[*]\}/g,
          '{p$1}',
        )
          .replace(/<br>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
    }
  } catch (_) {}
  try {
    const tempAttrTable = readTable(langDir, 'TempAttrTable');
    const tempAttrData = Array.isArray(tempAttrTable)
      ? tempAttrTable
      : Object.values(tempAttrTable);
    for (const e of tempAttrData) {
      if (e.Id && e.AttrDesc) {
        attrDescs[String(e.Id)] = e.AttrDesc.replace(/\{[*]tempAttr\.un[*]\}/g, '{v}').trim();
      }
    }
  } catch (_) {}

  return {
    items,
    skills,
    classes: classText,
    parts,
    attributes,
    talents,
    seasonTalents,
    battleImagines,
    uiLabels,
    talentStages,
    moduleEffects,
    attrDescs,
  };
}

// player-levels.json: 冒険者レベル / シーズンレベル データ
//   levels[]: { level, exp, levelUpAttr[[attrId,val],...], fightValue, nacsStandard[[catId,val],...] }
//     levelUpAttr: そのレベルで加算されるステータス (11012=筋力, 11022=知力, 11032=俊敏, 11042=耐久力)
//     fightValue:  そのレベルで加算される能力スコア
//     nacsStandard: 能力スコア計算のカテゴリ別基準値 (AssessModuleTable IDをキーに各カテゴリの標準値)
//   season: { count, levelUpAttr, fightValue, expNum }
//     全シーズンレベルで共通の値 (uniformなため1エントリのみ保持)
//   skillUnlocks[]: { buffId, buffName, activeLevel }
//     レベルで解放されるアクション/スキル
function extractPlayerLevels(langDir) {
  const playerLevelTable = readTable(langDir, 'PlayerLevelTable');
  const seasonLevelTable = readTable(langDir, 'SeasonLevelTable');
  const playerLevelSkillTable = readTable(langDir, 'PlayerLevelSkillTable');

  const levels = Object.values(playerLevelTable)
    .sort((a, b) => a.Level - b.Level)
    .map((entry) => ({
      level: entry.Level,
      exp: entry.Exp,
      levelUpAttr: entry.LevelUpAttr ?? [],
      fightValue: entry.FightValue ?? 0,
      nacsStandard: entry.NacsStandard ?? [],
    }));

  // SeasonLevelTable は全レベルで同一値のため代表値のみ保持
  const seasonSample = Object.values(seasonLevelTable)[0] ?? {};
  const season = {
    count: Object.keys(seasonLevelTable).length,
    levelUpAttr: seasonSample.SeasonLevelUpAttr ?? [],
    fightValue: seasonSample.SeasonFightValue ?? 0,
    expNum: seasonSample.SeasonExpNum ?? 0,
  };

  const skillUnlocks = Object.values(playerLevelSkillTable)
    .sort((a, b) => a.ActiveLevel - b.ActiveLevel)
    .map((entry) => ({
      buffId: entry.BuffId,
      buffName: entry.BuffName,
      activeLevel: entry.ActiveLevel,
    }));

  return { levels, season, skillUnlocks };
}

// modules.json: モジュールシステム (ModTable, ModEffectLibTable, ModEffectTable, ModLinkEffectTable)
//   mods: モジュール一覧 { id, modType, quality(1-4), holes }
//   effectsByType: modType → 選択可能エフェクトID配列 (ModEffectLibTable.EffectConfig の重複なし順序)
//   effects: エフェクトID → { icon, levels: [[fightValue, enhancementNum, config], ...] }
//     config: [[effectType, attrId, value], ...]  (EffectType=1=フラット加算, 3=バフ, 5=その他)
//     levels[0] = Level=0 (未選択/効果なし), levels[1-6] が有効レベル
//   linkEffects: [[linkTime, fightValue, effects], ...] (ModLinkEffectTable, LinkTime昇順)
//     同じエフェクトをホール間でスタックした場合のグローバルボーナス。EffectType=1 が主体。
function extractModules(langDir) {
  const modTable = readTable(langDir, 'ModTable');
  const modEffectLibTable = readTable(langDir, 'ModEffectLibTable');
  const modEffectTable = readTable(langDir, 'ModEffectTable');
  const modLinkEffectTable = readTable(langDir, 'ModLinkEffectTable');

  // libId → effectId 一覧マップ
  const libEffectMap = {};
  for (const entry of Object.values(modEffectLibTable)) {
    (libEffectMap[entry.EffectLibID] ??= []).push(entry.EffectConfig);
  }

  // モジュール種別ごとにID昇順でソートしてクオリティ(1-4)を割り当て
  const modsByType = {};
  for (const entry of Object.values(modTable)) {
    if (entry.ModType > 3) continue;
    (modsByType[entry.ModType] ??= []).push(entry);
  }

  const mods = [];
  const effectsByType = {};
  for (const [modTypeStr, entries] of Object.entries(modsByType)) {
    const modType = Number(modTypeStr);
    entries.sort((a, b) => a.Id - b.Id);
    const seen = new Set();
    const typeEffectList = [];
    entries.forEach((entry, i) => {
      const holesCount = entry.EffectLibId.length > 0 ? entry.EffectLibId.length : 1;
      mods.push({ id: entry.Id, modType, quality: i + 1, holes: holesCount });
      for (const libId of entry.EffectLibId) {
        for (const effectId of libEffectMap[libId] ?? []) {
          if (!seen.has(effectId)) {
            seen.add(effectId);
            typeEffectList.push(effectId);
          }
        }
      }
    });
    effectsByType[modType] = typeEffectList;
  }
  mods.sort((a, b) => a.modType - b.modType || a.quality - b.quality);

  // エフェクトデータ (levels[Level] = [fightValue, enhancementNum, config])
  const effects = {};
  for (const entry of Object.values(modEffectTable)) {
    if (!effects[entry.EffectID]) {
      effects[entry.EffectID] = {
        icon: (entry.EffectConfigIcon || '').split('/').pop() || '',
        levels: [],
      };
    }
    effects[entry.EffectID].levels[entry.Level] = [
      entry.FightValue ?? 0,
      entry.EnhancementNum ?? 0,
      entry.EffectConfig ?? [],
      entry.EffectValue?.[0] ?? [], // effectType=3 説明テンプレートのパラメータ
    ];
  }

  // リンクエフェクト (LinkTime昇順)
  const linkEffects = Object.values(modLinkEffectTable)
    .sort((a, b) => a.LinkTime - b.LinkTime)
    .map((e) => [e.LinkTime, e.FightValue ?? 0, e.LinkLevelEffect ?? []]);

  // クラス×ビルドタイプ別パワーコア推奨エフェクト (TalentStageTable.RecommendModEffectId)
  // key: weaponType(=professionId), value: { "0": effectIds(BdType=0), "1": effectIds(BdType=1) }
  // TalentStage=1 のみ使用（R2以降の確定した推奨設定）
  const talentStageTable = readTable(langDir, 'TalentStageTable');
  const recommendedEffects = {};
  for (const entry of Object.values(talentStageTable)) {
    if (entry.TalentStage !== 1) continue;
    const ids = entry.RecommendModEffectId ?? [];
    if (ids.length === 0) continue;
    const wt = String(entry.WeaponType);
    const bd = String(entry.BdType);
    if (!recommendedEffects[wt]) recommendedEffects[wt] = {};
    recommendedEffects[wt][bd] = ids;
  }

  return { mods, effectsByType, effects, linkEffects, recommendedEffects };
}

function main() {
  const { src, dataOut, localesOut } = parseArgs(process.argv.slice(2));

  const structuralDir = join(src, STRUCTURAL_LANG_DIR);
  if (!existsSync(structuralDir)) {
    console.error(`[extract-ztable] structural source dir not found: ${structuralDir}`);
    process.exitCode = 1;
    return;
  }

  const suitsData = extractSuits(structuralDir);
  const suitsPath = writeJson(dataOut, 'suits.json', suitsData);
  console.log(
    `[extract-ztable] wrote suits.json (${Object.keys(suitsData).length} suits) to ${suitsPath}`,
  );

  const classes = extractClasses(structuralDir);
  const skillIds = collectReferencedSkillIds(classes, structuralDir);
  const skills = extractSkills(structuralDir, skillIds);
  const skillFightValues = extractSkillFightValues(structuralDir, skillIds);
  const skillRankFightValues = extractSkillRankFightValues(structuralDir, skillIds);
  const { battleImagines, usedBattleImagineAttrIds } = extractBattleImagines(structuralDir);
  const {
    byPart: equipmentByPart,
    usedAttrIds: equipAttrIds,
    usedFixedEvoAttrIds: fixedEvoAttrIds,
    usedLegendaryAttrIds: legendaryAttrIds,
  } = extractEquipment(structuralDir);
  const refineData = extractRefineData(structuralDir);
  const {
    enchantSets,
    usedEnchantItemIds: enchantItemIds,
    usedEnchantAttrIds: enchantAttrIds,
  } = extractEnchants(structuralDir);
  const {
    nodes: talentNodes,
    stagesByWeaponType,
    treeNodesByWeaponType,
    usedTalentAttrIds: talentAttrIds,
  } = extractTalentTree(structuralDir);
  const seasonTalentsData = extractSeasonTalents(structuralDir);
  const {
    factorTypes,
    byClass: phantomFactorsByClass,
    usedPhantomFactorItemIds: phantomFactorItemIds,
    usedPhantomFactorAttrIds: phantomFactorAttrIds,
  } = extractPhantomFactors(structuralDir);

  const modulesData = extractModules(structuralDir);
  const modulesPath = writeJson(dataOut, 'modules.json', modulesData);
  console.log(
    `[extract-ztable] wrote modules.json (${modulesData.mods.length} mods, ${Object.keys(modulesData.effects).length} effects) to ${modulesPath}`,
  );

  const playerLevelsData = extractPlayerLevels(structuralDir);
  const playerLevelsPath = writeJson(dataOut, 'player-levels.json', playerLevelsData);
  console.log(
    `[extract-ztable] wrote player-levels.json (${playerLevelsData.levels.length} levels, season x${playerLevelsData.season.count}, ${playerLevelsData.skillUnlocks.length} skill unlocks) to ${playerLevelsPath}`,
  );

  const classesPath = writeJson(dataOut, 'classes.json', classes);
  console.log(`[extract-ztable] wrote ${Object.keys(classes).length} classes to ${classesPath}`);

  const skillsPath = writeJson(dataOut, 'skills.json', skills);
  console.log(`[extract-ztable] wrote ${Object.keys(skills).length} skills to ${skillsPath}`);

  const skillFightValuesPath = writeJson(dataOut, 'skill-fight-values.json', skillFightValues);
  console.log(
    `[extract-ztable] wrote skill-fight-values.json (${Object.keys(skillFightValues).length} skills) to ${skillFightValuesPath}`,
  );

  const skillRankFightValuesPath = writeJson(
    dataOut,
    'skill-rank-fight-values.json',
    skillRankFightValues,
  );
  console.log(
    `[extract-ztable] wrote skill-rank-fight-values.json (${Object.keys(skillRankFightValues).length} skills) to ${skillRankFightValuesPath}`,
  );

  const battleImaginesPath = writeJson(dataOut, 'battle-imagines.json', battleImagines);
  console.log(
    `[extract-ztable] wrote ${Object.keys(battleImagines).length} battle imagines to ${battleImaginesPath}`,
  );

  const equipmentItemCount = Object.values(equipmentByPart).reduce(
    (sum, p) => sum + Object.keys(p).length,
    0,
  );
  const equipmentPath = writeJson(dataOut, 'equipment.json', equipmentByPart);
  console.log(
    `[extract-ztable] wrote ${equipmentItemCount} equipment items across ${Object.keys(equipmentByPart).length} parts to ${equipmentPath}`,
  );

  const refineIdCount = Object.keys(refineData.refineById).length;
  const refinePartCount = Object.keys(refineData.partRefineIds).length;
  const refinePath = writeJson(dataOut, 'refine.json', refineData);
  console.log(
    `[extract-ztable] wrote refine data (${refineIdCount} refine types, ${refinePartCount} parts) to ${refinePath}`,
  );

  const enchantsItemCount = Object.values(enchantSets).reduce(
    (sum, items) => sum + items.length,
    0,
  );
  const enchantsPath = writeJson(dataOut, 'enchants.json', enchantSets);
  console.log(
    `[extract-ztable] wrote enchants data (${Object.keys(enchantSets).length} sets, ${enchantsItemCount} base items) to ${enchantsPath}`,
  );

  const talentNodeCount = Object.keys(talentNodes).length;
  const talentTreePath = writeJson(dataOut, 'talent-tree.json', {
    nodes: talentNodes,
    stagesByWeaponType,
    treeNodesByWeaponType,
  });
  console.log(
    `[extract-ztable] wrote talent-tree.json (${talentNodeCount} nodes, ${Object.keys(stagesByWeaponType).length} weapon types) to ${talentTreePath}`,
  );

  const seasonTemplateCount = Object.keys(seasonTalentsData.templates).length;
  const seasonTreeNodeCount = Object.keys(seasonTalentsData.treeNodes).length;
  const seasonTalentsPath = writeJson(dataOut, 'season-talents.json', seasonTalentsData);
  console.log(
    `[extract-ztable] wrote season-talents.json (${seasonTemplateCount} templates, ${seasonTreeNodeCount} tree nodes) to ${seasonTalentsPath}`,
  );

  const phantomClassCount = Object.keys(phantomFactorsByClass).length;
  const phantomTotalItems = Object.values(phantomFactorsByClass).reduce(
    (s, c) => s + c.grades.length,
    0,
  );
  const phantomFactorsPath = writeJson(dataOut, 'phantom-factors.json', {
    factorTypes,
    byClass: phantomFactorsByClass,
  });
  console.log(
    `[extract-ztable] wrote phantom-factors.json (${Object.keys(factorTypes).length} types, ${phantomClassCount} classes, ${phantomTotalItems} grade entries) to ${phantomFactorsPath}`,
  );

  for (const [dirName, localeDir] of Object.entries(LOCALES)) {
    const langDir = join(src, dirName);
    if (!existsSync(langDir)) {
      console.warn(`[extract-ztable] ${langDir} not found, skipping ${dirName}`);
      continue;
    }
    const localeText = extractLocaleText(langDir, {
      classes,
      skillIds,
      equipmentByPart,
      equipAttrIds,
      fixedEvoAttrIds,
      legendaryAttrIds,
      enchantItemIds,
      enchantAttrIds,
      phantomFactorItemIds,
      phantomFactorAttrIds,
      talentAttrIds,
      battleImagineAttrIds: usedBattleImagineAttrIds,
      localeName: dirName,
    });
    const outDir = join(localesOut, localeDir);
    const path = writeJson(outDir, 'game-data.json', localeText);
    console.log(
      `[extract-ztable] wrote game-data.json for ${localeDir} (items:${Object.keys(localeText.items).length} skills:${Object.keys(localeText.skills).length} classes:${Object.keys(localeText.classes).length} talentStages:${Object.keys(localeText.talentStages).length} parts:${Object.keys(localeText.parts).length} attributes:${Object.keys(localeText.attributes).length} talents:${Object.keys(localeText.talents).length} battleImagines:${Object.keys(localeText.battleImagines).length}) to ${path}`,
    );
  }
}

main();

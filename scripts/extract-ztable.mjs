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

import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeJson } from './lib/json-file.mjs';
import { readTable } from './lib/read-table.mjs';
import { extractLocaleText } from './lib/extractLocaleText.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ZTable directory name -> locale directory name used under src/locales.
// zh_TW (Traditional Chinese) has no dedicated ZTable folder; it is derived
// from zh_CN via scripts/derive-traditional-chinese.mjs after extraction.
const LOCALES = {
  japanese: 'ja_JP',
  english: 'en_US',
  korean: 'ko_KR',
  chinese: 'zh_CN',
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

// Talent値 → ロールスキル(DutySkill)IDの対応。SkillTableのiconが
// ui/textures/dutyskill/ 配下のスキル群がロールスキルに相当する。
// Talent=1: DPS, Talent=2: ヒーラー/サポート, Talent=3: タンク
//
// シーズン3で追加された 3021-3028 は SkillDutyTable.Type=[1,2,3] (全ロール共通)。
// 「幻想図鑑」(SkillAoyiGuideTable/SkillAoyiGuideEffectTable、バトルイマジンの育成度で
// 解放される図鑑システム)と連動し、SkillLevel 1-4 でランクアップする。全Talentに
// 共通で追加する。
const UNIVERSAL_ROLE_SKILLS = [3021, 3022, 3023, 3024, 3025, 3026, 3027, 3028];
// 3011系は強制被弾(挑発)・+45%ダメージ軽減("・御"接尾辞)を含みタンク専用。
// 3611系は挑発なしの弱い被ダメ軽減("・御"なし)・ST回復でDPS向け。
// スキル説明文(SkillAttrDes)で確認済み: Talent=1(DPS)には3611系、Talent=3(タンク)には3011系が正。
const TALENT_ROLE_SKILLS = {
  1: [3611, 3612, 3613, 3614, ...UNIVERSAL_ROLE_SKILLS],
  2: [3311, 3312, 3313, 3314, ...UNIVERSAL_ROLE_SKILLS],
  3: [3011, 3012, 3013, 3014, ...UNIVERSAL_ROLE_SKILLS],
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
  const skillDutyTable = readTable(langDir, 'SkillDutyTable');

  // Build upgradeId → maxRank (max SlotNumber) map
  const maxRankByUpgradeId = {};
  for (const entry of Object.values(skillUpgradeTable)) {
    const cur = maxRankByUpgradeId[entry.UpgradeId] ?? 0;
    maxRankByUpgradeId[entry.UpgradeId] = Math.max(cur, entry.SlotNumber);
  }
  // Build upgradeId → maxLevel (max SkillLevel) map。全ロール共通スキル
  // (SkillDutyTable由来、SlotNumber=0固定・SkillLevelでランクが変わる)専用。
  const maxLevelByUpgradeId = {};
  for (const entry of Object.values(skillUpgradeTable)) {
    const cur = maxLevelByUpgradeId[entry.UpgradeId] ?? 0;
    maxLevelByUpgradeId[entry.UpgradeId] = Math.max(cur, entry.SkillLevel);
  }
  // Build skillBaseId → upgradeId map
  const upgradeIdBySkillId = {};
  for (const entry of Object.values(skillSystemTable)) {
    upgradeIdBySkillId[entry.SkillBaseId] = entry.UpgradeId;
  }
  // SkillDutyTable: 全ロール共通スキル(UNIVERSAL_ROLE_SKILLS)は SkillSystemTable に
  // 登録がないため、UpgradeId をここから直接補う。
  const dutyUpgradeIdBySkillId = {};
  for (const entry of Object.values(skillDutyTable)) {
    if (entry.UpgradeId) dutyUpgradeIdBySkillId[entry.Id] = entry.UpgradeId;
  }

  const result = {};
  for (const id of referencedSkillIds) {
    const entry = skillTable[String(id)];
    if (!entry) {
      console.warn(`[extract-ztable] no SkillTable entry for referenced skill id ${id}, skipping`);
      continue;
    }
    const isDutySkill = dutyUpgradeIdBySkillId[id] != null;
    const upgradeId = upgradeIdBySkillId[id] ?? dutyUpgradeIdBySkillId[id];
    const maxRank =
      upgradeId == null
        ? 0
        : isDutySkill
          ? (maxLevelByUpgradeId[upgradeId] ?? 0)
          : (maxRankByUpgradeId[upgradeId] ?? 0);
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
//   seasonId: SkillAoyiTable.SeasonId (1=S1, 2=S2, 3=S3)
//   classification: SkillAoyiTable.Classification (1=紫品質, 2=通常橙品質,
//     3=特殊金品質, 4=コラボ限定。コラボはSeasonIdの値に関わらずシーズン/品質
//     どちらのフィルターからも独立して扱う。実データでの対応関係(ルーシィ/ナツ=4等)
//     はImaginePickerDialogのフィルターロジック側で確認済み)
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
      seasonId: entry.SeasonId,
      classification: entry.Classification,
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
//   Seal-based (EnchantId 2001–2004 [Gs>100] / 3001–3004 [Gs≥220, Lv190+]):
//     from EnchantItemList; each base item includes "refined" and "perfect"
//     variants at baseId+1 / baseId+2.
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

  // Seal-based (EnchantId 2001–2004 / 3001–3004): base item + 精 (id+1) + 極 (id+2) variants
  for (const enchantId of [2001, 2002, 2003, 2004, 3001, 3002, 3003, 3004]) {
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
      // 上級装着コスト: 精/極(高レベル)結果を狙う場合のコスト。通常/精/極いずれのIDでも
      // 同一トリオ内ではOrdinaryConsume/AdvancedConsumeが完全に一致するため、baseId側の
      // 値のみ保持し、精/極側は個別に持たない(表示側でbaseの値を共通参照する)。
      const advancedCost = baseEnchantData?.AdvancedConsume ?? [];
      for (const [costItemId] of advancedCost) usedEnchantItemIds.add(costItemId);
      const sealItem = {
        id: baseId,
        quality: item.Quality,
        icon: item.Icon || '',
        level: baseEnchantData?.EnchantItemLevel ?? 0,
        cost: baseCost,
        advancedCost,
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
  // レアステータス(シーズン3、通称「レアステータス」): quality>=4 かつ非セット装備の
  // 一部で、装備自体は QualityChildAttrLibId を持たず、TransformId 経由の
  // EquipTransformTable.QualityAttrLibId からのみ選択可能ステータスを取得できる
  // (クラフト品の「匠」系列で確認)。ドロップ品の「極」系列は装備自体に
  // QualityChildAttrLibId を直接持つ(TransformId側は同じ値の重複)。
  const equipTransformTable = readTable(langDir, 'EquipTransformTable');

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
        stats[key] ??= [];
        for (let i = 0; i < entry.AttrEffect.length; i++) {
          const [effectType, attrId] = entry.AttrEffect[i];
          const [min, max] = entry.AttrEffectConfig[i] ?? [0, 0];
          const [fvMin, fvMax] = entry.FightValue?.[i] ?? [0, 0];
          const isPercent = effectType === 3 || Boolean(profileAttrByAttrId[attrId - 2]);
          stats[key].push([effectType, attrId, min, max, isPercent, fvMin, fvMax]);
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
  // 防具刻印の中でも %表示になるステータス(筋力/知力/敏捷/攻撃速度/詠唱速度/回復力/
  // バリア強度万分率は値/100が%。他の装備部位カテゴリ(武器/アクセサリ)では同じattrIdが
  // 常にisPercent:trueで出現しているため、防具側だけこの一覧から漏れていた4件を追加した)。
  const LEGENDARY_ARMOR_PERCENT_ATTR_IDS = new Set([
    11014, 11024, 11034, 11722, 11732, 11792, 11812,
  ]);

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

  // 蒼海武器等の4枠選択式レアステータス: EquipTransformTable.QualityAttrLibId(tableType=2)の
  // libId配列(枠ごとに対応、同じlibIdが複数枠で重複することがある)から、
  // TalentSchoolIdごとの枠別候補リストを構築する。各libIdはEquipAttrSchoolLibTableの
  // SchoolNumberごとに異なるattrIdを1つ持つ「選択肢」の集まり(fixedEvolutionStatsと同じ
  // テーブル・同じTalentSchoolId軸だが、固定ではなく選択式)。
  // 戻り値: { [talentSchoolId]: LegendaryAffixEntry[][] (枠数分、libIds と同じ並び) } | null
  function buildLegendaryAffixGroups(libIds, equipPart, professionId) {
    if (!libIds.length) return null;
    const bySchool = {};
    let hasAny = false;
    for (let slotIndex = 0; slotIndex < libIds.length; slotIndex++) {
      const entries = (schoolLibByLibId[libIds[slotIndex]] ?? []).filter((e) =>
        (e.AllowPart ?? []).includes(equipPart),
      );
      const bySchoolForSlot = new Map();
      for (const e of entries) {
        const key = String(e.TalentSchoolId ?? '');
        (bySchoolForSlot.get(key) ?? bySchoolForSlot.set(key, []).get(key)).push(e);
      }
      for (const [schoolKey, schoolEntries] of bySchoolForSlot) {
        const byEffect = new Map();
        for (const e of schoolEntries) {
          const [effectType, attrId] = e.AttrEffect[0];
          const key = `${effectType}_${attrId}`;
          if (!byEffect.has(key)) {
            byEffect.set(key, { effectType, attrId, isPercent: true, pairs: [] });
          }
          const data = byEffect.get(key);
          const val = e.AttrEffectConfig[0]?.[0] ?? 0;
          const fv = e.FightValue[0]?.[0] ?? 0;
          data.pairs.push({ val, fv });
        }
        const group = [...byEffect.values()].map(({ effectType, attrId, isPercent, pairs }) => {
          pairs.sort((a, b) => a.val - b.val);
          return {
            effectType,
            attrId,
            isPercent,
            values: pairs.map((p) => p.val),
            fightValues: pairs.map((p) => p.fv),
          };
        });
        if (group.length === 0) continue;
        hasAny = true;
        const list = (bySchool[schoolKey] ??= Array.from({ length: libIds.length }, () => []));
        list[slotIndex] = group;
      }
    }
    if (!hasAny) return null;
    // TalentSchoolId=[] → type1 TalentSchoolId にリマップ(buildFixedEvoStatsと同じ)。
    if ('' in bySchool) {
      const talentIds = profToTalentSchools.get(professionId);
      const type1Key = talentIds ? String(talentIds[0]) : '101';
      bySchool[type1Key] = bySchool[''];
      delete bySchool[''];
    }
    return bySchool;
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

    // 伝説刻印/レアステータス: QualityChildAttrLibId から選択可能ステータスを抽出。
    const rawAffixIds = Array.isArray(equip.QualityChildAttrLibId)
      ? equip.QualityChildAttrLibId
      : [];
    const affixLibId = rawAffixIds.length >= 2 ? rawAffixIds[1] : 0;
    let legendaryAffix = buildLegendaryAffixEntries(affixLibId, equip.EquipPart);
    // 装備自体に QualityChildAttrLibId が無い場合、TransformId 経由でレアステータスを
    // 補う。tableType=1(EquipAttrLibTable経由、クラフト品「匠」系列)は単一選択の
    // legendaryAffix、tableType=2(蒼海武器等、EquipAttrSchoolLibTable経由)は
    // 4枠選択式の legendaryAffixGroups として抽出する(互いに排他)。
    let legendaryAffixGroups = null;
    if (!legendaryAffix && equip.TransformId) {
      const transformEntry = equipTransformTable[String(equip.TransformId)];
      const rawQualityIds = Array.isArray(transformEntry?.QualityAttrLibId)
        ? transformEntry.QualityAttrLibId
        : [];
      if (rawQualityIds[0] === 1 && rawQualityIds[1]) {
        legendaryAffix = buildLegendaryAffixEntries(rawQualityIds[1], equip.EquipPart);
      } else if (rawQualityIds[0] === 2 && rawQualityIds.length > 1) {
        legendaryAffixGroups = buildLegendaryAffixGroups(
          rawQualityIds.slice(1),
          equip.EquipPart,
          weaponEntry?.ProfessionId,
        );
      }
    }
    if (legendaryAffix) {
      for (const { attrId } of legendaryAffix) usedLegendaryAttrIds.add(attrId);
    }
    if (legendaryAffixGroups) {
      for (const groups of Object.values(legendaryAffixGroups)) {
        for (const group of groups) {
          for (const { attrId } of group) usedLegendaryAttrIds.add(attrId);
        }
      }
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
      ...(legendaryAffixGroups ? { legendaryAffixGroups } : {}),
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
        ...(baseItem.legendaryAffixGroups
          ? { legendaryAffixGroups: baseItem.legendaryAffixGroups }
          : {}),
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

  // BelongFunction: 800522="潜在心相晶"(FunctionTable.Note: 赛季养成线：赛季通用 = シーズン
  // 共通、プレイヤーが選択する通常の心相投影, 800523="滅妄心相晶"(Note: 大秘境专用 = 「大秘境」
  // という別ゲームモード専用の別UI)。後者(20001-20006, シーズン3新規)はビルドプランナーの
  // 通常フローでは選択対象外のため、抽出時点で除外する。
  const SEASON_TALENT_SELECTABLE_FUNCTION_ID = 800522;

  const templates = {};
  for (const entry of Object.values(templateTable)) {
    if (entry.BelongFunction !== SEASON_TALENT_SELECTABLE_FUNCTION_ID) continue;
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
    if (!templates[entry.TemplateId]) continue;
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
//   factorTypes[typeId]: タイプ名 (シーズン3: 1=極性, 2=恒常性, 3=第六感, 4=クラス恒常性,
//     5=クラス狂想, 6=真実。旧シーズンの typeId 1-5 は「共通攻撃/共通防御/クラス攻撃/
//     クラス防御/クラス狂想」を指していたが、番号を維持したまま意味が変わった)
//   byClass[factorItemClass]:
//     typeId: FactorItemTypeId (旧シーズンとtypeId番号が重複するため、単独でクラスの
//       「種別」を判別する用途には使えない。seasonId と併せて判定すること)
//     professionIds: 対象クラス [] (空=全クラス共通)
//     seasonId: SeasonTalentFactorItemTable.SeasonId[0]。過去シーズンの因子
//       (例: SeasonId=2)は現シーズンでは無効(AttrDescription側で「この因子は現シーズン
//       では無効です」と明記されている)だが、過去のセーブデータ互換のためデータからは
//       削除しない。表示側(phantom/phantomView.ts)で「現在の最大seasonId」と比較し、
//       それより古いものを無効表記・後方ソートする。
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
        seasonId: entry.SeasonId?.[0] ?? 0,
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

// player-levels.json: 冒険者レベル / シーズンレベル データ
//   levels[]: { level, exp, levelUpAttr[[attrId,val],...], fightValue, nacsStandard[[catId,val],...] }
//     levelUpAttr: そのレベルで加算されるステータス (11012=筋力, 11022=知力, 11032=俊敏, 11042=耐久力)
//     fightValue:  そのレベルで加算される能力スコア
//     nacsStandard: 能力スコア計算のカテゴリ別基準値 (AssessModuleTable IDをキーに各カテゴリの標準値)
//   season: { count, levelUpAttr, fightValue, expNum }
//     全シーズンレベルで共通の値 (uniformなため1エントリのみ保持)
//   skillUnlocks[]: { buffId, buffName, activeLevel }
//     レベルで解放されるアクション/スキル
// season-constants.json: 実数値→%変換に使う「収益減少曲線」の係数(K値)。
// FightAttrTranTable.json は Id=1/2/3 がそれぞれシーズン1/2/3に対応する(SeasonIdフィールド
// 自体は無いため、Idをそのままシーズン番号とみなす)。現在の最大Id = 現行シーズンとして、
// そのエントリから系列A/B/Cの係数を取り出す。docs/STATUS_CALCULATION.md「実数値→%変換の
// 共通モデル」参照。base%(会心5%等)やFIXED_BASE_*系はこのテーブルには存在しない
// (Wiki由来の実測値)ため、引き続き src/build-planner/stats/seasonConstants.ts 側で
// 手動管理する。
function extractSeasonConstants(langDir) {
  const tranTable = readTable(langDir, 'FightAttrTranTable');
  const ids = Object.keys(tranTable)
    .map(Number)
    .sort((a, b) => a - b);
  const currentEntry = tranTable[String(ids[ids.length - 1])];
  return {
    // 系列A: 会心/ファスト/幸運/器用さ/レジストの実数値→%変換係数
    diminishingA: currentEntry.CriToCrit?.[0] ?? 0,
    // 系列B: 万能の実数値→%変換係数
    diminishingVersatility: currentEntry.VersatilityToVersatilityPct?.[0] ?? 0,
    // 系列C: 物理/魔法増強・属性強度/属性耐性の実数値→%変換係数
    diminishingEnhance: currentEntry.PhyPowerToDam?.[0] ?? 0,
  };
}

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

  // SeasonLevelTable は過去シーズン分のエントリも SeasonId 別に残ったまま(例:
  // シーズン2=SeasonFightValue 4, シーズン3=6)なので、現行シーズン(最大SeasonId)の
  // エントリのみを対象にする。同一シーズン内はレベルによらず同一値のため代表値でよい。
  const seasonLevelEntries = Object.values(seasonLevelTable);
  const currentFactorSeasonId = Math.max(0, ...seasonLevelEntries.map((e) => e.SeasonId ?? 0));
  const currentSeasonEntries = seasonLevelEntries.filter(
    (e) => (e.SeasonId ?? 0) === currentFactorSeasonId,
  );
  const seasonSample = currentSeasonEntries[0] ?? {};
  const season = {
    count: currentSeasonEntries.length,
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

  const seasonConstantsData = extractSeasonConstants(structuralDir);
  const seasonConstantsPath = writeJson(dataOut, 'season-constants.json', seasonConstantsData);
  console.log(
    `[extract-ztable] wrote season-constants.json (diminishingA=${seasonConstantsData.diminishingA}, diminishingVersatility=${seasonConstantsData.diminishingVersatility}, diminishingEnhance=${seasonConstantsData.diminishingEnhance}) to ${seasonConstantsPath}`,
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

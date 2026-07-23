import { basename } from 'node:path';
import { readTable } from './read-table.mjs';

// SkillAttrDes の formula 空欄行のうち、リキャスト系として扱うラベル(完全一致)。
// PVECoolTime とランク別短縮ルールで値を解決する。
const COOLDOWN_ATTR_LABELS = new Set([
  'リキャスト',
  'チャージ時間',
  '変身リキャスト',
  'CD',
  'Cooldown',
  'Charge Time',
  'Overdrive Time',
  'Transformation Cooldown',
  '쿨타임',
  '에너지 충전 시간',
  '변신 쿨타임',
  '冷却时间',
  '充能时间',
  '变身冷却时间',
]);

// リキャスト短縮が適用されないイマジン(ゲーム内確認)。
// 3910=虚蝕オーガ(60秒固定)、3949/3982/3983=変身型(変身リキャスト20秒固定)。
// 英語版の変身型はラベルが plain な CD のため、ラベルでなく ID で除外する。
const CD_REDUCTION_EXEMPT_AOYI_IDS = new Set([3910, 3949, 3982, 3983]);

// クールタイム表示の秒サフィックス(SkillAttrDes 内のリテラル表記に合わせる)。
const SECONDS_SUFFIX = {
  japanese: '秒',
  english: 's',
  korean: '초',
  chinese: '秒',
};

// "up" 書式: 1/100 したパーセント表記(小数は最大2桁、ゲーム内表示に一致)。
function formatUpPercent(total) {
  const pct = total / 100;
  return (pct % 1 === 0 ? String(Math.round(pct)) : String(parseFloat(pct.toFixed(2)))) + '%';
}

// リキャスト系のうちチャージ時間を表すラベル(完全一致)。
const CHARGE_TIME_ATTR_LABELS = new Set([
  'チャージ時間',
  'Charge Time',
  'Overdrive Time',
  '에너지 충전 시간',
  '充能时间',
]);

// クラススキルの SkillAttrDes formula 空欄行(バフ効果行)の値解決マッピング。
// ゲーム内表示との突き合わせ(sample/skill-effect-survey.txt)で確定したもの、
// および確定パターンからの類推(コメント参照)を登録する。未登録の行は空値=非表示。
// skillId -> SkillAttrDes 行index -> テンプレート配列
//   要素: 固定文字列 | [FloatParameterキー, 単位]
//   単位: percent(raw/100の%) | flat(実数) | seconds(ミリ秒→秒)
//   値 = SkillFightLevelTable のレベル別基礎値 + WeaponStarTable のランク別増分
const SKILL_EFFECT_VALUE_MAP = {
  // --- ゲーム内確認済み ---
  1243: {
    0: [['attrPer', 'percent'], '+', ['attrAdd', 'flat']],
    1: [['time', 'seconds']],
  },
  1524: { 0: [['attr', 'percent']], 1: [['mAtk', 'flat']], 2: [['time', 'seconds']] },
  1528: { 0: [['attr', 'percent'], '+', ['attrAdd', 'flat']], 1: [['subCd', 'seconds']] },
  1730: { 0: [['attrPer', 'percent'], '+', ['attrAdd', 'flat']] },
  1936: { 0: [['attrPer', 'percent'], '+', ['attrAdd', 'flat']] },
  1938: { 0: [['attr', 'percent']], 1: [['time', 'seconds']] },
  2209: { 2: ['10%'] }, // 脆弱: 出所データなし・ゲーム内表示は固定10%
  2231: {
    0: [['attrPer', 'percent'], '+', ['attrAdd', 'flat']],
    1: [['time', 'seconds']],
  },
  2316: { 0: [['attrPer', 'percent'], '+', ['attrAdd', 'flat']] },
  2405: { 1: [['attrPer', 'percent']] },
  2408: { 1: [['attrPer', 'percent']] },
  2415: { 0: [['attrAdd', 'flat']], 1: [['attrPer', 'percent']] },
  // --- 確定パターンからの類推(要ゲーム内確認) ---
  // 「%+実数」複合はスポットライト(2316)と同族
  1420: { 1: [['attrPer', 'percent'], '+', ['attrAdd', 'flat']] },
  // --- シーズン3: 全ロール共通スキル(UNIVERSAL_ROLE_SKILLS)。FloatParameterキー名が
  // ラベルと直訳一致するため高確度の類推だが、ゲーム内表示との突き合わせは未実施。
  // (time=持続時間、num=人数、shield=バリア、attr/attrPer=%効果値)
  3022: { 1: [['attr', 'percent']], 2: [['time', 'seconds']] }, // 追加ダメージ軽減/持続時間
  3024: { 1: [['attr', 'percent']], 2: [['time', 'seconds']] }, // 重傷/持続時間
  3025: { 1: [['time', 'seconds']] }, // 持続時間 (バリア自体は skillpara.effect("shield") で解決済み)
  3026: { 1: [['time', 'seconds']] }, // 沈黙持続時間
  3027: { 0: [['num', 'flat']], 1: [['attrPer', 'percent']] }, // 復活人数/復活後の基本HP
  3028: { 0: [['attr', 'percent']] }, // 追加ダメージ軽減
};

// バトルイマジンの SkillAttrDes formula 空欄行(バフ効果行)の値解決マッピング。
// ゲーム内ポップアップとの突き合わせ調査(sample/imagine-effect-survey.txt)で全行確定済み。
// aoyiId -> SkillAttrDes 行index -> [FloatParameterキー, 単位] または [null, 'fixed', 表示文字列]
// 単位: percent = raw/100 の%表記
//       flat    = raw をそのまま実数表示(会心/幸運等の実数レーティング系)
//       seconds = ミリ秒→秒
const IMAGINE_EFFECT_VALUE_MAP = {
  3903: { 0: ['attrPer', 'percent'], 1: ['attrOther', 'percent'] },
  3904: { 1: ['attrAdd', 'flat'], 2: ['attrPer', 'percent'] },
  3905: { 1: ['attrPer', 'percent'] },
  3906: { 1: ['attrPer', 'percent'] },
  3907: { 1: ['attrPer', 'percent'] },
  3908: { 1: ['attrPer', 'percent'] },
  3911: { 0: ['lockHp', 'percent'], 1: ['time', 'seconds'] },
  3913: { 1: ['attrPer', 'percent'] },
  3914: { 1: ['attrPer', 'percent'], 3: ['attrAdd', 'flat'] },
  3915: { 1: ['attrAdd', 'flat'], 2: ['attrPer', 'percent'] },
  3917: { 3: [null, 'fixed', '15%'] },
  3920: { 0: ['attrPer', 'percent'] },
  3921: { 0: ['attrPer', 'percent'] },
  3922: { 2: ['prob', 'percent'] },
  3923: { 1: ['attrAdd', 'flat'], 2: ['attrPer', 'percent'] },
  3925: { 1: ['attrPer', 'percent'] },
  3926: { 1: ['attrAdd', 'flat'], 2: ['attrPer', 'percent'] },
  3927: { 1: ['attrPer', 'percent'] },
  3930: { 0: ['healHp', 'percent'], 1: ['attrPer', 'percent'] },
  3934: { 1: ['attrPer', 'percent'] },
  3936: { 1: ['attrPer', 'percent'] },
  3937: { 1: ['attrAdd', 'flat'], 2: ['attrPer', 'percent'] },
  3938: { 1: ['attrPer', 'percent'] },
  3939: { 1: ['attrPer', 'percent'] },
  3940: { 1: ['attrPer', 'percent'] },
  3941: { 0: ['time', 'seconds'] },
  3942: { 2: ['attrPer', 'percent'], 3: ['attrOther', 'percent'] },
  3944: { 1: ['attrPer', 'percent'] },
  3946: {
    0: ['prob1', 'percent'],
    1: ['prob2', 'percent'],
    4: ['attrPer3914', 'percent'],
    6: ['attrAdd3914', 'flat'],
    9: ['attrAdd3915', 'flat'],
    10: ['attrPer3915', 'percent'],
    13: ['attrPer3927', 'percent'],
    16: ['attrPer3940', 'percent'],
    19: ['attrAdd3926', 'flat'],
    20: ['attrPer3926', 'percent'],
  },
  3947: { 1: ['attrPer', 'percent'] },
  3948: { 1: ['attrPer', 'percent'], 2: ['attrPerElse', 'percent'], 3: ['hpPer', 'percent'] },
  3950: {
    1: ['attrPer', 'percent'],
    2: ['attrPerElse', 'percent'],
    3: ['speed1', 'percent'],
    4: ['speed2', 'percent'],
  },
  3951: { 0: ['attrPer', 'percent'] },
  3952: { 1: ['speed1', 'percent'], 2: ['speed2', 'percent'] },
  3953: { 1: ['attrPer', 'percent'] },
  3954: { 1: ['attrPer', 'percent'] },
  3957: { 1: ['attrPer', 'percent'] },
  3958: { 1: ['attrPer', 'percent'] },
  3963: { 1: ['attrPer', 'percent'] },
  3964: {
    1: ['attr1', 'flat'],
    2: ['attrPer1', 'percent'],
    3: ['attr2', 'flat'],
    4: ['attrPer2', 'percent'],
    5: ['attr3', 'flat'],
    6: ['attrPer3', 'percent'],
  },
  3966: { 1: ['attrPer', 'percent'] },
  3982: { 7: ['attrA', 'percent'], 8: ['attrB', 'percent'], 9: ['attrC', 'percent'] },
  3983: { 0: ['attr', 'percent'], 10: ['attrA', 'percent'], 11: ['attrB', 'percent'] },
  // --- シーズン3: 新規バトルイマジン(3968-3981)。FloatParameterキー名がラベルと
  // 直訳一致する高確度の類推だが、ゲーム内表示との突き合わせは未実施(要確認)。
  // 3968/3969 はキー4件に対しラベル3件で1対1対応が確定できないため未登録のまま
  // (空欄表示。調査が必要な残項目は sample/season3-imagine-effect-todo.txt 参照)。
  3970: { 3: ['attr', 'percent'], 6: ['subAoyiCdPct', 'percent'] },
  3971: { 1: ['attrA', 'percent'], 2: ['attrB', 'percent'] },
  3972: { 1: ['attrElse', 'percent'], 2: ['attrMax', 'percent'] },
  3974: { 1: ['attrA', 'percent'], 2: ['attrB', 'percent'], 3: ['attrC', 'percent'] },
  3975: { 1: ['attrDef', 'percent'], 2: ['attrHp', 'percent'] },
  3978: { 1: ['time', 'percent'] },
  3979: { 1: ['attr', 'percent'] },
  3980: { 1: ['attr', 'percent'] },
};

// 英語版の SkillAttrDes は一部イマジンで行構成が日本語版と異なる(変身持続時間などの
// 行が追加されている)ため、該当イマジンのみ行indexを英語版に合わせて差し替える。
// 未確認: 英語版のみ存在する「Transformation Duration」行(ルーシィ/ナツ)は
// 値の出所となるデータが見つかっておらず、空値=非表示のまま(日本語版には行自体なし)。
const IMAGINE_EFFECT_VALUE_MAP_EN_OVERRIDES = {
  3982: { 8: ['attrA', 'percent'], 9: ['attrB', 'percent'], 10: ['attrC', 'percent'] },
  3983: { 0: ['attr', 'percent'], 11: ['attrA', 'percent'], 12: ['attrB', 'percent'] },
};

// AttrDescription.json のテキストから表示名を抽出する。
// "幸運の一撃のダメージ+{*Decision.unmarkpercent(1)*}" → "幸運の一撃のダメージ"
// "ダメージ系のマスタリースキルが魔法増強を{*...*}上昇させる" → "ダメージ系のマスタリースキルが魔法増強を上昇させる"
function nameFromAttrDesc(description) {
  return description
    .replace(/[+]\{[^}]+}.*$/s, '') // "+{*...*}" 以降を除去
    .replace(/\{[^}]+}/g, '') // 残った "{*...*}" を除去
    .replace(/を上昇させる$/, 'を上昇させる') // "を上昇させる" は保持(末尾処理なし)
    .replace(/。\s*$/, '') // 末尾の。を除去
    .trim();
}

// 伝説刻印のtype=3効果ID(2400001/2400002)はどのテーブルにも名前がないため言語別にハードコード。
const LEGENDARY_SPECIAL_ATTR_NAMES = {
  japanese: { 2400001: '物理攻撃力ボーナス', 2400002: '魔法攻撃力ボーナス' },
  english: { 2400001: 'ATK Bonus', 2400002: 'MATK Bonus' },
};

// ZTable上の名称がシーズン更新に追従していないAttrIdの上書き名(言語別)。
// 英語版は正しい訳文が未確認のため上書きしない(ZTable由来の旧名のまま)。
const ATTR_NAME_OVERRIDES = {
  japanese: { 11442: '滅妄強度' },
  english: {},
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

export function extractLocaleText(
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
  // 全ロール共通スキル(UNIVERSAL_ROLE_SKILLS、SkillDutyTable.UpgradeId!=0)は
  // SkillFightLevelTable.Level が 1-4(幻想図鑑ランク)のみで、通常のクラススキルの
  // 「レベル1-30 × ランクG0-G6(WeaponStarTable)」という2軸とは異なる1軸(ランクのみ)の
  // 値を持つ。resolveSkillActiveEffectParams 系の関数はこのIDを見て専用ロジックに切り替える。
  const skillDutyTable = readTable(langDir, 'SkillDutyTable');
  const universalRoleSkillIds = new Set(
    Object.values(skillDutyTable)
      .filter((e) => e.UpgradeId)
      .map((e) => e.Id),
  );
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

  // TempAttrTable: 季節限定の「シーズン強度」系ステータス(装備のbaseStatsに直接AttrIdとして
  // 現れる、通常のProfileAttrTable体系とは異なる番号帯)。名前解決の最終フォールバックに使う。
  // 例: 98982(旧S2シーズン強度=幻夢強度)は AttrDesc が既に「幻夢強度（無効）{v}」となっており、
  // シーズン3では無効化されたステータスであることがゲームデータ側で明示されている。
  const tempAttrNameById = {};
  try {
    const tempAttrTableForNames = readTable(langDir, 'TempAttrTable');
    const tempAttrRows = Array.isArray(tempAttrTableForNames)
      ? tempAttrTableForNames
      : Object.values(tempAttrTableForNames);
    for (const e of tempAttrRows) {
      if (e.Id && e.AttrDesc) tempAttrNameById[e.Id] = nameFromAttrDesc(e.AttrDesc);
    }
  } catch (_) {
    // ignore
  }

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
  const damageAttrTable = readTable(langDir, 'DamageAttrTable');
  const skillFightLvlTable = readTable(langDir, 'SkillFightLevelTable');

  // Build SkillId -> first SkillEffectTable entry map
  const skillEffectBySkillId = {};
  for (const entry of Object.values(skillEffectTable)) {
    if (!skillEffectBySkillId[entry.SkillId]) skillEffectBySkillId[entry.SkillId] = entry;
  }

  // skillId -> level -> { FloatParameter object, PVECoolTime }
  // (クラススキルは SkillFightLevelTable にレベル1-30の行を持つ)
  const fightLvlBySkillLevel = {};
  for (const entry of Object.values(skillFightLvlTable)) {
    if (!entry.SkillId) continue;
    (fightLvlBySkillLevel[entry.SkillId] ??= {})[entry.Level] = {
      floatPar: Object.fromEntries((entry.FloatParameter || []).map(([k, v]) => [k, Number(v)])),
      coolTime: entry.PVECoolTime,
    };
  }

  // skillId -> rank(1-6) -> { key: 増分 }
  // クラススキルのランク(G)強化は WeaponStarTable。FloatParameter の増分が
  // スキル効果値に加算される(ゲーム内表示と突き合わせて確認済み)。
  const weaponStarTable = readTable(langDir, 'WeaponStarTable');
  const skillStarIncByRank = {};
  for (const entry of Object.values(weaponStarTable)) {
    if (!entry.SkillId) continue;
    (skillStarIncByRank[entry.SkillId] ??= {})[entry.Level] = Object.fromEntries(
      (entry.FloatParameter || []).map(([k, v]) => [k, Number(v)]),
    );
  }

  // クラススキル効果値: レベル別基礎値(SkillFightLevelTable) + ランク別増分(WeaponStarTable)
  const skillEffectValue = (skillId, key, rank, level) =>
    (fightLvlBySkillLevel[skillId]?.[level]?.floatPar?.[key] ?? 0) +
    (rank > 0 ? (skillStarIncByRank[skillId]?.[rank]?.[key] ?? 0) : 0);

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

  const SKILL_MAX_LEVEL = 30;
  const SKILL_MAX_RANK = 6; // G0-G6

  // evaluate(rank, level) を全ランク・全レベルで評価し、変動する次元に応じた
  // part を parts へ追加する共通処理。
  //   定数 → 文字列 / ランクのみ → { r: 7要素 } / レベルのみ → { l: 30要素 }
  //   両方 → { u: 書式, l: レベル別基礎値(数値), r: ランク別増分(数値) }
  //   (両方の場合は 値 = l[level-1] + r[rank] を表示側で書式化する)
  //
  // 全ロール共通スキル(isRoleSkill)の場合: SkillFightLevelTable.Level(1-4)を
  // そのまま「ランク」軸として評価し、{ r: [dummy, lv1, lv2, lv3, lv4] } (5要素) を返す。
  // UI側のランク値(1-4、未設定時0)がそのままインデックスとして使える
  // (index0=dummyはrank未設定時のフォールバック用にLv1の値を入れておく)。
  function pushEffectValues(parts, pushText, evaluate, fmt, formatCode, skillId, isRoleSkill) {
    if (isRoleSkill) {
      const byRoleLevel = [1, 1, 2, 3, 4].map((lvl) => evaluate(0, lvl));
      const varies = new Set(byRoleLevel.slice(1)).size > 1;
      if (varies) parts.push({ r: byRoleLevel.map(fmt) });
      else pushText(fmt(byRoleLevel[0]));
      return;
    }
    const byLevel = [];
    for (let level = 1; level <= SKILL_MAX_LEVEL; level++) {
      byLevel.push(evaluate(0, level));
    }
    const incByRank = [];
    for (let rank = 0; rank <= SKILL_MAX_RANK; rank++) {
      incByRank.push(evaluate(rank, SKILL_MAX_LEVEL) - evaluate(0, SKILL_MAX_LEVEL));
    }
    const levelVaries = new Set(byLevel).size > 1;
    const rankVaries = incByRank.some((v) => v !== 0);
    if (rankVaries && levelVaries) {
      if (formatCode !== 'up' && formatCode !== 'un') {
        // 表示側の書式化は up/un のみ対応(秒等の両次元変動は現データに存在しない)
        console.warn(
          `[extract-ztable] skill ${skillId}: 両次元変動の値が未対応書式(${formatCode})`,
        );
        parts.push({ l: byLevel.map(fmt) });
        return;
      }
      parts.push({ u: formatCode, l: byLevel, r: incByRank });
    } else if (rankVaries) {
      parts.push({ r: incByRank.map((inc) => fmt(byLevel[0] + inc)) });
    } else if (levelVaries) {
      parts.push({ l: byLevel.map(fmt) });
    } else {
      pushText(fmt(byLevel[0]));
    }
  }

  // クラススキルの SkillAttrDes formula をトークン分解し、値 parts へ変換する。
  // 表示側が選択中のレベル・ランクで組み立てる。
  // DamageAttrTable の PVEDamageRadio は7要素=ランク別、
  // PVEFixedParameter/PVEStunnedDamage は30要素=レベル別。
  // skillpara.effect は skillEffectValue(レベル別基礎値+ランク別増分)で解決する。
  function resolveSkillAttrDesParts(formula, skillId, isRoleSkill) {
    const parts = [];
    const pushText = (text) => {
      const cleaned = text.replace(/<br>/gi, ' ');
      if (!cleaned) return;
      if (typeof parts[parts.length - 1] === 'string') parts[parts.length - 1] += cleaned;
      else parts.push(cleaned);
    };
    const pushValues = (evaluate, format) => {
      const fmt = (v) => (format === 'up' ? formatUpPercent(v) : String(v));
      pushEffectValues(parts, pushText, evaluate, fmt, format, skillId, isRoleSkill);
    };

    const tokenRe =
      /\{\*skillpara\.damageMerge\(\{([^}]+)},\{([^}]+)},"([^"]+)","([^"]+)"\)\*}|\{\*skillpara\.effect\("([^"]+)","([^"]+)"\)\*}/g;
    let last = 0;
    let m;
    while ((m = tokenRe.exec(formula)) !== null) {
      pushText(formula.slice(last, m.index));
      if (m[1] !== undefined) {
        const ids = m[1].split(',').map((s) => s.trim());
        const counts = m[2].split(',').map((s) => Number(s.trim()));
        const fieldName = m[3];
        pushValues((rank, level) => {
          let total = 0;
          ids.forEach((id, i) => {
            const arr = damageAttrTable[id]?.[fieldName];
            let value = 0;
            if (Array.isArray(arr) && arr.length > 0) {
              const idx =
                arr.length === SKILL_MAX_RANK + 1 ? rank : Math.min(level - 1, arr.length - 1);
              value = arr[idx];
            } else if (typeof arr === 'number') {
              value = arr;
            }
            total += value * (counts[i] || 1);
          });
          return total;
        }, m[4]);
      } else {
        const key = m[5];
        pushValues((rank, level) => skillEffectValue(skillId, key, rank, level), m[6]);
      }
      last = tokenRe.lastIndex;
    }
    pushText(formula.slice(last));
    if (typeof parts[0] === 'string') parts[0] = parts[0].trimStart();
    const lastPart = parts[parts.length - 1];
    if (typeof lastPart === 'string') {
      const trimmed = lastPart.trimEnd();
      if (trimmed) parts[parts.length - 1] = trimmed;
      else parts.pop();
    }
    return parts;
  }

  // SKILL_EFFECT_VALUE_MAP のテンプレート配列を parts へ変換する。
  function resolveSkillMappedParts(template, skillId, secSuffix, isRoleSkill) {
    const parts = [];
    const pushText = (text) => {
      if (!text) return;
      if (typeof parts[parts.length - 1] === 'string') parts[parts.length - 1] += text;
      else parts.push(text);
    };
    for (const item of template) {
      if (typeof item === 'string') {
        pushText(item);
        continue;
      }
      const [key, unit] = item;
      const fmt = (v) => {
        if (unit === 'percent') return formatUpPercent(v);
        if (unit === 'seconds') return `${parseFloat((v / 1000).toFixed(2))}${secSuffix}`;
        return String(v);
      };
      const formatCode = unit === 'percent' ? 'up' : unit === 'flat' ? 'un' : 'seconds';
      pushEffectValues(
        parts,
        pushText,
        (rank, level) => skillEffectValue(skillId, key, rank, level),
        fmt,
        formatCode,
        skillId,
        isRoleSkill,
      );
    }
    return parts;
  }

  // クラススキルの activeEffectParams: [[label, parts], ...]
  // formula 空欄行の解決:
  //   チャージ時間 → SkillTable.EnergyChargeTime(ミリ秒)
  //   リキャスト   → PVECoolTime。ただし 0/1 はチャージ型のプレースホルダのため、
  //                  EnergyChargeTime があればそちらを表示(フェラルシード15秒等で確認)
  //   バフ効果行   → SKILL_EFFECT_VALUE_MAP(未登録は空=非表示)
  function resolveSkillActiveEffectParams(skillId) {
    const effectEntry = skillEffectBySkillId[skillId];
    if (!effectEntry?.SkillAttrDes?.length) return [];
    const secSuffix = SECONDS_SUFFIX[basename(langDir)] ?? '秒';
    const valueMap = SKILL_EFFECT_VALUE_MAP[skillId] ?? {};
    const isRoleSkill = universalRoleSkillIds.has(skillId);
    const rows = [];
    effectEntry.SkillAttrDes.forEach(([label, formula], rowIdx) => {
      if (!label) return;
      if (formula) {
        rows.push([label, resolveSkillAttrDesParts(formula, skillId, isRoleSkill)]);
        return;
      }
      if (COOLDOWN_ATTR_LABELS.has(label)) {
        const chargeTime = skillTable[String(skillId)]?.EnergyChargeTime ?? 0;
        if (isRoleSkill) {
          // 全ロール共通スキルはリキャストが幻想図鑑ランク(Level 1-4)で短縮される。
          const secs = [1, 1, 2, 3, 4].map(
            (lvl) => fightLvlBySkillLevel[skillId]?.[lvl]?.coolTime ?? 0,
          );
          const fmtSec = (s) => (s ? `${s}${secSuffix}` : '');
          const varies = new Set(secs.slice(1)).size > 1;
          rows.push([label, varies ? [{ r: secs.map(fmtSec) }] : secs[0] ? [fmtSec(secs[0])] : []]);
          return;
        }
        const coolTime = fightLvlBySkillLevel[skillId]?.[1]?.coolTime ?? 0;
        let seconds;
        if (CHARGE_TIME_ATTR_LABELS.has(label)) {
          seconds = chargeTime > 0 ? chargeTime / 1000 : coolTime;
        } else {
          seconds =
            (coolTime === 0 || coolTime === 1) && chargeTime > 0 ? chargeTime / 1000 : coolTime;
        }
        rows.push([label, seconds ? [`${seconds}${secSuffix}`] : []]);
        return;
      }
      const mapping = valueMap[rowIdx];
      rows.push([
        label,
        mapping ? resolveSkillMappedParts(mapping, skillId, secSuffix, isRoleSkill) : [],
      ]);
    });
    return rows;
  }

  const skills = {};
  for (const id of skillIds) {
    const entry = skillTable[String(id)];
    if (!entry) continue;
    const skillLabel = resolveSkillLabel(entry.EffectIDs);
    const activeEffectParams = resolveSkillActiveEffectParams(id);
    skills[id] = {
      name: entry.Name,
      description: entry.Desc || '',
      ...(skillLabel.length > 0 ? { skillLabel } : {}),
      ...(activeEffectParams.length > 0 ? { activeEffectParams } : {}),
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
    } else if (tempAttrNameById[attrId]) {
      // TempAttrTable由来(季節限定「シーズン強度」系)のフォールバック。
      attributes[attrId] = tempAttrNameById[attrId];
    }
  }
  // 伝説刻印 AttrId の名前を解決して追加。
  // x14 系 (11014/11024/11034): attrId-2 が ProfileAttrTable に存在。
  // x34 系 (11334/11344): attrId-4 が ProfileAttrTable に存在。
  // type=3 効果ID: AttrDescription.json に表示名があればそれを使用(例: 2400004/2408030)。
  // 存在しないもの(2400001/2400002)のみ下のハードコード名にフォールバックする。
  // TempAttrTable由来(例: 92000=移動速度)は、equipAttrIds/fixedEvoAttrIdsと同じく
  // 最終フォールバックとして使う(装備のレアステータス枠にもTempAttrTable系AttrIdが出現するため)。
  for (const attrId of legendaryAttrIds) {
    if (attributes[attrId]) continue;
    if (attrByAttrId[attrId - 2]) {
      attributes[attrId] = attrByAttrId[attrId - 2].Name;
    } else if (attrByAttrId[attrId - 4]) {
      attributes[attrId] = attrByAttrId[attrId - 4].Name;
    } else if (attrDescById[attrId]) {
      attributes[attrId] = nameFromAttrDesc(attrDescById[attrId].Description);
    } else if (fightAttrNameByAdd.has(attrId)) {
      attributes[attrId] = fightAttrNameByAdd.get(attrId);
    } else if (tempAttrNameById[attrId]) {
      attributes[attrId] = tempAttrNameById[attrId];
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
  // ZTable側のテキストがシーズン更新に追従していないAttrId名の上書き。
  // AttrId 11442(装備由来、attrId-2=11440 のProfileAttrTable名を継承)はシーズン3で
  // GS90-180装備から廃止され、GS190+装備の新効果に意味が変わった(ゲーム内表示は
  // 「滅妄強度」)が、ProfileAttrTable.Name(11440)はまだ旧名「幻夢強度」のまま
  // (2026-07-16時点、ユーザー報告による)。
  const attrNameOverrides = ATTR_NAME_OVERRIDES[localeName] ?? {};
  for (const [id, name] of Object.entries(attrNameOverrides)) {
    attributes[Number(id)] = name;
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

  // Build per-rank BuffPar map: aoyiId -> level(1-5) -> number[]
  const aoyiRankBufPar = {};
  // Build per-rank FloatParameter map: aoyiId -> level(1-5) -> { key: number }
  const aoyiRankFloatPar = {};
  // aoyiId -> level(1-5) -> リキャスト短縮量ms (TransformationType type=9、チャージ型のみ存在)
  const aoyiCdReductionMs = {};
  for (const entry of Object.values(aoyiStarTableForLocale)) {
    (aoyiRankBufPar[entry.SkillId] ??= {})[entry.Level] = entry.BuffPar?.[0] ?? [];
    (aoyiRankFloatPar[entry.SkillId] ??= {})[entry.Level] = Object.fromEntries(
      (entry.FloatParameter || []).map(([k, v]) => [k, Number(v)]),
    );
    for (const [type, , value] of entry.TransformationType || []) {
      if (type === 9) (aoyiCdReductionMs[entry.SkillId] ??= {})[entry.Level] = value;
    }
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

  // Substitute {*Decision.fn(N)*} placeholders with computed values from params array
  function substituteBuffParams(template, params) {
    return template.replace(/\{\*Decision\.(\w+)\((\d+)\)\*}/g, (_, fnName, idxStr) => {
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
    // {*skillpara.damageMerge({ids},{counts},"field","format")*}
    // PVEDamageRadio has one entry per rank (index 0=G0..5=G5).
    // counts は ids と同順のヒット数で、合計値 = Σ value(id_i) × count_i
    // (フロストオーガ 10ヒット+1ヒット等でゲーム内表示と一致することを確認済み)。
    result = result.replace(
      /\{\*skillpara\.damageMerge\(\{([^}]+)},\{([^}]+)},"([^"]+)","([^"]+)"\)\*}/g,
      (_, idsStr, countsStr, fieldName, format) => {
        const ids = idsStr.split(',').map((s) => s.trim());
        const counts = countsStr.split(',').map((s) => Number(s.trim()));
        let total = 0;
        ids.forEach((id, i) => {
          const entry = damageAttrTable[id];
          if (!entry) return;
          const arr = entry[fieldName];
          let value = 0;
          if (Array.isArray(arr) && arr.length > 0) {
            value = arr[Math.min(rank, arr.length - 1)];
          } else if (typeof arr === 'number') {
            value = arr;
          }
          total += value * (counts[i] || 1);
        });
        if (format === 'up') return formatUpPercent(total);
        return String(total);
      },
    );
    // {*skillpara.effect("key","format")*}
    // value = SkillFightLevelTable[effectId].FloatParameter["key"]
    //       + SkillAoyiStarTable[aoyiId][rank].FloatParameter["key"]  (rank>0 のみ)
    result = result.replace(
      /\{\*skillpara\.effect\("([^"]+)","([^"]+)"\)\*}/g,
      (_, key, format) => {
        const base = fightLvlFloatPar[String(effectId)]?.[key] ?? 0;
        const increment = rank > 0 ? (aoyiRankFloatPar[aoyiId]?.[rank]?.[key] ?? 0) : 0;
        const total = base + increment;
        if (format === 'up') return formatUpPercent(total);
        return String(total);
      },
    );
    return result.replace(/<br>/gi, ' ').trim();
  }

  // バトルイマジンのリキャスト系行(リキャスト/チャージ時間/変身リキャスト)のランク別値。
  // 通常型は G3/G4 で基礎の 5/6、G5 で 2/3 に短縮される(ゲーム内確認による。
  // データ上はチャージ型のみ type9 短縮量が明示されており、短縮量=基礎の1/6・1/3)。
  // チャージ型(PVECoolTime=1)は type9 の G3 短縮量×6 から基礎値を逆算する。
  // CD_REDUCTION_EXEMPT_AOYI_IDS(虚蝕オーガ・変身型)は短縮なし。
  function resolveImagineCooldowns(aoyiId, secSuffix) {
    const reductions = aoyiCdReductionMs[aoyiId];
    let base = pveCoolTimeBySkillId[aoyiId];
    if (base === 1 && reductions?.[3]) base = (reductions[3] / 1000) * 6;
    if (!base) return ['', '', '', '', '', ''];
    const noReduction = CD_REDUCTION_EXEMPT_AOYI_IDS.has(aoyiId);
    const vals = [];
    for (let rank = 0; rank <= 5; rank++) {
      let cd = base;
      if (!noReduction) {
        if (reductions) cd = base - (reductions[rank] ?? 0) / 1000;
        else if (rank >= 3) cd = Math.round(base * (rank >= 5 ? 2 / 3 : 5 / 6));
      }
      vals.push(`${cd}${secSuffix}`);
    }
    return vals;
  }

  // IMAGINE_EFFECT_VALUE_MAP に基づく formula 空欄行(バフ効果行)のランク別値。
  function resolveMappedEffectValue(mapping, rank, aoyiId, effectId, secSuffix) {
    const [key, unit, fixedText] = mapping;
    if (unit === 'fixed') return fixedText;
    const base = fightLvlFloatPar[String(effectId)]?.[key] ?? 0;
    const increment = rank > 0 ? (aoyiRankFloatPar[aoyiId]?.[rank]?.[key] ?? 0) : 0;
    const total = base + increment;
    switch (unit) {
      case 'percent':
        return formatUpPercent(total);
      case 'flat':
        return String(total);
      case 'seconds':
        return `${parseFloat((total / 1000).toFixed(2))}${secSuffix}`;
      default:
        return '';
    }
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
    // formula 空欄行はリキャスト系ならランク短縮込みのクールタイム、
    // バフ効果行なら IMAGINE_EFFECT_VALUE_MAP で解決する
    // (マッピング未定義の行は空値とし、表示側のフィルタで行ごと非表示になる)。
    const effectEntry = skillEffectBySkillId[entry.Id];
    const activeEffectParams = [];
    if (effectEntry?.SkillAttrDes) {
      const secSuffix = SECONDS_SUFFIX[basename(langDir)] ?? '秒';
      const valueMap =
        (basename(langDir) === 'english'
          ? IMAGINE_EFFECT_VALUE_MAP_EN_OVERRIDES[entry.Id]
          : undefined) ??
        IMAGINE_EFFECT_VALUE_MAP[entry.Id] ??
        {};
      effectEntry.SkillAttrDes.forEach(([label, formula], rowIdx) => {
        if (!label) return;
        const vals = [];
        if (formula) {
          for (let rank = 0; rank <= 5; rank++) {
            vals.push(resolveSkillAttrDesValue(formula, rank, entry.Id, effectEntry.Id));
          }
        } else if (COOLDOWN_ATTR_LABELS.has(label)) {
          vals.push(...resolveImagineCooldowns(entry.Id, secSuffix));
        } else {
          const mapping = valueMap[rowIdx];
          for (let rank = 0; rank <= 5; rank++) {
            vals.push(
              mapping
                ? resolveMappedEffectValue(mapping, rank, entry.Id, effectEntry.Id, secSuffix)
                : '',
            );
          }
        }
        activeEffectParams.push([label, vals]);
      });
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
          /\{[*]Decision\.unmarkpercent\((\d+)\)[*]}/g,
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
        attrDescs[String(e.Id)] = e.AttrDesc.replace(/\{[*]tempAttr\.un[*]}/g, '{v}').trim();
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

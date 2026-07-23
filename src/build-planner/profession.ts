import { getClassData } from './classData';
import type { ElementId } from './types';

// クラス(職業)の定義。"class" はプログラミング言語の予約語と紛らわしいため、
// ゲーム内表記に合わせて "profession" の語で統一する。
//
// クラスの識別・ZTable側IDとの対応・ステータス計算用の係数(docs/STATUS_CALCULATION.md
// 「攻撃ステータス」章のクラス別変換効率表)は、すべて1つの `Profession` 構造体の
// 属性として持つ(IDからの個別ルックアップテーブルを別途維持する必要がないようにする)。

export type MainStatId = 'strength' | 'agility' | 'intellect';
export type AttackType = 'physical' | 'magical';

// アプリ内でクラスを一意に識別するキー。
export type ProfessionKey =
  | 'heavyGuardian'
  | 'shieldFighter'
  | 'stormBlade'
  | 'galeLancer'
  | 'divineArcher'
  | 'frostMage'
  | 'verdantOracle'
  | 'beatPerformer'
  | 'twinStriker';

// 「クラスの型」(器用さの効果がクラスごとに2種類に分かれる、docs/STATUS_CALCULATION.md
// 「器用さ」章の表に対応)。型名はクラス毎に異なる(ロケールファイルの
// `buildPlanner.professionTypes.<ProfessionKey>.<ProfessionTypeKey>` を参照)が、
// 型の数は常に2つなのでキー自体は全クラス共通の "type1"/"type2" で表す。
export type ProfessionTypeKey = 'type1' | 'type2';
export const PROFESSION_TYPE_KEYS: ProfessionTypeKey[] = ['type1', 'type2'];

// デフォルトクラスはクラスID(ProfessionId)1のもの(ストームブレイド)。
export const DEFAULT_PROFESSION_KEY: ProfessionKey = 'stormBlade';

export interface Profession {
  key: ProfessionKey;
  // ZTableのProfessionId。`src/data/classes.json` および各ロケールの
  // `src/locales/<locale>/game-data.json` の `classes` セクションのキーと一致する
  // (例: game-data.json の `classes["13"].name` === "ビートパフォーマー")。
  professionId: number;
  // メインステータス(物理/魔法攻撃力への変換元になるステータス)
  mainStat: MainStatId;
  // メインステータスが物理/魔法攻撃力のどちらに変換されるか
  attackType: AttackType;
  // クラス固有の属性(`src/data/classes.json` の `element` フィールド由来。ZTableの
  // ElementalRestraintTable.json のId順=1:火/2:氷/3:雷/4:森/5:風/6:岩/7:光/8:闇と対応)。
  // 追加バフ効果ダイアログのシロップ/脊椎試薬属性選択の初期値に使用する。
  element: ElementId;
  // メインステータス1ptあたりの攻撃力上昇量(基礎値。R1アビリティ取得時の追加分は含まない)
  atkPerMainStatPoint: number;
  // 耐久力1ptあたりの最大HP上昇量
  hpPerEndurancePoint: number;
  // ファスト1%あたりの攻撃速度上昇量
  atkSpeedPerHastePercent: number;
  // ファスト1%あたりの詠唱速度上昇量
  castSpeedPerHastePercent: number;
  // 戦闘時のスタミナ秒間回復量(docs/STATUS_CALCULATION.md 「その他」章のクラス別表)
  staminaRegenPerSecond: number;
  // ProfessionSystemTable.ShowTalentStage: [type1のTalentSchoolId, type2のTalentSchoolId]
  // シリーズ武器の fixedEvolutionStats を型別に引くキーとして使用。
  talentSchoolIds: [number, number];
}

// professionId・attackType・mainStatは、game-data.jsonの実名(classes[id].name)と
// classes.jsonのattackShow(11330=物理攻撃力/11340=魔法攻撃力)・strOrIntOrDexShow
// (11010=筋力/11020=知力/11030=敏捷)を突き合わせて確認済み:
//
// | ProfessionKey  | professionId | game-data.json上の名前 |
// |---|---|---|
// | stormBlade     | 1  | ストームブレイド |
// | frostMage      | 2  | フロストメイジ |
// | galeLancer     | 4  | ゲイルランサー |
// | verdantOracle  | 5  | ヴァーダントオラクル |
// | heavyGuardian  | 9  | ヘヴィガーディアン |
// | divineArcher   | 11 | ディバインアーチャー |
// | shieldFighter  | 12 | シールドファイター |
// | beatPerformer  | 13 | ビートパフォーマー |
//
// | twinStriker    | 3  | ツインストライカー(シーズン3で isOpen: true 化) |
//
// `isOpen: false` のID(8, 10, 14, 15)は未実装/特殊クラスのため対象外。
export const PROFESSIONS: Record<ProfessionKey, Profession> = {
  heavyGuardian: {
    key: 'heavyGuardian',
    professionId: 9,
    mainStat: 'strength',
    attackType: 'physical',
    element: 'rock',
    atkPerMainStatPoint: 0.6,
    hpPerEndurancePoint: 12,
    atkSpeedPerHastePercent: 0.6,
    castSpeedPerHastePercent: 1,
    staminaRegenPerSecond: 160,
    talentSchoolIds: [113, 114],
  },
  shieldFighter: {
    key: 'shieldFighter',
    professionId: 12,
    mainStat: 'strength',
    attackType: 'physical',
    element: 'light',
    atkPerMainStatPoint: 0.6,
    hpPerEndurancePoint: 12,
    atkSpeedPerHastePercent: 0.6,
    castSpeedPerHastePercent: 1,
    staminaRegenPerSecond: 160,
    talentSchoolIds: [122, 123],
  },
  galeLancer: {
    key: 'galeLancer',
    professionId: 4,
    mainStat: 'strength',
    attackType: 'physical',
    element: 'wind',
    atkPerMainStatPoint: 0.6,
    hpPerEndurancePoint: 6,
    atkSpeedPerHastePercent: 0.6,
    castSpeedPerHastePercent: 1,
    staminaRegenPerSecond: 160,
    talentSchoolIds: [107, 108],
  },
  stormBlade: {
    key: 'stormBlade',
    professionId: 1,
    mainStat: 'agility',
    attackType: 'physical',
    element: 'thunder',
    atkPerMainStatPoint: 0.6,
    hpPerEndurancePoint: 6,
    atkSpeedPerHastePercent: 0.6,
    castSpeedPerHastePercent: 1,
    staminaRegenPerSecond: 185,
    talentSchoolIds: [101, 102],
  },
  divineArcher: {
    key: 'divineArcher',
    professionId: 11,
    mainStat: 'agility',
    attackType: 'physical',
    element: 'light',
    atkPerMainStatPoint: 0.58,
    hpPerEndurancePoint: 6,
    atkSpeedPerHastePercent: 0.6,
    castSpeedPerHastePercent: 1,
    staminaRegenPerSecond: 185,
    talentSchoolIds: [116, 117],
  },
  frostMage: {
    key: 'frostMage',
    professionId: 2,
    mainStat: 'intellect',
    attackType: 'magical',
    element: 'ice',
    atkPerMainStatPoint: 0.5,
    hpPerEndurancePoint: 6.5,
    atkSpeedPerHastePercent: 0.2,
    castSpeedPerHastePercent: 2,
    staminaRegenPerSecond: 240,
    talentSchoolIds: [104, 105],
  },
  verdantOracle: {
    key: 'verdantOracle',
    professionId: 5,
    mainStat: 'intellect',
    attackType: 'magical',
    element: 'forest',
    atkPerMainStatPoint: 0.5,
    hpPerEndurancePoint: 6,
    atkSpeedPerHastePercent: 0.2,
    castSpeedPerHastePercent: 2,
    staminaRegenPerSecond: 240,
    talentSchoolIds: [110, 111],
  },
  beatPerformer: {
    key: 'beatPerformer',
    professionId: 13,
    mainStat: 'intellect',
    attackType: 'magical',
    element: 'fire',
    atkPerMainStatPoint: 0.5,
    hpPerEndurancePoint: 6,
    atkSpeedPerHastePercent: 0.6,
    castSpeedPerHastePercent: 2,
    staminaRegenPerSecond: 240,
    talentSchoolIds: [119, 120],
  },
  // TODO(シーズン3): 係数は未確認。近接・物理・筋力ベースの他クラス(galeLancer/
  // stormBlade)の値を暫定採用している。docs/STATUS_CALCULATION.md 方式でのゲーム内
  // 確認が取れ次第、正しい値に差し替えること。talentSchoolIds はZTable
  // (ProfessionSystemTable.ShowTalentStage)由来のため確定値。
  twinStriker: {
    key: 'twinStriker',
    professionId: 3,
    mainStat: 'strength',
    attackType: 'physical',
    element: 'fire',
    atkPerMainStatPoint: 0.6,
    hpPerEndurancePoint: 6,
    atkSpeedPerHastePercent: 0.6,
    castSpeedPerHastePercent: 1,
    staminaRegenPerSecond: 185,
    talentSchoolIds: [128, 129],
  },
};

// `src/data/classes.json`(ZTable由来)の `isOpen` フラグを見て、現在選択可能な
// (実装済みの)クラスかどうかを判定する。新クラス実装時はゲームデータ側のisOpenが
// trueになるが、ステータス計算係数(PROFESSIONS)の追加は別途必要。
export function isProfessionOpen(profession: Profession): boolean {
  return getClassData(profession.professionId)?.isOpen ?? false;
}

export function getOpenProfessions(): Profession[] {
  return Object.values(PROFESSIONS).filter(isProfessionOpen);
}

// "{クラス名}({型名})" 形式の表示ラベルを組み立てる(プラン名の初期値・共有テキスト等で共用)。
// tGameは `useTranslation('game-data')` のtをそのまま渡す。
export function formatProfessionLabel(
  professionKey: ProfessionKey,
  professionTypeKey: ProfessionTypeKey,
  tGame: (key: string, options: { defaultValue: string }) => string,
): string {
  const professionId = PROFESSIONS[professionKey].professionId;
  const showTalentStage = getClassData(professionId)?.showTalentStage ?? [];
  const typeStageId = showTalentStage[professionTypeKey === 'type1' ? 0 : 1];
  const className = tGame(`classes.${professionId}.name`, { defaultValue: professionKey });
  const typeName = typeStageId
    ? tGame(`talentStages.${typeStageId}.typeName`, { defaultValue: professionTypeKey })
    : professionTypeKey;
  return `${className}(${typeName})`;
}

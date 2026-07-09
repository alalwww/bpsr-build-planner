import type { StatId } from '../types';

// ZTableのAttrId/BuffId → アプリ内 StatId・効果のマッピング定義。
// calculateRawStats.ts / calculateAbilityScore.ts から参照される。

// アビリティツリー(talent-tree.json)の effects[n][0] (EffectType)。
export const TALENT_EFFECT_TYPE_FLAT_STAT = 1; // 平坦ステータス加算
export const TALENT_EFFECT_TYPE_TYPE1_FINAL_PCT = 3; // 型依存の最終%ボーナス(type1使用時のみ)
export const TALENT_EFFECT_TYPE_CONVERSION_RATE = 4; // メインステータス→他ステータスへの変換率ボーナス
export const TALENT_EFFECT_TYPE_SKILL_REPLACEMENT = 6; // スキル置き換え(fromSkillId→toSkillId)

// モジュールエフェクト(modules.json)の effects[n][0] (EffectType)。
export const MOD_EFFECT_TYPE_STAT = 1; // 通常のステータス加算
export const MOD_EFFECT_TYPE_ADAPTIVE = 5; // 適応ステータス・攻撃力(モジュール専用)

// 潜在因子/絆レベル(phantom-factors.json, season-talents.json)の effects[n][0] (EffectType)。
export const PHANTOM_EFFECT_TYPE_STAT = 1; // 平坦ステータス加算・%乗算値
export const PHANTOM_EFFECT_TYPE_POLARITY = 3; // 極性バフ/絆レベルのBuffId参照(boost/penalty)

// アビリティ type=1 効果 (平坦加算) の AttrId → StatId マッピング
export const TALENT_ATTR_TO_STAT: Partial<Record<number, StatId>> = {
  11012: 'strength',
  11022: 'intellect',
  11032: 'agility',
  11042: 'endurance',
  11112: 'crit',
  11122: 'haste',
  11132: 'luck',
  11142: 'mastery',
  11152: 'versatility',
  11332: 'atk',
  11342: 'matk',
  11352: 'physicalDef',
};

// アビリティ type=3 効果(BuffId参照)のうち、型(ProfessionTypeKey)によって内容が変わるもの。
// ZTable側に型別のパラメータテーブルがないため、説明文(game-data.json)から手動で値を確定している。
export interface TalentType1OnlyFinalPct {
  stat: StatId;
  value: number; // 単位: 1/10000 (2000 → 20%)
}

// ビートパフォーマーR1アビリティ「変奏」: 響奏型では効果内容が変わる(通常攻撃の変更)ため、
// 最大HP+20%は狂音型(type1)使用時のみ適用する。
export const TALENT_TYPE1_ONLY_FINAL_PCT: Partial<Record<number, TalentType1OnlyFinalPct>> = {
  2207340: { stat: 'maxHp', value: 2000 },
};

// アビリティ type=1 効果のうち、attrIdが「攻撃速度」の%finalバリアント(単位1/10000)のもの。
// atkSpeedPercentはStatId(rawStats)ではなくDerivedStats側の値のため、TALENT_ATTR_TO_STAT/
// IMAGINARY_PCT_FINALには乗らず、deriveStats()への直接加算として個別に扱う
// (例: ディバインアーチャー「迅射」talentId 1135、他に talentId 41/42 も同じattrIdを使う)。
export const TALENT_ATK_SPEED_FINAL_PCT_ATTR_ID = 11722;

// アビリティ type=3 効果(BuffId参照)のうち、「会心/ファスト/幸運/器用さ/万能のうち
// 最終値が最も高い1項目」に最終%加算するもの(HP変動/鼓舞と同じ加算方式・単位。
// LIFE_WAVE_VALUES/INSPIRATION_VALUESと同じ%そのままの数値、350ではなく3.5→+3.5%)。
// 型に関わらず常に適用される。
// フロストメイジR1アビリティ「二段増幅」: 該当5ステータスのうち最終値最大の1項目+3.5%。
export const TALENT_HIGHEST_OF_FINAL_PCT: Partial<Record<number, number>> = {
  2204340: 3.5,
};

export const LEVEL_ATTR_TO_STAT: Partial<Record<number, StatId>> = {
  11012: 'strength',
  11022: 'intellect',
  11032: 'agility',
  11042: 'endurance',
};

// 絆レベル effectType=3 BuffId → ステータス効果マッピング
export type BondBuffStatEffect =
  | { type: 'static'; stat: StatId; value: number }
  | { type: 'highest_of'; stats: StatId[]; value: number }
  // 最終%ボーナスへの直接加算(finalPctAddendと同じ単位: 100 = 1%)
  | { type: 'final_pct'; stat: StatId; value: number }
  // クラスのメインステータス(筋力/知力/敏捷)への平坦加算
  | { type: 'main_stat'; value: number }
  // 現時点のtotal[sourceStat]にratioを乗じてtargetStatへ加算
  | { type: 'ratio_of'; sourceStat: StatId; targetStat: StatId; ratio: number };

export const BOND_BUFF_STAT_EFFECTS: Partial<Record<number, BondBuffStatEffect[]>> = {
  // 幻夢強度+100。耐久力+500
  3003610: [
    { type: 'static', stat: 'illusionPower', value: 100 },
    { type: 'static', stat: 'endurance', value: 500 },
  ],
  3003620: [
    { type: 'static', stat: 'illusionPower', value: 100 },
    { type: 'static', stat: 'endurance', value: 500 },
  ],
  3003640: [
    { type: 'static', stat: 'illusionPower', value: 100 },
    { type: 'static', stat: 'endurance', value: 500 },
  ],
  // 会心、ファスト、幸運、器用さ、万能のうち最も高い1項目+300。耐久力+500
  3003630: [
    {
      type: 'highest_of',
      stats: ['crit', 'haste', 'luck', 'mastery', 'versatility'],
      value: 300,
    },
    { type: 'static', stat: 'endurance', value: 500 },
  ],
  // 会心、ファスト、幸運、器用さ、万能のうち最も高い1項目+500。耐久力+500
  3003650: [
    {
      type: 'highest_of',
      stats: ['crit', 'haste', 'luck', 'mastery', 'versatility'],
      value: 500,
    },
    { type: 'static', stat: 'endurance', value: 500 },
  ],
  // 幸運+1%
  3003660: [{ type: 'final_pct', stat: 'luck', value: 100 }],
  // 会心+1%
  3003670: [{ type: 'final_pct', stat: 'crit', value: 100 }],
  // 物理防御力50ptにつき、攻撃力+1pt
  3003720: [{ type: 'ratio_of', sourceStat: 'physicalDef', targetStat: 'atk', ratio: 1 / 50 }],
  // 現在のメインステータス+100
  3003730: [{ type: 'main_stat', value: 100 }],
};

// 潜在因子 effectType=1 AttrId → StatId マッピング（平坦加算値。末尾が2のIDは加算、4のIDは%乗算のため別扱い）
export const PHANTOM_ATTR_TO_STAT: Partial<Record<number, StatId>> = {
  11012: 'strength',
  11022: 'intellect',
  11032: 'agility',
  11042: 'endurance',
  11322: 'maxHp',
  11352: 'physicalDef',
  11442: 'illusionPower',
  13002: 'allAttrStr',
  13202: 'allAttrResist',
  11802: 'receivedRecovery',
  11812: 'barrierStrength',
};

// 潜在因子 effectType=3 極性バフ (BuffId → boost/penalty stat, pars index)
// pars 単位: 100 = 1% (renderEffectDesc の pAsPercent と同様)
// 効果: boost_stat *= (1 + pars[boostIdx] / 10000), penalty_stat *= (1 - pars[penaltyIdx] / 10000)
export interface PolarityEffect {
  boostStat: StatId;
  boostIdx: number;
  penaltyStat: StatId;
  penaltyIdx: number;
}

export const FACTOR_POLARITY_EFFECTS: Partial<Record<number, PolarityEffect>> = {
  3058050: { boostStat: 'crit', boostIdx: 1, penaltyStat: 'mastery', penaltyIdx: 0 }, // 会心+, 器用さ(mastery)-
  3058060: { boostStat: 'luck', boostIdx: 1, penaltyStat: 'haste', penaltyIdx: 0 }, // 幸運+, ファスト-
  3058070: { boostStat: 'mastery', boostIdx: 1, penaltyStat: 'luck', penaltyIdx: 0 }, // 器用さ(mastery)+, 幸運-
  3058080: { boostStat: 'haste', boostIdx: 1, penaltyStat: 'crit', penaltyIdx: 0 }, // ファスト+, 会心-
};

// 潜在レベルアップ AttrId → StatId マッピング
export const PHANTOM_LEVEL_ATTR_TO_STAT: Partial<Record<number, StatId>> = {
  11442: 'illusionPower',
  11042: 'endurance',
};

// モジュールエフェクト EffectType=1 AttrId → StatId マッピング
export const MOD_ATTR_TO_STAT: Partial<Record<number, StatId>> = {
  11012: 'strength',
  11022: 'intellect',
  11032: 'agility',
  11042: 'endurance',
  11112: 'crit',
  11122: 'haste',
  11132: 'luck',
  11142: 'mastery',
  11152: 'versatility',
  11322: 'maxHp',
  11332: 'atk',
  11342: 'matk',
  11352: 'physicalDef',
};

// モジュール専用の「適応」効果 (EffectType=5)。クラスのメインステータス/攻撃タイプに
// 応じて実際のステータスへ加算する。値は数値そのもの(%ではない)。
export const MOD_ADAPTIVE_MAIN_STAT_ATTR_ID = 99005; // 適応筋力/知力/敏捷 → profession.mainStat
export const MOD_ADAPTIVE_ATK_ATTR_ID = 99006; // 適応物理/魔法攻撃力 → profession.attackTypeに応じ atk/matk

// 精錬効果(RefineTable)のAttrId。1つのattrIdが複数ステータス(実数値+内訳表示用の
// refineXxx)へ加算されるため、他の attrId→StatId マップとは異なり個別定数として定義する。
export const REFINE_ATK_ATTR_ID = 11412; // 精錬物攻 → atk + refinePhysAtk
export const REFINE_MATK_ATTR_ID = 11432; // 精錬魔攻 → matk + refineMagAtk
export const REFINE_DEF_ATTR_ID = 11422; // 精錬防御力 → physicalDef + magicalDef + refineDef
export const REFINE_ENDURANCE_ATTR_ID = 11042; // 精錬耐久 → endurance

// EquipAttrLibTable の AttrId → StatId マッピング。
export const EQUIP_ATTR_TO_STAT: Partial<Record<number, StatId>> = {
  11442: 'illusionPower',
  11332: 'atk',
  11342: 'matk',
  11352: 'physicalDef',
  11012: 'strength',
  11022: 'intellect',
  11032: 'agility',
  11042: 'endurance',
};

// 装着効果(エンチャント) AttrId → StatId マッピング。
// 11502(全属性攻撃力)は atk/matk 両方に加算するため、このマップには含めず別途処理。
export const ENCHANT_ATTR_TO_STAT: Partial<Record<number, StatId>> = {
  11012: 'strength',
  11022: 'intellect',
  11032: 'agility',
  11042: 'endurance',
  11112: 'crit',
  11122: 'haste',
  11132: 'luck',
  11142: 'mastery',
  11152: 'versatility',
};

// 進化ステータス固定効果 AttrId → StatId (fixedEvolutionStats の isPercent=false エントリ用)
export const EVO_ATTR_TO_STAT: Partial<Record<number, StatId>> = {
  11112: 'crit',
  11122: 'haste',
  11132: 'luck',
  11142: 'mastery',
  11152: 'versatility',
};

// 進化ステータス固定効果 AttrId → StatId (fixedEvolutionStats の isPercent=true エントリ用。
// 蒼海武器シリーズ等)。対象ステータスはderiveStats側で収益減少曲線を経由しない固定基礎%への
// 直接加算(会心ダメージ/幸運の一撃ダメージ率/会心回復/バリア強度)か、物理・魔法増強であり、
// 単純な%乗算ではないため実数値の平坦加算として扱う。
// (会心/幸運/ファスト/器用さの"%"バリアントはEVO_PCT_FINAL_ATTR_TO_STAT側を参照)
export const EVO_PCT_ATTR_TO_STAT: Partial<Record<number, StatId>> = {
  11812: 'barrierStrength',
  12552: 'physicalEnhance',
  12572: 'magicalEnhance',
  12512: 'critDamageBonus',
  12532: 'luckyHitDamageBonus',
  12742: 'critRecoveryBonus',
};

// 進化ステータス固定効果 AttrId → StatId (fixedEvolutionStats の isPercent=true エントリのうち、
// 会心/幸運/ファスト/器用さの"%"バリアント。既存のflat系attrId(11112/11132/11122/11142)と
// game-data.json上で同名のため、収益逓減カーブ適用後の最終%への乗算ボーナスとして扱う
// (IMAGINARY_PCT_FINALと同じ意味・同じ単位: 1/10000)。
export const EVO_PCT_FINAL_ATTR_TO_STAT: Partial<Record<number, StatId>> = {
  11712: 'crit',
  11782: 'luck',
  11932: 'haste',
  11942: 'mastery',
};

// 刻印(伝説刻印) AttrId → 最終ステータスへの%乗算(武器/アクセサリのみ・isPercent=true)。
// 2400001/2400002はeffectType=3の特殊関数効果(物理/魔法攻撃力ボーナス)で、意味的には
// 11334/11344と同じ物理/魔法攻撃力%ボーナスのため同じバケツに集約する。
export const AFFIX_STAT_EFFECTS: Record<number, { statId: StatId }> = {
  11334: { statId: 'atk' },
  11344: { statId: 'matk' },
  2400001: { statId: 'atk' },
  2400002: { statId: 'matk' },
};

// 刻印(伝説刻印) AttrId → rawStatsへの平坦加算(防具のみ・isPercent=false)。
// 筋力/知力/敏捷(11014/11024/11034)は防具でも%扱いのため IMAGINARY_PCT_BASE 側で処理する。
export const LEGENDARY_AFFIX_FLAT_STAT: Partial<Record<number, StatId>> = {
  11322: 'maxHp',
  11352: 'physicalDef',
  13202: 'allAttrResist',
};

// Base stat (strength/intellect/agility/endurance) percentage bonuses applied to rawStats before deriveStats.
// Unit: 1/10000 (value 600 → 6%).
export const IMAGINARY_PCT_BASE: Partial<Record<number, StatId>> = {
  11014: 'strength',
  11024: 'intellect',
  11034: 'agility',
  11044: 'endurance',
};

// Final stat percentage bonuses applied after deriveStats + affix multipliers.
// Unit: 1/10000 (value 3584 → 35.84%).
export const IMAGINARY_PCT_FINAL = {
  11324: 'maxHp',
  11334: 'atk',
  11344: 'matk',
  11354: 'physicalDef',
} as const;
export type ImaginaryFinalStatId = keyof typeof IMAGINARY_PCT_FINAL;

// バトルイマジン パッシブの会心/ファスト/幸運/器用さ/万能は、筋力等と違って%専用のAttrIdを
// 持たず、TALENT/MOD/ENCHANT等と同じ実数値レーティングとして加算される(収益減少カーブは
// deriveStats側で一括適用されるため、ここで%として扱うと二重に乗算されてしまう)。
export const IMAGINARY_FLAT_STAT: Partial<Record<number, StatId>> = {
  11112: 'crit',
  11122: 'haste',
  11132: 'luck',
  11142: 'mastery',
  11152: 'versatility',
};

// 心相ツリーの固定ノード(nodeType=1, ordinaryEffect)は大半がスキル固有/条件付き効果
// (このアプリの静的ステータスモデルでは表現不可)だが、一部は単純なステータスボーナスとして
// 表現できる。BuffId(effectType=3の第2要素)ごとに手動で対応付ける。
export type OrdinaryEffectBonus =
  { kind: 'flat'; stat: StatId; value: number } | { kind: 'finalPct'; stat: StatId; value: number };

export const ORDINARY_EFFECT_BONUS: Partial<Record<number, OrdinaryEffectBonus>> = {
  // 瞬間ブレス: 戦闘中のスタミナ回復+35pt/秒(移動速度+10%は対応するStatIdが無いため対象外)
  3002090: { kind: 'flat', stat: 'staminaRegen', value: 35 },
  // 物理防御力+15%(無条件の固定ノード)
  3003280: { kind: 'finalPct', stat: 'physicalDef', value: 1500 },
};

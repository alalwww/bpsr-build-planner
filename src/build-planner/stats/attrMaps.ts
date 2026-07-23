import type { ElementId, StatId } from '../types';

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

// 属性(「全」を除く8属性)ごとの属性攻撃力/属性強度 AttrId → StatId マッピング。
// クラスアビリティの小ノード(weaponGroup:0の共通ノード、例: talentId 20〜27)等で使われる。
export const ELEMENT_ATK_STAT: Record<ElementId, StatId> = {
  fire: 'fireAtk',
  ice: 'iceAtk',
  forest: 'forestAtk',
  thunder: 'thunderAtk',
  wind: 'windAtk',
  rock: 'rockAtk',
  light: 'lightAtk',
  dark: 'darkAtk',
};
// 属性別の属性強度は現状ゲームデータ上に個別AttrIdの使用例がなく、シロップ/脊椎試薬
// (料理バフ)による加算のみが実際のソース。属性ボーナス%算出時にallAttrStrと合算する。
export const ELEMENT_ATTR_STR_STAT: Record<ElementId, StatId> = {
  fire: 'fireAttrStr',
  ice: 'iceAttrStr',
  forest: 'forestAttrStr',
  thunder: 'thunderAttrStr',
  wind: 'windAttrStr',
  rock: 'rockAttrStr',
  light: 'lightAttrStr',
  dark: 'darkAttrStr',
};

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
  // 属性攻撃力(個別属性): 全クラス共通の小ノード(例: talentId 20〜27)で使われる。
  11512: ELEMENT_ATK_STAT.fire,
  11522: ELEMENT_ATK_STAT.ice,
  11532: ELEMENT_ATK_STAT.forest,
  11542: ELEMENT_ATK_STAT.thunder,
  11552: ELEMENT_ATK_STAT.wind,
  11562: ELEMENT_ATK_STAT.rock,
  11572: ELEMENT_ATK_STAT.light,
  11582: ELEMENT_ATK_STAT.dark,
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
// IMAGINE_PCT_FINALには乗らず、deriveStats()への直接加算として個別に扱う
// (例: ディバインアーチャー「迅射」talentId 1135、他に talentId 41/42 も同じattrIdを使う)。
//
// 同じattrIdはtype=4(TALENT_EFFECT_TYPE_CONVERSION_RATE)効果でも使われるが、そちらは
// 「ファスト%→攻撃速度%の変換率そのものへのボーナス」という別の意味(例: ストームブレイド/
// ツインストライカー/ゲイルランサー「迅速」talentId 135/301/435「ファスト1%につき攻撃速度+1%」)。
// TALENT_ATTR_TO_STATにはrawStats側のStatIdしか載せられないため、calculateRawStats.tsの
// type=4分岐でこの定数と直接比較し、atkSpeedPerHastePercentBonusとして個別集計する。
export const TALENT_ATK_SPEED_FINAL_PCT_ATTR_ID = 11722;

// アビリティ type=3 効果(BuffId参照)のうち、「会心/ファスト/幸運/器用さ/万能のうち
// 最終値が最も高い1項目」に最終%加算するもの(HP変動/鼓舞と同じ加算方式・単位。
// LIFE_WAVE_VALUES/INSPIRATION_VALUESと同じ%そのままの数値、350ではなく3.5→+3.5%)。
// 型に関わらず常に適用される。
// フロストメイジR1アビリティ「二段増幅」: 該当5ステータスのうち最終値最大の1項目+3.5%。
export const TALENT_HIGHEST_OF_FINAL_PCT: Partial<Record<number, number>> = {
  2204340: 3.5,
};

// アビリティ type=3 効果(BuffId参照)のうち、型に関わらず常に適用される、特定の1ステータスへの
// 平坦加算。会心回復等、収益逓減カーブを経由しないraw値(EVO_PCT_ATTR_TO_STAT等と同じ単位:
// 100 = 1%)を対象とする効果に使う。
// ビートパフォーマー響奏型R2アビリティ「会心回復」: 会心回復+25%。
// ストームブレイドR2アビリティ「爆裂」: 会心ダメージ+10%。
// ツインストライカーR2アビリティ「炎舞破斬」: 会心ダメージ+8%。
export const TALENT_FLAT_PCT_TO_STAT: Partial<Record<number, { stat: StatId; value: number }>> = {
  2207210: { stat: 'critRecoveryBonus', value: 2500 },
  2200540: { stat: 'critDamageBonus', value: 1000 },
  2208520: { stat: 'critDamageBonus', value: 800 },
};

// アビリティ type=3 効果(BuffId参照)のうち、型に関わらず常に適用される、rawStats側の実数値
// ステータスへの平坦加算(TALENT_ATTR_TO_STATのtype=1加算と同じ単位・同じaddStat経路。
// 会心/ファスト等は収益逓減カーブの対象になる)。TALENT_FLAT_PCT_TO_STATとは異なり、
// 対象は「%そのものの最終値」ではなく「カーブ適用前の実数値レーティング」である点に注意。
// フロストメイジR2アビリティ「高速詠唱」: ファスト+2500(パーマフロスト中の詠唱速度+15%は
// 状態依存の条件付き効果のため対象外)。
export const TALENT_RAW_FLAT_TO_STAT: Partial<Record<number, { stat: StatId; value: number }>> = {
  2204640: { stat: 'haste', value: 2500 },
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

// レベル1〜5(unlockFraction 2/5/12/20/25)は全8テンプレート共通の絆報酬(累積加算される)。
// レベル6(unlockFraction 35)のみテンプレートごとに異なる固有報酬(buffId 3003660〜3003730、
// テンプレート1体につき1種類)。値は`src/locales/*/game-data.json`の`attrDescs.{buffId}`
// (ゲーム内説明文、静的テキストでbuffPars非依存)から直接確認済み。
export const BOND_BUFF_STAT_EFFECTS: Partial<Record<number, BondBuffStatEffect[]>> = {
  // Lv1(2pt)/Lv2(5pt)/Lv4(20pt) 共通: 滅妄強度+100。耐久力+750
  3003610: [
    { type: 'static', stat: 'illusionPower', value: 100 },
    { type: 'static', stat: 'endurance', value: 750 },
  ],
  3003620: [
    { type: 'static', stat: 'illusionPower', value: 100 },
    { type: 'static', stat: 'endurance', value: 750 },
  ],
  3003640: [
    { type: 'static', stat: 'illusionPower', value: 100 },
    { type: 'static', stat: 'endurance', value: 750 },
  ],
  // Lv3(12pt): 会心、ファスト、幸運、器用さ、万能のうち最も高い1項目+750。耐久力+750
  3003630: [
    {
      type: 'highest_of',
      stats: ['crit', 'haste', 'luck', 'mastery', 'versatility'],
      value: 750,
    },
    { type: 'static', stat: 'endurance', value: 750 },
  ],
  // Lv5(25pt): 会心、ファスト、幸運、器用さ、万能のうち最も高い1項目+1250。耐久力+750
  3003650: [
    {
      type: 'highest_of',
      stats: ['crit', 'haste', 'luck', 'mastery', 'versatility'],
      value: 1250,
    },
    { type: 'static', stat: 'endurance', value: 750 },
  ],
  // Lv6(35pt)固有報酬。テンプレート1「幸運+1%」
  3003660: [{ type: 'final_pct', stat: 'luck', value: 100 }],
  // テンプレート2「会心+1%」
  3003670: [{ type: 'final_pct', stat: 'crit', value: 100 }],
  // テンプレート3「マスタリースキルの虚妄ダメージ+6%」はスキル固有効果のため対象外
  // (静的ステータスモデルでは表現不可)。
  // テンプレート4「滅妄ダメージ+4%」・テンプレート5「滅妄ダメージ+2%」も対応するStatIdが
  // 存在しないため対象外(illusionPowerは実数値の"滅妄強度"であり、ダメージ%とは別軸)。
  // テンプレート6「寂滅の夢の影響を受けている対象を攻撃すると、会心確率、幸運確率+2%」は
  // 対象の状態異常に依存する条件付き効果のため対象外。
  // テンプレート7「物理防御力75ptにつき、攻撃力+1pt」
  3003720: [{ type: 'ratio_of', sourceStat: 'physicalDef', targetStat: 'atk', ratio: 1 / 75 }],
  // テンプレート8「現在のメインステータス+150」
  3003730: [{ type: 'main_stat', value: 150 }],
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
  13002: 'allAttrStr',
  // 会心ダメージ/会心回復(「集中・会心」等): EVO_PCT_ATTR_TO_STATと同じattrId・同じ単位
  // (100=1%)のrawStats項目のため、他のMOD_ATTR_TO_STATエントリと同様addStat()にそのまま乗る。
  12512: 'critDamageBonus',
  12742: 'critRecoveryBonus',
  // 物理軽減/魔法軽減(「物理耐性」「魔法耐性」)。単位は他の%系attrIdと同じ100=1%。
  // 12562はProfileAttrTable(ZTable)側に表示名を持たないattrIdだが、MOD_ATTR_TO_STATに
  // マッピングすることでformatEffectDesc/tStat側の名前(buildPlanner.stats.*)が使われる
  // ため、ZTableの名前欠落を気にせず解決できる(12512/12742と同じ理由)。
  12562: 'physicalReductionBonus',
  12582: 'magicalReductionBonus',
  // 幸運の一撃ダメージ率(「集中・幸運」等): EVO_PCT_ATTR_TO_STATの12532と同じrawStats項目。
  12532: 'luckyHitDamageBonus',
  // 幸運の一撃回復の倍率(「集中・幸運」等)。12722もProfileAttrTableに表示名を持たない
  // attrIdだが、12562/12582と同じ理由でMOD_ATTR_TO_STAT経由なら問題にならない。
  12722: 'luckyHitRecoveryBonus',
  // 物理防御力無視(「筋力強化」等)。
  11392: 'physicalDefIgnoreBonus',
};

// モジュール専用の「適応」効果 (EffectType=5)。クラスのメインステータス/攻撃タイプに
// 応じて実際のステータスへ加算する。値は数値そのもの(%ではない)。
export const MOD_ADAPTIVE_MAIN_STAT_ATTR_ID = 99005; // 適応筋力/知力/敏捷 → profession.mainStat
export const MOD_ADAPTIVE_ATK_ATTR_ID = 99006; // 適応物理/魔法攻撃力 → profession.attackTypeに応じ atk/matk

// モジュール専用: 詠唱速度の%finalバリアント(「集中・詠唱」等)。攻撃速度側の
// TALENT_ATK_SPEED_FINAL_PCT_ATTR_ID(11722)と同じ理由でStatId(rawStats)を持たず
// castSpeedPercentはDerivedStats側の値のため、MOD_ATTR_TO_STATには含めず
// calculateRawStats()内で個別集計し、deriveStats()へcastSpeedFinalPctAddendとして渡す。
export const MOD_CAST_SPEED_FINAL_PCT_ATTR_ID = 11732;

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
  // 物理/魔法攻撃力(例: 「荒野カニクモの刻印」matk+38、耳飾り/首飾り/指輪等の装着効果)。
  11332: 'atk',
  11342: 'matk',
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
// 会心/幸運/ファスト/器用さ/万能の"%"バリアント。既存のflat系attrId(11112/11132/11122/11142/
// 11152)とgame-data.json上で同名のため、収益逓減カーブ適用後の最終%への乗算ボーナスとして扱う
// (IMAGINE_PCT_FINALと同じ意味・同じ単位: 1/10000)。
// 11952(万能)は蒼海武器レアステータスでのみ確認。他4件と同じ命名規則・並び(11712/11782/
// 11932/11942の次)であることからの類推であり、ゲーム内表示での実測未確認。
export const EVO_PCT_FINAL_ATTR_TO_STAT: Partial<Record<number, StatId>> = {
  11712: 'crit',
  11782: 'luck',
  11932: 'haste',
  11942: 'mastery',
  11952: 'versatility',
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
// 筋力/知力/敏捷(11014/11024/11034)は防具でも%扱いのため IMAGINE_PCT_BASE 側で処理する。
export const LEGENDARY_AFFIX_FLAT_STAT: Partial<Record<number, StatId>> = {
  11322: 'maxHp',
  11352: 'physicalDef',
  13202: 'allAttrResist',
};

// Base stat (strength/intellect/agility/endurance) percentage bonuses applied to rawStats before deriveStats.
// Unit: 1/10000 (value 600 → 6%).
export const IMAGINE_PCT_BASE: Partial<Record<number, StatId>> = {
  11014: 'strength',
  11024: 'intellect',
  11034: 'agility',
  11044: 'endurance',
};

// Final stat percentage bonuses applied after deriveStats + affix multipliers.
// Unit: 1/10000 (value 3584 → 35.84%).
export const IMAGINE_PCT_FINAL = {
  11324: 'maxHp',
  11334: 'atk',
  11344: 'matk',
  11354: 'physicalDef',
} as const;
export type ImagineFinalStatId = keyof typeof IMAGINE_PCT_FINAL;

// バトルイマジン パッシブの会心/ファスト/幸運/器用さ/万能は、筋力等と違って%専用のAttrIdを
// 持たず、TALENT/MOD/ENCHANT等と同じ実数値レーティングとして加算される(収益減少カーブは
// deriveStats側で一括適用されるため、ここで%として扱うと二重に乗算されてしまう)。
export const IMAGINE_FLAT_STAT: Partial<Record<number, StatId>> = {
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

import { describe, expect, it } from 'vitest';
import { PROFESSIONS } from '../profession';
import type { StatId } from '../types';
import { BASE_STATS } from './baseStats';
import { COMMON_STAT_COEFFICIENTS } from './commonCoefficients';
import {
  deriveStats,
  recalculateLuckyHitMultipliers,
  recalculateSpeedPercents,
} from './deriveStats';
import { diminishingPercent } from './formulas';
import {
  DIMINISHING_A_BASE_PERCENT,
  FIXED_BASE_PERCENT,
  SEASON_CONSTANTS,
} from './seasonConstants';

function zeroRaw(): Record<StatId, number> {
  return Object.fromEntries(
    (Object.keys(BASE_STATS) as StatId[]).map((statId) => [statId, 0]),
  ) as Record<StatId, number>;
}

describe('deriveStats', () => {
  it('degenerates every diminishing-returns stat to its base percentage when raw is all zero', () => {
    const result = deriveStats(zeroRaw(), PROFESSIONS.stormBlade);

    expect(result.maxHp).toBe(0);
    expect(result.physicalAtk).toBe(0);
    expect(result.magicalAtk).toBe(0);
    expect(result.physicalDef).toBe(0);
    expect(result.magicalDef).toBe(0);
    expect(result.critPercent).toBe(DIMINISHING_A_BASE_PERCENT.crit);
    expect(result.hastePercent).toBe(DIMINISHING_A_BASE_PERCENT.haste);
    expect(result.luckPercent).toBe(DIMINISHING_A_BASE_PERCENT.luck);
    expect(result.masteryPercent).toBe(DIMINISHING_A_BASE_PERCENT.mastery);
    expect(result.versatilityPercent).toBe(0);
    expect(result.resistPercent).toBe(DIMINISHING_A_BASE_PERCENT.resist);
    expect(result.physicalBoostPercent).toBe(0);
    expect(result.magicalBoostPercent).toBe(0);
    expect(result.staminaRegenPerSecond).toBe(PROFESSIONS.stormBlade.staminaRegenPerSecond);
  });

  it('routes the main stat bonus to physicalAtk for a physical attacker (stormBlade, mainStat=agility)', () => {
    const profession = PROFESSIONS.stormBlade;
    const raw: Record<StatId, number> = {
      ...zeroRaw(),
      maxHp: 1000,
      atk: 500,
      matk: 300,
      physicalDef: 200,
      magicalDef: 150,
      strength: 100,
      agility: 200,
      intellect: 50,
      endurance: 80,
      crit: 3000,
      haste: 2000,
      luck: 1000,
      mastery: 4000,
      versatility: 2000,
      resist: 500,
      staminaRegen: 10,
      physicalEnhance: 3000,
      magicalEnhance: 1000,
      critDamageBonus: 500,
      luckyHitDamageBonus: 300,
      critRecoveryBonus: 200,
      physicalReductionBonus: 360,
      magicalReductionBonus: 480,
      luckyHitRecoveryBonus: 620,
      physicalDefIgnoreBonus: 1880,
    };

    const result = deriveStats(raw, profession);

    expect(result.maxHp).toBe(raw.maxHp + raw.endurance * profession.hpPerEndurancePoint);
    expect(result.physicalAtk).toBe(raw.atk + raw.agility * profession.atkPerMainStatPoint);
    expect(result.magicalAtk).toBe(raw.matk);
    expect(result.physicalDef).toBe(
      raw.physicalDef + raw.strength * COMMON_STAT_COEFFICIENTS.physicalDefPerStrengthPoint,
    );
    expect(result.magicalDef).toBe(
      raw.magicalDef + raw.intellect * COMMON_STAT_COEFFICIENTS.magicalDefPerIntellectPoint,
    );

    expect(result.critPercent).toBeCloseTo(
      diminishingPercent(raw.crit, SEASON_CONSTANTS.diminishingA, DIMINISHING_A_BASE_PERCENT.crit),
    );
    const hasteReal = raw.haste + raw.agility * COMMON_STAT_COEFFICIENTS.hastePerAgilityPoint;
    expect(result.hastePercent).toBeCloseTo(
      diminishingPercent(
        hasteReal,
        SEASON_CONSTANTS.diminishingA,
        DIMINISHING_A_BASE_PERCENT.haste,
      ),
    );
    expect(result.atkSpeedPercent).toBeCloseTo(
      result.hastePercent * profession.atkSpeedPerHastePercent,
    );
    expect(result.castSpeedPercent).toBeCloseTo(
      result.hastePercent * profession.castSpeedPerHastePercent,
    );

    expect(result.luckPercent).toBeCloseTo(
      diminishingPercent(raw.luck, SEASON_CONSTANTS.diminishingA, DIMINISHING_A_BASE_PERCENT.luck),
    );
    expect(result.luckyHitDamageMultiplierPercent).toBeCloseTo(
      FIXED_BASE_PERCENT.luckyHitBase + 0.25 * result.luckPercent + raw.luckyHitDamageBonus / 100,
    );
    expect(result.luckyHitBoostPercent).toBe(result.luckPercent);

    expect(result.masteryPercent).toBeCloseTo(
      diminishingPercent(
        raw.mastery,
        SEASON_CONSTANTS.diminishingA,
        DIMINISHING_A_BASE_PERCENT.mastery,
      ),
    );

    expect(result.versatilityPercent).toBeCloseTo(
      diminishingPercent(raw.versatility, SEASON_CONSTANTS.diminishingVersatility),
    );
    expect(result.versatilityDamageBonusPercent).toBeCloseTo(result.versatilityPercent * 0.35);
    expect(result.versatilityDamageReductionPercent).toBeCloseTo(result.versatilityPercent * 0.15);

    expect(result.resistPercent).toBeCloseTo(
      diminishingPercent(
        raw.resist,
        SEASON_CONSTANTS.diminishingA,
        DIMINISHING_A_BASE_PERCENT.resist,
      ),
    );
    expect(result.resistDamageReductionPercent).toBe(FIXED_BASE_PERCENT.resistDamageReduction);

    expect(result.physicalBoostPercent).toBeCloseTo(
      diminishingPercent(raw.physicalEnhance, SEASON_CONSTANTS.diminishingEnhance),
    );
    expect(result.magicalBoostPercent).toBeCloseTo(
      diminishingPercent(raw.magicalEnhance, SEASON_CONSTANTS.diminishingEnhance),
    );

    expect(result.critDamageBonusPercent).toBe(
      FIXED_BASE_PERCENT.critDamage + raw.critDamageBonus / 100,
    );
    expect(result.critRecoveryPercent).toBe(
      FIXED_BASE_PERCENT.critRecovery + raw.critRecoveryBonus / 100,
    );
    expect(result.physicalReductionPercent).toBe(raw.physicalReductionBonus / 100);
    expect(result.magicalReductionPercent).toBe(raw.magicalReductionBonus / 100);
    expect(result.luckyHitRecoveryMultiplierPercent).toBe(
      FIXED_BASE_PERCENT.luckyHitBase + 0.25 * result.luckPercent + raw.luckyHitRecoveryBonus / 100,
    );
    expect(result.physicalDefIgnorePercent).toBe(raw.physicalDefIgnoreBonus / 100);
    expect(result.staminaRegenPerSecond).toBe(profession.staminaRegenPerSecond + raw.staminaRegen);
  });

  it('routes the main stat bonus to magicalAtk for a magical attacker (frostMage, mainStat=intellect)', () => {
    const profession = PROFESSIONS.frostMage;
    const raw: Record<StatId, number> = {
      ...zeroRaw(),
      atk: 100,
      matk: 200,
      intellect: 150,
      agility: 999, // 物理攻撃側のメインステータスではないため無視されることを確認
    };

    const result = deriveStats(raw, profession);

    expect(result.physicalAtk).toBe(raw.atk);
    expect(result.magicalAtk).toBe(raw.matk + raw.intellect * profession.atkPerMainStatPoint);
  });

  it('adds conversionRateBonus (R1 ability) on top of the base conversion rate for atk/physicalDef/haste', () => {
    const profession = PROFESSIONS.stormBlade; // physical, mainStat=agility
    const raw: Record<StatId, number> = {
      ...zeroRaw(),
      agility: 200,
      strength: 100,
      haste: 500,
    };

    const withoutBonus = deriveStats(raw, profession);
    const withBonus = deriveStats(raw, profession, { atk: 0.125, physicalDef: 0.6667, haste: 0.2 });

    expect(withBonus.physicalAtk).toBe(withoutBonus.physicalAtk + raw.agility * 0.125);
    expect(withBonus.physicalDef).toBe(withoutBonus.physicalDef + raw.strength * 0.6667);
    // hasteはdiminishingPercent経由なので実数値側で比較する
    const hasteRealWithoutBonus =
      raw.haste + raw.agility * COMMON_STAT_COEFFICIENTS.hastePerAgilityPoint;
    const hasteRealWithBonus =
      raw.haste + raw.agility * (COMMON_STAT_COEFFICIENTS.hastePerAgilityPoint + 0.2);
    expect(withBonus.hastePercent).toBeCloseTo(
      diminishingPercent(
        hasteRealWithBonus,
        SEASON_CONSTANTS.diminishingA,
        DIMINISHING_A_BASE_PERCENT.haste,
      ),
    );
    expect(withBonus.hastePercent).not.toBe(withoutBonus.hastePercent);
    expect(hasteRealWithBonus).toBeGreaterThan(hasteRealWithoutBonus);
  });

  it('adds atkSpeedFinalPctAddend (e.g. divineArcher "迅射") directly on top of the haste-derived atkSpeedPercent', () => {
    const profession = PROFESSIONS.divineArcher;
    const raw: Record<StatId, number> = { ...zeroRaw(), agility: 200, haste: 500 };

    const withoutAbility = deriveStats(raw, profession);
    const withAbility = deriveStats(raw, profession, {}, 3);

    expect(withAbility.atkSpeedPercent).toBeCloseTo(withoutAbility.atkSpeedPercent + 3);
    // castSpeedPercentはatkSpeedとは独立した値のため、attrIdがatkSpeed専用のこの加算では変化しない。
    expect(withAbility.castSpeedPercent).toBe(withoutAbility.castSpeedPercent);
  });

  it('multiplies hastePercent by atkSpeedPerHastePercentBonus (e.g. stormBlade "迅速") on top of the base per-class rate', () => {
    const profession = PROFESSIONS.stormBlade; // atkSpeedPerHastePercent = 0.6
    const raw: Record<StatId, number> = { ...zeroRaw(), agility: 200, haste: 500 };

    const withoutAbility = deriveStats(raw, profession);
    const withAbility = deriveStats(raw, profession, {}, 0, 1);

    expect(withAbility.hastePercent).toBe(withoutAbility.hastePercent);
    expect(withAbility.atkSpeedPercent).toBeCloseTo(
      withAbility.hastePercent * (profession.atkSpeedPerHastePercent + 1),
    );
    expect(withAbility.atkSpeedPercent).toBeGreaterThan(withoutAbility.atkSpeedPercent);
    // castSpeedPercentはファスト%→攻撃速度%の変換率とは独立しているため変化しない。
    expect(withAbility.castSpeedPercent).toBe(withoutAbility.castSpeedPercent);
  });

  it('adds castSpeedFinalPctAddend (e.g. module "集中・詠唱") directly on top of the haste-derived castSpeedPercent', () => {
    const profession = PROFESSIONS.divineArcher;
    const raw: Record<StatId, number> = { ...zeroRaw(), agility: 200, haste: 500 };

    const withoutModule = deriveStats(raw, profession);
    const withModule = deriveStats(raw, profession, {}, 0, 0, 12);

    expect(withModule.castSpeedPercent).toBeCloseTo(withoutModule.castSpeedPercent + 12);
    // atkSpeedPercentは詠唱速度とは独立した値のため、attrIdがcastSpeed専用のこの加算では変化しない。
    expect(withModule.atkSpeedPercent).toBe(withoutModule.atkSpeedPercent);
  });

  it('adds luckyHitDamageRatioBonus (e.g. beatPerformer "幸運相乗") to the base 0.25 coefficient on luckPercent', () => {
    const profession = PROFESSIONS.beatPerformer;
    const raw: Record<StatId, number> = { ...zeroRaw(), luck: 1000 };

    const withoutAbility = deriveStats(raw, profession);
    const withAbility = deriveStats(raw, profession, {}, 0, 0, 0, 0.5);

    expect(withAbility.luckyHitDamageMultiplierPercent).toBeCloseTo(
      FIXED_BASE_PERCENT.luckyHitBase + (0.25 + 0.5) * withAbility.luckPercent,
    );
    expect(withAbility.luckyHitDamageMultiplierPercent).toBeGreaterThan(
      withoutAbility.luckyHitDamageMultiplierPercent,
    );
    // luckyHitBoostPercent/luckyHitRecoveryMultiplierPercentは幸運の一撃ダメージ倍率専用の
    // このボーナスとは独立した値のため変化しない。
    expect(withAbility.luckyHitBoostPercent).toBe(withoutAbility.luckyHitBoostPercent);
    expect(withAbility.luckyHitRecoveryMultiplierPercent).toBe(
      withoutAbility.luckyHitRecoveryMultiplierPercent,
    );
  });

  it('matches the user-reported damage-enhancement potion example (+640 real -> 5.4983%, k=11000)', () => {
    const profession = PROFESSIONS.stormBlade;
    const raw: Record<StatId, number> = { ...zeroRaw(), physicalEnhance: 640 };

    const result = deriveStats(raw, profession);

    expect(SEASON_CONSTANTS.diminishingEnhance).toBe(11000);
    expect(result.physicalBoostPercent).toBeCloseTo((100 * 640) / (640 + 11000), 4);
  });

  it('adds finalPctAddend.physicalEnhance/magicalEnhance (e.g. Azure Sea weapon "物理/魔法増強+n%") directly on top of the diminishing-curve result instead of merging into the same curve input as the potion', () => {
    const profession = PROFESSIONS.stormBlade;
    const raw: Record<StatId, number> = {
      ...zeroRaw(),
      physicalEnhance: 640,
      magicalEnhance: 640,
    };

    const withoutWeapon = deriveStats(raw, profession);
    // finalPctAddendはcalcStatValueと同じ実数値表記(100 = 1%)のため、500 = +5%。
    const withWeapon = deriveStats(raw, profession, {}, 0, 0, 0, 0, {
      physicalEnhance: 500,
      magicalEnhance: 500,
    });

    expect(withoutWeapon.physicalBoostPercent).toBeCloseTo(
      diminishingPercent(raw.physicalEnhance, SEASON_CONSTANTS.diminishingEnhance),
    );
    // +5%が収益逓減カーブを経由していれば640+500=1140を入力した値になるはずだが、そうならず
    // 単純加算になっていることを確認する(カーブ通過"後"の最終%への直接加算であることの検証)。
    expect(withWeapon.physicalBoostPercent).toBeCloseTo(withoutWeapon.physicalBoostPercent + 5);
    expect(withWeapon.magicalBoostPercent).toBeCloseTo(withoutWeapon.magicalBoostPercent + 5);
    expect(withWeapon.physicalBoostPercent).not.toBeCloseTo(
      diminishingPercent(1140, SEASON_CONSTANTS.diminishingEnhance),
    );
  });

  it('ignores unrelated conversionRateBonus keys (magical attacker does not get an atk bonus meant for physical)', () => {
    const profession = PROFESSIONS.frostMage; // magical, mainStat=intellect
    const raw: Record<StatId, number> = { ...zeroRaw(), atk: 100, intellect: 150 };

    // atk bonus should have no effect on a magical attacker; only matk would.
    const result = deriveStats(raw, profession, { atk: 0.5 });

    expect(result.physicalAtk).toBe(raw.atk);
  });
});

describe('recalculateSpeedPercents', () => {
  it('converts the full final haste% (post finalPctAddend/imagine/cooking bonuses) through the same per-class coefficient used by deriveStats, unlike the raw-hastePercent-only intermediate value (e.g. ストームブレイド月影型 weapon "ファスト+6%" bug report: 6% haste at a 1.6 total coefficient = +9.6% atk speed)', () => {
    const profession = PROFESSIONS.stormBlade; // atkSpeedPerHastePercent = 0.6
    // +1.0 bonus mirrors the R1 ability "迅速" (see the deriveStats test above), giving a 1.6 total coefficient.
    const result = recalculateSpeedPercents(6, profession, 1, 0, 0);

    expect(result.atkSpeedPercent).toBeCloseTo(6 * 1.6);
  });

  it('still adds atkSpeedFinalPctAddend/castSpeedFinalPctAddend directly on top, same as the initial deriveStats computation', () => {
    const profession = PROFESSIONS.divineArcher;
    const result = recalculateSpeedPercents(20, profession, 0, 3, 12);

    expect(result.atkSpeedPercent).toBeCloseTo(20 * profession.atkSpeedPerHastePercent + 3);
    expect(result.castSpeedPercent).toBeCloseTo(20 * profession.castSpeedPerHastePercent + 12);
  });
});

describe('recalculateLuckyHitMultipliers', () => {
  // 不具合報告2026-08-09: プランナー内部の初期計算(rawStats由来のluckPercentのみを見る中間値)
  // ではなく、finalPctAddend.luck/イマジン最終%乗算/料理バフ等すべて確定済みの最終幸運%
  // (stats.luck)を使わないと、幸運の一撃ダメージ倍率/回復倍率が過小に算出される
  // (recalculateSpeedPercentsと同種の後付け加算取りこぼし)。
  it('uses the given final luck% (post finalPctAddend/imagine/cooking bonuses), matching the formula used by deriveStats', () => {
    // ビートパフォーマー狂音型の不具合報告例: 幸運36.86%、幸運相乗(+0.5)込みで
    // 40 + 36.86*(0.25+0.5) = 67.645%。
    const result = recalculateLuckyHitMultipliers(36.86, 0.5, 0, 0);

    expect(result.luckyHitDamageMultiplierPercent).toBeCloseTo(40 + 36.86 * 0.75);
    expect(result.luckyHitRecoveryMultiplierPercent).toBeCloseTo(40 + 36.86 * 0.25);
  });

  it('still adds raw.luckyHitDamageBonus/luckyHitRecoveryBonus directly on top, same as the initial deriveStats computation', () => {
    const result = recalculateLuckyHitMultipliers(20, 0, 300, 150);

    expect(result.luckyHitDamageMultiplierPercent).toBeCloseTo(40 + 20 * 0.25 + 3);
    expect(result.luckyHitRecoveryMultiplierPercent).toBeCloseTo(40 + 20 * 0.25 + 1.5);
  });
});

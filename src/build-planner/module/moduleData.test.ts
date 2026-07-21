import { describe, expect, it } from 'vitest';
import { PROFESSIONS } from '../profession';
import type { ModuleSlots } from '../types';
import { calcModuleTotalStats, formatEffectDesc } from './moduleData';

const tgAttrDesc = (key: string) =>
  ({ '99005': '適応筋力/知力/敏捷+{v}', '99006': '適応物理/魔法攻撃力+{v}' })[key] ??
  `attrDescs.${key}`;
const tgAttr = (key: string) => ({ '11722': '攻撃速度', '11732': '詠唱速度' })[key] ?? key;
// 12512/12742/12532/12722/12562/12582/11392はMOD_ATTR_TO_STATでStatIdにマッピング済みのため、
// 実アプリと同様tStat(buildPlanner.stats.*)側の名前が使われる(tgAttrへは落ちない)。
// 12722/12562/12582はProfileAttrTable(ZTable)側に表示名を持たないattrIdだが、
// MOD_ATTR_TO_STAT経由ならtgAttrのフォールバックへ落ちないため問題にならない。
const tStat = (key: string) =>
  ({
    critDamageBonus: '会心ダメージ',
    critRecoveryBonus: '会心回復',
    luckyHitDamageBonus: '幸運の一撃のダメージ倍率',
    luckyHitRecoveryBonus: '幸運の一撃回復の倍率',
    physicalReductionBonus: '物理軽減',
    magicalReductionBonus: '魔法軽減',
    physicalDefIgnoreBonus: '物理防御力無視',
  })[key] ?? key;

describe('formatEffectDesc', () => {
  it('formats attack-speed/cast-speed final-% and crit damage/recovery attrIds as percent (unit 100=1%)', () => {
    expect(formatEffectDesc([[1, 11722, 360]], [], tgAttrDesc, tgAttr, tStat)).toEqual([
      '攻撃速度 +3.60%',
    ]);
    expect(formatEffectDesc([[1, 11732, 720]], [], tgAttrDesc, tgAttr, tStat)).toEqual([
      '詠唱速度 +7.20%',
    ]);
    expect(formatEffectDesc([[1, 12512, 1200]], [], tgAttrDesc, tgAttr, tStat)).toEqual([
      '会心ダメージ +12.00%',
    ]);
    expect(formatEffectDesc([[1, 12742, 1200]], [], tgAttrDesc, tgAttr, tStat)).toEqual([
      '会心回復 +12.00%',
    ]);
    expect(formatEffectDesc([[1, 12532, 780]], [], tgAttrDesc, tgAttr, tStat)).toEqual([
      '幸運の一撃のダメージ倍率 +7.80%',
    ]);
    expect(formatEffectDesc([[1, 12722, 620]], [], tgAttrDesc, tgAttr, tStat)).toEqual([
      '幸運の一撃回復の倍率 +6.20%',
    ]);
    expect(formatEffectDesc([[1, 12562, 600]], [], tgAttrDesc, tgAttr, tStat)).toEqual([
      '物理軽減 +6.00%',
    ]);
    expect(formatEffectDesc([[1, 12582, 600]], [], tgAttrDesc, tgAttr, tStat)).toEqual([
      '魔法軽減 +6.00%',
    ]);
    expect(formatEffectDesc([[1, 11392, 1880]], [], tgAttrDesc, tgAttr, tStat)).toEqual([
      '物理防御力無視 +18.80%',
    ]);
  });

  it('still formats a normal mapped stat (maxHp) as a raw number, not a percent', () => {
    expect(formatEffectDesc([[1, 11322, 900]], [], tgAttrDesc, tgAttr, tStat)).toEqual([
      'maxHp +900',
    ]);
  });

  it('returns one array entry per config row, for the caller to render with line breaks', () => {
    const result = formatEffectDesc(
      [
        [1, 11322, 1500],
        [1, 13002, 60],
        [1, 12512, 710],
        [1, 12742, 710],
      ],
      [],
      tgAttrDesc,
      tgAttr,
      tStat,
    );
    expect(result).toEqual(['maxHp +1500', 'allAttrStr +60', '会心ダメージ +7.10%', '会心回復 +7.10%']);
  });

  it('keeps a template with an internal slash ("適応物理/魔法攻撃力") as a single entry, not split', () => {
    expect(formatEffectDesc([[5, 99006, 40]], [], tgAttrDesc, tgAttr, tStat)).toEqual([
      '適応物理/魔法攻撃力+40',
    ]);
  });
});

describe('calcModuleTotalStats(装備効果合計欄)', () => {
  // 2枠のmodIdに同じeffectIdをlinkCount10ずつ振り分け、totalLink=20(lv6)へ到達させる。
  function twoSlotModuleSlots(modId: number, effectId: number): ModuleSlots {
    const config = {
      modId,
      holes: [
        { effectId, linkCount: 10 },
        { effectId: null, linkCount: 10 },
        { effectId: null, linkCount: 5 },
      ],
    };
    return [config, config, null, null, null];
  }

  it('routes 全属性攻撃力 (attrId 11502) to stats.allAttrAtk, same special-case as calculateRawStats.ts', () => {
    // effectId 1308(「物理耐性」)のlv6 config includes [1,11502,20]。5500303=防御quality3(3穴)。
    const { stats } = calcModuleTotalStats(twoSlotModuleSlots(5500303, 1308), PROFESSIONS.stormBlade);
    expect(stats.allAttrAtk).toBe(20);
  });

  it('returns 攻撃速度/詠唱速度 %final bonuses separately, since they have no rawStats StatId', () => {
    // effectId 1408(「集中・攻撃速度」)のlv6 config includes [1,11722,600] -> +6%。
    const atkSpeedResult = calcModuleTotalStats(
      twoSlotModuleSlots(5500303, 1408),
      PROFESSIONS.stormBlade,
    );
    expect(atkSpeedResult.atkSpeedFinalPctAddend).toBe(6);
    expect(atkSpeedResult.castSpeedFinalPctAddend).toBe(0);
    expect(atkSpeedResult.stats.atkSpeedFinalPctAddend).toBeUndefined();

    // effectId 1407(「集中・詠唱」)のlv6 config includes [1,11732,1200] -> +12%。
    const castSpeedResult = calcModuleTotalStats(
      twoSlotModuleSlots(5500303, 1407),
      PROFESSIONS.stormBlade,
    );
    expect(castSpeedResult.castSpeedFinalPctAddend).toBe(12);
    expect(castSpeedResult.atkSpeedFinalPctAddend).toBe(0);
  });
});

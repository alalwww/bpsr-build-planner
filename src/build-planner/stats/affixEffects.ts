import type { PhantomAffixValue } from '../phantom/phantomData';
import { getAffixGroup } from '../phantom/phantomAffixData';
import type { StatId } from '../types';
import {
  AFFIX_FLAT_ATTR_TO_STAT,
  AFFIX_POLARITY_EFFECTS,
  AFFIX_POLARITY_PENALTY,
  IMAGINE_PCT_BASE,
  IMAGINE_PCT_FINAL,
  MOD_CAST_SPEED_FINAL_PCT_ATTR_ID,
  PHANTOM_EFFECT_TYPE_BUFF,
  PHANTOM_ORDINARY_PCT_ATTR_TO_STAT,
  TALENT_ATK_SPEED_FINAL_PCT_ATTR_ID,
  type ImagineFinalStatId,
} from './attrMaps';

// 映痕(S4祈願因子に埋め込むステータス系の映痕)のステータスへの振り分け。calculateRawStats と
// 効果一覧(phantomEffectSummary)の両方で使う。クラス映痕(AffixType=2)は大半が特定スキルへの
// 効果のため対象外(2026-11-23 ユーザー判断)。

export const AFFIX_TYPE_STAT = 1;

export interface AffixStatSink {
  /** rawStats への実数加算(祈り系は "100=1%" の raw% のまま)。 */
  flat: (statId: StatId, value: number) => void;
  /** 基礎ステータス等への%乗算(addPctBonus 相当、1/10000)。 */
  pct: (statId: StatId, value: number) => void;
  /** 変換後の最終値への%乗算(phantomFinalPct 相当、1/10000)。 */
  finalPct: (statId: StatId, value: number) => void;
  /** 攻撃速度/詠唱速度の最終%直接加算(単位 %)。 */
  atkSpeed: (percent: number) => void;
  castSpeed: (percent: number) => void;
}

// 有効な因子(ツリー上で効果が出るもの)の映痕を集め、最後に apply() でまとめて反映する。
// 重複不可の極性の映痕は、全因子を通じて同じ効果は最大値の1つだけを反映する(2026-11-23 ユーザー確認)。
export class AffixStatCollector {
  private readonly polarityMax = new Map<number, number>();
  private readonly pending: { attrId: number; value: number }[] = [];

  add(affixes: readonly PhantomAffixValue[]): void {
    for (const affix of affixes) {
      const group = getAffixGroup(affix.group);
      if (!group || group.affixType !== AFFIX_TYPE_STAT) continue;
      if (group.effectType === PHANTOM_EFFECT_TYPE_BUFF) {
        if (AFFIX_POLARITY_EFFECTS[group.effectId]) {
          const prev = this.polarityMax.get(group.effectId) ?? 0;
          this.polarityMax.set(group.effectId, Math.max(prev, affix.value));
        }
        continue;
      }
      this.pending.push({ attrId: group.effectId, value: affix.value });
    }
  }

  apply(sink: AffixStatSink): void {
    for (const { attrId, value } of this.pending) {
      const flatStatId = AFFIX_FLAT_ATTR_TO_STAT[attrId];
      if (flatStatId !== undefined) {
        sink.flat(flatStatId, value);
        continue;
      }
      const baseStatId = IMAGINE_PCT_BASE[attrId] ?? PHANTOM_ORDINARY_PCT_ATTR_TO_STAT[attrId];
      if (baseStatId !== undefined) {
        sink.pct(baseStatId, value);
        continue;
      }
      const finalStatKey = IMAGINE_PCT_FINAL[attrId as ImagineFinalStatId];
      if (finalStatKey !== undefined) {
        sink.finalPct(finalStatKey, value);
        continue;
      }
      // 攻撃速度/詠唱速度(AttrNumType=1、100=1%): 伝説刻印と同じ最終%直接加算。
      if (attrId === TALENT_ATK_SPEED_FINAL_PCT_ATTR_ID) sink.atkSpeed(value / 100);
      else if (attrId === MOD_CAST_SPEED_FINAL_PCT_ATTR_ID) sink.castSpeed(value / 100);
    }
    for (const [buffId, value] of this.polarityMax) {
      const polarity = AFFIX_POLARITY_EFFECTS[buffId]!;
      sink.pct(polarity.boostStat, value);
      sink.pct(polarity.penaltyStat, -AFFIX_POLARITY_PENALTY);
    }
  }
}

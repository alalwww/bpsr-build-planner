import type { StatId } from '../types';
import { substituteEffectDescParams } from '../components/gameText';
import { PROFESSIONS } from '../profession';
import {
  BOND_BUFF_STAT_EFFECTS,
  FACTOR_POLARITY_EFFECTS,
  IMAGINE_PCT_BASE,
  IMAGINE_PCT_FINAL,
  ORDINARY_EFFECT_BONUS,
  PHANTOM_ATTR_TO_STAT,
  PHANTOM_EFFECT_TYPE_POLARITY,
  PHANTOM_EFFECT_TYPE_STAT,
  type ImagineFinalStatId,
} from '../stats/attrMaps';
import type { PhantomFactorSlotValue, TreeStep, TreeStepKind } from './phantomData';
import {
  getActivePhantomNodeIds,
  getSTAsset,
  getUnlockLevel,
  iconPathToFile,
  isFactorClassLegacy,
  pfData,
  stData,
} from './phantomData';
import { factorBaseName, getNodeIcon, type GameDataT } from './phantomView';

// 効果一覧ダイアログ(合計セクション)専用の集計ロジック。calculateRawStats.ts の
// 潜在因子効果/絆レベル効果ブロックと同じ対応表(attrMaps.ts)を参照して独立に再集計する。
// 表示専用のため、他ソース(装備/アビリティ等)と混ざった合算値は扱わず、心相投影ツリー
// (固定ノード+因子スロット+絆レベル)由来の変化量のみを対象にする。絆レベル効果は
// BondBuffStatEffectの要素単位(1つのbuffIdが複数要素を持つ場合もそれぞれ独立)で振り分ける:
// static/final_pct/main_statはそのまま集計、highest_ofは対象ステータス未確定のため専用の
// highestOfBonusへ合算(表側で「5ステータス最大値へ加算」の1行として表示)、ratio_ofのみ
// (他ソース込みの現在のステータス値が必要で計算不能)実際のゲーム内説明文をそのまま
// 個別効果として表示する。

// pctBonus/finalPctと同じ単位規約(calculateRawStats.ts PERCENT_BASIS_POINTS): 10000 = 100%。
const PERCENT_BASIS_POINTS = 10000;

export interface PhantomStatDelta {
  statId: StatId;
  /** 平坦加算値(addStat相当)。 */
  flat: number;
  /** 基礎ステータス等への%乗算値、1/10000単位(addPctBonus相当)。 */
  pct: number;
  /** 収益逓減後の最終値への直接加算%、1/10000単位(phantomFinalPct相当)。 */
  finalPct: number;
}

export interface PhantomIndividualEffect {
  key: string;
  /** ノード名/因子名(表示用)。 */
  name: string;
  /** 効果説明文。ordinary由来は<br>等のタグを含む場合があるためrenderMarkupで描画すること。 */
  desc: string;
  /** ノード種別に応じたアイコンURL(getNodeIcon相当)。 */
  icon: string;
  /** 表示順ソートキー。初級(ordinary)は常に-1、中級(factor)は装着因子のtypeId
   * (1=極性/2=恒常性/3=第六感/4=クラス恒常性/5=クラス狂想/6=真実)。 */
  sortOrder: number;
}

export interface PhantomEffectTotals {
  statDeltas: PhantomStatDelta[];
  individualEffects: PhantomIndividualEffect[];
  /** 絆レベル効果の「会心/ファスト/幸運/器用さ/万能のうち最大値へ加算」の合計値(実数)。
   * 対象ステータスは他ソース込みの現在値次第で確定できないため、専用行として別に返す。 */
  highestOfBonus: number;
}

// 潜在Lv・現在の選択/因子装着状況から、心相投影ツリー由来のステータス変化を集計する。
// calculateRawStats.ts と異なり phantomEnabled(ON/OFF)は見ない(現在の設定内容そのものを
// 確認するためのダイアログのため、無効化中でも「有効にした場合の効果」を表示する)。
export function computePhantomEffectTotals(
  tg: GameDataT,
  // bpsr-bp-ui名前空間の翻訳関数。絆レベル効果の個別効果名(game-data側に該当キーが無いラベル)
  // でのみ使う。
  tUi: GameDataT,
  phantomTemplateId: number,
  phantomLevel: number,
  phantomNodeSelections: Record<number, number>,
  phantomFactorSlots: Record<number, PhantomFactorSlotValue | null>,
  professionId: number,
  phantomBondPoints: number,
): PhantomEffectTotals {
  const tmpl = stData.templates[String(phantomTemplateId)];
  if (!tmpl) return { statDeltas: [], individualEffects: [], highestOfBonus: 0 };

  const deltaMap = new Map<StatId, PhantomStatDelta>();
  const getDelta = (statId: StatId): PhantomStatDelta => {
    let entry = deltaMap.get(statId);
    if (!entry) {
      entry = { statId, flat: 0, pct: 0, finalPct: 0 };
      deltaMap.set(statId, entry);
    }
    return entry;
  };
  const addFlat = (statId: StatId, value: number) => {
    if (value === 0) return;
    getDelta(statId).flat += value;
  };
  const addPct = (statId: StatId, value: number) => {
    if (value === 0) return;
    getDelta(statId).pct += value;
  };
  const addFinalPct = (statId: StatId, value: number) => {
    if (value === 0) return;
    getDelta(statId).finalPct += value;
  };

  const individualEffects: PhantomIndividualEffect[] = [];

  const activeIds = getActivePhantomNodeIds(
    tmpl.rootNodeId,
    phantomTemplateId,
    phantomNodeSelections,
  );
  for (const nodeId of activeIds) {
    const node = stData.treeNodes[String(nodeId)];
    if (!node) continue;
    if (phantomLevel < getUnlockLevel(node.unlockCondition)) continue;

    if (node.nodeType === 1) {
      const oe = stData.ordinaryEffects[String(nodeId)];
      if (!oe) continue;
      const name = tg(`seasonTalents.ordinaryEffects.${nodeId}`);
      const icon = getNodeIcon(nodeId, 1);
      // type=1: calculateRawStats.ts では常に対象外(条件付き/スキル固有効果のため)。
      // 表示用にそのまま個別効果として列挙する。
      for (const e of oe.effects) {
        if (e[0] !== 1) continue;
        const attrName = tg(`attributes.${e[1]}`, { defaultValue: String(e[1]) });
        individualEffects.push({
          key: `ordinary-${nodeId}-attr-${e[1]}`,
          name,
          desc: `${attrName} +${e[2]}`,
          icon,
          sortOrder: -1,
        });
      }
      // type=3: ORDINARY_EFFECT_BONUS対応があれば集計、なければ説明文をそのまま個別表示。
      const idx3 = oe.effects.findIndex((e) => e[0] === 3);
      if (idx3 >= 0) {
        const buffId = oe.effects[idx3][1];
        const bonus = ORDINARY_EFFECT_BONUS[buffId];
        if (bonus) {
          if (bonus.kind === 'flat') addFlat(bonus.stat, bonus.value);
          else addFinalPct(bonus.stat, bonus.value);
        } else {
          const tmplStr = tg(`attrDescs.${buffId}`, { defaultValue: '' });
          if (tmplStr) {
            const pars = oe.buffPars[idx3] ?? [];
            individualEffects.push({
              key: `ordinary-${nodeId}-buff-${buffId}`,
              name,
              desc: substituteEffectDescParams(tmplStr, pars),
              icon,
              sortOrder: -1,
            });
          }
        }
      }
      continue;
    }

    if (node.nodeType !== 2) continue;
    const slot = phantomFactorSlots[node.groupId];
    if (!slot) continue;
    if (isFactorClassLegacy(slot.classKey)) continue;
    const factorClass = pfData.byClass[slot.classKey];
    if (!factorClass) continue;
    if (factorClass.professionIds.length > 0 && !factorClass.professionIds.includes(professionId))
      continue;
    const gradeData = factorClass.grades[slot.grade - 1];
    if (!gradeData) continue;

    const slotName = tg(`seasonTalents.intermediateSlots.${node.groupId}`);
    const name = `${slotName}: ${factorBaseName(tg, slot.classKey)} G${slot.grade}`;
    const icon = getNodeIcon(node.groupId, 2);
    // 極性(1)→恒常性(2)→第六感(3)→クラス恒常性(4)→クラス狂想(5)→真実(6)の順で
    // ソートするためのキー。装着中の因子クラス自身のtypeIdを使う(スロットの
    // factorTypesではなく、装着因子自体の分類で並べる)。
    const factorSortOrder = factorClass.typeId;

    for (const eff of gradeData.effects) {
      if (eff[0] !== PHANTOM_EFFECT_TYPE_STAT) continue;
      const [, attrId, value] = eff;
      const baseStatId = IMAGINE_PCT_BASE[attrId];
      if (baseStatId !== undefined) {
        addPct(baseStatId, value);
        continue;
      }
      const finalStatKey = IMAGINE_PCT_FINAL[attrId as ImagineFinalStatId];
      if (finalStatKey !== undefined) {
        addFinalPct(finalStatKey, value);
        continue;
      }
      const statId = PHANTOM_ATTR_TO_STAT[attrId];
      if (statId !== undefined) {
        addFlat(statId, value);
        continue;
      }
      const attrName = tg(`attributes.${attrId}`, { defaultValue: String(attrId) });
      individualEffects.push({
        key: `factor-${node.groupId}-attr-${attrId}`,
        name,
        desc: `${attrName} +${value}`,
        icon,
        sortOrder: factorSortOrder,
      });
    }

    for (let i = 0; i < gradeData.effects.length; i++) {
      const [effectType, buffId] = gradeData.effects[i];
      if (effectType !== PHANTOM_EFFECT_TYPE_POLARITY) continue;
      const polarity = FACTOR_POLARITY_EFFECTS[buffId];
      const pars = gradeData.buffPars?.[i] ?? [];
      if (polarity) {
        addPct(polarity.boostStat, pars[polarity.boostIdx] ?? 0);
        addPct(polarity.penaltyStat, -(pars[polarity.penaltyIdx] ?? 0));
      } else {
        const tmplStr = tg(`attrDescs.${buffId}`, { defaultValue: '' });
        if (tmplStr) {
          individualEffects.push({
            key: `factor-${node.groupId}-buff-${buffId}`,
            name,
            desc: substituteEffectDescParams(tmplStr, pars, true),
            icon,
            sortOrder: factorSortOrder,
          });
        }
      }
    }
  }

  // 絆レベル効果(上級ノード効果): レベル1〜5は全テンプレート共通・累積加算、レベル6のみ
  // テンプレート固有。calculateRawStats.tsの絆レベル効果ブロックと同じBOND_BUFF_STAT_EFFECTS
  // を、1つのbuffIdが持つ複数要素も独立に振り分ける(同じbuffId内でstatic+highest_ofが
  // 混在するケースがあり、staticだけを理由に丸ごと個別効果へフォールバックすると集計できる
  // 分まで説明文任せになってしまうため)。ratio_ofのみ(他ソース込みの現在のステータス値が
  // 必要で計算不能)、そのbuffId全体を実際のゲーム内説明文のまま個別効果として表示する。
  const mainStatId = Object.values(PROFESSIONS).find(
    (p) => p.professionId === professionId,
  )?.mainStat;
  let highestOfBonus = 0;
  const activeAdvEffects = Object.values(stData.advancedEffects).filter(
    (ae) => ae.effectId === tmpl.advancedEffectId && phantomBondPoints >= ae.unlockFraction,
  );
  for (const ae of activeAdvEffects) {
    const icon = getSTAsset(iconPathToFile(ae.icon));
    for (let i = 0; i < ae.effects.length; i++) {
      const [effectType, buffId] = ae.effects[i];
      if (effectType !== PHANTOM_EFFECT_TYPE_POLARITY) continue;
      const statEffects = BOND_BUFF_STAT_EFFECTS[buffId];
      const hasRatioOf = statEffects?.some((e) => e.type === 'ratio_of');
      if (statEffects && !hasRatioOf) {
        for (const eff of statEffects) {
          if (eff.type === 'static') addFlat(eff.stat, eff.value);
          else if (eff.type === 'final_pct') addFinalPct(eff.stat, eff.value);
          else if (eff.type === 'main_stat' && mainStatId) addFlat(mainStatId, eff.value);
          else if (eff.type === 'highest_of') highestOfBonus += eff.value;
        }
        continue;
      }
      const pars = ae.buffPars[i] ?? [];
      const tmplStr = tg(`attrDescs.${buffId}`, { defaultValue: '' });
      if (tmplStr) {
        individualEffects.push({
          key: `bond-${ae.level}-${buffId}`,
          name: tUi('buildPlanner.phantom.effectSummary.bondLevelLabel', { level: ae.level }),
          desc: substituteEffectDescParams(tmplStr, pars),
          icon,
          sortOrder: -2,
        });
      }
    }
  }

  // 上級(sortOrder=-2)→初級(sortOrder=-1)→中級(typeId昇順: 極性→恒常性→第六感→クラス恒常性→クラス狂想→真実)の順に整列。
  // Array.sortは安定ソートのため、同じsortOrder内の元の並び順(ノード出現順)は保たれる。
  individualEffects.sort((a, b) => a.sortOrder - b.sortOrder);

  return { statDeltas: [...deltaMap.values()], individualEffects, highestOfBonus };
}

export function formatPctDelta(rawValue: number): number {
  return rawValue / (PERCENT_BASIS_POINTS / 100);
}

// ---- 中級/初級ノード一覧(選択済みルート/未開放ルートの判定) ----

export type PhantomNodeRowStatus = 'active' | 'locked-level' | 'locked-route';

export interface PhantomNodeRow {
  nodeId: number;
  status: PhantomNodeRowStatus;
  /** treeSteps全体における出現順(1始まり)。PhantomNodeConfigのnumberedSlotNameと同じ採番。 */
  stepNum: number;
}

const ORDINARY_KINDS: TreeStepKind[] = ['fixed-ordinary', 'choice-ordinary'];
const FACTOR_KINDS: TreeStepKind[] = ['solo-factor', 'choice-factor-type', 'path-factor'];

// treeSteps(テンプレートの全ノードを網羅する構造。未選択の分岐先も含む)を走査し、
// 各ノードが「選択中で潜在Lvも十分(active)」「選択中だが潜在Lv不足(locked-level)」
// 「選択しなかったルート(locked-route)」のいずれかを判定する。
function computeNodeRows(
  treeSteps: TreeStep[],
  activeNodeIds: ReadonlySet<number>,
  levelUnlockedNodeIds: ReadonlySet<number>,
  phantomNodeSelections: Record<number, number>,
  kinds: TreeStepKind[],
): PhantomNodeRow[] {
  const rows: PhantomNodeRow[] = [];
  treeSteps.forEach((step, stepIdx) => {
    if (!kinds.includes(step.kind)) return;
    const stepNum = stepIdx + 1;
    if (step.kind === 'fixed-ordinary' || step.kind === 'solo-factor') {
      const nodeId = step.nodeIds[0];
      rows.push({
        nodeId,
        stepNum,
        status: levelUnlockedNodeIds.has(nodeId) ? 'active' : 'locked-level',
      });
      return;
    }
    let chosen: number | undefined;
    if (step.kind === 'path-factor') {
      const activeStepIds = step.nodeIds.filter((id) => activeNodeIds.has(id));
      if (activeStepIds.length === 0) {
        chosen = undefined;
      } else if (activeStepIds.length === 1) {
        chosen = activeStepIds[0];
      } else {
        const storedSel = phantomNodeSelections[step.sameGroupId];
        chosen =
          storedSel !== undefined && activeStepIds.includes(storedSel)
            ? storedSel
            : activeStepIds[0];
      }
    } else {
      chosen = phantomNodeSelections[step.sameGroupId] ?? step.nodeIds[0];
    }
    for (const nodeId of step.nodeIds) {
      if (nodeId === chosen) {
        rows.push({
          nodeId,
          stepNum,
          status: levelUnlockedNodeIds.has(nodeId) ? 'active' : 'locked-level',
        });
      } else {
        rows.push({ nodeId, stepNum, status: 'locked-route' });
      }
    }
  });
  return rows;
}

export function computeOrdinaryNodeRows(
  treeSteps: TreeStep[],
  activeNodeIds: ReadonlySet<number>,
  levelUnlockedNodeIds: ReadonlySet<number>,
  phantomNodeSelections: Record<number, number>,
): PhantomNodeRow[] {
  return computeNodeRows(
    treeSteps,
    activeNodeIds,
    levelUnlockedNodeIds,
    phantomNodeSelections,
    ORDINARY_KINDS,
  );
}

export function computeFactorNodeRows(
  treeSteps: TreeStep[],
  activeNodeIds: ReadonlySet<number>,
  levelUnlockedNodeIds: ReadonlySet<number>,
  phantomNodeSelections: Record<number, number>,
): PhantomNodeRow[] {
  return computeNodeRows(
    treeSteps,
    activeNodeIds,
    levelUnlockedNodeIds,
    phantomNodeSelections,
    FACTOR_KINDS,
  );
}

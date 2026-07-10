import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  loadAutoSave,
  loadBuildPlans,
  persistAutoSave,
  persistBuildPlans,
  type BuildPlanData,
} from './buildPlan';
import { getDefaultAutoSaveState } from './planDefaults';

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear() {
    this.store.clear();
  }
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number) {
    return [...this.store.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage());
});

// v1(0.2.6配布済み)は BuildPlanData をフィールド名そのままJSONへ直列化しており、
// battleImaginaries/imaginaryRanksという旧フィールド名を含む。phantom関連等、当時
// 存在しなかったフィールドは欠けている。
function legacyRawPlan(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  const defaults = getDefaultAutoSaveState('frostMage');
  return {
    id: 'legacy-1',
    name: '旧プラン',
    professionKey: 'frostMage',
    professionTypeKey: 'type1',
    equipped: defaults.equipped,
    refineLevels: defaults.refineLevels,
    perfectlines: defaults.perfectlines,
    evolutionStats: defaults.evolutionStats,
    legendaryAffixState: defaults.legendaryAffixState,
    masteryEquipped: defaults.masteryEquipped,
    masteryLevels: defaults.masteryLevels,
    masteryRanks: defaults.masteryRanks,
    fixedLevels: defaults.fixedLevels,
    fixedRanks: defaults.fixedRanks,
    // 旧フィールド名(現行コードのbattleImagines/imagineRanksに対応)
    battleImaginaries: [3944, null],
    imaginaryRanks: [5, 5],
    talentR1EnabledIds: defaults.talentR1EnabledIds,
    talentR2EnabledIds: defaults.talentR2EnabledIds,
    slotEnchants: defaults.slotEnchants,
    moduleSlots: defaults.moduleSlots,
    // phantom関連フィールドは当時存在しなかったため意図的に含めない
    ...overrides,
  };
}

describe('loadBuildPlans / persistBuildPlans', () => {
  it('v2ネイティブ形式をラウンドトリップできる(legacySource=null)', () => {
    const plan: BuildPlanData = {
      id: 'p1',
      ...getDefaultAutoSaveState('stormBlade'),
      name: 'テストプラン',
    };
    persistBuildPlans([plan]);

    const { plans, legacySource, loadError } = loadBuildPlans();
    expect(legacySource).toBeNull();
    expect(loadError).toBe(false);
    expect(plans).toEqual([plan]);
  });

  it('v1(旧フィールド名)からbattleImagines/imagineRanksへ正しく移行し、クラッシュしない', () => {
    localStorage.setItem('bpsr-build-plans-v1', JSON.stringify([legacyRawPlan()]));

    const { plans, legacySource, loadError } = loadBuildPlans();
    expect(loadError).toBe(false);
    expect(legacySource).toBe('v1');
    expect(plans).toHaveLength(1);
    expect(plans[0].battleImagines).toEqual([3944, null]);
    expect(plans[0].imagineRanks).toEqual([5, 5]);
    // 当時存在しなかったphantom関連フィールドはデフォルト値で補われる
    expect(plans[0].phantomEnabled).toBe(getDefaultAutoSaveState('frostMage').phantomEnabled);
  });

  it('v1移行時点ではまだv2へ書き戻さない(ユーザーの確認待ち)', () => {
    localStorage.setItem('bpsr-build-plans-v1', JSON.stringify([legacyRawPlan()]));
    loadBuildPlans();
    expect(localStorage.getItem('bpsr-build-plans-v2')).toBeNull();
  });

  it('バージョニング導入前の無バージョンキー(v0)からも移行できる', () => {
    localStorage.setItem('bpsr-build-plans', JSON.stringify([legacyRawPlan({ id: 'legacy-0' })]));

    const { plans, legacySource } = loadBuildPlans();
    expect(legacySource).toBe('v0');
    expect(plans[0].id).toBe('legacy-0');
    expect(plans[0].battleImagines).toEqual([3944, null]);
  });

  it('v2キーが存在すればv1/v0より優先される', () => {
    const plan: BuildPlanData = { id: 'native', ...getDefaultAutoSaveState('galeLancer') };
    persistBuildPlans([plan]);
    localStorage.setItem('bpsr-build-plans-v1', JSON.stringify([legacyRawPlan()]));

    const { plans, legacySource } = loadBuildPlans();
    expect(legacySource).toBeNull();
    expect(plans.map((p) => p.id)).toEqual(['native']);
  });

  it('壊れたv2データはクラッシュせず、読み込み失敗を報告する', () => {
    localStorage.setItem('bpsr-build-plans-v2', 'not valid json{{{');

    const { plans, legacySource, loadError } = loadBuildPlans();
    expect(plans).toEqual([]);
    expect(legacySource).toBeNull();
    expect(loadError).toBe(true);
  });

  it('どのキーも存在しなければ空配列を返しエラーにしない', () => {
    const { plans, legacySource, loadError } = loadBuildPlans();
    expect(plans).toEqual([]);
    expect(legacySource).toBeNull();
    expect(loadError).toBe(false);
  });
});

describe('loadAutoSave / persistAutoSave', () => {
  it('v2ネイティブ形式をラウンドトリップできる', () => {
    const state = getDefaultAutoSaveState('verdantOracle');
    persistAutoSave(state);

    const { state: loaded, legacySource, loadError } = loadAutoSave();
    expect(legacySource).toBeNull();
    expect(loadError).toBe(false);
    expect(loaded).toEqual(state);
  });

  it('v1(旧フィールド名)から移行し、その場でv2へ書き戻す(自動保存は確認不要)', () => {
    const { battleImaginaries, imaginaryRanks, ...rest } = legacyRawPlan();
    void battleImaginaries;
    void imaginaryRanks;
    localStorage.setItem(
      'bpsr-autosave-v1',
      JSON.stringify({ ...rest, battleImaginaries: [1, 2], imaginaryRanks: [3, 4] }),
    );

    const { state, legacySource } = loadAutoSave();
    expect(legacySource).toBe('v1');
    expect(state?.battleImagines).toEqual([1, 2]);
    expect(state?.imagineRanks).toEqual([3, 4]);

    // 自動でv2形式として書き戻されている
    expect(localStorage.getItem('bpsr-autosave-v2')).not.toBeNull();
    const second = loadAutoSave();
    expect(second.legacySource).toBeNull();
    expect(second.state).toEqual(state);
  });

  it('壊れたv2自動保存データはクラッシュせず、読み込み失敗を報告する', () => {
    localStorage.setItem('bpsr-autosave-v2', 'not valid json{{{');

    const { state, legacySource, loadError } = loadAutoSave();
    expect(state).toBeNull();
    expect(legacySource).toBeNull();
    expect(loadError).toBe(true);
  });

  it('どのキーも存在しなければnullを返しエラーにしない', () => {
    const { state, legacySource, loadError } = loadAutoSave();
    expect(state).toBeNull();
    expect(legacySource).toBeNull();
    expect(loadError).toBe(false);
  });
});

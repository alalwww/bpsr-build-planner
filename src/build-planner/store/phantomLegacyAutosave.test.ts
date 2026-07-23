import { beforeEach, describe, expect, it, vi } from 'vitest';
import { decodePlanCode } from '../plan/planCode';
import { CURRENT_FACTOR_SEASON_ID, pfData } from '../phantom/phantomData';

// vitestは environment: 'node' で動作しており、node には localStorage が存在しない。
// autosave.test.ts と同様、モジュール評価(=ストア初期化時の getAutoSaveOnMount() 呼び出し)
// より前に簡易 polyfill をグローバルへ差し込んでから動的importする。
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

// 実データから旧シーズンの幻影因子クラスキーを1つ拾う(モックの架空データではなく、
// hasLegacyPhantomFactor/isFactorClassLegacyが実際に判定に使う形と一致させるため)。
const [legacyClassKey] = Object.entries(pfData.byClass).find(
  ([, fc]) => fc.seasonId < CURRENT_FACTOR_SEASON_ID,
)!;

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal('localStorage', storage);
  vi.resetModules();
});

// バグの再現条件: 起動時にlocalStorageのオートセーブへS2幻影因子が残っていた場合、
// createPhantomSlice/createPlanSliceはメモリ上の状態こそ補正するが、それをlocalStorageへ
// 書き戻さないと次回起動時に同じ判定が再び真になり、通知が毎回出続けてしまう
// (useBuildStore.ts参照)。
describe('S2幻影因子の自動リセットとオートセーブへの反映', () => {
  it('起動時に検知したリセットは即座に永続化され、次回起動では再検知されない', async () => {
    // 1回目の起動: 素の状態でストアを作り、S2幻影因子を装着した状態を自動保存させる
    // (このsetPhantomFactorSlotsStateは「プラン読込/リセット専用」の生セッターで、
    // インタラクティブな setPhantomFactorSlot 同様にlegacyかどうかは判定しない)。
    const { useBuildStore: firstMount } = await import('./useBuildStore');
    firstMount.getState().setPhantomTemplateIdState(1);
    firstMount.getState().setPhantomFactorSlotsState({ 0: { classKey: legacyClassKey, grade: 1 } });

    const savedAfterFirstMount = storage.getItem('bpsr-autosave-v2');
    expect(savedAfterFirstMount).not.toBeNull();
    expect(decodePlanCode(savedAfterFirstMount!)?.state.phantomFactorSlots?.[0]?.classKey).toBe(
      legacyClassKey,
    );

    // 2回目の起動: 上記のlocalStorageを引き継いだ状態でストアを再初期化する。
    vi.resetModules();
    const { useBuildStore: secondMount } = await import('./useBuildStore');

    // 通知自体は今まで通り出る(初回検知は正しく機能している)。
    expect(secondMount.getState().phantomLegacyFactorResetNotice).toBe(true);
    // メモリ上は補正済み。
    expect(secondMount.getState().phantomFactorSlots).toEqual({});

    // 補正結果がlocalStorageにも書き戻されているか(=このテストが検証したいバグの核心)。
    const savedAfterSecondMount = storage.getItem('bpsr-autosave-v2');
    const decodedAfterSecondMount = decodePlanCode(savedAfterSecondMount!)?.state;
    expect(decodedAfterSecondMount?.phantomFactorSlots).toEqual({});
    expect(decodedAfterSecondMount?.phantomLevel).toBe(1);
    expect(decodedAfterSecondMount?.phantomBondPoints).toBe(0);

    // 3回目の起動: 書き戻された(補正済みの)localStorageから読み込むので、
    // もう通知は出ないはず(無限ループしていないことの確認)。
    vi.resetModules();
    const { useBuildStore: thirdMount } = await import('./useBuildStore');
    expect(thirdMount.getState().phantomLegacyFactorResetNotice).toBe(false);
  });
});

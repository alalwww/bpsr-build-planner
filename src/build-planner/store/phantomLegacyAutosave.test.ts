import { compressToEncodedURIComponent } from 'lz-string';
import { getDefaultPhantomLevel } from '../seasonSchedule';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { decodePlanCode } from '../plan/planCode';
import { pfData } from '../phantom/phantomData';

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

// S4以降の抽出データは現行シーズンの因子のみを含むため、旧シーズン(S3)の因子クラスキーは
// データに存在しないこと自体が「廃止済み」の判定条件になる(isFactorClassLegacy)。
const legacyClassKey = '202201';
if (pfData.byClass[legacyClassKey]) throw new Error('legacyClassKey must be absent from S4 data');

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal('localStorage', storage);
  vi.resetModules();
});

// バグの再現条件: 起動時にlocalStorageのオートセーブへ過去シーズンの因子が残っていた場合、
// createPhantomSlice/createPlanSliceはメモリ上の状態こそ補正するが、それをlocalStorageへ
// 書き戻さないと次回起動時に同じ判定が再び真になり、通知が毎回出続けてしまう
// (useBuildStore.ts参照)。
describe('過去シーズンの因子の自動リセットとオートセーブへの反映', () => {
  it('起動時に検知したリセットは即座に永続化され、次回起動では再検知されない', async () => {
    // 1回目の起動: 素の状態でストアを作り、過去シーズンの因子を装着した状態を自動保存させる
    // (このsetPhantomFactorSlotsStateは「プラン読込/リセット専用」の生セッターで、
    // インタラクティブな setPhantomFactorSlot 同様にlegacyかどうかは判定しない)。
    const { useBuildStore: firstMount } = await import('./useBuildStore');
    firstMount.getState().setPhantomTemplateIdState(9);
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
    expect(decodedAfterSecondMount?.phantomLevel).toBe(getDefaultPhantomLevel());

    // 3回目の起動: 書き戻された(補正済みの)localStorageから読み込むので、
    // もう通知は出ないはず(無限ループしていないことの確認)。
    vi.resetModules();
    const { useBuildStore: thirdMount } = await import('./useBuildStore');
    expect(thirdMount.getState().phantomLegacyFactorResetNotice).toBe(false);
  });
});

describe('過去シーズン(S3)に保存された自動保存データ', () => {
  it('起動時に心相投影を初期化し、現行シーズンのデータとして書き戻す(心相投影以外は維持)', async () => {
    const { CURRENT_SAVE_SEASON_ID } = await import('../plan/saveSeason');
    // S3までのv2形式。index 0: クラス(5=frostMage), 18: 冒険者Lv, 19-21: 心相投影の
    // 有効化/Lv/テンプレート(9 はS4にも存在するIDだが、S3のデータなので初期化される)。
    // 名称セグメント "B" は空文字(Base64)。
    const v2 = Array<unknown>(22).fill(null);
    v2[0] = 5;
    v2[18] = 42;
    v2[19] = 1;
    v2[20] = 55;
    v2[21] = 9;
    storage.setItem('bpsr-autosave-v2', `2:B:${compressToEncodedURIComponent(JSON.stringify(v2))}`);

    const { useBuildStore } = await import('./useBuildStore');
    const state = useBuildStore.getState();
    expect(state.phantomEnabled).toBe(false);
    expect(state.phantomTemplateId).toBeNull();
    expect(state.phantomLevel).toBe(getDefaultPhantomLevel());
    expect(state.adventurerLevel).toBe(42);
    expect(state.phantomLegacyFactorResetNotice).toBe(true);

    const saved = decodePlanCode(storage.getItem('bpsr-autosave-v2')!)?.state;
    expect(saved?.saveSeasonId).toBe(CURRENT_SAVE_SEASON_ID);
    expect(saved?.phantomTemplateId).toBeNull();
    expect(saved?.adventurerLevel).toBe(42);
  });
});

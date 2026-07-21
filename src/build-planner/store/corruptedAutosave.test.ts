import { beforeEach, describe, expect, it, vi } from 'vitest';
import { decodePlanCode } from '../planCode';

// vitestは environment: 'node' で動作しており、node には localStorage が存在しない。
// phantomLegacyAutosave.test.ts と同様、モジュール評価(=ストア初期化時の
// getAutoSaveOnMount()/loadBuildPlans() 呼び出し)より前に簡易 polyfill をグローバルへ
// 差し込んでから動的importする。
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

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal('localStorage', storage);
  vi.resetModules();
});

// バグの再現条件: 起動時にlocalStorageの自動保存/保存プラン一覧のデータが壊れていて
// デコードに失敗すると、ストア自体はデフォルト状態で復元されるが、壊れたデータそのものは
// localStorageに残ったままになる。何らかの値を変更して再保存されるまで、次回起動でも
// 同じ破損データの読み込みに失敗し続けてしまう(useBuildStore.ts参照)。
describe('ロード失敗時のlocalStorage上書き', () => {
  it('自動保存が破損している場合、起動時にデフォルト状態で即座に上書きされる', async () => {
    storage.setItem('bpsr-autosave-v2', '!!!not-a-valid-plan-code!!!');

    const { useBuildStore: firstMount } = await import('./useBuildStore');
    expect(firstMount.getState().autoSaveLoadError).toBe(true);

    const savedAfterFirstMount = storage.getItem('bpsr-autosave-v2');
    expect(savedAfterFirstMount).not.toBe('!!!not-a-valid-plan-code!!!');
    expect(decodePlanCode(savedAfterFirstMount!)).not.toBeNull();

    // 2回目の起動: 上書きされた(正常な)データから読み込むので、もう失敗しないはず。
    vi.resetModules();
    const { useBuildStore: secondMount } = await import('./useBuildStore');
    expect(secondMount.getState().autoSaveLoadError).toBe(false);
  });

  it('保存プラン一覧が破損している場合、起動時に空配列で即座に上書きされる', async () => {
    storage.setItem('bpsr-build-plans-v2', '!!!not-valid-json!!!');

    const { useBuildStore: firstMount } = await import('./useBuildStore');
    expect(firstMount.getState().planLoadError).toBe(true);

    const savedAfterFirstMount = storage.getItem('bpsr-build-plans-v2');
    expect(savedAfterFirstMount).toBe('[]');

    // 2回目の起動: 上書きされた(正常な)データから読み込むので、もう失敗しないはず。
    vi.resetModules();
    const { useBuildStore: secondMount } = await import('./useBuildStore');
    expect(secondMount.getState().planLoadError).toBe(false);
  });
});

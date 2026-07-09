import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { useBuildStore as UseBuildStoreType } from './useBuildStore';

// vitestは environment: 'node' で動作しており、node には localStorage が存在しない。
// buildPlan.ts の loadAutoSave/persistAutoSave は try/catch で localStorage 不在を
// 吸収する設計だが、この自動保存テストでは実際の保存内容を検証したいため、モジュール
// 評価(=ストア初期化時の getAutoSaveOnMount() 呼び出し)より前に簡易 polyfill を
// グローバルへ差し込んでから動的importする。
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

let useBuildStore: typeof UseBuildStoreType;

beforeAll(async () => {
  vi.stubGlobal('localStorage', new MemoryStorage());
  ({ useBuildStore } = await import('./useBuildStore'));
});

describe('自動保存(subscribeWithSelector)', () => {
  it('対象フィールドの変更でlocalStorageへ保存され、cookingBuffは含まれない', () => {
    useBuildStore.getState().setAdventurerLevel(37);

    const raw = localStorage.getItem('bpsr-autosave-v1');
    expect(raw).not.toBeNull();
    const saved = JSON.parse(raw!);
    expect(saved.adventurerLevel).toBe(37);
    expect(saved.cookingBuff).toBeUndefined();
  });

  it('talentR1/R2EnabledIdsはSetではなく配列として保存される', () => {
    useBuildStore.getState().setTalentR1EnabledIds(new Set([10, 20]));

    const raw = localStorage.getItem('bpsr-autosave-v1');
    const saved = JSON.parse(raw!);
    expect(Array.isArray(saved.talentR1EnabledIds)).toBe(true);
    expect(saved.talentR1EnabledIds.sort()).toEqual([10, 20]);
  });

  it('cookingBuffのみの変更では自動保存フィールドの購読対象に含まれないため再保存されない', () => {
    useBuildStore.getState().setAdventurerLevel(1);
    const before = localStorage.getItem('bpsr-autosave-v1');

    useBuildStore.getState().setCookingBuff({ cookingEnabled: true });

    const after = localStorage.getItem('bpsr-autosave-v1');
    expect(after).toBe(before);
  });
});

import { describe, expect, it } from 'vitest';
import { computeStatsBundle } from './derivedSelectors';
import { useBuildStore } from './useBuildStore';

// 回帰テスト: computeStatsBundle が state 非依存に毎回新規オブジェクトを返すと、
// Zustand の useShallow selector で無限レンダリングループになる
// (「getSnapshotの結果はキャッシュされるべき」警告 → Maximum update depth exceeded)。
// 実際にブラウザで踏んだ不具合のため、参照安定性をユニットテストで固定する。
describe('computeStatsBundle', () => {
  it('入力状態が変わらなければ、各フィールドの参照が呼び出し間で安定している', () => {
    const state = useBuildStore.getState();

    const first = computeStatsBundle(state);
    const second = computeStatsBundle(state);

    expect(second.stats).toBe(first.stats);
    expect(second.rawStats).toBe(first.rawStats);
    expect(second.rawStatsBreakdown).toBe(first.rawStatsBreakdown);
    expect(second.derivedStats).toBe(first.derivedStats);
    expect(second.abilityScore).toBe(first.abilityScore);
    expect(second.roleSkills).toBe(first.roleSkills);
    expect(second.talentNodesById).toBe(first.talentNodesById);
    expect(second.skillReplacements).toBe(first.skillReplacements);
  });

  it('関係する状態が変わればstats/abilityScoreの参照が変化する', () => {
    const before = computeStatsBundle(useBuildStore.getState());

    useBuildStore.getState().setAdventurerLevel(useBuildStore.getState().adventurerLevel + 1);
    const after = computeStatsBundle(useBuildStore.getState());

    expect(after.stats).not.toBe(before.stats);
    expect(after.abilityScore).not.toBe(before.abilityScore);
  });
});

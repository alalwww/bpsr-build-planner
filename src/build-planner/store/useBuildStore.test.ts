import { beforeEach, describe, expect, it } from 'vitest';
import { useBuildStore } from './useBuildStore';
import { PROFESSIONS } from '../profession';
import { DEFAULT_LOADOUT, getItemsBySlot } from '../equipment/equipmentData';

// ストアはモジュール単位のシングルトンのため、各テスト前に初期状態へ明示的に復元する
// (localStorageが存在しないnode環境ではautoSaveOnMountは常にnullになるため、
// 初期状態は STATIC_AUTOSAVE_DEFAULTS/DEFAULT_LOADOUT 相当になる)。
const initialState = useBuildStore.getState();

beforeEach(() => {
  useBuildStore.setState(initialState, true);
});

describe('equipmentSlice', () => {
  it('equip: 装備時にperfectlineを最大値にリセットし、伝説刻印を消去する', () => {
    const weapon = getItemsBySlot('weapon')[0];
    useBuildStore.getState().setLegendaryAffix('weapon', { attrId: 1, value: 100 });

    useBuildStore.getState().equip('weapon', weapon);

    const state = useBuildStore.getState();
    expect(state.equipped.weapon).toEqual(weapon);
    expect(state.legendaryAffixState.weapon).toBeUndefined();
  });

  it('unequip: 装備・進化ステータス・伝説刻印・エンチャントをまとめて削除する', () => {
    const weapon = getItemsBySlot('weapon')[0];
    useBuildStore.getState().equip('weapon', weapon);
    useBuildStore.getState().setEvolutionStat('weapon', 0, 'crit');
    useBuildStore.getState().setSlotEnchant('weapon', 999);

    useBuildStore.getState().unequip('weapon');

    const state = useBuildStore.getState();
    expect(state.equipped.weapon).toBeUndefined();
    expect(state.evolutionStats.weapon).toBeUndefined();
    expect(state.slotEnchants.weapon).toBeUndefined();
  });

  it('resetEquipmentForProfessionChange: メインステータス変更時は上下半身装備も外す', () => {
    const weapon = getItemsBySlot('weapon')[0];
    const head = getItemsBySlot('head')[0];
    useBuildStore.getState().equip('weapon', weapon);
    useBuildStore.getState().equip('head', head);

    useBuildStore.getState().resetEquipmentForProfessionChange(true);

    const state = useBuildStore.getState();
    expect(state.equipped.weapon).toBeUndefined();
    expect(state.equipped.head).toBeUndefined();
    expect(state.evolutionStats).toEqual({});
  });

  it('resetEquipmentForProfessionChange: メインステータス不変時は武器のみ外す', () => {
    const weapon = getItemsBySlot('weapon')[0];
    const head = getItemsBySlot('head')[0];
    useBuildStore.getState().equip('weapon', weapon);
    useBuildStore.getState().equip('head', head);

    useBuildStore.getState().resetEquipmentForProfessionChange(false);

    const state = useBuildStore.getState();
    expect(state.equipped.weapon).toBeUndefined();
    expect(state.equipped.head).toEqual(head);
  });
});

describe('talentSlice', () => {
  it('resetTalentForProfessionChange: R1/R2両方を対象プロフェッションの初期状態に戻す', () => {
    useBuildStore.getState().setTalentR1EnabledIds(new Set([1, 2, 3]));
    useBuildStore.getState().setTalentR2EnabledIds(new Set([4, 5]));

    const targetProfessionId = PROFESSIONS.shieldFighter.professionId;
    useBuildStore.getState().resetTalentForProfessionChange(targetProfessionId);

    const state = useBuildStore.getState();
    expect(state.talentR1EnabledIds).not.toEqual(new Set([1, 2, 3]));
    expect(state.talentR2EnabledIds).not.toEqual(new Set([4, 5]));
  });

  it('resetTalentR2ForType: R2のみリセットしR1は変更しない', () => {
    useBuildStore.getState().setTalentR1EnabledIds(new Set([1, 2, 3]));
    const before = useBuildStore.getState().talentR1EnabledIds;

    useBuildStore.getState().resetTalentR2ForType(PROFESSIONS.stormBlade.professionId, 1);

    expect(useBuildStore.getState().talentR1EnabledIds).toBe(before);
  });
});

describe('skillSlice', () => {
  it('toggleMasteryEquipped: 4個装着済みの状態で5個目は装着できない', () => {
    useBuildStore.getState().setMasteryEquippedState([true, true, true, true, false, false]);

    useBuildStore.getState().toggleMasteryEquipped(4);

    expect(useBuildStore.getState().masteryEquipped[4]).toBe(false);
  });

  it('toggleMasteryEquipped: 装着済みは常に解除できる', () => {
    useBuildStore.getState().setMasteryEquippedState([true, true, true, true, false, false]);

    useBuildStore.getState().toggleMasteryEquipped(0);

    expect(useBuildStore.getState().masteryEquipped[0]).toBe(false);
  });

  it('resetSkillForProfessionChange: マスタリー/固定スキルのみリセットしバトルイマジンは維持する', () => {
    useBuildStore.getState().setBattleImaginesState([42, null]);
    useBuildStore.getState().setMasteryLevelsState([10, 10]);

    useBuildStore.getState().resetSkillForProfessionChange('shieldFighter');

    const state = useBuildStore.getState();
    expect(state.battleImagines).toEqual([42, null]);
    expect(state.masteryLevels.every((lv) => lv === 30)).toBe(true);
  });
});

describe('moduleSlice', () => {
  it('setModuleSlot: 指定indexのみ更新し他は変更しない', () => {
    const config = { modId: 1, holes: [] };
    useBuildStore.getState().setModuleSlot(2, config);

    const state = useBuildStore.getState();
    expect(state.moduleSlots[2]).toEqual(config);
    expect(state.moduleSlots[0]).toBeNull();
  });
});

describe('phantomSlice', () => {
  it('setPhantomTemplateId: テンプレート変更時にnode/factor選択をリセットする', () => {
    useBuildStore.getState().setPhantomNodeSelection(1, 100);
    useBuildStore.getState().setPhantomFactorSlot(1, { classKey: 'stormBlade', grade: 3 });

    useBuildStore.getState().setPhantomTemplateId(999);

    const state = useBuildStore.getState();
    expect(state.phantomTemplateId).toBe(999);
    expect(state.phantomFactorSlots).toEqual({});
  });

  it('setPhantomTemplateIdState: 副作用なしでテンプレートIDのみ更新する', () => {
    useBuildStore.getState().setPhantomNodeSelection(1, 100);

    useBuildStore.getState().setPhantomTemplateIdState(999);

    const state = useBuildStore.getState();
    expect(state.phantomTemplateId).toBe(999);
    expect(state.phantomNodeSelections).toEqual({ 1: 100 });
  });
});

describe('planSlice', () => {
  it('selectProfession: 装備/スキル/アビリティのリセットを連鎖させ、typeをtype1に戻す', () => {
    useBuildStore.getState().selectProfessionType('type2');
    const weapon = getItemsBySlot('weapon')[0];
    useBuildStore.getState().equip('weapon', weapon);

    useBuildStore.getState().selectProfession('shieldFighter');

    const state = useBuildStore.getState();
    expect(state.professionKey).toBe('shieldFighter');
    expect(state.professionTypeKey).toBe('type1');
    expect(state.equipped.weapon).toBeUndefined();
  });

  it('savePlan → loadPlan: 保存時のスナップショットが読込で復元される', () => {
    useBuildStore.getState().setAdventurerLevel(42);
    useBuildStore.getState().savePlan('テストプラン');

    const saved = useBuildStore.getState().buildPlans[0];
    expect(saved.name).toBe('テストプラン');
    expect(saved.adventurerLevel).toBe(42);

    useBuildStore.getState().setAdventurerLevel(1);
    useBuildStore.getState().loadPlan(saved.id);

    expect(useBuildStore.getState().adventurerLevel).toBe(42);
    expect(useBuildStore.getState().planName).toBe('テストプラン');
  });

  it('deletePlan: 指定idのプランのみ削除する', () => {
    useBuildStore.getState().savePlan('A');
    useBuildStore.getState().savePlan('B');
    const [planB, planA] = useBuildStore.getState().buildPlans;

    useBuildStore.getState().deletePlan(planA.id);

    const remaining = useBuildStore.getState().buildPlans;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(planB.id);
  });

  it('renamePlan: 現在の編集中プラン名と一致していれば入力欄も追従する', () => {
    useBuildStore.getState().savePlan('旧名');
    const plan = useBuildStore.getState().buildPlans[0];
    useBuildStore.getState().setPlanName('旧名');

    useBuildStore.getState().renamePlan(plan.id, '新名');

    expect(useBuildStore.getState().planName).toBe('新名');
    expect(useBuildStore.getState().buildPlans[0].name).toBe('新名');
  });

  it('exportPlanCode → importPlanCode: エクスポート内容が読込で復元される(ラウンドトリップ)', () => {
    useBuildStore.getState().setAdventurerLevel(55);
    useBuildStore.getState().setPlanName('エクスポート用');

    const code = useBuildStore.getState().exportPlanCode();

    useBuildStore.getState().setAdventurerLevel(1);
    useBuildStore.getState().setPlanName('');

    const ok = useBuildStore.getState().importPlanCode(code);

    expect(ok).toBe(true);
    expect(useBuildStore.getState().adventurerLevel).toBe(55);
    expect(useBuildStore.getState().planName).toBe('エクスポート用');
  });

  it('importPlanCode: 不正なコードはfalseを返し状態を変更しない', () => {
    const before = useBuildStore.getState().planName;

    const ok = useBuildStore.getState().importPlanCode('not-a-valid-code');

    expect(ok).toBe(false);
    expect(useBuildStore.getState().planName).toBe(before);
  });

  it('resetPlan: 装備をデフォルトの初期ロードアウトへ戻す', () => {
    const weapon = getItemsBySlot('weapon')[0];
    useBuildStore.getState().equip('weapon', weapon);
    useBuildStore.getState().setPlanName('編集中');

    useBuildStore.getState().resetPlan();

    const state = useBuildStore.getState();
    expect(state.planName).toBe('');
    expect(state.equipped).toEqual(DEFAULT_LOADOUT);
  });
});

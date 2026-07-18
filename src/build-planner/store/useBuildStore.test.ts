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

  it('resetEquipmentForProfessionChange: メインステータス変更時は上下半身装備も外し、装着効果・伝説刻印・レアステータスも消去する', () => {
    const weapon = getItemsBySlot('weapon')[0];
    const head = getItemsBySlot('head')[0];
    useBuildStore.getState().equip('weapon', weapon);
    useBuildStore.getState().equip('head', head);
    useBuildStore.getState().setSlotEnchant('weapon', 999);
    useBuildStore.getState().setSlotEnchant('head', 998);
    useBuildStore.getState().setLegendaryAffix('weapon', { attrId: 1, value: 100 });
    useBuildStore.getState().setLegendaryAffixGroup('head', 0, { attrId: 2, value: 200 });

    useBuildStore.getState().resetEquipmentForProfessionChange(true);

    const state = useBuildStore.getState();
    expect(state.equipped.weapon).toBeUndefined();
    expect(state.equipped.head).toBeUndefined();
    expect(state.evolutionStats).toEqual({});
    expect(state.slotEnchants.weapon).toBeUndefined();
    expect(state.slotEnchants.head).toBeUndefined();
    expect(state.legendaryAffixState.weapon).toBeUndefined();
    expect(state.legendaryAffixGroupState.head).toBeUndefined();
  });

  it('resetEquipmentForProfessionChange: メインステータス不変時は武器のみ外し、武器の装着効果・伝説刻印のみ消去する', () => {
    const weapon = getItemsBySlot('weapon')[0];
    const head = getItemsBySlot('head')[0];
    useBuildStore.getState().equip('weapon', weapon);
    useBuildStore.getState().equip('head', head);
    useBuildStore.getState().setSlotEnchant('weapon', 999);
    useBuildStore.getState().setSlotEnchant('head', 998);
    useBuildStore.getState().setLegendaryAffix('weapon', { attrId: 1, value: 100 });

    useBuildStore.getState().resetEquipmentForProfessionChange(false);

    const state = useBuildStore.getState();
    expect(state.equipped.weapon).toBeUndefined();
    expect(state.equipped.head).toEqual(head);
    expect(state.slotEnchants.weapon).toBeUndefined();
    expect(state.slotEnchants.head).toBe(998);
    expect(state.legendaryAffixState.weapon).toBeUndefined();
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

  it('resetSkillForProfessionChange: ロールスキルは新クラスのTalent別固定スキルにリセットされる', () => {
    useBuildStore.getState().setRoleSkillSlotsState([3021, 3022, 3023, 3024]);
    useBuildStore.getState().setRoleSkillRanksState([2, 3, 1, 4]);

    useBuildStore.getState().resetSkillForProfessionChange('shieldFighter');

    const state = useBuildStore.getState();
    expect(state.roleSkillSlots).toEqual([3011, 3012, 3013, 3014]);
    expect(state.roleSkillRanks).toEqual([0, 0, 0, 0]);
  });

  it('setRoleSkillSlot/setRoleSkillRank: 指定indexのみ更新する', () => {
    useBuildStore.getState().setRoleSkillSlotsState([3011, 3012, 3013, 3014]);
    useBuildStore.getState().setRoleSkillRanksState([0, 0, 0, 0]);

    useBuildStore.getState().setRoleSkillSlot(1, 3021);
    useBuildStore.getState().setRoleSkillRank(1, 3);

    const state = useBuildStore.getState();
    expect(state.roleSkillSlots).toEqual([3011, 3021, 3013, 3014]);
    expect(state.roleSkillRanks).toEqual([0, 3, 0, 0]);
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

  it('savePlan → loadPlan: 過去シーズン(S2)の幻影因子が装着されたプランは、読込時に潜在Lv1/絆Pt0/因子全解除/ノード選択初期化にリセットされ、通知フラグが立つ', () => {
    // src/data/phantom-factors.json: byClass["201001"].seasonId=2 (< current max seasonId=3)。
    useBuildStore.getState().setPhantomTemplateIdState(1);
    useBuildStore.getState().setPhantomLevel(50);
    useBuildStore.getState().setPhantomBondPoints(25);
    useBuildStore.getState().setPhantomNodeSelection(1, 12345);
    useBuildStore.getState().setPhantomFactorSlot(163, { classKey: '201001', grade: 1 });
    useBuildStore.getState().savePlan('S2因子プラン');
    const saved = useBuildStore.getState().buildPlans[0];

    // 保存後、編集中の状態だけを変えてから読込む(保存済みプラン一覧はそのまま)。
    useBuildStore.getState().setPhantomTemplateIdState(null);
    useBuildStore.getState().setPhantomLevel(1);
    useBuildStore.getState().setPhantomBondPoints(35);
    expect(useBuildStore.getState().phantomLegacyFactorResetNotice).toBe(false);

    useBuildStore.getState().loadPlan(saved.id);

    const state = useBuildStore.getState();
    expect(state.phantomTemplateId).toBe(1); // テンプレート自体は維持する
    expect(state.phantomLevel).toBe(1);
    expect(state.phantomBondPoints).toBe(0);
    expect(state.phantomFactorSlots).toEqual({});
    expect(state.phantomNodeSelections[1]).not.toBe(12345); // テンプレートの初期選択に戻る
    expect(state.phantomLegacyFactorResetNotice).toBe(true);

    useBuildStore.getState().dismissPhantomLegacyFactorResetNotice();
    expect(useBuildStore.getState().phantomLegacyFactorResetNotice).toBe(false);
  });

  it('savePlan → loadPlan: 現行シーズンの幻影因子が装着されたプランはリセットされない', () => {
    // src/data/phantom-factors.json: byClass["202201"].seasonId=3 (current)。
    useBuildStore.getState().setPhantomTemplateIdState(1);
    useBuildStore.getState().setPhantomLevel(50);
    useBuildStore.getState().setPhantomBondPoints(25);
    useBuildStore.getState().setPhantomFactorSlot(163, { classKey: '202201', grade: 1 });
    useBuildStore.getState().savePlan('S3因子プラン');
    const saved = useBuildStore.getState().buildPlans[0];

    useBuildStore.getState().setPhantomLevel(1);
    useBuildStore.getState().setPhantomBondPoints(0);
    useBuildStore.getState().setPhantomFactorSlot(163, null);

    useBuildStore.getState().loadPlan(saved.id);

    const state = useBuildStore.getState();
    expect(state.phantomLevel).toBe(50);
    expect(state.phantomBondPoints).toBe(25);
    expect(state.phantomFactorSlots).toEqual({ 163: { classKey: '202201', grade: 1 } });
    expect(state.phantomLegacyFactorResetNotice).toBe(false);
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

    const result = useBuildStore.getState().importPlanCode(code);

    expect(result).toBe('ok');
    expect(useBuildStore.getState().adventurerLevel).toBe(55);
    expect(useBuildStore.getState().planName).toBe('エクスポート用');
  });

  it('importPlanCode: 不正なコードはfailedを返し状態を変更しない', () => {
    const before = useBuildStore.getState().planName;

    const result = useBuildStore.getState().importPlanCode('not-a-valid-code');

    expect(result).toBe('failed');
    expect(useBuildStore.getState().planName).toBe(before);
  });

  it('applyPlanState: roleSkillSlots/roleSkillRanksが無いプラン(旧データ)はクラスのロール専用4種にフォールバックする', () => {
    useBuildStore.getState().setRoleSkillSlotsState([3021, 3022, 3023, 3024]);
    useBuildStore.getState().setRoleSkillRanksState([2, 3, 1, 4]);
    const plan = useBuildStore.getState().buildAutoSaveState('旧データ再現');
    // roleSkillSlots/roleSkillRanksが未設定の状態(旧バージョンのプラン)を再現する。
    const { roleSkillSlots: _slots, roleSkillRanks: _ranks, ...planWithoutRoleSkills } = plan;
    void _slots;
    void _ranks;

    useBuildStore
      .getState()
      .applyPlanState({ ...planWithoutRoleSkills, professionKey: 'shieldFighter' });

    const state = useBuildStore.getState();
    expect(state.roleSkillSlots).toEqual([3011, 3012, 3013, 3014]);
    expect(state.roleSkillRanks).toEqual([0, 0, 0, 0]);
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

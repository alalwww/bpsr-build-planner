import { describe, expect, it } from 'vitest';
import type { EquipmentItem } from '../types';
import { getEvoVariantFamily } from './equipmentData';

function makeEquipmentItem(overrides: Partial<EquipmentItem> = {}): EquipmentItem {
  return {
    id: 1,
    slot: 'head',
    part: 201,
    equipGs: 120,
    quality: 4,
    icon: 'headwear_icon_c_armourpower01',
    baseStats: [[98982, 30, 80, 250, 250]],
    evo: [
      [11112, 450, 540, 56, 81],
      [11122, 225, 270, 28, 40],
    ],
    reforgeMaxPerfectline: 0,
    reforgeEvoMin: 0,
    reforgeEvoMax: 0,
    reforgeEvoFvMin: 0,
    reforgeEvoFvMax: 0,
    fixedEvolutionStats: {},
    enchantId: 2002,
    ...overrides,
  };
}

describe('getEvoVariantFamily', () => {
  it('groups items that differ only in evo (Evo1/Evo2 combination)', () => {
    const dominant = makeEquipmentItem({ id: 1 });
    const secondaryVariant = makeEquipmentItem({
      id: 2,
      evo: [
        [11112, 450, 540, 56, 81],
        [11132, 225, 270, 28, 40],
      ],
    });
    const swappedDominant = makeEquipmentItem({
      id: 3,
      evo: [
        [11122, 450, 540, 56, 81],
        [11112, 225, 270, 28, 40],
      ],
    });
    const candidates = [dominant, secondaryVariant, swappedDominant];

    const family = getEvoVariantFamily(dominant, candidates);

    expect(family).not.toBeNull();
    expect(family!.map((m) => m.id).sort()).toEqual([1, 2, 3]);
  });

  it('returns null when no sibling shares the same non-evo fields', () => {
    const solo = makeEquipmentItem({ id: 1 });
    const unrelated = makeEquipmentItem({ id: 2, icon: 'different_icon' });

    expect(getEvoVariantFamily(solo, [solo, unrelated])).toBeNull();
  });

  it('does not group items that also differ in a non-evo field (e.g. icon)', () => {
    const a = makeEquipmentItem({ id: 1 });
    const differentIcon = makeEquipmentItem({
      id: 2,
      icon: 'other_icon',
      evo: [
        [11112, 450, 540, 56, 81],
        [11132, 225, 270, 28, 40],
      ],
    });

    expect(getEvoVariantFamily(a, [a, differentIcon])).toBeNull();
  });

  it('returns null for items whose evo entries share the same attrId (sameEvo, not a fixed pair)', () => {
    const sameAttrEvo = makeEquipmentItem({
      evo: [
        [11112, 10, 20, 1, 2],
        [11112, 5, 10, 1, 2],
      ],
    });

    expect(getEvoVariantFamily(sameAttrEvo, [sameAttrEvo])).toBeNull();
  });

  it('returns null for items with no evo data at all (selectable kind)', () => {
    const noEvo = makeEquipmentItem({ evo: [] });

    expect(getEvoVariantFamily(noEvo, [noEvo])).toBeNull();
  });

  it('groups single-evo-slot items ([匠]系: 1つの固定ステータス違い)', () => {
    const crit = makeEquipmentItem({ id: 1, evo: [[11112, 1890, 2295, 189, 229]] });
    const haste = makeEquipmentItem({ id: 2, evo: [[11122, 1890, 2295, 189, 229]] });
    const luck = makeEquipmentItem({ id: 3, evo: [[11132, 1890, 2295, 189, 229]] });
    const candidates = [crit, haste, luck];

    const family = getEvoVariantFamily(crit, candidates);

    expect(family).not.toBeNull();
    expect(family!.map((m) => m.id).sort()).toEqual([1, 2, 3]);
  });

  it('does not group items whose evo has a different number of entries', () => {
    const twoSlot = makeEquipmentItem({ id: 1 });
    const oneSlot = makeEquipmentItem({ id: 2, evo: [[11112, 450, 540, 56, 81]] });

    expect(getEvoVariantFamily(twoSlot, [twoSlot, oneSlot])).toBeNull();
    expect(getEvoVariantFamily(oneSlot, [twoSlot, oneSlot])).toBeNull();
  });
});

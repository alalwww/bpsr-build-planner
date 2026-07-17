import { createAssetMap } from '../assetMap';

// クラスアイコン (profession_horizontal_NN.png の NN = open professionId の昇順位置)
const classIcon = createAssetMap(
  import.meta.glob<{ default: string }>('../../assets/classes/profession_horizontal_*.png', {
    eager: true,
  }),
);

const PROF_ID_ICON: Record<number, string> = {
  1: 'profession_horizontal_03',
  2: 'profession_horizontal_05',
  3: 'profession_horizontal_09',
  4: 'profession_horizontal_02',
  5: 'profession_horizontal_04',
  9: 'profession_horizontal_06',
  11: 'profession_horizontal_07',
  12: 'profession_horizontal_01',
  13: 'profession_horizontal_08',
};

export function getClassIconUrl(professionId: number): string | undefined {
  const filename = PROF_ID_ICON[professionId];
  return filename ? classIcon(filename) : undefined;
}

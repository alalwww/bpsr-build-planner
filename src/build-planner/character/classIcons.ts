// クラスアイコン (profession_horizontal_NN.png の NN = open professionId の昇順位置)
const _classMods = import.meta.glob<{ default: string }>(
  '../../assets/classes/profession_horizontal_*.png',
  { eager: true },
);
const CLASS_ICON_BY_FILENAME: Record<string, string> = {};
for (const [path, mod] of Object.entries(_classMods)) {
  const filename = path
    .split('/')
    .pop()
    ?.replace(/\.png$/, '');
  if (filename) CLASS_ICON_BY_FILENAME[filename] = mod.default;
}
const PROF_ID_ICON: Record<number, string> = {
  1: 'profession_horizontal_03',
  2: 'profession_horizontal_05',
  4: 'profession_horizontal_02',
  5: 'profession_horizontal_04',
  9: 'profession_horizontal_06',
  11: 'profession_horizontal_07',
  12: 'profession_horizontal_01',
  13: 'profession_horizontal_08',
};

export function getClassIconUrl(professionId: number): string | undefined {
  const filename = PROF_ID_ICON[professionId];
  return filename ? CLASS_ICON_BY_FILENAME[filename] : undefined;
}

import { getImagineIconUrl, getSkillIconUrl } from './skillData';

// スキル/イマジンの丸アイコンにマウス操作を紐づけるためのハンドラ束(ホバー・ピン留め用ツールチップに使用)。
export type CircleHandlers = {
  onMouseEnter: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave: () => void;
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  onClick: (e: React.MouseEvent<HTMLDivElement>) => void;
};

function SkillCircle({
  iconPath,
  isImagine = false,
  rarityType,
  size = 'md',
}: {
  iconPath?: string;
  isImagine?: boolean;
  rarityType?: number;
  size?: 'sm' | 'md';
}) {
  const url = isImagine ? getImagineIconUrl(iconPath ?? '') : getSkillIconUrl(iconPath ?? '');
  const borderUrl =
    rarityType != null ? getImagineIconUrl(`main_skill_bg_on_${rarityType}`) : undefined;
  const circle = (
    <div className={`skill-circle skill-circle--${size}`}>
      {url ? (
        <img className="skill-circle__img" src={url} alt="" />
      ) : (
        <div className="skill-circle__fallback" />
      )}
    </div>
  );
  if (borderUrl) {
    return (
      <div className={`skill-circle-frame skill-circle-frame--${size}`}>
        {circle}
        <img className="skill-circle__border" src={borderUrl} alt="" />
      </div>
    );
  }
  return circle;
}

export default SkillCircle;

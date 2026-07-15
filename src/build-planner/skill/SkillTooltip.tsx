import { useTranslation } from 'react-i18next';
import FloatingTooltip from '../components/FloatingTooltip';
import { renderMarkup } from '../components/renderMarkup';
import { IMAGINE_FLAT_STAT } from '../stats/attrMaps';
import {
  type BattleImagineData,
  getBattleImagineData,
  getImagineIconUrl,
  getSkillData,
  getSkillIconUrl,
  type SkillData,
} from './skillData';

export interface SkillTooltipState {
  skillId: number;
  isImagine?: boolean;
  rank?: number;
  /** クラススキルのスキルレベル(1-30)。省略時は30。イマジンでは未使用。 */
  level?: number;
  /** そのスキル/イマジンによる能力スコア寄与。ロールスキル等、算出不可の場合は undefined。 */
  score?: number;
  /** 'right'(既定): アイコンの右側に表示。'left': パネル右側寄りのアイコン用に左側へ表示。 */
  align?: 'right' | 'left';
  x: number;
  y: number;
  pinned: boolean;
}

/**
 * クラススキル性能値の構成部品:
 * 文字列(固定) / r=ランクG0-G6別 / l=レベル1-30別 /
 * u付き=両次元変動(値 = l[level-1] + r[rank] を書式 u で表示。up=%表記, un=実数)
 */
type SkillEffectPart =
  string | { r: string[] } | { l: string[] } | { u: 'up' | 'un'; l: number[]; r: number[] };

// extract-ztable.mjs の formatUpPercent と同一の書式(raw/100 の%表記、小数最大2桁)
function formatUpPercent(total: number): string {
  const pct = total / 100;
  return (pct % 1 === 0 ? String(Math.round(pct)) : String(parseFloat(pct.toFixed(2)))) + '%';
}

function SkillTooltip({
  state,
  onMouseEnter,
  onMouseLeave,
  onRequestClose,
}: {
  state: SkillTooltipState;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onRequestClose?: () => void;
}) {
  const { t } = useTranslation('game-data');
  const { t: tUi } = useTranslation();
  const { skillId, isImagine, rank = 0, level = 30, score } = state;
  const sd = isImagine ? getBattleImagineData(skillId) : getSkillData(skillId);
  const ns = isImagine ? 'battleImagines' : 'skills';
  const name = t(`${ns}.${skillId}.name`, { defaultValue: String(skillId) });
  const desc = t(`${ns}.${skillId}.description`, { defaultValue: '' });
  const activeSkillName = isImagine
    ? t(`battleImagines.${skillId}.activeSkillName`, { defaultValue: '' })
    : '';
  const skillLabel = t(`${ns}.${skillId}.skillLabel`, {
    returnObjects: true,
    defaultValue: [],
  }) as string[];
  const dialogue = isImagine ? t(`battleImagines.${skillId}.dialogue`, { defaultValue: '' }) : '';
  const passiveEffects = isImagine
    ? ((sd as BattleImagineData | undefined)?.passiveEffects ?? [])
    : [];
  const passiveBufDescs = isImagine
    ? (t(`battleImagines.${skillId}.passiveBufDescriptions`, {
        returnObjects: true,
        defaultValue: [],
      }) as string[][])
    : [];
  const allActiveEffectParams = isImagine
    ? (t(`battleImagines.${skillId}.activeEffectParams`, {
        returnObjects: true,
        defaultValue: [],
      }) as [string, string[]][])
    : [];
  const activeEffectParams = allActiveEffectParams.filter(([, vals]) => vals[rank] !== '');
  // クラススキルの性能値: 選択中のランク(G0-G6)とレベル(1-30)で値を組み立てる
  const skillEffectParams = !isImagine
    ? (t(`skills.${skillId}.activeEffectParams`, {
        returnObjects: true,
        defaultValue: [],
      }) as [string, SkillEffectPart[]][])
    : [];
  const resolveSkillEffectPart = (part: SkillEffectPart): string => {
    if (typeof part === 'string') return part;
    if ('u' in part) {
      const base = part.l[Math.max(0, Math.min(level, part.l.length) - 1)] ?? 0;
      const inc = part.r[Math.min(rank, part.r.length - 1)] ?? 0;
      const total = base + inc;
      return part.u === 'up' ? formatUpPercent(total) : String(total);
    }
    if ('r' in part) return part.r[Math.min(rank, part.r.length - 1)] ?? '';
    return part.l[Math.max(0, Math.min(level, part.l.length) - 1)] ?? '';
  };
  const skillEffectRows = skillEffectParams
    .map(([label, parts]) => [label, parts.map(resolveSkillEffectPart).join('')] as const)
    .filter(([, value]) => value !== '');
  const iconUrl = isImagine
    ? getImagineIconUrl((sd as BattleImagineData | undefined)?.icon ?? '')
    : getSkillIconUrl((sd as SkillData | undefined)?.icon ?? '');

  const hasPassive = passiveEffects.length > 0 || passiveBufDescs.length > 0;
  const hasActiveContent = !!(
    activeSkillName ||
    desc ||
    activeEffectParams.length > 0 ||
    skillEffectRows.length > 0
  );

  return (
    <FloatingTooltip
      x={state.x}
      y={state.y}
      clamp
      align={state.align}
      className={`skill-tooltip${state.pinned ? ' skill-tooltip--pinned' : ''}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={state.pinned ? undefined : onMouseLeave}
      onRequestClose={state.pinned ? onRequestClose : undefined}
    >
      <div className="skill-tooltip__header">
        {iconUrl && <img className="skill-tooltip__icon" src={iconUrl} alt="" />}
        <span className="skill-tooltip__name">{name}</span>
      </div>
      {!isImagine && skillLabel.length > 0 && (
        <div className="skill-tooltip__tags">
          {skillLabel.map((tag, i) => (
            <span key={i} className="skill-tooltip__tag">
              {tag}
            </span>
          ))}
        </div>
      )}
      {/* イマジン: フレーバーテキスト → hr → タグ → アクティブ効果 → hr → パッシブ */}
      {dialogue && <p className="skill-tooltip__dialogue">{dialogue}</p>}
      {(dialogue || !isImagine) && hasActiveContent && <hr className="skill-tooltip__hr" />}
      {isImagine && skillLabel.length > 0 && (
        <div className="skill-tooltip__tags">
          {skillLabel.map((tag, i) => (
            <span key={i} className="skill-tooltip__tag">
              {tag}
            </span>
          ))}
        </div>
      )}
      {activeSkillName && <div className="skill-tooltip__active-name">{activeSkillName}</div>}
      {desc && <p className="skill-tooltip__desc">{renderMarkup(desc)}</p>}
      {/* クラススキル: 説明(戦略行)の下に1行分空けて性能値を表示 */}
      {!isImagine && skillEffectRows.length > 0 && (
        <ul className="skill-tooltip__effect-list skill-tooltip__effect-list--skill">
          {skillEffectRows.map(([label, value], i) => (
            <li key={i} className="skill-tooltip__effect-item">
              <span className="skill-tooltip__effect-label">{renderMarkup(label)}</span>
              <span className="skill-tooltip__effect-val">{value}</span>
            </li>
          ))}
        </ul>
      )}
      {activeEffectParams.length > 0 && (
        <ul className="skill-tooltip__effect-list">
          {activeEffectParams.map(([label, vals], i) => (
            <li key={i} className="skill-tooltip__effect-item">
              <span className="skill-tooltip__effect-label">{renderMarkup(label)}</span>
              <span className="skill-tooltip__effect-val">{vals[rank] ?? vals[0]}</span>
            </li>
          ))}
        </ul>
      )}
      {hasActiveContent && hasPassive && <hr className="skill-tooltip__hr" />}
      {hasPassive && (
        <div className="skill-tooltip__passive">
          {passiveEffects.map((eff) => {
            const value = eff[rank + 1] ?? eff[1];
            // 会心/ファスト/幸運/器用さ/万能は%専用のAttrIdを持たず実数値レーティングのため、
            // 他の%系(筋力等の基礎ステータス%ボーナスや最終ステータス%ボーナス)と区別して表示する。
            const isFlat = IMAGINE_FLAT_STAT[eff[0]] !== undefined;
            return (
              <div key={eff[0]} className="skill-tooltip__passive-row">
                <span className="skill-tooltip__passive-name">
                  {t(`attributes.${eff[0]}`, { defaultValue: String(eff[0]) })}
                </span>
                <span className="skill-tooltip__passive-val">
                  {isFlat ? `+${value}` : `+${(value / 100).toFixed(0)}%`}
                </span>
              </div>
            );
          })}
          {passiveBufDescs.map((rankTexts, i) => {
            const text = Array.isArray(rankTexts) ? (rankTexts[rank] ?? rankTexts[0]) : '';
            return text ? (
              <div key={`buf${i}`} className="skill-tooltip__passive-buf">
                {renderMarkup(text)}
              </div>
            ) : null;
          })}
        </div>
      )}
      {score !== undefined && (
        <>
          <hr className="skill-tooltip__hr" />
          <div className="skill-tooltip__score-row">
            <span className="skill-tooltip__score-label">{tUi('buildPlanner.abilityScore')}</span>
            <span className="skill-tooltip__score-value">{score.toLocaleString()}</span>
          </div>
        </>
      )}
    </FloatingTooltip>
  );
}

export default SkillTooltip;

import { Fragment, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Chevron from '../components/Chevron';
import Dropdown from '../components/Dropdown';
import { useArrowKeySelect } from '../components/useArrowKeySelect';
import type { CursorTooltipHoverHandlers } from '../components/useCursorTooltip';
import {
  getEffectCategory,
  getEffectIcon,
  getMajorGroup,
  modulesData,
  recommendIconSrc,
} from './moduleData';

interface EffectSelectProps {
  value: number | null;
  options: number[];
  placeholder: string;
  onChange: (effectId: number | null) => void;
  recommendedEffectIds?: Set<number>;
  /** 選択肢マウスオーバー時にパワーコア効果の詳細ポップアップ(EffectInfoPopup)を表示する。 */
  getEffectHoverHandlers?: (effectId: number) => CursorTooltipHoverHandlers;
  /** 選択確定でホバー中の選択肢ボタンごとドロップダウンが消えるため、mouseleaveが発火せず
   * ポップアップが開いたまま残ってしまう。選択時に明示的に閉じるためのコールバック。 */
  onCloseEffectHoverPopup?: () => void;
}

function EffectSelect({
  value,
  options,
  placeholder,
  onChange,
  recommendedEffectIds,
  getEffectHoverHandlers,
  onCloseEffectHoverPopup,
}: EffectSelectProps) {
  const { t: tg } = useTranslation('game-data');
  const { t: tUi } = useTranslation();

  const getName = (effectId: number): string =>
    tg(`moduleEffects.${effectId}`, { defaultValue: String(effectId) });

  const optionsKey = options.join(',');
  const sortedOptions = useMemo(() => {
    return [...options].sort((a, b) => {
      const ca = getEffectCategory(a);
      const cb = getEffectCategory(b);
      if (ca !== cb) return ca - cb;
      return getName(a).localeCompare(getName(b));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionsKey, tg]);

  const selEffData = value != null ? modulesData.effects[String(value)] : undefined;
  const selIconSrc = selEffData ? getEffectIcon(selEffData.icon) : undefined;
  const selName = value != null ? getName(value) : undefined;

  // トリガーにフォーカスがある間、パネルを開かずに上下矢印キーで選択を直接変更できるように
  // する(ネイティブselect/Stepperのコンボと同じ操作感)。表示順(sortedOptions)と一致させる。
  const effectSelectValues: (number | null)[] = [null, ...sortedOptions];
  const handleTriggerKeyDown = useArrowKeySelect({
    values: effectSelectValues,
    current: value,
    onChange,
  });

  return (
    <div className="mod-effect-select-wrap">
      <Dropdown
        triggerClassName={(isOpen) =>
          `mod-effect-select-trigger${isOpen ? ' mod-effect-select-trigger--open' : ''}`
        }
        panelClassName="mod-effect-select-dropdown"
        onTriggerKeyDown={handleTriggerKeyDown}
        renderTrigger={(isOpen) => (
          <>
            {selIconSrc && <img src={selIconSrc} className="mod-effect-select-sel-icon" alt="" />}
            <span className={value == null ? 'mod-effect-select-placeholder' : ''}>
              {selName ?? placeholder}
            </span>
            <Chevron open={isOpen} className="mod-effect-select-arrow" />
          </>
        )}
      >
        {(close) => (
          <>
            <button
              type="button"
              className={`mod-effect-option${value === null ? ' mod-effect-option--selected' : ''}`}
              data-selected={value === null}
              onClick={() => {
                onChange(null);
                onCloseEffectHoverPopup?.();
                close();
              }}
            >
              <span className="mod-effect-option-name">{placeholder}</span>
            </button>
            {sortedOptions.map((effectId, i) => {
              const effData = modulesData.effects[String(effectId)];
              const iconSrc = effData ? getEffectIcon(effData.icon) : undefined;
              const prevMajor = i > 0 ? getMajorGroup(getEffectCategory(sortedOptions[i - 1])) : -1;
              const curMajor = getMajorGroup(getEffectCategory(effectId));
              const showSep = i > 0 && curMajor !== prevMajor;
              return (
                <Fragment key={effectId}>
                  {showSep && <div className="mod-effect-separator" />}
                  <button
                    type="button"
                    className={`mod-effect-option${value === effectId ? ' mod-effect-option--selected' : ''}`}
                    data-selected={value === effectId}
                    onClick={() => {
                      onChange(effectId);
                      onCloseEffectHoverPopup?.();
                      close();
                    }}
                    {...getEffectHoverHandlers?.(effectId)}
                  >
                    {iconSrc ? (
                      <img src={iconSrc} className="mod-effect-option-icon" alt="" />
                    ) : (
                      <div className="mod-effect-option-icon-placeholder" />
                    )}
                    <span className="mod-effect-option-name">{getName(effectId)}</span>
                    {recommendedEffectIds?.has(effectId) && (
                      <img
                        src={recommendIconSrc}
                        className="mod-effect-option-recommend"
                        alt={tUi('buildPlanner.module.recommendedAlt')}
                      />
                    )}
                  </button>
                </Fragment>
              );
            })}
          </>
        )}
      </Dropdown>
    </div>
  );
}

export default EffectSelect;

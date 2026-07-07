import { Fragment, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Chevron from '../components/Chevron';
import Dropdown from '../components/Dropdown';
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
}

function EffectSelect({
  value,
  options,
  placeholder,
  onChange,
  recommendedEffectIds,
}: EffectSelectProps) {
  const { t: tg } = useTranslation('game-data');

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

  return (
    <div className="mod-effect-select-wrap">
      <Dropdown
        triggerClassName={(isOpen) =>
          `mod-effect-select-trigger${isOpen ? ' mod-effect-select-trigger--open' : ''}`
        }
        panelClassName="mod-effect-select-dropdown"
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
              onClick={() => {
                onChange(null);
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
                    onClick={() => {
                      onChange(effectId);
                      close();
                    }}
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
                        alt="推奨"
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

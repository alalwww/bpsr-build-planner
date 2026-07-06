import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import DraggableDialog from '../components/DraggableDialog';
import type { ModuleConfig, ModuleHole } from '../types';
import {
  getModById,
  getModHoles,
  getModIcon,
  getQualityBg,
  isExtremeEffect,
  MAX_LINK,
  modulesData,
} from './moduleData';
import EffectSelect from './EffectSelect';

interface HoleState {
  effectId: number | null;
  linkCount: number;
}

type Holes = [HoleState, HoleState, HoleState];

interface DialogState {
  modType: 1 | 2 | 3;
  quality: 1 | 2 | 3 | 4;
  holes: Holes;
}

const makeHoles = (): Holes => [
  { effectId: null, linkCount: MAX_LINK[0] },
  { effectId: null, linkCount: MAX_LINK[1] },
  { effectId: null, linkCount: MAX_LINK[2] },
];

function dialogStateFromConfig(config: ModuleConfig | null): DialogState {
  if (!config) return { modType: 3, quality: 3, holes: makeHoles() };
  const mod = getModById(config.modId);
  if (!mod) return { modType: 3, quality: 3, holes: makeHoles() };
  const quality = mod.quality as 1 | 2 | 3 | 4;
  const numHoles = getModHoles(quality);
  const holes = makeHoles();
  for (let i = 0; i < numHoles; i++) {
    holes[i] = {
      effectId: config.holes[i]?.effectId ?? null,
      linkCount: config.holes[i]?.linkCount ?? MAX_LINK[i],
    };
  }
  return { modType: mod.modType as 1 | 2 | 3, quality, holes };
}

function dialogStateToConfig(state: DialogState): ModuleConfig | null {
  const mod = modulesData.mods.find(
    (m) => m.modType === state.modType && m.quality === state.quality,
  );
  if (!mod) return null;
  const numHoles = getModHoles(state.quality);
  const holes: ModuleHole[] = [];
  for (let i = 0; i < numHoles; i++) {
    holes.push({ effectId: state.holes[i].effectId, linkCount: state.holes[i].linkCount });
  }
  return { modId: mod.id, holes };
}

function getAvailableEffects(
  modType: number,
  holeIdx: number,
  quality: number,
  selectedIds: (number | null)[],
): number[] {
  return (modulesData.effectsByType[String(modType)] ?? []).filter((effectId) => {
    if (isExtremeEffect(effectId) && (quality < 3 || holeIdx > 0)) return false;
    return !selectedIds.some((sid, i) => i !== holeIdx && sid === effectId);
  });
}

const MOD_TYPES: { type: 1 | 2 | 3; key: string }[] = [
  { type: 3, key: 'buildPlanner.module.typeDefense' },
  { type: 2, key: 'buildPlanner.module.typeSupport' },
  { type: 1, key: 'buildPlanner.module.typeAttack' },
];

const QUALITY_NAMES: Record<number, string> = {
  1: 'buildPlanner.module.qualityBasic',
  2: 'buildPlanner.module.qualityHighPerf',
  3: 'buildPlanner.module.qualitySuperior',
  4: 'buildPlanner.module.qualityExc',
};

interface ModuleDialogProps {
  slotIndex: number;
  config: ModuleConfig | null;
  onSetModuleSlot: (index: number, config: ModuleConfig | null) => void;
  onClose: () => void;
  recommendedEffectIds: Set<number>;
}

function ModuleDialog({
  slotIndex,
  config,
  onSetModuleSlot,
  onClose,
  recommendedEffectIds,
}: ModuleDialogProps) {
  const { t } = useTranslation();
  const [state, setState] = useState<DialogState>(() => dialogStateFromConfig(config));
  const [showQualityPicker, setShowQualityPicker] = useState<boolean>(() => !config);
  const [pickerModType, setPickerModType] = useState<1 | 2 | 3>(() => {
    if (config) {
      const mod = getModById(config.modId);
      return (mod?.modType as 1 | 2 | 3) ?? 3;
    }
    return 3;
  });

  const applyAndSet = (newState: DialogState) => {
    setState(newState);
    onSetModuleSlot(slotIndex, dialogStateToConfig(newState));
  };

  const handleTypeClick = (modType: 1 | 2 | 3) => {
    setPickerModType(modType);
    setShowQualityPicker(true);
  };

  const handleQualitySelect = (quality: 1 | 2 | 3 | 4) => {
    const newState: DialogState = { modType: pickerModType, quality, holes: makeHoles() };
    applyAndSet(newState);
    setShowQualityPicker(false);
  };

  const handleEffectChange = (holeIdx: number, effectId: number | null) => {
    const holes: Holes = [{ ...state.holes[0] }, { ...state.holes[1] }, { ...state.holes[2] }];
    holes[holeIdx] = { effectId, linkCount: MAX_LINK[holeIdx] };
    if (holeIdx === 0) {
      holes[1] = { effectId: null, linkCount: MAX_LINK[1] };
      holes[2] = { effectId: null, linkCount: MAX_LINK[2] };
    } else if (holeIdx === 1) {
      holes[2] = { effectId: null, linkCount: MAX_LINK[2] };
    }
    applyAndSet({ ...state, holes });
  };

  const handleLinkChange = (holeIdx: number, count: number) => {
    const holes: Holes = [{ ...state.holes[0] }, { ...state.holes[1] }, { ...state.holes[2] }];
    holes[holeIdx] = { ...holes[holeIdx], linkCount: count };
    applyAndSet({ ...state, holes });
  };

  const numHoles = getModHoles(state.quality);
  const { holes } = state;
  const selectedIds = holes.map((h) => h.effectId);

  const renderHole = (holeIdx: number) => {
    const hole = holes[holeIdx];
    const available = getAvailableEffects(state.modType, holeIdx, state.quality, selectedIds);
    const maxLink = holeIdx === 2 ? 5 : 10;
    return (
      <div key={holeIdx} className="mod-hole">
        <EffectSelect
          value={hole.effectId}
          options={available}
          placeholder={t('buildPlanner.module.selectEffect')}
          onChange={(eid) => handleEffectChange(holeIdx, eid)}
          recommendedEffectIds={recommendedEffectIds}
        />
        {hole.effectId != null && (
          <div className="mod-link-row">
            <span className="mod-link-row__label">{t('buildPlanner.module.linkCount')}</span>
            <div className="mod-link-btns">
              {Array.from({ length: maxLink }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`mod-link-btn${hole.linkCount === n ? ' mod-link-btn--active' : ''}`}
                  onClick={() => handleLinkChange(holeIdx, n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <DraggableDialog
      title={t('buildPlanner.module.slot', { n: slotIndex + 1 })}
      onClose={onClose}
      className="module-dialog"
    >
      <div className="module-dialog__type-tabs">
        {MOD_TYPES.map(({ type, key }) => {
          const isConfigured = state.modType === type && !showQualityPicker;
          const isActive = isConfigured || (pickerModType === type && showQualityPicker);
          const icon = getModIcon(type, isConfigured ? state.quality : 3);
          return (
            <button
              key={type}
              type="button"
              className={`mod-type-tab${isActive ? ' mod-type-tab--active' : ''}`}
              onClick={() => handleTypeClick(type)}
            >
              {icon && <img src={icon} className="mod-type-tab__icon" alt="" />}
              <span className="mod-type-tab__label">{t(key)}</span>
            </button>
          );
        })}
      </div>

      {showQualityPicker ? (
        <div className="module-quality-picker">
          <div className="module-quality-picker__grid">
            {([4, 3, 2, 1] as const).map((q) => {
              const icon = getModIcon(pickerModType, q);
              const bg = getQualityBg(q);
              return (
                <button
                  key={q}
                  type="button"
                  className="module-quality-item"
                  onClick={() => handleQualitySelect(q)}
                >
                  <div
                    className="module-quality-item__bg"
                    style={bg ? { backgroundImage: `url(${bg})` } : {}}
                  >
                    {icon && <img src={icon} className="module-quality-item__icon" alt="" />}
                  </div>
                  <span className="module-quality-item__name">{t(QUALITY_NAMES[q])}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="module-dialog__holes">
          {Array.from({ length: numHoles }, (_, i) => renderHole(i))}
        </div>
      )}
    </DraggableDialog>
  );
}

export default ModuleDialog;

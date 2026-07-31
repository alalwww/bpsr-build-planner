import { useMemo, useState } from 'react';
import './module.css';
import type { Profession, ProfessionTypeKey } from '../profession';
import { useBuildStore } from '../store/useBuildStore';
import { modulesData } from './moduleData';
import ModuleSlot from './ModuleSlot';
import ModuleTotalStats from './ModuleTotalStats';
import EffectInfoPopup from './EffectInfoPopup';
import ModuleDialog from './ModuleDialog';
import { useCursorTooltip } from '../components/useCursorTooltip';

interface ModulePanelProps {
  profession: Profession;
  professionTypeKey: ProfessionTypeKey;
}

interface EffectPopupKey {
  effectId: number;
  align: 'right' | 'left';
}

function ModulePanel({ profession, professionTypeKey }: ModulePanelProps) {
  const moduleSlots = useBuildStore((s) => s.moduleSlots);
  const onSetModuleSlot = useBuildStore((s) => s.setModuleSlot);
  const [openSlot, setOpenSlot] = useState<number | null>(null);
  const {
    tooltip: effectPopup,
    makeHandlers: makeEffectHandlers,
    cancelClose: cancelEffectPopupClose,
    scheduleClose: scheduleEffectPopupClose,
    close: closeEffectPopup,
  } = useCursorTooltip<EffectPopupKey>((a, b) => a.effectId === b.effectId);

  const recommendedEffectIds = useMemo<Set<number>>(() => {
    const bdType = professionTypeKey === 'type1' ? '0' : '1';
    const ids = modulesData.recommendedEffects[String(profession.professionId)]?.[bdType] ?? [];
    return new Set(ids);
  }, [profession.professionId, professionTypeKey]);

  // 左側(モジュールスロット)は右側にポップアップ表示、右側(装備効果合計欄)は
  // パネル右端に近く画面外へはみ出しやすいため左側に表示する。
  const getEffectHandlers = (effectId: number, align: 'right' | 'left') =>
    makeEffectHandlers({ effectId, align }, align);

  // モジュール選択ダイアログのドロップダウン選択肢用。クリックは効果の選択に使うため、
  // makeEffectHandlersが返すonClick/onMouseDown(クリックでピン留め)は含めず、
  // ホバーで追従表示するハンドラのみを渡す(EffectSelect.tsx参照)。
  const getEffectHoverHandlers = (effectId: number, align: 'right' | 'left') => {
    const { onMouseEnter, onMouseMove, onMouseLeave } = makeEffectHandlers(
      { effectId, align },
      align,
    );
    return { onMouseEnter, onMouseMove, onMouseLeave };
  };

  return (
    <section className="module-panel">
      <div className="module-panel__layout">
        <div className="module-panel__slots">
          {[0, 1, 2, 3, 4].map((idx) => (
            <ModuleSlot
              key={idx}
              n={idx + 1}
              config={moduleSlots[idx] ?? null}
              onClick={() => {
                closeEffectPopup();
                setOpenSlot(idx);
              }}
              onRemove={() => onSetModuleSlot(idx, null)}
              getEffectHandlers={(effectId) => getEffectHandlers(effectId, 'right')}
            />
          ))}
        </div>
        <div className="module-panel__stats">
          <ModuleTotalStats
            moduleSlots={moduleSlots}
            profession={profession}
            getEffectHandlers={(effectId) => getEffectHandlers(effectId, 'left')}
          />
        </div>
      </div>

      {effectPopup && (
        <EffectInfoPopup
          effectId={effectPopup.key.effectId}
          moduleSlots={moduleSlots}
          x={effectPopup.x}
          y={effectPopup.y}
          align={effectPopup.key.align}
          pinned={effectPopup.pinned}
          onMouseEnter={cancelEffectPopupClose}
          onMouseLeave={scheduleEffectPopupClose}
          onClose={closeEffectPopup}
        />
      )}

      {openSlot != null && (
        <ModuleDialog
          slotIndex={openSlot}
          config={moduleSlots[openSlot] ?? null}
          onSetModuleSlot={onSetModuleSlot}
          onClose={() => setOpenSlot(null)}
          recommendedEffectIds={recommendedEffectIds}
          getEffectHoverHandlers={(effectId) => getEffectHoverHandlers(effectId, 'right')}
          onCloseEffectHoverPopup={closeEffectPopup}
        />
      )}
    </section>
  );
}

export default ModulePanel;

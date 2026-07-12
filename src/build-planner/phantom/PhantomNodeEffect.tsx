import { useTranslation } from 'react-i18next';
import type { PhantomFactorSlotValue } from './phantomData';
import { getSTAsset, iconPathToFile, stData } from './phantomData';
import { factorBaseName, getFactorEffectDesc, getNodeEffectDesc } from './phantomView';

// 選択中ノードの効果詳細表示(固定ノード=ステータス/バフ効果、因子スロット=装着中の因子効果)。
// PhantomPanel から分離。

interface PhantomNodeEffectProps {
  selectedNodeId: number | null;
  phantomFactorSlots: Record<number, PhantomFactorSlotValue | null>;
}

export default function PhantomNodeEffect({
  selectedNodeId,
  phantomFactorSlots,
}: PhantomNodeEffectProps) {
  const { t } = useTranslation();
  const { t: tg } = useTranslation('game-data');

  if (selectedNodeId == null) {
    return (
      <span className="phantom-desc-placeholder">
        {t('buildPlanner.phantom.nodeEffectPlaceholder')}
      </span>
    );
  }
  const node = stData.treeNodes[String(selectedNodeId)];
  if (!node) return null;

  if (node.nodeType === 1) {
    const name = tg(`seasonTalents.ordinaryEffects.${selectedNodeId}`);
    const oe = stData.ordinaryEffects[String(selectedNodeId)];
    const iconSrc = oe ? getSTAsset(iconPathToFile(oe.icon)) : '';
    const effects = oe?.effects ?? [];
    const effectDesc = getNodeEffectDesc(tg, selectedNodeId);
    return (
      <>
        <div className="phantom-desc-header">
          {iconSrc && <img src={iconSrc} className="phantom-desc-icon" alt="" />}
          <span className="phantom-desc-name">{name}</span>
        </div>
        <div className="phantom-desc-effects">
          {effects
            .filter((e) => e[0] === 1)
            .map((e, i) => {
              const attrName = tg(`attributes.${e[1]}`);
              return (
                <div key={i} className="phantom-desc-effect">
                  {attrName} +{e[2]}
                </div>
              );
            })}
          {effectDesc && (
            <div className="phantom-desc-effect phantom-desc-effect--buff">{effectDesc}</div>
          )}
        </div>
      </>
    );
  } else {
    const groupId = node.groupId;
    const slotName = tg(`seasonTalents.intermediateSlots.${groupId}`);
    const slot = stData.intermediateSlots[String(groupId)];
    const iconSrc = slot ? getSTAsset(iconPathToFile(slot.icon)) : '';
    const current = phantomFactorSlots[groupId] ?? null;
    const factorEffectDesc = current
      ? getFactorEffectDesc(tg, current.classKey, current.grade)
      : '';
    return (
      <>
        <div className="phantom-desc-header">
          {iconSrc && <img src={iconSrc} className="phantom-desc-icon" alt="" />}
          <span className="phantom-desc-name">
            {t('buildPlanner.phantom.factorSlot')}: {slotName}
          </span>
        </div>
        {current && (
          <div className="phantom-desc-factor">
            {factorBaseName(tg, current.classKey)} G{current.grade}
          </div>
        )}
        {factorEffectDesc && <div className="phantom-desc-text">{factorEffectDesc}</div>}
      </>
    );
  }
}

import { useTranslation } from 'react-i18next';
import type { ProfessionKey, ProfessionTypeKey } from '../profession';
import { getOpenProfessions, PROFESSION_TYPE_KEYS, PROFESSIONS } from '../profession';
import classesData from '../../data/classes.json';
import DraggableDialog from '../components/DraggableDialog';
import { getClassIconUrl } from './classIcons';

interface ClassEntry {
  showTalentStage: number[];
  talentColor?: string;
  talent?: number;
}

const clsData = classesData as Record<string, ClassEntry>;

function getRoleBg(professionId: number): string | undefined {
  const color = clsData[String(professionId)]?.talentColor;
  return color ? `${color}1a` : undefined;
}

// Talent値→表示順: 3=防御(0) > 2=支援(1) > 1=攻撃(2)
const TALENT_SORT_ORDER: Record<number, number> = { 3: 0, 2: 1, 1: 2 };

function sortProfessions(professions: ReturnType<typeof getOpenProfessions>) {
  return [...professions].sort((a, b) => {
    const ta = clsData[String(a.professionId)]?.talent ?? 99;
    const tb = clsData[String(b.professionId)]?.talent ?? 99;
    const orderDiff = (TALENT_SORT_ORDER[ta] ?? 99) - (TALENT_SORT_ORDER[tb] ?? 99);
    if (orderDiff !== 0) return orderDiff;
    return a.professionId - b.professionId;
  });
}

interface ProfessionPickerProps {
  professionKey: ProfessionKey;
  professionTypeKey: ProfessionTypeKey;
  onSelectProfession: (key: ProfessionKey) => void;
  onSelectProfessionType: (key: ProfessionTypeKey) => void;
  onClose: () => void;
}

function ProfessionPicker({
  professionKey,
  professionTypeKey,
  onSelectProfession,
  onSelectProfessionType,
  onClose,
}: ProfessionPickerProps) {
  const { t } = useTranslation();
  const { t: tGame } = useTranslation('game-data');
  const openProfessions = getOpenProfessions();

  const getProfessionTypeName = (pKey: ProfessionKey, typeKey: ProfessionTypeKey): string => {
    const pid = PROFESSIONS[pKey].professionId;
    const stages = clsData[String(pid)]?.showTalentStage ?? [];
    const stageId = stages[typeKey === 'type1' ? 0 : 1];
    return stageId ? tGame(`talentStages.${stageId}.typeName`, { defaultValue: typeKey }) : typeKey;
  };

  return (
    <DraggableDialog
      title={t('buildPlanner.selectProfessionTitle')}
      onClose={onClose}
      className="profession-dialog"
    >
      <div className="profession-dialog__body">
        <div className="profession-dialog__section">
          <div className="profession-dialog__section-label">
            {t('buildPlanner.professionLabel')}
          </div>
          <div className="profession-dialog__list" role="radiogroup">
            {sortProfessions(openProfessions).map((profession) => {
              const pid = PROFESSIONS[profession.key].professionId;
              const roleBg = getRoleBg(pid);
              const iconUrl = getClassIconUrl(pid);
              return (
                <label
                  key={profession.key}
                  className={`profession-dialog__item${professionKey === profession.key ? ' profession-dialog__item--selected' : ''}`}
                  style={roleBg ? { backgroundColor: roleBg } : undefined}
                >
                  <input
                    type="radio"
                    name="profession"
                    value={profession.key}
                    checked={professionKey === profession.key}
                    onChange={() => onSelectProfession(profession.key)}
                    className="profession-dialog__radio"
                  />
                  {iconUrl && (
                    <img src={iconUrl} alt="" className="profession-dialog__class-icon" />
                  )}
                  {tGame(`classes.${pid}.name`, { defaultValue: profession.key })}
                </label>
              );
            })}
          </div>
        </div>

        <div className="profession-dialog__section profession-dialog__section--type">
          <div className="profession-dialog__section-label">
            {t('buildPlanner.professionTypeLabel')}
          </div>
          <div className="profession-dialog__list" role="radiogroup">
            {PROFESSION_TYPE_KEYS.map((typeKey) => {
              const roleBg = getRoleBg(PROFESSIONS[professionKey].professionId);
              return (
                <label
                  key={typeKey}
                  className={`profession-dialog__item${professionTypeKey === typeKey ? ' profession-dialog__item--selected' : ''}`}
                  style={roleBg ? { backgroundColor: roleBg } : undefined}
                >
                  <input
                    type="radio"
                    name="professionType"
                    value={typeKey}
                    checked={professionTypeKey === typeKey}
                    onChange={() => onSelectProfessionType(typeKey)}
                    className="profession-dialog__radio"
                  />
                  {getProfessionTypeName(professionKey, typeKey)}
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </DraggableDialog>
  );
}

export default ProfessionPicker;

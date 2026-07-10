import { useTranslation } from 'react-i18next';
import DraggableDialog from '../build-planner/components/DraggableDialog';
import { changelogEntries } from './changelogData';
import './changelog.css';

interface ChangelogDialogProps {
  onClose: () => void;
}

function formatEntryDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ChangelogDialog({ onClose }: ChangelogDialogProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith('ja') ? 'ja' : 'en';

  return (
    <DraggableDialog title={t('changelog.title')} onClose={onClose} className="changelog-dialog">
      <div className="changelog-dialog__body">
        {changelogEntries.length === 0 ? (
          <p className="changelog-dialog__empty">{t('changelog.empty')}</p>
        ) : (
          changelogEntries.map((entry) => (
            <section key={entry.version} className="changelog-dialog__entry">
              <h3 className="changelog-dialog__version">
                v{entry.version}
                <span className="changelog-dialog__date">{formatEntryDate(entry.date)}</span>
              </h3>
              <p className="changelog-dialog__summary">{entry.summary[lang]}</p>
              {entry.changes[lang].length > 0 && (
                <ul className="changelog-dialog__changes">
                  {entry.changes[lang].map((change, i) => (
                    <li key={i}>{change}</li>
                  ))}
                </ul>
              )}
            </section>
          ))
        )}
      </div>
    </DraggableDialog>
  );
}

export default ChangelogDialog;

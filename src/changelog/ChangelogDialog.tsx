import { useTranslation } from 'react-i18next';
import DraggableDialog from '../build-planner/components/DraggableDialog';
import ChangelogList from './ChangelogList';
import './changelog.css';

interface ChangelogDialogProps {
  onClose: () => void;
}

function ChangelogDialog({ onClose }: ChangelogDialogProps) {
  const { t } = useTranslation();

  return (
    <DraggableDialog title={t('changelog.title')} onClose={onClose} className="changelog-dialog">
      <div className="changelog-dialog__body">
        <ChangelogList />
      </div>
    </DraggableDialog>
  );
}

export default ChangelogDialog;

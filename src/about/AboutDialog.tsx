import DraggableDialog from '../build-planner/components/DraggableDialog';
import './AboutDialog.css';
import AboutPanel from './AboutPanel';

interface AboutDialogProps {
  onClose: () => void;
}

// Web版の About ダイアログ。AboutPanel(アプリ情報+変更履歴)を
// タイトルなしの中央固定モーダルで表示する。
function AboutDialog({ onClose }: AboutDialogProps) {
  return (
    <DraggableDialog onClose={onClose} className="about-dialog">
      <AboutPanel onOk={onClose} />
    </DraggableDialog>
  );
}

export default AboutDialog;

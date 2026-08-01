import { useTranslation } from 'react-i18next';
import DraggableDialog from '../build-planner/components/DraggableDialog';
import { openExternal } from '../platform/openExternal';
import './privacy-policy.css';

const GOOGLE_PRIVACY_POLICY_URL = 'https://policies.google.com/privacy';
const GA_OPT_OUT_URL = 'https://tools.google.com/dlpage/gaoptout';
const X_PROFILE_URL = 'https://x.com/alalwww';

interface PrivacyPolicyDialogProps {
  onClose: () => void;
}

// Web版限定のプライバシーポリシーダイアログ(Footerから開く)。
// GA/localStorage/共有リンク機能(短縮URL)が何を送信・保存するかを説明する。
function PrivacyPolicyDialog({ onClose }: PrivacyPolicyDialogProps) {
  const { t } = useTranslation();
  const tp = (key: string) => t(`privacy.${key}`);

  return (
    <DraggableDialog title={tp('title')} onClose={onClose} className="privacy-policy-dialog">
      <div className="privacy-policy">
        <p className="privacy-policy__updated">{tp('updated')}</p>

        <h2>{tp('operatorHeading')}</h2>
        <p>{tp('operatorBody')}</p>

        <h2>{tp('dataHeading')}</h2>
        <h3>{tp('analyticsHeading')}</h3>
        <p>{tp('analyticsBody')}</p>
        <h3>{tp('storageHeading')}</h3>
        <p>{tp('storageBody')}</p>
        <h3>{tp('shareHeading')}</h3>
        <p>{tp('shareBody')}</p>

        <h2>{tp('thirdPartyHeading')}</h2>
        <p>{tp('thirdPartyBody')}</p>

        <h2>{tp('changesHeading')}</h2>
        <p>{tp('changesBody')}</p>

        <h2>{tp('contactHeading')}</h2>
        <p>{tp('contactBody')}</p>

        <div className="privacy-policy__links">
          <button type="button" onClick={() => openExternal(GOOGLE_PRIVACY_POLICY_URL)}>
            {tp('googlePolicyLink')}
          </button>
          <button type="button" onClick={() => openExternal(GA_OPT_OUT_URL)}>
            {tp('gaOptOutLink')}
          </button>
          <button type="button" onClick={() => openExternal(X_PROFILE_URL)}>
            {tp('xLink')}
          </button>
        </div>
      </div>
    </DraggableDialog>
  );
}

export default PrivacyPolicyDialog;

import { useTranslation } from 'react-i18next';
import FloatingTooltip from './FloatingTooltip';
import { renderMarkup, type LinkTextHandlers } from './renderMarkup';
import type { LinkTextPopupState } from './useLinkTextPopup';

interface LinkTextPopupProps {
  state: LinkTextPopupState;
  handlers: LinkTextHandlers;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

// <linktext=ID>クリック時に表示するネストしたポップアップ本体。TextDescription.json由来の
// textDescs(game-data)から名前/説明を引く。ロック(ピン留め)は持たず、呼び出し元(useLinkTextPopup)
// のホバー維持ロジックに開閉を委ねる。説明文自体にさらにlinktextが含まれる場合、同じhandlersを
// そのまま渡すことでクリック時にこのポップアップの内容を差し替える(多段ポップアップにはしない)。
function LinkTextPopup({ state, handlers, onMouseEnter, onMouseLeave }: LinkTextPopupProps) {
  const { t: tGame } = useTranslation('game-data');
  const name = tGame(`textDescs.${state.id}.name`, { defaultValue: '' });
  const description = tGame(`textDescs.${state.id}.description`, { defaultValue: '' });

  if (!name && !description) return null;

  return (
    <FloatingTooltip
      x={state.x}
      y={state.y}
      clamp
      className="linktext-popup"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {name && <div className="linktext-popup__name">{name}</div>}
      {description && (
        <p className="linktext-popup__desc">{renderMarkup(description, handlers)}</p>
      )}
    </FloatingTooltip>
  );
}

export default LinkTextPopup;

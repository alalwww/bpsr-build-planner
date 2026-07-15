import './stats-detail-window.css';
import StatsDetailDialog from './StatsDetailDialog';

// クライアント版限定の Stats Detail ウィンドウ(stats-detail.html)。
// main の編集内容は storeSync 経由で反映される(自ウィンドウの useBuildStore は読み取り専用ミラー)。
function StatsDetailApp() {
  const close = () => {
    void (async () => {
      const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      await getCurrentWebviewWindow().hide();
    })();
  };

  return <StatsDetailDialog onClose={close} windowed />;
}

export default StatsDetailApp;

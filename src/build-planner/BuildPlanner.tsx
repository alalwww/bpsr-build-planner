import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import './build-planner.css';
import './components/components.css';
import CharacterPanel from './character/CharacterPanel';
import EquipmentPanel from './equipment/EquipmentPanel';
import ModulePanel from './module/ModulePanel';
import { getSTAsset, iconPathToFile, stData } from './phantom/phantomData';
import PhantomPanel from './phantom/PhantomPanel';
import { PROFESSIONS } from './profession';
import SkillPanel from './skill/SkillPanel';
import StatsDetailDialog from './character/StatsDetailDialog';
import { isTauri } from '../platform';
import { applyLanguage } from '../platform/languageSync';
import { SUPPORTED_LANGUAGES } from '../platform/languages';
import { showAboutWindow, showResidentWindow } from '../platform/residentWindow';
import { useBuildStore } from './store/useBuildStore';
import TalentTreePanel from './talent/TalentTreePanel';
import { useArrowKeySelect } from './components/useArrowKeySelect';
import { useDelayedUnmount } from './components/useDelayedUnmount';

const TABS = ['skill', 'equipment', 'module', 'phantom'] as const;
type Tab = (typeof TABS)[number];
const CLOSE_ANIM_MS = 150;

// 開いている間だけ、メニュー外クリックで閉じるハンドラを張る
function useDismissOnOutsideClick(
  open: boolean,
  ref: RefObject<HTMLDivElement | null>,
  close: () => void,
) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, ref, close]);
}

function BuildPlanner() {
  const { t, i18n } = useTranslation();
  const { t: tg } = useTranslation('game-data');
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);
  useDismissOnOutsideClick(langMenuOpen, langMenuRef, () => setLangMenuOpen(false));
  const shouldRenderLangMenu = useDelayedUnmount(langMenuOpen, CLOSE_ANIM_MS);

  const changeLanguage = (lang: string) => {
    applyLanguage(lang);
    setLangMenuOpen(false);
  };
  // トリガーにフォーカスがある間、パネルを開かずに上下矢印キーで選択を直接変更できるように
  // する(ネイティブselect/Stepperのコンボと同じ操作感)。表示順(SUPPORTED_LANGUAGES)と一致させる。
  const handleLangTriggerKeyDown = useArrowKeySelect({
    values: SUPPORTED_LANGUAGES.map((l) => l.code),
    current: i18n.language,
    onChange: changeLanguage,
    disabled: langMenuOpen,
  });

  // クライアント版限定のアプリメニュー(⚙️)。現在は About のみ。
  // 設定ウィンドウ(SettingsApp)は実装済みだが、設定項目ができるまで導線は置かない。
  const [appMenuOpen, setAppMenuOpen] = useState(false);
  const appMenuRef = useRef<HTMLDivElement>(null);
  useDismissOnOutsideClick(appMenuOpen, appMenuRef, () => setAppMenuOpen(false));
  const shouldRenderAppMenu = useDelayedUnmount(appMenuOpen, CLOSE_ANIM_MS);

  const openAbout = () => {
    void showAboutWindow();
    setAppMenuOpen(false);
  };

  const { professionKey, professionTypeKey, phantomEnabled, phantomTemplateId } = useBuildStore(
    useShallow((s) => ({
      professionKey: s.professionKey,
      professionTypeKey: s.professionTypeKey,
      phantomEnabled: s.phantomEnabled,
      phantomTemplateId: s.phantomTemplateId,
    })),
  );
  const selectProfessionType = useBuildStore((s) => s.selectProfessionType);
  const profession = PROFESSIONS[professionKey];
  // 潜在タブに表示する心相投影アイコン。有効時は選択中ツリーのアイコン、無効時は
  // 同サイズの灰色の丸(潜在Lv自体は無効化されないので「潜在」自体が無効という
  // 誤解を避けるため、テキストの(有効/無効)表記ではなくアイコンで示す)。
  const phantomTemplateIcon =
    phantomTemplateId != null ? stData.templates[String(phantomTemplateId)]?.icon : undefined;
  const phantomTabIconUrl =
    phantomEnabled && phantomTemplateIcon ? getSTAsset(iconPathToFile(phantomTemplateIcon)) : null;
  const phantomTabIconTitle = phantomTabIconUrl
    ? t('buildPlanner.phantom.tabTitleEnabled', {
        name: tg(`seasonTalents.templates.${phantomTemplateId}`),
        defaultValue: '{{name}}が有効です',
      })
    : t('buildPlanner.phantom.tabTitleDisabled', {
        defaultValue: '心相投影ツリーが無効です',
      });

  const [activeTab, setActiveTab] = useState<Tab>('skill');
  const [showTalentTree, setShowTalentTree] = useState(false);
  const [showStatsDetail, setShowStatsDetail] = useState(false);

  const handleTabClick = (tab: Tab) => {
    setActiveTab(tab);
    setShowTalentTree(false);
  };

  // タブ下線をアクティブタブの位置までスライドさせるインジケーター。位置は実測値
  // (offsetLeft/offsetWidth)で決まるため、タブ切り替え時だけでなく、アイコン読み込みや
  // 言語切り替えによるラベル幅変化・ウィンドウリサイズでもズレないようResizeObserverで
  // 追従させる。タレントツリー表示中はどのタブも「アクティブ」ではないため非表示にする。
  const tabListRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});
  const [tabIndicator, setTabIndicator] = useState<{ left: number; width: number } | null>(null);

  const updateTabIndicator = () => {
    const btn = tabRefs.current[activeTab];
    if (!btn) return;
    setTabIndicator({ left: btn.offsetLeft, width: btn.offsetWidth });
  };
  // ResizeObserverのコールバックは初回マウント時のクロージャで固定されるため、
  // 常に最新のupdateTabIndicator(=最新のactiveTab)を参照できるようrefを介す。
  const updateTabIndicatorRef = useRef(updateTabIndicator);
  updateTabIndicatorRef.current = updateTabIndicator;

  useLayoutEffect(updateTabIndicator, [activeTab, phantomTabIconUrl]);

  useEffect(() => {
    const container = tabListRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => updateTabIndicatorRef.current());
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div className="build-planner">
        <CharacterPanel
          onOpenTalentTree={() => setShowTalentTree(true)}
          onOpenStatsDetail={() =>
            isTauri ? void showResidentWindow('stats-detail') : setShowStatsDetail(true)
          }
        />
        <div className="build-planner__right">
          <nav className="build-planner__tabs">
            <div className="build-planner__tab-list" ref={tabListRef}>
              {TABS.map((tab) => (
                <button
                  type="button"
                  key={tab}
                  ref={(el) => {
                    tabRefs.current[tab] = el;
                  }}
                  className={`build-planner__tab${!showTalentTree && tab === activeTab ? ' build-planner__tab--active' : ''}`}
                  onClick={() => handleTabClick(tab)}
                >
                  {t(`buildPlanner.tabs.${tab}`)}
                  {tab === 'phantom' &&
                    (phantomTabIconUrl ? (
                      <img
                        src={phantomTabIconUrl}
                        className="build-planner__tab-phantom-icon"
                        alt=""
                        title={phantomTabIconTitle}
                      />
                    ) : (
                      <span
                        className="build-planner__tab-phantom-icon build-planner__tab-phantom-icon--off"
                        title={phantomTabIconTitle}
                      />
                    ))}
                </button>
              ))}
              {tabIndicator && (
                <div
                  className={`build-planner__tab-indicator${showTalentTree ? ' build-planner__tab-indicator--hidden' : ''}`}
                  style={{ left: tabIndicator.left, width: tabIndicator.width }}
                />
              )}
            </div>
            <div className="build-planner__nav-right">
              <span className="build-planner__season-badge">{t('buildPlanner.seasonBadge')}</span>
              <div className="nav-lang" ref={langMenuRef}>
                <button
                  type="button"
                  className="build-planner__nav-lang"
                  onClick={() => setLangMenuOpen((v) => !v)}
                  onKeyDown={handleLangTriggerKeyDown}
                  title="Language"
                >
                  🌐
                </button>
                {shouldRenderLangMenu && (
                  <div
                    className={`nav-lang__dropdown-anchor dropdown-panel-anim${langMenuOpen ? '' : ' dropdown-panel-anim--closing'}`}
                  >
                    <div className="dropdown-panel-anim__inner">
                      <div className="nav-lang__dropdown-panel">
                        {SUPPORTED_LANGUAGES.map(({ code, label }) => (
                          <button
                            key={code}
                            type="button"
                            className={`nav-lang__item${i18n.language === code ? ' nav-lang__item--active' : ''}`}
                            onClick={() => changeLanguage(code)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {isTauri && (
                <div className="nav-lang" ref={appMenuRef}>
                  <button
                    type="button"
                    className="build-planner__nav-lang"
                    onClick={() => setAppMenuOpen((v) => !v)}
                    title={t('about.menuTitle')}
                  >
                    ⚙️
                  </button>
                  {shouldRenderAppMenu && (
                    <div
                      className={`nav-lang__dropdown-anchor dropdown-panel-anim${appMenuOpen ? '' : ' dropdown-panel-anim--closing'}`}
                    >
                      <div className="dropdown-panel-anim__inner">
                        <div className="nav-lang__dropdown-panel">
                          <hr />
                          <button type="button" className="nav-lang__item" onClick={openAbout}>
                            {t('about.menu')}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </nav>
          <div className="build-planner__content">
            {showTalentTree ? (
              <TalentTreePanel
                professionKey={professionKey}
                professionTypeKey={professionTypeKey}
                onSelectProfessionType={selectProfessionType}
              />
            ) : (
              <>
                {activeTab === 'equipment' && (
                  <EquipmentPanel profession={profession} professionTypeKey={professionTypeKey} />
                )}
                {activeTab === 'skill' && (
                  <SkillPanel professionKey={professionKey} professionTypeKey={professionTypeKey} />
                )}
                {activeTab === 'module' && (
                  <ModulePanel profession={profession} professionTypeKey={professionTypeKey} />
                )}
                {activeTab === 'phantom' && <PhantomPanel professionKey={professionKey} />}
              </>
            )}
          </div>
        </div>
      </div>
      {showStatsDetail && <StatsDetailDialog onClose={() => setShowStatsDetail(false)} />}
    </>
  );
}

export default BuildPlanner;

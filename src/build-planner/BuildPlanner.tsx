import { type RefObject, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import './build-planner.css';
import './components/components.css';
import CharacterPanel from './character/CharacterPanel';
import EquipmentPanel from './equipment/EquipmentPanel';
import ModulePanel from './module/ModulePanel';
import PhantomPanel from './phantom/PhantomPanel';
import { PROFESSIONS } from './profession';
import SkillPanel from './skill/SkillPanel';
import StatsDetailDialog from './character/StatsDetailDialog';
import { isTauri } from '../platform';
import { applyLanguage } from '../platform/languageSync';
import { showAboutWindow, showResidentWindow } from '../platform/residentWindow';
import { useBuildStore } from './store/useBuildStore';
import TalentTreePanel from './talent/TalentTreePanel';

const TABS = ['skill', 'equipment', 'module', 'phantom'] as const;
type Tab = (typeof TABS)[number];

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
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);
  useDismissOnOutsideClick(langMenuOpen, langMenuRef, () => setLangMenuOpen(false));

  const changeLanguage = (lang: string) => {
    applyLanguage(lang);
    setLangMenuOpen(false);
  };

  // クライアント版限定のアプリメニュー(⚙️)。現在は About のみ。
  // 設定ウィンドウ(SettingsApp)は実装済みだが、設定項目ができるまで導線は置かない。
  const [appMenuOpen, setAppMenuOpen] = useState(false);
  const appMenuRef = useRef<HTMLDivElement>(null);
  useDismissOnOutsideClick(appMenuOpen, appMenuRef, () => setAppMenuOpen(false));

  const openAbout = () => {
    void showAboutWindow();
    setAppMenuOpen(false);
  };

  const { professionKey, professionTypeKey } = useBuildStore(
    useShallow((s) => ({ professionKey: s.professionKey, professionTypeKey: s.professionTypeKey })),
  );
  const selectProfessionType = useBuildStore((s) => s.selectProfessionType);
  const profession = PROFESSIONS[professionKey];

  const [activeTab, setActiveTab] = useState<Tab>('skill');
  const [showTalentTree, setShowTalentTree] = useState(false);
  const [showStatsDetail, setShowStatsDetail] = useState(false);

  const handleTabClick = (tab: Tab) => {
    setActiveTab(tab);
    setShowTalentTree(false);
  };

  const isPhantomTab = !showTalentTree && activeTab === 'phantom';

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
            {TABS.map((tab) => (
              <button
                type="button"
                key={tab}
                className={`build-planner__tab${!showTalentTree && tab === activeTab ? ' build-planner__tab--active' : ''}`}
                onClick={() => handleTabClick(tab)}
              >
                {t(`buildPlanner.tabs.${tab}`)}
              </button>
            ))}
            <div className="build-planner__nav-right">
              <span className="build-planner__season-badge">{t('buildPlanner.seasonBadge')}</span>
              <div className="nav-lang" ref={langMenuRef}>
                <button
                  type="button"
                  className="build-planner__nav-lang"
                  onClick={() => setLangMenuOpen((v) => !v)}
                  title="Language"
                >
                  🌐
                </button>
                {langMenuOpen && (
                  <div className="nav-lang__dropdown">
                    <button
                      type="button"
                      className={`nav-lang__item${i18n.language === 'ja_JP' ? ' nav-lang__item--active' : ''}`}
                      onClick={() => changeLanguage('ja_JP')}
                    >
                      日本語
                    </button>
                    <button
                      type="button"
                      className={`nav-lang__item${i18n.language === 'en_US' ? ' nav-lang__item--active' : ''}`}
                      onClick={() => changeLanguage('en_US')}
                    >
                      English
                    </button>
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
                  {appMenuOpen && (
                    <div className="nav-lang__dropdown">
                      <hr />
                      <button type="button" className="nav-lang__item" onClick={openAbout}>
                        {t('about.menu')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </nav>
          <div
            className={`build-planner__content${isPhantomTab ? ' build-planner__content--phantom' : ''}`}
          >
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

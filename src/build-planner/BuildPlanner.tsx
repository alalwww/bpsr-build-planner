import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './build-planner.css';
import './components/components.css';
import CharacterPanel from './character/CharacterPanel';
import EquipmentPanel from './equipment/EquipmentPanel';
import ModulePanel from './module/ModulePanel';
import PhantomPanel from './phantom/PhantomPanel';
import SkillPanel from './skill/SkillPanel';
import StatsDetailDialog from './character/StatsDetailDialog';
import TalentTreePanel from './talent/TalentTreePanel';
import { useBuildState } from './useBuildState';

const TABS = ['skill', 'equipment', 'module', 'phantom'] as const;
type Tab = (typeof TABS)[number];

function BuildPlanner() {
  const { t, i18n } = useTranslation();
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!langMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setLangMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [langMenuOpen]);

  const changeLanguage = (lang: string) => {
    localStorage.setItem('bpsr-language', lang);
    void i18n.changeLanguage(lang);
    setLangMenuOpen(false);
  };

  const { profession, professionKey, professionTypeKey, selectProfessionType } = useBuildState();

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
          onOpenStatsDetail={() => setShowStatsDetail(true)}
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

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useOnboarding } from "./useOnboarding";
import WelcomeModal from "./WelcomeModal";
import OnboardingChecklist from "./OnboardingChecklist";
import TourEngine from "./TourEngine";
import { HERO_TOUR, CHAPTERS, SCENARIOS } from "./tours";

// /workspace 配下のオンボーディング統括。
// - 初回訪問 → WelcomeModal（900ms遅延）→ ヒーローツアー or スキップ
// - チェックリスト常駐。チャプター（機能別深掘りツアー）を起動可能
export default function OnboardingOverlay() {
  const location = useLocation();
  const inWorkspace = location.pathname.startsWith("/workspace");

  const {
    tourDone, finishTour,
    checklist, toggleItem, doneCount, totalCount,
  } = useOnboarding();

  const [modalOpen, setModalOpen] = useState(false);
  const [activeTour, setActiveTour] = useState(null); // null | tour object
  const delayRef = useRef(null);

  useEffect(() => {
    if (inWorkspace && !tourDone) {
      delayRef.current = setTimeout(() => setModalOpen(true), 900);
    }
    return () => clearTimeout(delayRef.current);
  }, [inWorkspace, tourDone]);

  const startTour = useCallback((tour) => {
    setModalOpen(false);
    setTimeout(() => setActiveTour(tour), 300);
  }, []);

  const handleStartHero = () => {
    setModalOpen(false);
    finishTour();
    setTimeout(() => setActiveTour(HERO_TOUR), 350);
  };

  const handleSkip = () => {
    setModalOpen(false);
    finishTour();
  };

  const handleTourFinish = () => {
    setActiveTour(null);
    finishTour();
  };

  const startChapter = useCallback((chapterId) => {
    const ch = CHAPTERS[chapterId];
    if (ch) startTour(ch);
  }, [startTour]);

  const startScenario = useCallback((scenarioId) => {
    const sc = SCENARIOS[scenarioId];
    if (sc) startTour(sc);
  }, [startTour]);

  if (!inWorkspace) return null;

  return (
    <>
      <WelcomeModal open={modalOpen} onStartTour={handleStartHero} onSkip={handleSkip} />

      {activeTour && (
        <TourEngine tour={activeTour} onFinish={handleTourFinish} />
      )}

      <OnboardingChecklist
        checklist={checklist}
        onToggle={toggleItem}
        doneCount={doneCount}
        totalCount={totalCount}
        onReplayHero={() => startTour(HERO_TOUR)}
        onStartChapter={startChapter}
        onStartScenario={startScenario}
        tourActive={!!activeTour}
      />
    </>
  );
}

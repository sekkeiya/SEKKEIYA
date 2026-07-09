import { useState, useCallback } from "react";

const KEY_TOUR     = "sekkeiya_tour_done";
const KEY_CHECKLIST = "sekkeiya_checklist";

const DEFAULT_CHECKLIST = {
  layout:  false,
  models:  false,
  project: false,
};

const load = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? JSON.parse(v) : fallback;
  } catch { return fallback; }
};
const save = (key, val) => {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
};

export function useOnboarding() {
  const [tourDone, setTourDone]     = useState(() => load(KEY_TOUR, false));
  const [checklist, setChecklist]   = useState(() => load(KEY_CHECKLIST, DEFAULT_CHECKLIST));
  const [tourRequested, setTourRequested] = useState(false);

  const finishTour = useCallback(() => {
    setTourDone(true);
    save(KEY_TOUR, true);
  }, []);

  // ウェルカムモーダルから「もう一度ツアー」ボタンで呼ばれる
  const requestTour = useCallback(() => {
    setTourRequested(true);
  }, []);

  const clearTourRequest = useCallback(() => {
    setTourRequested(false);
  }, []);

  const toggleItem = useCallback((key) => {
    setChecklist(prev => {
      const next = { ...prev, [key]: !prev[key] };
      save(KEY_CHECKLIST, next);
      return next;
    });
  }, []);

  const resetOnboarding = useCallback(() => {
    save(KEY_TOUR, false);
    save(KEY_CHECKLIST, DEFAULT_CHECKLIST);
    setTourDone(false);
    setChecklist(DEFAULT_CHECKLIST);
  }, []);

  const doneCount  = Object.values(checklist).filter(Boolean).length;
  const totalCount = Object.keys(checklist).length;

  return {
    tourDone,
    finishTour,
    tourRequested,
    requestTour,
    clearTourRequest,
    checklist,
    toggleItem,
    resetOnboarding,
    doneCount,
    totalCount,
  };
}

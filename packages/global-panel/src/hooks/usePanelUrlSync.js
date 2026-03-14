import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useGlobalPanelStore, VALID_PANELS } from '../store/useGlobalPanelStore';

/**
 * URLクエリパラメータ (?panel=...) と Zustand ストア (activePanel) を双方向に同期する
 */
export function usePanelUrlSync() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activePanel = useGlobalPanelStore((state) => state.activePanel);
  const openPanel = useGlobalPanelStore((state) => state.openPanel);
  const closePanel = useGlobalPanelStore((state) => state.closePanel);

  const lastActivePanel = useRef(activePanel);
  const lastUrlPanel = useRef(searchParams.get('panel'));
  const isMounted = useRef(false);

  useEffect(() => {
    const currentUrlPanel = searchParams.get('panel');

    // Simple one-way sync: URL acts as the absolute source of truth
    if (currentUrlPanel && VALID_PANELS.includes(currentUrlPanel)) {
      if (activePanel !== currentUrlPanel) {
        openPanel(currentUrlPanel);
      }
    } else {
      if (activePanel !== null) {
        closePanel();
      }
      
      // Clear invalid params automatically without recursive looping
      if (currentUrlPanel && !VALID_PANELS.includes(currentUrlPanel)) {
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('panel');
        setSearchParams(newParams, { replace: true });
      }
    }
  }, [searchParams.get('panel')]);

  return activePanel;
}

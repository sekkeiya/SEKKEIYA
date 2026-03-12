import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useGlobalPanelStore } from '../store/useGlobalPanelStore';

const VALID_PANELS = ['drive', 'chat', 'notifications'];

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

    // 初回マウント時: URL状態をStoreに反映（URLが正）
    if (!isMounted.current) {
      isMounted.current = true;
      if (currentUrlPanel && VALID_PANELS.includes(currentUrlPanel)) {
        if (activePanel !== currentUrlPanel) {
          openPanel(currentUrlPanel);
          lastActivePanel.current = currentUrlPanel;
        }
      } else if (currentUrlPanel && !VALID_PANELS.includes(currentUrlPanel)) {
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('panel');
        setSearchParams(newParams, { replace: true });
        lastUrlPanel.current = null;
      }
      return;
    }

    const panelChangedInStore = activePanel !== lastActivePanel.current;
    const panelChangedInUrl = currentUrlPanel !== lastUrlPanel.current;

    if (panelChangedInStore) {
      if (activePanel) {
        if (currentUrlPanel !== activePanel) {
          const newParams = new URLSearchParams(searchParams);
          newParams.set('panel', activePanel);
          setSearchParams(newParams);
          lastUrlPanel.current = activePanel;
        }
      } else {
        if (currentUrlPanel !== null) {
          const newParams = new URLSearchParams(searchParams);
          newParams.delete('panel');
          setSearchParams(newParams);
          lastUrlPanel.current = null;
        }
      }
      lastActivePanel.current = activePanel;
    } else if (panelChangedInUrl) {
      if (currentUrlPanel && VALID_PANELS.includes(currentUrlPanel)) {
        if (activePanel !== currentUrlPanel) {
          openPanel(currentUrlPanel);
          lastActivePanel.current = currentUrlPanel;
        }
      } else if (currentUrlPanel && !VALID_PANELS.includes(currentUrlPanel)) {
        if (activePanel !== null) {
          closePanel();
          lastActivePanel.current = null;
        }
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('panel');
        setSearchParams(newParams, { replace: true });
        lastUrlPanel.current = null;
      } else if (!currentUrlPanel) {
        if (activePanel !== null) {
          closePanel();
          lastActivePanel.current = null;
        }
      }
      lastUrlPanel.current = currentUrlPanel;
    }
  }, [activePanel, searchParams, openPanel, closePanel, setSearchParams]);

  return activePanel;
}

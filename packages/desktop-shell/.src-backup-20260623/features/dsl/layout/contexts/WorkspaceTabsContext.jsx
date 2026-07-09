// src/features/layout/contexts/WorkspaceTabsContext.jsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * WorkspaceTabsContext
 * - 「複数プロジェクト（= workspace）」をタブとして保持し、切り替えできるようにする
 * - URL直打ちで開いても tabs に自動追加される（重要）
 *
 * ✅ 重要: tab.id は常に「workspaceId」で統一する
 *
 * タブデータ構造:
 * {
 *   id: string,        // ✅ workspaceId
 *   title: string,     // 表示名（workspaceNameなど）
 *   path: string,      // そのワークスペースを開くURL
 *   lastActiveAt: number
 * }
 */

const WorkspaceTabsContext = createContext(null);
const STORAGE_KEY = "3dsl_workspace_tabs_v2";

function safeJsonParse(str, fallback) {
  try {
    const v = JSON.parse(str);
    return v == null ? fallback : v;
  } catch {
    return fallback;
  }
}

function shortId(id) {
  const s = String(id || "");
  if (s.length <= 10) return s || "-";
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

function guessTitleFromId(id) {
  return `Workspace-${shortId(id)}`;
}

/**
 * pathname から workspaceId を取り出す
 * 例: /app/layout/projects/xxx/workspaces/yyy
 */
function extractWorkspaceIdFromPathname(pathname) {
  const m = String(pathname || "").match(/\/workspaces\/([^/]+)/);
  return m?.[1] ? decodeURIComponent(m[1]) : "";
}

/**
 * tab を生成（id は workspaceId に統一）
 * openTab は workspaceId を渡す想定。
 */
function makeTab({ workspaceId, title, path }) {
  const id = String(workspaceId || "").trim();
  if (!id) return null;

  const t = String(title || "").trim();
  const p = String(path || "").trim();

  return {
    id, // ✅ workspaceId
    title: t ? t : guessTitleFromId(id),
    path: p,
    lastActiveAt: Date.now(),
  };
}

export function WorkspaceTabsProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  // ---------------------------
  // init from session
  // ---------------------------
  const initial = useMemo(() => {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed = safeJsonParse(raw, null);
    const tabs = Array.isArray(parsed?.tabs) ? parsed.tabs : [];
    const activeId = typeof parsed?.activeId === "string" ? parsed.activeId : "";
    return { tabs, activeId };
  }, []);

  const [tabs, setTabs] = useState(initial.tabs);
  const [activeId, setActiveId] = useState(initial.activeId);

  // ---------------------------
  // latest refs（クロージャで古い状態を掴まないため）
  // ---------------------------
  const tabsRef = useRef(tabs);
  const activeIdRef = useRef(activeId);

  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  // ---------------------------
  // persist
  // ---------------------------
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ tabs, activeId }));
  }, [tabs, activeId]);

  // ---------------------------
  // auto register from URL（URL直打ち・canonical置換に追従）
  // ---------------------------
  useEffect(() => {
    const workspaceId = extractWorkspaceIdFromPathname(location.pathname);
    if (!workspaceId) return;

    const path = location.pathname + (location.search || "") + (location.hash || "");

    setTabs((prev) => {
      const idx = prev.findIndex((t) => t?.id === workspaceId);
      if (idx >= 0) {
        // ✅ 常に最新 path に更新
        return prev.map((t) => (t?.id === workspaceId ? { ...t, path } : t));
      }
      const tab = makeTab({ workspaceId, path });
      return tab ? [...prev, tab] : prev;
    });

    // ✅ 既に active なら再設定しない（無駄な再レンダー抑制）
    setActiveId((cur) => (cur === workspaceId ? cur : workspaceId));
  }, [location.pathname, location.search, location.hash]);

  // ---------------------------
  // actions
  // ---------------------------
  const openTab = useCallback(
    ({ workspaceId, title, path, boardId }) => {
      // ✅ workspaceId が最優先（互換で boardId もチェック）
      const key = String(workspaceId || boardId || "").trim();
      const tab = makeTab({ workspaceId: key, title, path });
      if (!tab) return;

      setTabs((prev) => {
        const idx = prev.findIndex((t) => t?.id === tab.id);
        if (idx >= 0) {
          return prev.map((t) => {
            if (t?.id !== tab.id) return t;
            return {
              ...t,
              title: String(title || "").trim() ? String(title).trim() : t.title,
              path: tab.path || t.path,
              lastActiveAt: Date.now(),
            };
          });
        }
        return [...prev, tab];
      });

      setActiveId(tab.id);

      // ✅ path がある場合は即遷移（リロード無し）
      if (tab.path) navigate(tab.path);
    },
    [navigate]
  );

  const setActive = useCallback(
    (workspaceId) => {
      const id = String(workspaceId || "").trim();
      if (!id) return;

      // 既に active なら何もしない（余計な navigate 防止）
      if (activeIdRef.current === id) return;

      setActiveId(id);
      setTabs((prev) =>
        prev.map((t) => (t?.id === id ? { ...t, lastActiveAt: Date.now() } : t))
      );

      // ✅ 常に最新の tabs から path を引く
      const target = tabsRef.current.find((t) => t?.id === id);
      if (target?.path) navigate(target.path);
    },
    [navigate]
  );

  const closeTab = useCallback(
    (workspaceId) => {
      const id = String(workspaceId || "").trim();
      if (!id) return;

      const currentTabs = tabsRef.current;
      const currentActive = activeIdRef.current;

      const nextTabs = currentTabs.filter((t) => t?.id !== id);
      setTabs(nextTabs);

      if (currentActive === id) {
        const fallback =
          [...nextTabs].sort((a, b) => (b?.lastActiveAt || 0) - (a?.lastActiveAt || 0))[0] ||
          null;

        const nextActiveId = fallback?.id || "";
        setActiveId(nextActiveId);

        if (fallback?.path) navigate(fallback.path);
        else navigate("/app/layout");
      }
    },
    [navigate]
  );

  const updateTabTitle = useCallback((workspaceId, title) => {
    const id = String(workspaceId || "").trim();
    const nextTitle = String(title || "").trim();
    if (!id || !nextTitle) return;

    setTabs((prev) => prev.map((t) => (t?.id === id ? { ...t, title: nextTitle } : t)));
  }, []);

  const clearAllTabs = useCallback(() => {
    setTabs([]);
    setActiveId("");
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo(
    () => ({
      tabs,
      activeId,
      openTab,
      setActive,
      closeTab,
      updateTabTitle,
      clearAllTabs,
    }),
    [tabs, activeId, openTab, setActive, closeTab, updateTabTitle, clearAllTabs]
  );

  return <WorkspaceTabsContext.Provider value={value}>{children}</WorkspaceTabsContext.Provider>;
}

export function useWorkspaceTabs() {
  const ctx = useContext(WorkspaceTabsContext);
  if (!ctx) throw new Error("useWorkspaceTabs must be used within <WorkspaceTabsProvider />");
  return ctx;
}

/**
 * Layout側で workspaceName を取得した後にタブ名を更新したい時に使う
 */
export function useWorkspaceTabTitleSync(workspaceId, title) {
  const { updateTabTitle } = useWorkspaceTabs();

  useEffect(() => {
    const id = String(workspaceId || "").trim();
    const t = String(title || "").trim();
    if (!id || !t) return;
    updateTabTitle(id, t);
  }, [workspaceId, title, updateTabTitle]);
}

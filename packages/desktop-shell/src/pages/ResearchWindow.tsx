// ResearchWindow — Research & Memo の独立ネイティブウィンドウ（/?researchWindow=true）。
//
// 中身は ResearchBoardWorkspace そのまま（ボード一覧サイドバー＋キャンバス＋右のメモペイン）。
// 本体と違い、この窓は自分でスコープ（アカウント / プロジェクト）を持つ。
//
// 子窓は MainAppInitGate / MainLayout を通らないため、
//  ・MUI テーマを自前で張る（無いとダーク背景に黒文字になる）
//  ・host を height:100vh の flex column にする（ワークスペースの flex:1 が解決できない）
// の2点を CodeWindow と同様に必ず入れる。
import React, { useEffect, useMemo, useState } from 'react';
import { Box, ThemeProvider, CssBaseline } from '@mui/material';
import { ResearchBoardWorkspace } from '../components/Projects/ResearchBoardWorkspace';
import { ProjectActivityFeed } from '../components/Projects/ProjectActivityFeed';
import { AccountMemoTab } from '../components/Projects/AccountMemoTab';
import { ACCOUNT_BOARD_ID, parseBoardKey } from '../features/projects/repositories/ResearchCanvasRepository';
import { serveResearchWindowPresence } from '../features/projects/chat/researchWindowPresence';
import { serveShowBoardRequests, onShowBoard } from '../features/projects/chat/boardContextBus';
import {
  initialScope, RESEARCH_WINDOW_SCOPE_KEY, reconcileScope,
  activeBoardStorageKey, boardViewStorageKey,
} from '../features/projects/research/researchScope';
import { ResearchScopePicker } from '../components/Projects/ResearchScopePicker';
import { fetchUserProjects } from '../features/projects/api/fetchProjects';
import { useAppStore, TEMPLATE_WORKSPACE_NAME } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';
import { useAppTheme } from '../styles/useAppTheme';

export const ResearchWindow: React.FC = () => {
  const appTheme = useAppTheme();
  const params = useMemo(() => new URLSearchParams(window.location.search), []);

  const [scope, setScope] = useState<string>(() => {
    const saved = (() => {
      try { return localStorage.getItem(RESEARCH_WINDOW_SCOPE_KEY); } catch { return null; }
    })();
    return initialScope(saved, params.get('projectId'));
  });

  // 子窓は本体のストアを共有しないので、プロジェクト一覧を自前で取得する
  // （ChatWindow と同じ手口。AuthGuard 配下なので currentUser は確定している）。
  const currentUser = useAuthStore(s => s.currentUser);
  const projects = useAppStore(s => s.projects);
  const [projectsLoaded, setProjectsLoaded] = useState(false);

  useEffect(() => {
    setProjectsLoaded(false);
    if (!currentUser) return;
    fetchUserProjects(currentUser.uid)
      .then(ps => {
        useAppStore.setState({
          projects: ps.filter(p => p.name !== TEMPLATE_WORKSPACE_NAME),
        });
        setProjectsLoaded(true);
      })
      .catch(e => console.warn('[ResearchWindow] プロジェクト取得に失敗:', e));
  }, [currentUser]);

  // プロジェクト一覧の取得が成功したら、消えたプロジェクトを指していないか確かめる。
  // 取得失敗時には整合しない（一時的なネットワーク障害かもしれないため、スコープの切り替えを避ける）。
  //
  // fetchUserProjects は失敗しても例外を投げず [] を返すため、「0件」と「取得できなかった」を
  // 区別できない。一時的な通信エラーで利用者の選んだスコープを永久に捨てるより、
  // 本当に0件のときに整合を見送るほうが害が小さいので、空配列のときも整合しない。
  useEffect(() => {
    if (!projectsLoaded || projects.length === 0) return;
    setScope(current => reconcileScope(current, projects.map(p => p.id)));
  }, [projectsLoaded, projects]);

  useEffect(() => {
    import('@tauri-apps/api/window')
      .then(({ getCurrentWindow }) => getCurrentWindow().setTitle('Research & Memo — SEKKEIYA'))
      .catch(() => {});
  }, []);

  // 本体へ「窓が開いています」を配信する（本体タブはこれを見てマウントを止める）。
  useEffect(() => serveResearchWindowPresence(), []);

  // AI の「このボードを出して」を受ける。本体は窓が開いていると何もしないので、ここが受け手。
  useEffect(() => serveShowBoardRequests(), []);

  // 別スコープのボードを指定されたら、スコープごと切り替えて前面に出す。
  // 同一スコープ内のボード・ビュー切替は ResearchBoardWorkspace 側のハンドラが担う。
  useEffect(() => onShowBoard(req => {
    const target = parseBoardKey(req.boardKey);
    if (target.scope !== scope) {
      try {
        localStorage.setItem(activeBoardStorageKey(target.scope), target.docId);
        localStorage.setItem(boardViewStorageKey(target.scope, target.docId), req.view);
      } catch { /* ignore */ }
      setScope(target.scope);
    }
    import('@tauri-apps/api/window')
      .then(({ getCurrentWindow }) => getCurrentWindow().setFocus())
      .catch(() => {});
  }), [scope]);

  // スコープを記憶し、ストアにも反映する（右ペインの活動フィードが getActiveProject を見るため）。
  useEffect(() => {
    try { localStorage.setItem(RESEARCH_WINDOW_SCOPE_KEY, scope); } catch { /* ignore */ }
    useAppStore.setState({
      activeProjectId: scope === ACCOUNT_BOARD_ID ? null : scope,
      isInitialized: true,
    });
  }, [scope]);

  const isAccount = scope === ACCOUNT_BOARD_ID;

  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'var(--brand-bg)' }}>
        <ResearchBoardWorkspace
          key={scope}
          scope={scope}
          scopePicker={
            <ResearchScopePicker
              scope={scope}
              onChange={setScope}
              projects={projects.map(p => ({ id: p.id, name: p.name, isTeam: p.isTeam }))}
            />
          }
          sidebar={isAccount ? <AccountMemoTab /> : <ProjectActivityFeed compact />}
          sidebarWidth={isAccount ? 420 : 400}
        />
      </Box>
    </ThemeProvider>
  );
};

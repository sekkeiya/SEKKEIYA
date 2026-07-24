import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Box, Button, ButtonGroup, Typography, Dialog, DialogTitle, DialogContent, DialogActions, Chip, Switch, Modal, CircularProgress, Menu, MenuItem, ListItemIcon, ListItemText, IconButton, Tooltip, useMediaQuery } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import SortRoundedIcon from '@mui/icons-material/SortRounded';
import WhatshotRoundedIcon from '@mui/icons-material/WhatshotRounded';
import FiberNewRoundedIcon from '@mui/icons-material/FiberNewRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { doc, setDoc, increment } from 'firebase/firestore';
import { db } from '../../lib/firebase/client';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
// @ts-ignore
import UploadModalContent from './upload/modal/UploadModalContent';
import { DssModelsGrid } from './DssModelsGrid';
import { DssProjectsGrid } from './DssProjectsGrid';
import { DssGroupedModelsGrid } from './DssGroupedModelsGrid';
import { buildDedupedAssetsView, buildGroupedLayoutUsageView } from './utils/dashboardViewUtils';
import { useAppStore } from '../../store/useAppStore';
import { useDssUploadBridge } from '../../store/useDssUploadBridge';
import { useRhinoDragImport } from './hooks/useRhinoDragImport';
import RhinoDropZone from './components/RhinoDropZone';
import { SaveToProjectDialog } from './components/SaveToProjectDialog';
import { UserProfileDialog } from './components/UserProfileDialog';
import { DssShareDialog } from './components/DssShareDialog';
import { DssDeleteConfirmDialog } from './components/DssDeleteConfirmDialog';
import { WorkspaceItemRepository } from '../workspace/WorkspaceItemRepository';
import { DssModelDetailView, DssDetailHeader } from './components/DssModelDetailView';
// 全幅ヘッダー化レイアウト: 左のモデル一覧サイドバーと右の Search & Filter パネルを
// このダッシュボード内（ツールバー下の 3 ゾーン行）に埋め込む。デスクトップのみ。
// モバイルは従来どおり MainLayout / RightPanelHost 側の外部パネル（ドロワー）を使う。
import { ModelsSidebar } from '../../shared/layout/models-sidebar/ModelsSidebar';
import { DssRightPanel } from './components/DssRightPanel';
import { projectAssetsApi } from '../projects/api/projectAssetsApi';
import { useProjectAssetUsage } from './hooks/useProjectAssetUsage';
import { useFurniturePickerStore } from '../../store/useFurniturePickerStore';
import { useModelSourcesStore } from './store/useModelSourcesStore';
import { useLocalUploadStore, type CloudFilter } from './store/useLocalUploadStore';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded';
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded';
import ImageSearchRoundedIcon from '@mui/icons-material/ImageSearchRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import { Divider } from '@mui/material';
import { useAuthStore } from '../../store/useAuthStore';
import { SEARCH_ENGINES, runProductSearch, getModelQueryImage, type SearchEngine } from './utils/productImageSearch';
import { runLensSearch, appendRelatedLinks, appendCatalogLinks, bulkRegisterLensLinks, type LensResult, type LensDiag, type BulkRegisterProgress, type CatalogLink } from './utils/lensResultsSearch';
import { bulkAiAutoFill, type AiAutoFillProgress } from './utils/bulkAiAutoFill';
import { bulkRegenerateThumbnails, type ThumbRegenProgress } from './utils/bulkRegenerateThumbnails';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import { DssFurnitureGraph } from './graph/DssFurnitureGraph';
import { openModelInDcc, canPlaceInDcc, type DccApp } from './utils/dccPlacement';
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded';
import AutoAwesomeMotionRoundedIcon from '@mui/icons-material/AutoAwesomeMotionRounded';
import ThreeDRotationRoundedIcon from '@mui/icons-material/ThreeDRotationRounded';
import ViewInArRoundedIcon from '@mui/icons-material/ViewInArRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { Snackbar, Alert } from '@mui/material';
import { LensResultsDialog } from './components/LensResultsDialog';
import { searchCatalogByImage, getCatalogSources, type CatalogMatch, type CatalogIndexMeta } from './catalog/searchCatalog';
import { CatalogMatchDialog } from './catalog/CatalogMatchDialog';

const CLOUD_FILTER_TABS: { key: CloudFilter; label: string; color: string }[] = [
  { key: 'all', label: 'すべて', color: 'rgb(var(--brand-fg-rgb) / 0.65)' },
  { key: 'cloud', label: 'クラウド保存済み', color: 'light-dark(#0676a8, #38bdf8)' },
  { key: 'public', label: '公開', color: 'light-dark(#2f07a6, #a78bfa)' },
  { key: 'private', label: '非公開', color: 'light-dark(#aa4e03, #fb923c)' },
  { key: 'local', label: 'ローカルのみ', color: '#16a34a' },
];

// モデル詳細の前/次スライド演出（方向に応じて左右からスライドイン/アウト）。
const DETAIL_SLIDE_VARIANTS = {
  enter: (dir: number) => ({ x: dir > 0 ? '45%' : '-45%', opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? '-45%' : '45%', opacity: 0 }),
};

const DENSITY_PRESETS = [
  { key: 'compact', label: 'Compact', value: 168 },
  { key: 'default', label: 'Default', value: 210 },
  { key: 'large', label: 'Large', value: 246 },
];

export const DssDashboard: React.FC<{
  payload: any;
  items: any[];
  isInitializing: boolean;
}> = ({ payload, items, isInitializing }) => {
  const setPanelSelection = useAppStore(s => s.setPanelSelection);
  const modelsScope = useAppStore(s => s.modelsScope);
  const viewingPublicProjectName = useAppStore(s => s.viewingPublicProjectName);
  const activeProjectId = useAppStore(s => s.activeProjectId);
  const projects = useAppStore(s => s.projects);
  // S.Image の「画像生成・編集」エディターと同じ発想で、S.Model 内に 3D モデル生成エディターを開く。
  const setDssShellMode = useAppStore(s => s.setDssShellMode);
  const openModelGenerator = useCallback(() => {
    setDssShellMode('editor');
  }, [setDssShellMode]);
  const activeProjectName = useMemo(
    () => projects.find(p => p.id === activeProjectId)?.name ?? null,
    [projects, activeProjectId]
  );
  const selectedItem = useAppStore(s => payload?.workspaceId ? s.panelSelections[payload.workspaceId] : null);

  // 選択中モデルを画像検索（逆画像検索 / 商品検索）するメニュー。
  const currentUserUid = useAuthStore(s => s.currentUser?.uid ?? null);
  const [imgSearchAnchor, setImgSearchAnchor] = useState<null | HTMLElement>(null);
  const [imgSearchBusy, setImgSearchBusy] = useState(false);
  const [imgSearchError, setImgSearchError] = useState<string | null>(null);
  const canImageSearch = !!selectedItem && !selectedItem.isProjectItem;

  // S.Library カタログとのローカル視覚照合。
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogBusy, setCatalogBusy] = useState(false);
  const [catalogProgress, setCatalogProgress] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogMatches, setCatalogMatches] = useState<CatalogMatch[]>([]);
  const [catalogQueryImg, setCatalogQueryImg] = useState<string | null>(null);
  const [catalogSources, setCatalogSources] = useState<CatalogIndexMeta[]>([]);
  const [catalogModel, setCatalogModel] = useState<any | null>(null);
  const [catalogRegistering, setCatalogRegistering] = useState(false);

  const handleSearchCatalog = useCallback(async () => {
    setImgSearchAnchor(null);
    if (!selectedItem) return;
    setCatalogModel(selectedItem);
    setCatalogOpen(true);
    setCatalogBusy(true);
    setCatalogError(null);
    setCatalogMatches([]);
    setCatalogQueryImg(null);
    setCatalogProgress('モデル画像を準備中…');
    // 索引済みソース（カタログ/サイト）一覧を取得して表示。
    getCatalogSources().then(setCatalogSources).catch(() => setCatalogSources([]));
    try {
      const query = await getModelQueryImage(selectedItem);
      if (!query) throw new Error('モデルのプレビュー画像を取得できませんでした。');
      setCatalogQueryImg(typeof query === 'string' ? query : URL.createObjectURL(query));
      setCatalogProgress('カタログと照合中…（初回はモデル読込に時間がかかります）');
      const matches = await searchCatalogByImage(query, 12);
      setCatalogMatches(matches);
    } catch (e: any) {
      console.error('[DssDashboard] catalog search failed', e);
      setCatalogError(e?.message || 'カタログ照合に失敗しました。');
    } finally {
      setCatalogBusy(false);
      setCatalogProgress(null);
    }
  }, [selectedItem]);

  const catalogCanRegister = !!catalogModel && (
    catalogModel.authorId === currentUserUid || catalogModel.ownerId === currentUserUid || catalogModel.createdBy === currentUserUid
  );

  const handleRegisterCatalog = useCallback(async (links: CatalogLink[]) => {
    if (!catalogModel || links.length === 0) return;
    setCatalogRegistering(true);
    try {
      const merged = await appendCatalogLinks(catalogModel, links);
      // グリッド側のモデル参照＋右パネルへ即時反映。
      const it = gridItemsRef.current.find((m) => m.id === catalogModel.id);
      if (it) it.catalogLinks = merged;
      if (payload?.workspaceId && selectedItem?.id === catalogModel.id) {
        setPanelSelection(payload.workspaceId, { ...selectedItem, catalogLinks: merged });
      }
      setCatalogOpen(false);
    } catch (e: any) {
      console.error('[DssDashboard] register catalog links failed', e);
      setCatalogError(e?.message || 'カタログ登録に失敗しました。');
    } finally {
      setCatalogRegistering(false);
    }
  }, [catalogModel, payload?.workspaceId, selectedItem, setPanelSelection]);

  const handleRunImageSearch = useCallback(async (engine: SearchEngine) => {
    setImgSearchError(null);
    if (!selectedItem) return;
    try {
      setImgSearchBusy(true);
      await runProductSearch(engine, selectedItem, currentUserUid);
      setImgSearchAnchor(null);  // 成功時のみ閉じる（失敗時はメニュー内にエラー表示）
    } catch (e: any) {
      console.error('[DssDashboard] image search failed', e);
      setImgSearchError(e?.message || '画像検索を開始できませんでした。');
    } finally {
      setImgSearchBusy(false);
    }
  }, [selectedItem, currentUserUid]);

  // Google レンズの「結果一覧をアプリ内ダイアログで表示」モード（デスクトップ専用）。
  // 取得できた商品リンクを複数選択して RELATED URLs (relatedLinks) に登録できる。
  const [lensOpen, setLensOpen] = useState(false);
  const [lensBusy, setLensBusy] = useState(false);
  const [lensError, setLensError] = useState<string | null>(null);
  const [lensResults, setLensResults] = useState<LensResult[]>([]);
  const [lensDiag, setLensDiag] = useState<LensDiag | null>(null);
  const [lensQueryImg, setLensQueryImg] = useState<string | null>(null);
  const [lensUrl, setLensUrl] = useState<string | null>(null);
  const [lensRegistering, setLensRegistering] = useState(false);
  const lensModel = selectedItem; // ダイアログ操作中に選択が変わらない想定（同一モデルを参照）
  const lensCanRegister = !!selectedItem && (
    selectedItem.authorId === currentUserUid ||
    selectedItem.ownerId === currentUserUid ||
    selectedItem.createdBy === currentUserUid
  );

  const handleLensSearch = useCallback(async () => {
    if (!selectedItem) return;
    setImgSearchError(null);
    // Web 版は隠し WebView を使えないため従来どおり外部ブラウザを開く。
    const { isTauri } = await import('@tauri-apps/api/core');
    if (!isTauri()) {
      await handleRunImageSearch('lens');
      return;
    }
    setImgSearchAnchor(null);
    setLensOpen(true);
    setLensBusy(true);
    setLensError(null);
    setLensResults([]);
    setLensDiag(null);
    setLensUrl(null);
    setLensQueryImg(null);
    try {
      // クエリ（モデルサムネ）プレビュー。
      getModelQueryImage(selectedItem)
        .then((q) => { if (q) setLensQueryImg(typeof q === 'string' ? q : URL.createObjectURL(q)); })
        .catch(() => {});
      const { lensUrl: u, results, diag } = await runLensSearch(selectedItem, currentUserUid);
      setLensUrl(u);
      setLensResults(results);
      setLensDiag(diag);
    } catch (e: any) {
      console.error('[DssDashboard] lens search failed', e);
      setLensError(e?.message || 'Google レンズ検索に失敗しました。');
    } finally {
      setLensBusy(false);
    }
  }, [selectedItem, currentUserUid, handleRunImageSearch]);

  const handleRegisterLensLinks = useCallback(async (links: { title: string; url: string; thumbnail?: string; source?: string }[]) => {
    if (!lensModel || links.length === 0) return;
    setLensRegistering(true);
    try {
      const merged = await appendRelatedLinks(lensModel, links);
      // グリッド側のモデル参照も更新（再選択時に最新を表示）。
      const it = gridItemsRef.current.find((m) => m.id === lensModel.id);
      if (it) { it.relatedLinks = merged; it.sourceUrl = merged[0]?.url || it.sourceUrl; }
      // 右パネル等へ即時反映。
      if (payload?.workspaceId) {
        setPanelSelection(payload.workspaceId, { ...lensModel, relatedLinks: merged, sourceUrl: merged[0]?.url || '' });
      }
      setLensOpen(false);
    } catch (e: any) {
      console.error('[DssDashboard] register related links failed', e);
      setLensError(e?.message || '関連URLの登録に失敗しました。');
    } finally {
      setLensRegistering(false);
    }
  }, [lensModel, payload?.workspaceId, setPanelSelection]);

  // 複数選択（Ctrl/Cmd=トグル, Shift=範囲, Ctrl+A=全選択）。
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectionAnchorRef = useRef<string | null>(null);
  const gridItemsRef = useRef<any[]>([]);

  // ── 複数モデルへ Lens 上位5件を一括自動登録 ──────────────────────────────
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState<'related' | 'catalog'>('related');
  const [bulkProgress, setBulkProgress] = useState<BulkRegisterProgress | null>(null);
  const [bulkDone, setBulkDone] = useState<{ models: number; links: number; rows: { title: string; added: number; error?: string }[] } | null>(null);
  const bulkAbortRef = useRef<AbortController | null>(null);

  const isAuthorOf = useCallback((m: any) => !!m && (
    m.authorId === currentUserUid || m.ownerId === currentUserUid || m.createdBy === currentUserUid
  ), [currentUserUid]);

  // explicitModels を渡すと選択状態に依らずそのモデル群を対象にする（詳細ビューの単一モデル操作用）。
  // onClick に直接束ねられてイベントが渡るケースを Array.isArray でガード。
  const handleBulkRegister = useCallback(async (explicitModels?: any[]) => {
    const chosen = (Array.isArray(explicitModels) ? explicitModels : gridItemsRef.current.filter((m) => selectedIds.includes(m.id)))
      .filter((m) => isAuthorOf(m) && !m.isProjectItem);
    if (chosen.length === 0) return;
    setBulkMode('related');
    const { isTauri } = await import('@tauri-apps/api/core');
    if (!isTauri()) {
      setBulkDone(null);
      setBulkProgress({ index: 0, total: chosen.length, title: '', phase: 'error', message: 'この機能はデスクトップ版のみ対応です。' });
      setBulkOpen(true);
      return;
    }
    const controller = new AbortController();
    bulkAbortRef.current = controller;
    setBulkDone(null);
    setBulkProgress(null);
    setBulkOpen(true);
    try {
      const results = await bulkRegisterLensLinks(chosen, currentUserUid, {
        count: 5,
        signal: controller.signal,
        onProgress: (p) => setBulkProgress(p),
      });
      const totalLinks = results.reduce((s, r) => s + r.added, 0);
      setBulkDone({
        models: results.filter((r) => r.added > 0).length,
        links: totalLinks,
        rows: results.map((r) => ({ title: r.title, added: r.added, error: r.error })),
      });
      // 登録結果をグリッドの各モデルへ反映（再選択時に右パネルが最新を表示できるよう、参照を更新）。
      results.forEach((r) => {
        if (!r.relatedLinks) return;
        const it = gridItemsRef.current.find((m) => m.id === r.modelId);
        if (it) { it.relatedLinks = r.relatedLinks; it.sourceUrl = r.relatedLinks[0]?.url || it.sourceUrl; }
      });
      // 現在右パネルで開いているモデルが対象に含まれていれば即時反映。
      if (payload?.workspaceId && selectedItem) {
        const hit = results.find((r) => r.modelId === selectedItem.id && r.relatedLinks);
        if (hit) setPanelSelection(payload.workspaceId, { ...selectedItem, relatedLinks: hit.relatedLinks, sourceUrl: hit.relatedLinks?.[0]?.url || '' });
      }
    } catch (e: any) {
      console.error('[DssDashboard] bulk register failed', e);
      setBulkProgress((prev) => prev ? { ...prev, phase: 'error', message: e?.message || '失敗' } : null);
    } finally {
      bulkAbortRef.current = null;
    }
  }, [selectedIds, isAuthorOf, currentUserUid, payload?.workspaceId, selectedItem, setPanelSelection]);

  const cancelBulk = useCallback(() => {
    bulkAbortRef.current?.abort();
  }, []);

  // 選択モデルへ S.Library カタログの似た商品（上位5件）を一括登録。
  // カタログ照合はローカル視覚索引なので隠し WebView 不要・直列実行。進捗は bulk* ダイアログを共用。
  const handleBulkCatalog = useCallback(async (explicitModels?: any[]) => {
    const chosen = (Array.isArray(explicitModels) ? explicitModels : gridItemsRef.current.filter((m) => selectedIds.includes(m.id)))
      .filter((m) => isAuthorOf(m) && !m.isProjectItem);
    if (chosen.length === 0) return;
    setBulkMode('catalog');
    const controller = new AbortController();
    bulkAbortRef.current = controller;
    setBulkDone(null);
    setBulkProgress(null);
    setBulkOpen(true);
    const hostOf = (u?: string) => { try { return u ? new URL(u).host : ''; } catch { return ''; } };
    const rows: { title: string; added: number; error?: string }[] = [];
    let totalLinks = 0;
    let primaryMerged: CatalogLink[] | null = null;
    try {
      for (let i = 0; i < chosen.length; i++) {
        if (controller.signal.aborted) break;
        const model = chosen[i];
        const title = model?.title || model?.name || `モデル${i + 1}`;
        try {
          setBulkProgress({ index: i, total: chosen.length, title, phase: 'search' });
          const query = await getModelQueryImage(model);
          if (!query) { rows.push({ title, added: 0, error: 'モデル画像を取得できません' }); continue; }
          const matches = await searchCatalogByImage(query, 12);
          const links: CatalogLink[] = matches
            .filter((m) => !!m.productUrl)
            .slice(0, 5)
            .map((m) => ({
              title: m.label || m.catalogTitle || 'カタログ商品',
              url: m.productUrl as string,
              price: m.price || undefined,
              thumbnail: m.cropDataUrl || undefined,
              source: hostOf(m.productUrl) || undefined,
            }));
          if (links.length === 0) { rows.push({ title, added: 0, error: '該当する商品が見つかりません' }); continue; }
          setBulkProgress({ index: i, total: chosen.length, title, phase: 'register', added: links.length });
          const merged = await appendCatalogLinks(model, links);
          const it = gridItemsRef.current.find((m2) => m2.id === model.id);
          if (it) it.catalogLinks = merged;
          if (selectedItem && model.id === selectedItem.id) primaryMerged = merged;
          rows.push({ title, added: links.length });
          totalLinks += links.length;
          setBulkProgress({ index: i, total: chosen.length, title, phase: 'done', added: links.length });
        } catch (e: any) {
          rows.push({ title, added: 0, error: e?.message || '失敗' });
        }
      }
      setBulkDone({ models: rows.filter((r) => r.added > 0).length, links: totalLinks, rows });
      if (payload?.workspaceId && selectedItem && primaryMerged) {
        setPanelSelection(payload.workspaceId, { ...selectedItem, catalogLinks: primaryMerged });
      }
    } catch (e: any) {
      console.error('[DssDashboard] bulk catalog failed', e);
      setBulkProgress((prev) => prev ? { ...prev, phase: 'error', message: e?.message || '失敗' } : null);
    } finally {
      bulkAbortRef.current = null;
    }
  }, [selectedIds, isAuthorOf, payload?.workspaceId, selectedItem, setPanelSelection]);

  // ── 複数モデルへ「AIによる寸法・カテゴリ自動入力」を一括適用 ──────────────
  const [aiBulkOpen, setAiBulkOpen] = useState(false);
  const [aiBulkProgress, setAiBulkProgress] = useState<AiAutoFillProgress | null>(null);
  const [aiBulkDone, setAiBulkDone] = useState<{ models: number; rows: { title: string; fields: number; error?: string }[] } | null>(null);
  const aiBulkAbortRef = useRef<AbortController | null>(null);

  // ── サムネイル再生成（既存モデルを現在の生成設定で作り直す） ─────────────
  const [thumbRegenProgress, setThumbRegenProgress] = useState<ThumbRegenProgress | null>(null);
  const [thumbRegenBusy, setThumbRegenBusy] = useState(false);
  const thumbRegenAbortRef = useRef<AbortController | null>(null);

  const handleBulkRegenerateThumbs = useCallback(async () => {
    const chosen = gridItemsRef.current
      .filter((m) => selectedIds.includes(m.id))
      .filter((m) => isAuthorOf(m) && !m.isProjectItem);
    if (chosen.length === 0) return;
    const ok = window.confirm(
      `${chosen.length} 件のサムネイルを作り直します。\n` +
      'GLB を読み込んで画像を生成し直すため時間がかかります。よろしいですか？'
    );
    if (!ok) return;

    const controller = new AbortController();
    thumbRegenAbortRef.current = controller;
    setThumbRegenBusy(true);
    setThumbRegenProgress(null);
    try {
      const results = await bulkRegenerateThumbnails(chosen, {
        signal: controller.signal,
        onProgress: (p) => setThumbRegenProgress(p),
      });
      // グリッドと右パネルへ即時反映（再読み込みなしで新しいサムネが出るように）。
      results.forEach((r) => {
        if (!r.thumbnailUrl) return;
        const it = gridItemsRef.current.find((m) => m.id === r.modelId);
        if (it) it.thumbnailUrl = r.thumbnailUrl;
      });
      if (payload?.workspaceId && selectedItem) {
        const hit = results.find((r) => r.modelId === selectedItem.id && r.thumbnailUrl);
        if (hit) setPanelSelection(payload.workspaceId, { ...selectedItem, thumbnailUrl: hit.thumbnailUrl });
      }
      const failed = results.filter((r) => r.error).length;
      const skipped = results.filter((r) => r.skipped).length;
      const done = results.filter((r) => r.thumbnailUrl).length;
      setDccToast({
        sev: failed > 0 ? 'error' : 'success',
        msg: `サムネイルを再生成しました（成功 ${done} 件`
          + (skipped ? ` / GLB無しでスキップ ${skipped} 件` : '')
          + (failed ? ` / 失敗 ${failed} 件` : '') + '）',
      });
    } catch (e: any) {
      console.error('[DssDashboard] bulk thumbnail regeneration failed', e);
      setDccToast({ sev: 'error', msg: e?.message || 'サムネイルの再生成に失敗しました' });
    } finally {
      setThumbRegenBusy(false);
      setThumbRegenProgress(null);
      thumbRegenAbortRef.current = null;
    }
  }, [selectedIds, isAuthorOf, payload?.workspaceId, selectedItem, setPanelSelection]);

  const handleBulkAutoFill = useCallback(async (explicitModels?: any[]) => {
    const chosen = (Array.isArray(explicitModels) ? explicitModels : gridItemsRef.current.filter((m) => selectedIds.includes(m.id)))
      .filter((m) => isAuthorOf(m) && !m.isProjectItem);
    if (chosen.length === 0) return;
    const controller = new AbortController();
    aiBulkAbortRef.current = controller;
    setAiBulkDone(null);
    setAiBulkProgress(null);
    setAiBulkOpen(true);
    try {
      const results = await bulkAiAutoFill(chosen, {
        signal: controller.signal,
        onProgress: (p) => setAiBulkProgress(p),
      });
      setAiBulkDone({
        models: results.filter((r) => !r.error).length,
        rows: results.map((r) => ({ title: r.title, fields: r.fields, error: r.error })),
      });
      // 反映結果をグリッドの各モデルへ適用（再選択時に最新を表示）。
      results.forEach((r) => {
        if (!r.payload) return;
        const it = gridItemsRef.current.find((m) => m.id === r.modelId);
        if (it) Object.assign(it, r.payload);
      });
      // 右パネルで開いているモデルが対象なら即時反映。
      if (payload?.workspaceId && selectedItem) {
        const hit = results.find((r) => r.modelId === selectedItem.id && r.payload);
        if (hit) setPanelSelection(payload.workspaceId, { ...selectedItem, ...hit.payload });
      }
    } catch (e: any) {
      console.error('[DssDashboard] bulk auto-fill failed', e);
      setAiBulkProgress((prev) => prev ? { ...prev, phase: 'error', message: e?.message || '失敗' } : null);
    } finally {
      aiBulkAbortRef.current = null;
    }
  }, [selectedIds, isAuthorOf, payload?.workspaceId, selectedItem, setPanelSelection]);

  const cancelAiBulk = useCallback(() => {
    aiBulkAbortRef.current?.abort();
  }, []);

  // ── 選択中モデルを Rhino / Blender へ一括配置 ─────────────────────────────
  const [dccBusy, setDccBusy] = useState<DccApp | null>(null);
  const [dccToast, setDccToast] = useState<{ msg: string; sev: 'success' | 'info' | 'error' } | null>(null);

  const dccEligibleCount = useCallback(
    (app: DccApp) => gridItemsRef.current.filter((m) => selectedIds.includes(m.id) && canPlaceInDcc(m, app)).length,
    [selectedIds],
  );

  const handlePlaceInDcc = useCallback(async (app: DccApp, explicitModels?: any[]) => {
    const chosen = (Array.isArray(explicitModels) ? explicitModels : gridItemsRef.current.filter((m) => selectedIds.includes(m.id)))
      .filter((m) => canPlaceInDcc(m, app));
    if (chosen.length === 0) return;
    const { isTauri } = await import('@tauri-apps/api/core');
    if (!isTauri()) {
      setDccToast({ msg: 'この機能はデスクトップ版のみ対応です。', sev: 'error' });
      return;
    }
    setDccBusy(app);
    let ok = 0; let fail = 0;
    for (let i = 0; i < chosen.length; i++) {
      try {
        await openModelInDcc(chosen[i], app);
        ok++;
      } catch (e) {
        console.error('[DssDashboard] place in DCC failed', chosen[i]?.id, e);
        fail++;
      }
      // 外部アプリ起動/取り込みの間隔（連続投入で取りこぼさないように）。
      if (i < chosen.length - 1) await new Promise((r) => setTimeout(r, 1500));
    }
    setDccBusy(null);
    const appName = app === 'rhino' ? 'Rhino' : 'Blender';
    setDccToast({
      msg: fail === 0 ? `${ok} 件を ${appName} に配置しました` : `${appName} 配置: 成功 ${ok} 件 / 失敗 ${fail} 件`,
      sev: fail === 0 ? 'success' : 'info',
    });
  }, [selectedIds]);

  // 選択中のうち「自分が著者で一括登録できる」件数。
  const bulkEligibleCount = useMemo(
    () => gridItemsRef.current.filter((m) => selectedIds.includes(m.id) && isAuthorOf(m) && !m.isProjectItem).length,
    [selectedIds, isAuthorOf],
  );

  // Local Models のパンくず（参照中フォルダ）。
  const modelSources = useModelSourcesStore(s => s.sources);
  const sourceFilter = useModelSourcesStore(s => s.sourceFilter);
  const subfolderFilter = useModelSourcesStore(s => s.subfolderFilter);
  const setSourceFilter = useModelSourcesStore(s => s.setSourceFilter);
  const selectNode = useModelSourcesStore(s => s.selectNode);
  const isLocalModels = modelsScope === 'local_models';
  const cloudFilter = useLocalUploadStore(s => s.cloudFilter);
  const setCloudFilter = useLocalUploadStore(s => s.setCloudFilter);
  const breadcrumb = useMemo(() => {
    if (!isLocalModels) return null;
    const activeSource = modelSources.find(s => s.id === sourceFilter) || null;
    const segs: { label: string; path: string; onClick: () => void; active: boolean }[] = [
      { label: 'すべて', path: '', onClick: () => setSourceFilter(null), active: !activeSource },
    ];
    if (activeSource) {
      segs.push({
        label: activeSource.label,
        path: activeSource.path,
        onClick: () => selectNode(activeSource.id, null),
        active: !subfolderFilter,
      });
      if (subfolderFilter) {
        const parts = subfolderFilter.split('/');
        let acc = '';
        parts.forEach((p, i) => {
          acc = acc ? `${acc}/${p}` : p;
          const full = acc;
          segs.push({
            label: p,
            path: `${activeSource.path}\\${full.replace(/\//g, '\\')}`,
            onClick: () => selectNode(activeSource.id, full),
            active: i === parts.length - 1,
          });
        });
      }
    }
    // 末尾セグメントの実フォルダ絶対パス（ツールチップ/補助表示用）。
    const absPath = segs[segs.length - 1]?.path || '';
    return { segs, absPath };
  }, [isLocalModels, modelSources, sourceFilter, subfolderFilter, setSourceFilter, selectNode]);

  const scopeTitle = useMemo(() => {
    switch (modelsScope) {
      case 'global_models': return 'All Public Models';
      case 'global_projects': return 'All Public Projects';
      case 'my_public_models': return 'My Public Models';
      case 'my_private_models': return 'My Private Models';
      case 'project_models': return 'Project 3D Assets';
      case 'team_project_models': return 'Team Project 3D Assets';
      case 'local_models': return 'Local Models';
      default: return '3D Models';
    }
  }, [modelsScope]);

  const [cardSize, setCardSize] = useState(210);
  const searchFilters = useAppStore(s => s.dssSearchFilters);
  const setSearchFilters = useAppStore(s => s.setDssSearchFilters);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  // 外部（3D一括生成の進捗パネル等）からの要求を検知して、ファイル読み込み済みの状態で
  // アップロードダイアログを開く（initialFiles はストアから購読）。
  const uploadOpenToken = useDssUploadBridge(s => s.token);
  const uploadInitialFiles = useDssUploadBridge(s => s.files);
  const uploadPreparing = useDssUploadBridge(s => s.preparing);
  React.useEffect(() => {
    if (uploadOpenToken === 0) return;
    setUploadDialogOpen(true);
  }, [uploadOpenToken]);

  // S.Layout の「画像→3D生成」から来た場合、アップロード完了/クローズで元の画面（S.Layout）へ自動復帰。
  const closeUploadAndReturn = React.useCallback(() => {
    const app = useAppStore.getState();
    const rv = app.pendingReturnView;
    if (!rv) return;
    app.setPendingReturnView(null);
    app.setCurrentMainView(rv.mainView);
    if (rv.appScope) app.setLastActiveAppScope(rv.appScope);
    app.setActiveWorkspaceId(rv.workspaceId);
  }, []);
  const [showDetails, setShowDetails] = useState(false);
  const [saveToProjectModel, setSaveToProjectModel] = useState<any | null>(null);
  const [shareModel, setShareModel] = useState<any | null>(null);
  const [authorProfileModel, setAuthorProfileModel] = useState<any | null>(null);
  const [deleteModel, setDeleteModel] = useState<any | null>(null);
  const [detailModel, setDetailModel] = useState<any | null>(null);
  const [detailNavDir, setDetailNavDir] = useState<1 | -1>(1);
  const [viewMode, setViewMode] = useState<'assets' | 'layout' | 'graph'>('assets');

  // Public Projects のソート（新着順 / 人気順）
  const isGlobalProjectsScope = ['global_projects', 'global_following_projects'].includes(modelsScope);
  const [projectsSort, setProjectsSort] = useState<'newest' | 'popular'>('newest');
  const [sortMenuAnchor, setSortMenuAnchor] = useState<null | HTMLElement>(null);

  // Asset Usage tracking (especially for project_models scope)
  const isProjectModelsScope = modelsScope === 'project_models' || modelsScope === 'team_project_models';
  const { usageMap } = useProjectAssetUsage({
      projectId: isProjectModelsScope ? payload?.projectId : null,
      workspaceId: 'layout'
  });

  // 家具ピッカーモード（Chat 家具選定フロー § 手動選択パス）
  const pickerIsOpen = useFurniturePickerStore(s => s.isOpen);
  const pickerSelectedIds = useFurniturePickerStore(s => s.selectedIds);
  const pickerCandidateIds = useFurniturePickerStore(s => s.candidateIds);
  const pickerToggle = useFurniturePickerStore(s => s.toggle);
  const pickerConfirm = useFurniturePickerStore(s => s.confirmSelection);
  const pickerCancel = useFurniturePickerStore(s => s.cancelSelection);

  // Close detail view when switching scopes in the left sidebar
  React.useEffect(() => {
    setDetailModel(null);
  }, [modelsScope]);

  // 外部（ウォークスルー等）からのモデル詳細オープン要求を消化する
  const pendingModelDetail = useAppStore(s => s.pendingModelDetail);
  const setPendingModelDetail = useAppStore(s => s.setPendingModelDetail);
  React.useEffect(() => {
    if (!pendingModelDetail) return;
    setDetailModel(pendingModelDetail);
    if (payload?.workspaceId) {
      setPanelSelection(payload.workspaceId, pendingModelDetail);
    }
    setPendingModelDetail(null);
  }, [pendingModelDetail]); // eslint-disable-line react-hooks/exhaustive-deps

  const cardContext = useMemo(() => {
    if (modelsScope === 'my_public_models') return 'publicModels';
    if (modelsScope === 'my_private_models') return 'privateModels';
    if (modelsScope === 'project_models' || modelsScope === 'team_project_models') return 'boardModels';
    return 'models';
  }, [modelsScope]);


  const handleDeleteConfirm = async (model: any) => {
    try {
      if ((modelsScope === 'project_models' || modelsScope === 'team_project_models') && payload?.projectId) {
        // Phase 12 (SSOT): We delete the asset from the project library instead of workspace items
        await projectAssetsApi.hardDeleteAsset(payload.projectId, model.id);
        console.log('[DssDashboard] Deleted project asset:', model.id);
      } else if (payload?.workspaceId && payload?.projectId) {
        await WorkspaceItemRepository.deleteItem(payload.projectId, payload.workspaceId, model.id);
      } else {
        await WorkspaceItemRepository.deleteGlobalAsset(model.id);
      }
      // Optional: show a success toast here if desired
    } catch (err) {
      console.error('Failed to delete model:', err);
      // Optional: show an error toast here if desired
    }
  };

  // Native Rhino drag-and-drop
  const {
    isDraggingToRhino,
    openRhinoDocs,
    errorMessage,
    handleDropToRhino,
    handleCancelDrop,
    handleCardDragStart,
  } = useRhinoDragImport();

  const densityKey = useMemo(() => {
    let best = DENSITY_PRESETS[1];
    let bestDiff = Infinity;
    for (const p of DENSITY_PRESETS) {
      const d = Math.abs(p.value - cardSize);
      if (d < bestDiff) {
        best = p;
        bestDiff = d;
      }
    }
    return best.key;
  }, [cardSize]);

  const applyDensity = useCallback((key: string) => {
    const preset = DENSITY_PRESETS.find(p => p.key === key) || DENSITY_PRESETS[1];
    setCardSize(preset.value);
  }, []);

  const handleChangeSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value ?? '';
    setSearchFilters({ query: v });
  }, [setSearchFilters]);

  const handleSelectModel = useCallback((model: any, e?: React.MouseEvent) => {
    if (!payload?.workspaceId) return;
    const id = model.id;
    const items = gridItemsRef.current;

    if (e?.shiftKey && selectionAnchorRef.current) {
      // 範囲選択: アンカー〜クリック位置までを表示順で全選択。
      const a = items.findIndex((m) => m.id === selectionAnchorRef.current);
      const b = items.findIndex((m) => m.id === id);
      if (a >= 0 && b >= 0) {
        const [s, en] = a < b ? [a, b] : [b, a];
        setSelectedIds(items.slice(s, en + 1).map((m) => m.id));
      } else {
        setSelectedIds([id]);
      }
      setPanelSelection(payload.workspaceId, model);
      return;
    }

    if (e?.ctrlKey || e?.metaKey) {
      // トグル選択。
      setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
      selectionAnchorRef.current = id;
      setPanelSelection(payload.workspaceId, model);
      return;
    }

    // 通常クリック: 単一選択（同じものを再クリックで解除）。
    const currentSelected = useAppStore.getState().panelSelections[payload.workspaceId];
    if (currentSelected?.id === id && selectedIds.length <= 1) {
      setSelectedIds([]);
      selectionAnchorRef.current = null;
      setPanelSelection(payload.workspaceId, null);
    } else {
      setSelectedIds([id]);
      selectionAnchorRef.current = id;
      setPanelSelection(payload.workspaceId, model);
    }
  }, [payload?.workspaceId, setPanelSelection, selectedIds.length]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds([]);
    selectionAnchorRef.current = null;
    if (payload?.workspaceId) {
      setPanelSelection(payload.workspaceId, null);
    }
  }, [payload?.workspaceId, setPanelSelection]);

  // ── 選択中モデルの一括削除 ──────────────────────────────────────────
  // 削除アイコンと同じ条件（公開/非公開/ボード）でのみ有効。
  const canBulkDelete = cardContext === 'publicModels' || cardContext === 'privateModels' || cardContext === 'boardModels';
  const bulkDeletableCount = useMemo(
    () => (canBulkDelete ? gridItemsRef.current.filter((m) => selectedIds.includes(m.id)).length : 0),
    [selectedIds, canBulkDelete],
  );
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteBusy, setBulkDeleteBusy] = useState(false);

  const handleBulkDelete = useCallback(async () => {
    const chosen = gridItemsRef.current.filter((m) => selectedIds.includes(m.id));
    if (chosen.length === 0) return;
    setBulkDeleteBusy(true);
    for (const m of chosen) {
      // eslint-disable-next-line no-await-in-loop
      await handleDeleteConfirm(m);
    }
    setBulkDeleteBusy(false);
    setBulkDeleteOpen(false);
    handleClearSelection();
  }, [selectedIds, handleClearSelection]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ctrl/Cmd+A=全選択, Esc=選択解除（入力中は無視。このタブがアクティブな時のみ）。
  const activeWorkspaceId = useAppStore(s => s.activeWorkspaceId);
  const isActiveTab = !!payload?.workspaceId && activeWorkspaceId === payload.workspaceId;
  useEffect(() => {
    if (!isActiveTab) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        const ids = gridItemsRef.current.map((m) => m.id);
        if (ids.length) {
          e.preventDefault();
          setSelectedIds(ids);
          selectionAnchorRef.current = ids[0];
        }
      } else if (e.key === 'Escape' && selectedIds.length) {
        setSelectedIds([]);
        selectionAnchorRef.current = null;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isActiveTab, selectedIds.length]);

  // タブ/スコープ切替時は選択をリセット。
  useEffect(() => {
    setSelectedIds([]);
    selectionAnchorRef.current = null;
  }, [modelsScope, activeProjectId]);

  const handleDoubleClickProject = useCallback((project: any) => {
    useAppStore.getState().setViewingPublicProjectId(project.id);
    useAppStore.getState().setViewingPublicProjectName(project.name || project.title || null);
    useAppStore.getState().setModelsScope('view_public_project_models');
    // 閲覧数を記録（人気順ソートに使用）。失敗しても閲覧は妨げない
    setDoc(doc(db, 'projects', project.id), { viewCount: increment(1) }, { merge: true }).catch(() => {});
  }, []);

  const handleBackgroundPointerDownCapture = useCallback((e: React.PointerEvent) => {
    const el = e.target as HTMLElement;
    if (el?.closest?.('[data-right-sidebar="true"]')) return;
    if (el?.closest?.('[data-no-dismiss="true"]')) return;
    if (el?.closest?.('[data-model-card="true"]')) return;
    handleClearSelection();
  }, [handleClearSelection]);

  const handleDoubleClickModel = useCallback((model: any) => {
    setDetailModel(model);
    if (payload?.workspaceId) {
      setPanelSelection(payload.workspaceId, model);
    }
  }, [payload?.workspaceId, setPanelSelection]);

  // Pre-parse filters to avoid expensive array operations inside the loop
  const pFilter = useMemo(() => {
    const s = searchFilters;
    return {
      type: s.type,
      category: s.category,
      subCategory: s.subCategory,
      format: s.format ? String(s.format).toLowerCase() : null,
      wantsReady: s.wantsReady,
      wantsCustom: s.wantsCustom,
      tags: typeof s.tags === 'string' ? s.tags.split(/[\s,]+/).map((t: string) => t.trim().toLowerCase()).filter(Boolean) : null,
      buildingTypes: typeof s.buildingTypes === 'string' ? s.buildingTypes.split(/[\s,]+/).map((t: string) => t.trim().toLowerCase()).filter(Boolean) : null,
      rooms: typeof s.rooms === 'string' ? s.rooms.split(/[\s,]+/).map((t: string) => t.trim().toLowerCase()).filter(Boolean) : null,
      zones: typeof s.zones === 'string' ? s.zones.split(/[\s,]+/).map((t: string) => t.trim().toLowerCase()).filter(Boolean) : null,
      companionClasses: typeof s.companionClasses === 'string' ? s.companionClasses.split(/[\s,]+/).map((t: string) => t.trim().toLowerCase()).filter(Boolean) : null,
      materials: typeof s.materials === 'string' ? s.materials.split(/[\s,]+/).map((t: string) => t.trim().toLowerCase()).filter(Boolean) : null,
      query: s.query && typeof s.query === 'string' ? s.query.toLowerCase().trim() : null,
      layoutPaths: s.layoutPaths || []
    };
  }, [searchFilters]);

  // Client-side filtering
  const filteredItems = useMemo(() => {
    if (!items || items.length === 0) return [];
    
    return items.filter(m => {
      // 0. Base Filter: only show 3D models (hide AI Drive images/PDFs from 3DSS view)
      if (m.type === 'image' || m.type === 'pdf') {
        return false;
      }

      // 1. Primary Category (Macro Category matching e.g. '家具 (既製品)')
      if (pFilter.type && pFilter.type !== 'ALL') {
        if (m.macroCategory) {
          if (m.macroCategory !== pFilter.type) return false;
        } else {
          // Fallback legacy matching
          const mt = m.modelType || (m.type !== '3d-model' ? m.type : 'Furniture');
          const isCustom = m.tags?.includes('造作家具') || m.readyStatus === 'custom';
          let derivedMacro = '家具 (既製品)';
          if (mt === 'Architecture') derivedMacro = '建築・空間';
          else if (isCustom) derivedMacro = '家具 (造作)';
          
          if (pFilter.type === '設備・備品') {
            const catStr = [m.category, m.mainCategory, ...(Array.isArray(m.categoryPath) ? m.categoryPath : [])].filter(Boolean).join(" ");
            if (!catStr.includes('設備') && !catStr.includes('備品') && !catStr.includes('機器')) return false;
          } else if (derivedMacro !== pFilter.type) {
            return false;
          }
        }
      }

      // 2. Sub Category (category = 'ソファ' etc.)
      if (pFilter.category && pFilter.category !== 'ALL') {
        const catStr = [m.category, m.mainCategory, m.categoryMain, ...(Array.isArray(m.categoryPath) ? m.categoryPath : [])]
          .filter(Boolean).join(" ");
        if (!catStr.includes(pFilter.category)) return false;
      }

      // 3. Detailed Category (subCategory = '応接テーブル' etc.)
      if (pFilter.subCategory && pFilter.subCategory !== 'ALL') {
        const subCatStr = [m.category, m.subCategory, m.userCategory, ...(Array.isArray(m.categoryPath) ? m.categoryPath : [])]
          .filter(Boolean).join(" ");
        if (!subCatStr.includes(pFilter.subCategory)) return false;
      }

      // 4. Format
      if (pFilter.format && pFilter.format !== 'all') {
        const fmtStr = `${m.format} ${m.fileFormat} ${m.metadata?.format}`.toLowerCase();
        const urlStr = `${m.downloadUrl} ${m.storagePath} ${m.downloads?.glb}`.toLowerCase();
        if (!fmtStr.includes(pFilter.format) && !urlStr.includes(`.${pFilter.format}`)) return false;
      }

      // 5. Tags and Ready Status
      const itemTagsStr = (Array.isArray(m.tags) ? m.tags.join(" ") : (m.tags || "")).toLowerCase();
      
      if (pFilter.wantsReady || pFilter.wantsCustom) {
          const hasReady = itemTagsStr.includes('既製品家具') || m.readyStatus === 'ready';
          const hasCustom = itemTagsStr.includes('造作家具') || m.readyStatus === 'custom';
          
          if (pFilter.wantsReady && pFilter.wantsCustom) {
              if (!hasReady && !hasCustom) return false;
          } else if (pFilter.wantsReady) {
              if (!hasReady) return false;
          } else if (pFilter.wantsCustom) {
              if (!hasCustom) return false;
          }
      }

      if (pFilter.tags && pFilter.tags.length > 0) {
        for (const qt of pFilter.tags) {
          if (!itemTagsStr.includes(qt)) return false; // Contains all typed tags
        }
      }

      // Extended Metadata Filters
      if (pFilter.buildingTypes && pFilter.buildingTypes.length > 0) {
        const itemBuildingTypesStr = (Array.isArray(m.buildingTypes) ? m.buildingTypes.join(" ") : (m.buildingTypes || "")).toLowerCase();
        for (const qt of pFilter.buildingTypes) {
          if (!itemBuildingTypesStr.includes(qt)) return false;
        }
      }

      if (pFilter.rooms && pFilter.rooms.length > 0) {
        const itemRoomsStr = (Array.isArray(m.rooms) ? m.rooms.join(" ") : (m.rooms || "")).toLowerCase();
        for (const qt of pFilter.rooms) {
          if (!itemRoomsStr.includes(qt)) return false;
        }
      }

      if (pFilter.zones && pFilter.zones.length > 0) {
        const itemZonesStr = (Array.isArray(m.zones) ? m.zones.join(" ") : (m.zones || "")).toLowerCase();
        for (const qt of pFilter.zones) {
          if (!itemZonesStr.includes(qt)) return false;
        }
      }

      if (pFilter.companionClasses && pFilter.companionClasses.length > 0) {
        const itemCompanionClassesStr = (Array.isArray(m.companionClasses) ? m.companionClasses.join(" ") : (m.companionClasses || "")).toLowerCase();
        for (const qt of pFilter.companionClasses) {
          if (!itemCompanionClassesStr.includes(qt)) return false;
        }
      }

      if (pFilter.materials && pFilter.materials.length > 0) {
        const itemMaterialsStr = (Array.isArray(m.materials) ? m.materials.join(" ") : (m.materials || "")).toLowerCase();
        for (const qt of pFilter.materials) {
          if (!itemMaterialsStr.includes(qt)) return false;
        }
      }

      // 6. Generic Text Query
      if (pFilter.query) {
        const hay = [
          m.title,
          m.name,
          m.brand,
          m.ownerHandle,
          m.ownerName,
          Array.isArray(m.tags) ? m.tags.join(" ") : "",
          Array.isArray(m.categoryPath) ? m.categoryPath.join(" ") : "",
        ].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(pFilter.query)) return false;
      }

      // 7. Layout Paths (from usageMap)
      if (pFilter.layoutPaths.length > 0) {
        const usageData = usageMap ? usageMap[m.id] : null;
        if (!usageData || !usageData.locations || usageData.locations.length === 0) {
          return false; // Not in any layout, or at least not in the selected ones
        }
        
        // Find if this model is within ANY of the selected layoutPaths
        const isSelected = pFilter.layoutPaths.some((pathName: string) => 
          usageData.locations.some((loc: any) => loc.pathName === pathName)
        );
        
        if (!isSelected) {
          return false;
        }
      }

      return true;
    });
  }, [items, pFilter, usageMap]);

  // Public Projects 用: モデル0件のプロジェクトを除外し、選択中のソート順に並べる
  const projectItemsForGrid = useMemo(() => {
    if (!isGlobalProjectsScope) return filteredItems;
    // assetCount undefined はサムネ集計のロード中 → 表示したまま、確定0件のみ除外
    const visible = filteredItems.filter((p: any) => p.assetCount !== 0);
    const toMillis = (v: any) =>
      v?.toMillis ? v.toMillis()
      : v?.seconds ? v.seconds * 1000
      : typeof v === 'number' ? v
      : 0;
    return [...visible].sort((a: any, b: any) => {
      if (projectsSort === 'popular') {
        const diff = (b.viewCount ?? 0) - (a.viewCount ?? 0);
        if (diff !== 0) return diff;
      }
      return toMillis(b.createdAt) - toMillis(a.createdAt);
    });
  }, [filteredItems, isGlobalProjectsScope, projectsSort]);

  const { dedupedItemsForGrid, aggregatedUsageMap } = useMemo(() => {
    if (!isProjectModelsScope) {
      return { dedupedItemsForGrid: filteredItems, aggregatedUsageMap: usageMap };
    }
    const dedupedAssets = buildDedupedAssetsView(filteredItems, usageMap);
    const aggMap: Record<string, any> = {};
    dedupedAssets.forEach(d => {
      aggMap[d.item.id] = d.usageInfo;
    });
    return {
      dedupedItemsForGrid: dedupedAssets.map(d => d.item),
      aggregatedUsageMap: aggMap
    };
  }, [isProjectModelsScope, filteredItems, usageMap]);

  // 範囲選択/全選択で参照する「表示順リスト」を最新化。
  gridItemsRef.current = dedupedItemsForGrid;

  const groupedLayoutAssets = useMemo(() => {
    if (!isProjectModelsScope) return [];
    return buildGroupedLayoutUsageView(filteredItems, usageMap);
  }, [isProjectModelsScope, filteredItems, usageMap]);

  // 以前ここに毎レンダー実行される console.log があった（groups の map まで毎回走っていた）。
  // ログ量・処理量ともに無駄なので削除。必要になったら開発時だけ一時的に足すこと。

  // ── 全幅ヘッダー化レイアウト用の埋め込みパネル（デスクトップのみ） ──────────────
  // デスクトップでは MainLayout の左サイドバー / RightPanelHost の右パネルを抑止し、
  // 代わりにここ（ツールバー下の 3 ゾーン行）へ埋め込む。これによりツールバーが全幅ヘッダーになる。
  const isMobile = useMediaQuery('(max-width:768px)');
  const embeddedLeftSidebar = !isMobile ? <ModelsSidebar /> : null;
  const embeddedRightPanel = !isMobile ? (
    <Box
      sx={{
        width: 320, flexShrink: 0, height: '100%',
        borderLeft: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
        bgcolor: 'light-dark(rgba(255, 255, 255, 0.85), rgba(10, 15, 25, 0.6))',
        display: 'flex', flexDirection: 'column', overflowY: 'auto', overflowX: 'hidden',
      }}
    >
      {/* 詳細画面表示中はメインビューアが同じモデルを表示するため、右パネルの3Dはサムネイルに切り替える */}
      <Box sx={{ p: 2 }}><DssRightPanel hideViewer={!!detailModel} /></Box>
    </Box>
  ) : null;

  // ツールバー1行化: フィルタ/パンくずが実際にある時だけ 2 行目（フィルタ表示行）を出す。
  const hasActiveFilters = !!(
    (searchFilters.type && searchFilters.type !== 'ALL') ||
    (searchFilters.category && searchFilters.category !== 'ALL') ||
    (searchFilters.subCategory && searchFilters.subCategory !== 'ALL') ||
    (searchFilters.format && searchFilters.format !== 'ALL') ||
    searchFilters.tags || searchFilters.wantsReady || searchFilters.wantsCustom
  );

  return (
    <Box sx={styles.root}>
      {/* S.Modelに保存ボタン押下後、GLBファイル取得〜ダイアログ開くまでのローディングオーバーレイ */}
      {uploadPreparing && (
        <Box sx={{
          position: 'absolute', inset: 0, zIndex: 1200,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 2, bgcolor: 'rgba(10,12,18,0.72)', backdropFilter: 'blur(4px)',
        }}>
          <CircularProgress size={40} thickness={3} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }} />
          <Typography variant="body2" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>
            モデルを読み込んでいます…
          </Typography>
        </Box>
      )}
      {detailModel ? (() => {
        const idx = filteredItems.findIndex((m: any) => m.id === detailModel.id);
        const prevM = idx > 0 ? filteredItems[idx - 1] : null;
        const nextM = idx >= 0 && idx < filteredItems.length - 1 ? filteredItems[idx + 1] : null;
        const navigateDetail = (dir: 1 | -1) => {
          const target = dir === -1 ? prevM : nextM;
          if (!target) return;
          setDetailNavDir(dir);
          setDetailModel(target);
          if (payload?.workspaceId) setPanelSelection(payload.workspaceId, target);
        };
        return (
          <>
          {/* 全幅ヘッダー（一覧画面と同じく右サイドバーの上まで届く） */}
          <Box sx={styles.stickyHeaderWrap} data-no-dismiss="true">
            <Box component="header" sx={styles.topBar}>
              <DssDetailHeader
                onBack={() => setDetailModel(null)}
                searchQuery={searchFilters.query}
                onSearchChange={(v) => setSearchFilters({ query: v })}
                onSearchSubmit={() => setDetailModel(null)}
                canImageSearch={canImageSearch}
                imgSearchBusy={imgSearchBusy}
                onCameraClick={(el) => { setImgSearchError(null); setImgSearchAnchor(el); }}
                prevModel={prevM}
                nextModel={nextM}
                onNavigate={navigateDetail}
              />
              {/* 一覧ヘッダーと同じアクション（3Dモデル生成・Upload） */}
              <Tooltip title="3Dモデルの生成・編集エディターを開く（画像→3D）" placement="bottom">
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<ViewInArRoundedIcon />}
                  sx={{ ...styles.actionBtn, flexShrink: 0, bgcolor: '#7c3aed', color: 'var(--brand-fg)', '&:hover': { bgcolor: '#6d28d9' } }}
                  onClick={openModelGenerator}
                >
                  3Dモデル生成/編集
                </Button>
              </Tooltip>
              <Button
                size="small"
                variant="contained"
                startIcon={<CloudUploadIcon />}
                sx={{ ...styles.actionBtn, flexShrink: 0, bgcolor: '#29b6f6', color: 'var(--brand-fg)', '&:hover': { bgcolor: '#0288d1' } }}
                onClick={() => setUploadDialogOpen(true)}
              >
                Upload
              </Button>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <Box sx={{ position: 'relative', flex: 1, minWidth: 0, height: '100%', overflow: 'hidden' }}>
            <AnimatePresence mode="wait" custom={detailNavDir} initial={false}>
              <motion.div
                key={detailModel.id}
                custom={detailNavDir}
                variants={DETAIL_SLIDE_VARIANTS}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                style={{ position: 'absolute', inset: 0 }}
              >
                <DssModelDetailView
                  model={detailModel}
                  allItems={filteredItems}
                  prevModel={prevM}
                  nextModel={nextM}
                  onNavigate={navigateDetail}
                  onBack={() => setDetailModel(null)}
                  onSelectRelated={(m) => {
                    setDetailNavDir(1);
                    setDetailModel(m);
                    if (payload?.workspaceId) {
                      setPanelSelection(payload.workspaceId, m);
                    }
                  }}
                  usageMap={usageMap}
                  searchQuery={searchFilters.query}
                  onSearchChange={(v) => setSearchFilters({ query: v })}
                  onSearchSubmit={() => setDetailModel(null)}
                  canImageSearch={canImageSearch}
                  imgSearchBusy={imgSearchBusy}
                  onCameraClick={(el) => { setImgSearchError(null); setImgSearchAnchor(el); }}
                  detailActions={{
                    canRegister: isAuthorOf(detailModel) && !detailModel.isProjectItem,
                    canRhino: canPlaceInDcc(detailModel, 'rhino'),
                    canBlender: canPlaceInDcc(detailModel, 'blender'),
                    dccBusy,
                    onRegisterLinks: () => handleBulkRegister([detailModel]),
                    onCatalog: () => handleBulkCatalog([detailModel]),
                    onAutoFill: () => handleBulkAutoFill([detailModel]),
                    onRhino: () => handlePlaceInDcc('rhino', [detailModel]),
                    onBlender: () => handlePlaceInDcc('blender', [detailModel]),
                  }}
                />
              </motion.div>
            </AnimatePresence>
            </Box>
            {/* 詳細画面では Model Info は詳細ペインの「概要」タブに統合済みのため、
                右カラムは出さない（Item Details を1枚に保ち、ビューアを広く使う）。 */}
          </Box>
          </>
        );
      })() : (
        <>
          {/* Sticky Header */}
          <Box sx={styles.stickyHeaderWrap} data-no-dismiss="true">
            <Box component="header" sx={styles.topBar}>
              <Box sx={styles.titleBlock}>
                <Box sx={styles.breadcrumb}>
                  {modelsScope === 'view_public_project_models'
                    ? 'Public Projects'
                    : ['global_models', 'global_following_models', 'global_projects', 'my_public_models', 'my_private_models'].includes(modelsScope)
                      ? 'Global Asset Hub'
                      : `Project Models / ${payload?.workspaceName || 'Overview'}`}
                </Box>

                {modelsScope === 'view_public_project_models' ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        useAppStore.getState().setModelsScope('global_projects');
                        useAppStore.getState().setViewingPublicProjectId(null);
                        useAppStore.getState().setViewingPublicProjectName(null);
                      }}
                      sx={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 32, height: 32, borderRadius: '8px',
                        cursor: 'pointer',
                        color: 'rgb(var(--brand-fg-rgb) / 0.7)',
                        border: '1px solid rgb(var(--brand-fg-rgb) / 0.15)',
                        transition: 'all 0.15s',
                        '&:hover': { color: 'var(--brand-fg)', background: 'rgb(var(--brand-fg-rgb) / 0.1)', borderColor: 'rgb(var(--brand-fg-rgb) / 0.3)' },
                      }}
                    >
                      <ArrowBackRoundedIcon sx={{ fontSize: 18 }} />
                    </Box>
                    <Typography sx={{ fontSize: 22, fontWeight: 700, color: 'var(--brand-fg)', lineHeight: 1 }}>
                      {viewingPublicProjectName || 'Public Project'}
                    </Typography>
                  </Box>
                ) : ['global_models', 'global_following_models', 'global_projects', 'global_following_projects'].includes(modelsScope) ? (
                  <Box sx={{ display: 'flex', gap: 3, alignItems: 'baseline' }}>
                    <Typography
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        useAppStore.getState().setModelsScope(['global_projects', 'global_following_projects'].includes(modelsScope) ? 'global_projects' : 'global_models');
                      }}
                      sx={{
                        fontSize: 24, fontWeight: 700, cursor: 'pointer',
                        color: ['global_models', 'global_projects'].includes(modelsScope) ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.4)',
                        transition: 'color 0.2s',
                        '&:hover': { color: 'var(--brand-fg)' }
                      }}
                    >
                      Explore
                    </Typography>
                    <Typography
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        useAppStore.getState().setModelsScope(['global_projects', 'global_following_projects'].includes(modelsScope) ? 'global_following_projects' : 'global_following_models');
                      }}
                      sx={{
                        fontSize: 24, fontWeight: 700, cursor: 'pointer',
                        color: ['global_following_models', 'global_following_projects'].includes(modelsScope) ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.4)',
                        transition: 'color 0.2s',
                        '&:hover': { color: 'var(--brand-fg)' }
                      }}
                    >
                      Following
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={styles.pageTitle}>
                    {['project_models', 'team_project_models'].includes(modelsScope) && activeProjectName
                      ? activeProjectName
                      : scopeTitle}
                  </Box>
                )}
              </Box>

              <Box sx={{ flex: 1, minWidth: 12 }} />

              <Box sx={styles.searchWrap}>
                <SearchRoundedIcon sx={styles.searchIcon} />
                <input
                  type="text"
                  placeholder="Search models..."
                  style={styles.searchInput as React.CSSProperties}
                  value={searchFilters.query}
                  onChange={handleChangeSearch}
                  onPointerDown={(e) => e.stopPropagation()}
                />
              </Box>

              {/* 選択中の3Dモデルを画像検索して実在する商品を探す */}
              <Tooltip
                title={canImageSearch ? 'この3Dモデルを画像検索（実在する商品を探す）' : 'まず3Dモデルを選択してください'}
                arrow
              >
                <span>
                  <IconButton
                    size="small"
                    disabled={!canImageSearch || imgSearchBusy}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { setImgSearchError(null); setImgSearchAnchor(e.currentTarget); }}
                    sx={{
                      ml: 1,
                      width: 38,
                      height: 38,
                      borderRadius: 999,
                      border: '1px solid rgb(var(--slate-ink-rgb) / 0.30)',
                      background: 'rgb(var(--slate-panel-rgb) / 0.62)',
                      color: canImageSearch ? 'light-dark(#0352aa, #93c5fd)' : 'rgb(var(--slate-ink-rgb) / 0.5)',
                      '&:hover': { background: 'rgba(96,165,250,0.18)', borderColor: 'rgba(96,165,250,0.6)' },
                    }}
                  >
                    {imgSearchBusy
                      ? <CircularProgress size={18} sx={{ color: 'light-dark(#0352aa, #93c5fd)' }} />
                      : <PhotoCameraRoundedIcon sx={{ fontSize: 20 }} />}
                  </IconButton>
                </span>
              </Tooltip>

              {/* 画像検索メニュー＋Lens/カタログ ダイアログは常時描画領域へ移動（グリッド/詳細の両方で使用） */}

              {/* 選択時の一括操作バーは、backdrop-filter を持つ sticky ヘッダー内だと
                  それが position:fixed の containing block になり画面上部に貼り付いてしまう。
                  そのため描画はルート直下（下部フロート）に移動した。 */}

              <Snackbar open={!!dccToast} autoHideDuration={4000} onClose={() => setDccToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                {dccToast ? <Alert severity={dccToast.sev} onClose={() => setDccToast(null)} sx={{ fontSize: 13 }}>{dccToast.msg}</Alert> : undefined}
              </Snackbar>

              {/* 一括登録の進捗ダイアログ */}
              <Dialog
                open={bulkOpen}
                onClose={() => { if (!bulkProgress || bulkDone || bulkProgress.phase === 'error') setBulkOpen(false); }}
                maxWidth="xs" fullWidth
                slotProps={{ paper: { sx: { bgcolor: 'var(--brand-surface)', color: 'var(--brand-fg)', border: '1px solid rgb(var(--slate-ink-rgb) / 0.22)', borderRadius: 2 } } }}
              >
                <Box sx={{ p: 2.5 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 1.5 }}>{bulkMode === 'catalog' ? 'カタログを一括自動登録' : '関連URLを一括自動登録'}</Typography>
                  {!bulkDone && bulkProgress && bulkProgress.phase !== 'error' && (
                    <>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                        <CircularProgress size={18} sx={{ color: 'light-dark(#0352aa, #93c5fd)' }} />
                        <Typography sx={{ fontSize: 13 }}>
                          {bulkProgress.index + 1} / {bulkProgress.total} 件目
                          {bulkProgress.phase === 'search' ? '：検索中…' : bulkProgress.phase === 'register' ? '：登録中…' : ''}
                        </Typography>
                      </Box>
                      <Typography noWrap sx={{ fontSize: 12, color: 'rgb(var(--slate-ink-rgb) / 0.9)' }}>{bulkProgress.title}</Typography>
                    </>
                  )}
                  {!bulkDone && bulkProgress && bulkProgress.phase === 'error' && (
                    <Typography sx={{ fontSize: 13, color: 'light-dark(#a80606, #fca5a5)', whiteSpace: 'pre-wrap' }}>{bulkProgress.message}</Typography>
                  )}
                  {!bulkDone && !bulkProgress && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <CircularProgress size={18} sx={{ color: 'light-dark(#0352aa, #93c5fd)' }} />
                      <Typography sx={{ fontSize: 13 }}>準備中…</Typography>
                    </Box>
                  )}
                  {bulkDone && (
                    <Box>
                      <Typography sx={{ fontSize: 13, color: 'light-dark(#149944, #86efac)', mb: 1 }}>
                        完了：{bulkDone.models} 件のモデルに合計 {bulkDone.links} 件の{bulkMode === 'catalog' ? 'カタログ' : '関連URL'}を登録しました。
                      </Typography>
                      <Box sx={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {bulkDone.rows.map((r, i) => (
                          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 12 }}>
                            <Box component="span" sx={{ color: r.added > 0 ? 'light-dark(#149944, #86efac)' : 'light-dark(#a80606, #fca5a5)', fontWeight: 700, minWidth: 44 }}>
                              {r.added > 0 ? `+${r.added}` : '0件'}
                            </Box>
                            <Box component="span" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'light-dark(rgba(31,41,55,0.9), rgba(229,231,235,0.9))' }}>
                              {r.title}
                            </Box>
                            {r.error && <Box component="span" sx={{ color: 'light-dark(rgba(170,78,3,0.9), rgba(251,146,60,0.9))', fontSize: 11 }}>{r.error}</Box>}
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  )}
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, mt: 2.5 }}>
                    {!bulkDone && bulkProgress?.phase !== 'error' && (
                      <Button onClick={cancelBulk} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', textTransform: 'none', fontSize: 13 }}>中止</Button>
                    )}
                    {(bulkDone || bulkProgress?.phase === 'error') && (
                      <Button onClick={() => setBulkOpen(false)} variant="contained" sx={{ textTransform: 'none', fontSize: 13, bgcolor: '#2563eb', '&:hover': { bgcolor: '#1d4ed8' } }}>閉じる</Button>
                    )}
                  </Box>
                </Box>
              </Dialog>

              {/* AI寸法・カテゴリ一括自動入力の進捗ダイアログ */}
              <Dialog
                open={aiBulkOpen}
                onClose={() => { if (aiBulkDone || aiBulkProgress?.phase === 'error') setAiBulkOpen(false); }}
                maxWidth="xs" fullWidth
                slotProps={{ paper: { sx: { bgcolor: 'var(--brand-surface)', color: 'var(--brand-fg)', border: '1px solid rgb(var(--slate-ink-rgb) / 0.22)', borderRadius: 2 } } }}
              >
                <Box sx={{ p: 2.5 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 1.5 }}>AIで寸法・カテゴリを一括自動入力</Typography>
                  {!aiBulkDone && aiBulkProgress && aiBulkProgress.phase !== 'error' && (
                    <>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                        <CircularProgress size={18} sx={{ color: 'light-dark(#2705a9, #c4b5fd)' }} />
                        <Typography sx={{ fontSize: 13 }}>{aiBulkProgress.index + 1} / {aiBulkProgress.total} 件目：解析中…</Typography>
                      </Box>
                      <Typography noWrap sx={{ fontSize: 12, color: 'rgb(var(--slate-ink-rgb) / 0.9)' }}>{aiBulkProgress.title}</Typography>
                    </>
                  )}
                  {!aiBulkDone && aiBulkProgress?.phase === 'error' && (
                    <Typography sx={{ fontSize: 13, color: 'light-dark(#a80606, #fca5a5)', whiteSpace: 'pre-wrap' }}>{aiBulkProgress.message}</Typography>
                  )}
                  {!aiBulkDone && !aiBulkProgress && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <CircularProgress size={18} sx={{ color: 'light-dark(#2705a9, #c4b5fd)' }} />
                      <Typography sx={{ fontSize: 13 }}>準備中…</Typography>
                    </Box>
                  )}
                  {aiBulkDone && (
                    <Box>
                      <Typography sx={{ fontSize: 13, color: 'light-dark(#149944, #86efac)', mb: 1 }}>
                        完了：{aiBulkDone.models} 件のモデルに寸法・カテゴリ等を自動入力しました。
                      </Typography>
                      <Box sx={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {aiBulkDone.rows.map((r, i) => (
                          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 12 }}>
                            <Box component="span" sx={{ color: r.fields > 0 ? 'light-dark(#149944, #86efac)' : 'light-dark(#a80606, #fca5a5)', fontWeight: 700, minWidth: 56 }}>
                              {r.fields > 0 ? `${r.fields}項目` : '0項目'}
                            </Box>
                            <Box component="span" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'light-dark(rgba(31,41,55,0.9), rgba(229,231,235,0.9))' }}>
                              {r.title}
                            </Box>
                            {r.error && <Box component="span" sx={{ color: 'light-dark(rgba(170,78,3,0.9), rgba(251,146,60,0.9))', fontSize: 11 }}>{r.error}</Box>}
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  )}
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, mt: 2.5 }}>
                    {!aiBulkDone && aiBulkProgress?.phase !== 'error' && (
                      <Button onClick={cancelAiBulk} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', textTransform: 'none', fontSize: 13 }}>中止</Button>
                    )}
                    {(aiBulkDone || aiBulkProgress?.phase === 'error') && (
                      <Button onClick={() => setAiBulkOpen(false)} variant="contained" sx={{ textTransform: 'none', fontSize: 13, bgcolor: '#7c3aed', '&:hover': { bgcolor: '#6d28d9' } }}>閉じる</Button>
                    )}
                  </Box>
                </Box>
              </Dialog>

              <Box sx={{ flex: 1, minWidth: 12 }} />

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {isProjectModelsScope && (
                  <Box sx={styles.viewBlock}>
                    <Box sx={styles.miniLabel}>View Mode</Box>
                    <ButtonGroup size="small" variant="outlined" sx={styles.densityGroup}>
                      <Button
                        onClick={() => setViewMode('assets')}
                        sx={viewMode === 'assets' ? styles.densityBtnActive : styles.densityBtn}
                      >
                        Assets
                      </Button>
                      <Button
                        onClick={() => setViewMode('layout')}
                        sx={viewMode === 'layout' ? styles.densityBtnActive : styles.densityBtn}
                      >
                        Layout
                      </Button>
                    </ButtonGroup>
                  </Box>
                )}

                {!isGlobalProjectsScope && (
                  <Box sx={styles.viewBlock}>
                    <Box sx={styles.miniLabel}>Graph</Box>
                    <ButtonGroup size="small" variant="outlined" sx={styles.densityGroup}>
                      <Button
                        onClick={() => setViewMode('assets')}
                        sx={viewMode !== 'graph' ? styles.densityBtnActive : styles.densityBtn}
                      >
                        Grid
                      </Button>
                      <Button
                        onClick={() => setViewMode('graph')}
                        sx={viewMode === 'graph' ? styles.densityBtnActive : styles.densityBtn}
                      >
                        Graph
                      </Button>
                    </ButtonGroup>
                  </Box>
                )}

                <Box sx={styles.viewBlock}>
                  <Box sx={styles.miniLabel}>Density</Box>
                  <ButtonGroup size="small" variant="outlined" sx={styles.densityGroup}>
                  <Button
                    onClick={() => applyDensity('compact')}
                    sx={densityKey === 'compact' ? styles.densityBtnActive : styles.densityBtn}
                  >
                    Compact
                  </Button>
                  <Button
                    onClick={() => applyDensity('default')}
                    sx={densityKey === 'default' ? styles.densityBtnActive : styles.densityBtn}
                  >
                    Default
                  </Button>
                    <Button
                      onClick={() => applyDensity('large')}
                      sx={densityKey === 'large' ? styles.densityBtnActive : styles.densityBtn}
                    >
                      Large
                    </Button>
                  </ButtonGroup>
                </Box>
              </Box>
              {/* アクション群（詳細表示・3Dモデル生成・Upload・Sort）を 1 行目に統合 */}
              <Box sx={styles.actionsRight}>
                <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', mr: 1, fontWeight: 500 }}>
                    詳細表示
                  </Typography>
                  <Switch
                    size="small"
                    checked={showDetails}
                    onChange={(e) => setShowDetails(e.target.checked)}
                    color="primary"
                  />
                </Box>
                <Tooltip title="3Dモデルの生成・編集エディターを開く（画像→3D）" placement="bottom">
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<ViewInArRoundedIcon />}
                    sx={{ ...styles.actionBtn, bgcolor: '#7c3aed', color: 'var(--brand-fg)', '&:hover': { bgcolor: '#6d28d9' } }}
                    onClick={openModelGenerator}
                  >
                    3Dモデル生成/編集
                  </Button>
                </Tooltip>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<CloudUploadIcon />}
                  sx={{ ...styles.actionBtn, bgcolor: '#29b6f6', color: 'var(--brand-fg)', '&:hover': { bgcolor: '#0288d1' } }}
                  onClick={() => setUploadDialogOpen(true)}
                >
                  Upload
                </Button>
                <Button
                  size="small"
                  startIcon={<SortRoundedIcon />}
                  sx={styles.actionBtn}
                  onClick={(e) => { if (isGlobalProjectsScope) setSortMenuAnchor(e.currentTarget); }}
                >
                  {isGlobalProjectsScope ? (projectsSort === 'popular' ? '人気順' : '新着順') : 'Sort'}
                </Button>
                <Menu
                  anchorEl={sortMenuAnchor}
                  open={!!sortMenuAnchor}
                  onClose={() => setSortMenuAnchor(null)}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                  <MenuItem onClick={() => { setProjectsSort('newest'); setSortMenuAnchor(null); }}>
                    <ListItemIcon><FiberNewRoundedIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>新着順</ListItemText>
                    {projectsSort === 'newest' && <CheckRoundedIcon fontSize="small" sx={{ ml: 1, color: 'primary.main' }} />}
                  </MenuItem>
                  <MenuItem onClick={() => { setProjectsSort('popular'); setSortMenuAnchor(null); }}>
                    <ListItemIcon><WhatshotRoundedIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>人気順</ListItemText>
                    {projectsSort === 'popular' && <CheckRoundedIcon fontSize="small" sx={{ ml: 1, color: 'primary.main' }} />}
                  </MenuItem>
                </Menu>
              </Box>
            </Box>
          </Box>

          {/* 全幅ヘッダー下の 3 ゾーン行: 左モデル一覧サイドバー | グリッド | 右 Search & Filter */}
          <Box sx={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
            {embeddedLeftSidebar}
            {/* Main Content Area */}
            <Box
              component="main"
              sx={styles.content}
              onPointerDownCapture={handleBackgroundPointerDownCapture}
            >
            {/* フィルタ/パンくず表示。ヘッダー高さを固定するため、ヘッダー2行目ではなく
                グリッド列（結果エリア）の上部に配置する。左右サイドバーとヘッダーの高さは不変で、
                表示ON/OFF時は結果エリア内だけが上下する。 */}
            {(breadcrumb || hasActiveFilters) && (
            <Box component="section" data-no-dismiss="true" sx={{ ...styles.filterRow, minHeight: 40, py: 1, flexShrink: 0 }}>
              {breadcrumb ? (
              <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
                {breadcrumb.segs.map((seg, i) => (
                  <React.Fragment key={`${seg.label}-${i}`}>
                    {i > 0 && (
                      <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.3)', fontSize: 13, mx: 0.25, userSelect: 'none' }}>›</Typography>
                    )}
                    <Box
                      onClick={seg.onClick}
                      title={seg.path}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.4, borderRadius: 1.5, cursor: 'pointer',
                        bgcolor: seg.active ? 'rgba(22,163,74,0.2)' : 'rgb(var(--brand-fg-rgb) / 0.04)',
                        color: seg.active ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.7)',
                        fontSize: 12.5, fontWeight: seg.active ? 600 : 500,
                        transition: 'background-color 0.15s',
                        '&:hover': { bgcolor: seg.active ? 'rgba(22,163,74,0.25)' : 'rgb(var(--brand-fg-rgb) / 0.08)' },
                      }}
                    >
                      {i === 0 ? <FolderRoundedIcon sx={{ fontSize: 14 }} /> : <FolderOpenRoundedIcon sx={{ fontSize: 14 }} />}
                      <Typography sx={{ fontSize: 12.5, fontWeight: 'inherit', color: 'inherit' }}>{seg.label}</Typography>
                    </Box>
                  </React.Fragment>
                ))}
                {breadcrumb.absPath && (
                  <Typography noWrap title={breadcrumb.absPath} sx={{ ml: 1, color: 'rgb(var(--brand-fg-rgb) / 0.3)', fontSize: 10.5, maxWidth: 280, direction: 'rtl', textAlign: 'left' }}>
                    {breadcrumb.absPath}
                  </Typography>
                )}
                {/* クラウド状態の絞り込みチップ */}
                <Box sx={{ width: '1px', height: 18, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.12)', mx: 0.75 }} />
                {CLOUD_FILTER_TABS.map(tab => {
                  const active = cloudFilter === tab.key;
                  return (
                    <Box
                      key={tab.key}
                      onClick={() => setCloudFilter(tab.key)}
                      sx={{
                        px: 1, py: 0.35, borderRadius: 1.5, cursor: 'pointer', fontSize: 11.5, fontWeight: active ? 700 : 500,
                        color: active ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.6)',
                        bgcolor: active ? tab.color : 'rgb(var(--brand-fg-rgb) / 0.05)',
                        border: `1px solid ${active ? tab.color : 'transparent'}`,
                        transition: 'all 0.15s',
                        '&:hover': { bgcolor: active ? tab.color : 'rgb(var(--brand-fg-rgb) / 0.1)' },
                      }}
                    >
                      {tab.label}
                    </Box>
                  );
                })}
              </Box>
              ) : (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                <AnimatePresence mode="popLayout">
                  {(!searchFilters.type || searchFilters.type === 'ALL') && !searchFilters.category && !searchFilters.subCategory && !searchFilters.format && !searchFilters.tags && !searchFilters.wantsReady && !searchFilters.wantsCustom && (
                    <motion.div key="none-applied" layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.2 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>No filters applied</Typography>
                    </motion.div>
                  )}
                  
                  {searchFilters.type && searchFilters.type !== 'ALL' && (
                    <motion.div key="filter-type" layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.2 }}>
                      <Chip size="small" label={`Primary: ${searchFilters.type}`} onDelete={() => setSearchFilters({type: 'ALL', category: 'ALL', subCategory: 'ALL'})} sx={{ bgcolor: 'rgba(165, 214, 167, 0.1)', color: 'rgb(var(--brand-fg-rgb) / 0.65)', border: '1px solid rgba(165, 214, 167, 0.3)' }} />
                    </motion.div>
                  )}
                  {searchFilters.wantsReady && (
                    <motion.div key="filter-wantsReady" layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.2 }}>
                      <Chip size="small" label="既製品家具" onDelete={() => setSearchFilters({wantsReady: false})} sx={{ bgcolor: 'rgba(165, 214, 167, 0.1)', color: 'rgb(var(--brand-fg-rgb) / 0.65)', border: '1px solid rgba(165, 214, 167, 0.3)' }} />
                    </motion.div>
                  )}
                  {searchFilters.wantsCustom && (
                    <motion.div key="filter-wantsCustom" layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.2 }}>
                      <Chip size="small" label="造作家具" onDelete={() => setSearchFilters({wantsCustom: false})} sx={{ bgcolor: 'rgba(165, 214, 167, 0.1)', color: 'rgb(var(--brand-fg-rgb) / 0.65)', border: '1px solid rgba(165, 214, 167, 0.3)' }} />
                    </motion.div>
                  )}
                  {searchFilters.category && searchFilters.category !== 'ALL' && (
                    <motion.div key="filter-category" layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.2 }}>
                      <Chip size="small" label={`Category: ${searchFilters.category}`} onDelete={() => setSearchFilters({category: 'ALL', subCategory: 'ALL'})} sx={{ bgcolor: 'rgba(165, 214, 167, 0.1)', color: 'rgb(var(--brand-fg-rgb) / 0.65)', border: '1px solid rgba(165, 214, 167, 0.3)' }} />
                    </motion.div>
                  )}
                  {searchFilters.subCategory && searchFilters.subCategory !== 'ALL' && (
                    <motion.div key="filter-subcategory" layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.2 }}>
                      <Chip size="small" label={`Sub: ${searchFilters.subCategory}`} onDelete={() => setSearchFilters({subCategory: 'ALL'})} sx={{ bgcolor: 'rgba(165, 214, 167, 0.1)', color: 'rgb(var(--brand-fg-rgb) / 0.65)', border: '1px solid rgba(165, 214, 167, 0.3)' }} />
                    </motion.div>
                  )}
                  {searchFilters.format && searchFilters.format !== 'ALL' && (
                    <motion.div key="filter-format" layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.2 }}>
                      <Chip size="small" label={`Format: ${searchFilters.format}`} onDelete={() => setSearchFilters({format: 'ALL'})} sx={{ bgcolor: 'rgba(165, 214, 167, 0.1)', color: 'rgb(var(--brand-fg-rgb) / 0.65)', border: '1px solid rgba(165, 214, 167, 0.3)' }} />
                    </motion.div>
                  )}
                  {searchFilters.tags && typeof searchFilters.tags === 'string' && searchFilters.tags.split(/[\s,]+/).filter(Boolean).map((t: string) => (
                    <motion.div key={`filter-tag-${t}`} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.2 }}>
                      <Chip size="small" label={t} onDelete={() => {
                        const newTags = searchFilters.tags.split(/[\s,]+/).filter((tt: string) => tt !== t).join(' ');
                        setSearchFilters({tags: newTags});
                      }} sx={{ bgcolor: 'rgba(165, 214, 167, 0.1)', color: 'rgb(var(--brand-fg-rgb) / 0.65)', border: '1px solid rgba(165, 214, 167, 0.3)' }} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </Box>
              )}
            </Box>
            )}
            <Box sx={styles.pageBodyInner} data-center-page="true">
              {['global_projects', 'global_following_projects'].includes(modelsScope) ? (
                <DssProjectsGrid
                  items={projectItemsForGrid}
                  cardSize={cardSize}
                  selectedItemId={selectedItem?.id}
                  onSelectProject={handleSelectModel}
                  onDoubleClickProject={handleDoubleClickProject}
                  onOwnerClick={(project: any) => setAuthorProfileModel({
                    ownerId: project.ownerId,
                    ownerName: project.ownerDisplayName || project.ownerName || 'Creator',
                  })}
                  isInitializing={isInitializing}
                  badgeColor={payload?.themeColor}
                />
              ) : viewMode === 'graph' && !pickerIsOpen ? (
                <DssFurnitureGraph
                  items={dedupedItemsForGrid}
                  centerId={selectedItem?.id ?? null}
                  selectedId={selectedItem?.id ?? null}
                  onSelectModel={(raw) => handleSelectModel(raw)}
                  height="100%"
                />
              ) : viewMode === 'layout' && isProjectModelsScope ? (
                <DssGroupedModelsGrid
                  groups={groupedLayoutAssets}
                  cardSize={cardSize}
                  selectedItemId={selectedItem?.id}
                  onSelectModel={handleSelectModel}
                  onModelDragStart={handleCardDragStart}
                  badgeColor={payload?.themeColor}
                  showDetails={showDetails}
                  cardContext={cardContext}
                  onSave={(model) => setSaveToProjectModel(model)}
                  onShare={(model) => setShareModel(model)}
                  onDelete={(model) => setDeleteModel(model)}
                  onAuthorClick={(model) => setAuthorProfileModel(model)}
                  onDoubleClick={handleDoubleClickModel}
                />
              ) : (
                <DssModelsGrid
                  items={pickerIsOpen && pickerCandidateIds.length > 0
                    ? dedupedItemsForGrid.filter(m => pickerCandidateIds.includes(m.id) || pickerCandidateIds.includes(m.entityId))
                    : dedupedItemsForGrid}
                  cardSize={cardSize}
                  selectedItemId={pickerIsOpen ? undefined : selectedItem?.id}
                  multiSelectedIds={!pickerIsOpen && selectedIds.length > 1 ? selectedIds : undefined}
                  onSelectModel={handleSelectModel}
                  onModelDragStart={pickerIsOpen ? undefined : handleCardDragStart}
                  isInitializing={isInitializing}
                  showDetails={showDetails}
                  cardContext={cardContext}
                  onSave={pickerIsOpen ? undefined : (model) => setSaveToProjectModel(model)}
                  onShare={pickerIsOpen ? undefined : (model) => setShareModel(model)}
                  onDelete={pickerIsOpen ? undefined : (model) => setDeleteModel(model)}
                  onAuthorClick={pickerIsOpen ? undefined : (model) => setAuthorProfileModel(model)}
                  onDoubleClick={pickerIsOpen ? undefined : handleDoubleClickModel}
                  usageMap={aggregatedUsageMap}
                  pickerSelectedIds={pickerIsOpen ? pickerSelectedIds : undefined}
                  onPickerToggle={pickerIsOpen ? pickerToggle : undefined}
                />
              )}
            </Box>
            </Box>
            {embeddedRightPanel}
          </Box>
        </>
      )}

      {/* 家具ピッカーモード 浮動確定バー */}
      {pickerIsOpen && (
        <Box sx={{
          position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          zIndex: 200, display: 'flex', alignItems: 'center', gap: 1.5,
          bgcolor: 'var(--brand-surface2)', border: '1px solid rgba(255,215,64,0.5)',
          borderRadius: 3, px: 2.5, py: 1.25, boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}>
          <Box sx={{ fontSize: '0.75rem', color: 'rgb(var(--brand-fg-rgb) / 0.85)', mr: 1 }}>
            <Box component="span" sx={{ color: 'light-dark(#ad8900, #ffd740)', fontWeight: 700 }}>{pickerSelectedIds.length}</Box>
            {' 件選択中 — SEKKEIYA OS から家具を選んでいます'}
          </Box>
          <Button
            size="small" variant="outlined"
            onClick={pickerCancel}
            sx={{ fontSize: '0.7rem', textTransform: 'none', color: 'rgb(var(--brand-fg-rgb) / 0.6)', borderColor: 'rgb(var(--brand-fg-rgb) / 0.25)', '&:hover': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.5)' } }}
          >
            キャンセル
          </Button>
          <Button
            size="small" variant="contained"
            disabled={pickerSelectedIds.length === 0}
            onClick={pickerConfirm}
            sx={{ fontSize: '0.7rem', textTransform: 'none', bgcolor: '#ffd740', color: '#1a1f2b', fontWeight: 700, '&:hover': { bgcolor: '#ffe082' }, '&.Mui-disabled': { bgcolor: 'rgba(255,215,64,0.25)', color: 'rgb(var(--brand-fg-rgb) / 0.3)' } }}
          >
            {pickerSelectedIds.length}件をプロジェクトに追加
          </Button>
        </Box>
      )}

      {/* Rhino Drop Zone Overlay */}
      <RhinoDropZone
        open={isDraggingToRhino}
        docs={openRhinoDocs}
        errorMessage={errorMessage}
        onSelectDoc={(docId) => handleDropToRhino({ docId })}
        onClose={handleCancelDrop}
      />

      {/* Upload Dialog */}
      <Modal
        open={uploadDialogOpen}
        onClose={(_any, reason) => {
          if (reason !== 'backdropClick') {
             setUploadDialogOpen(false);
             useDssUploadBridge.getState().reset();
             closeUploadAndReturn();
          }
        }}
      >
        <UploadModalContent
          open={uploadDialogOpen}
          onClose={() => { setUploadDialogOpen(false); useDssUploadBridge.getState().reset(); closeUploadAndReturn(); }}
          initialFiles={uploadInitialFiles}
        />
      </Modal>

      {/* Save to Project Dialog */}
      <SaveToProjectDialog
        model={saveToProjectModel}
        open={!!saveToProjectModel}
        onClose={() => setSaveToProjectModel(null)}
      />

      {/* User Profile Dialog */}
      <UserProfileDialog
        authorId={authorProfileModel?.ownerId || authorProfileModel?.authorId || authorProfileModel?.id}
        authorName={authorProfileModel?.ownerName || authorProfileModel?.authorName || authorProfileModel?.author || 'Creator'}
        open={!!authorProfileModel}
        onClose={() => setAuthorProfileModel(null)}
      />

      {/* Share Dialog */}
      <DssShareDialog
        model={shareModel}
        open={!!shareModel}
        onClose={() => setShareModel(null)}
      />

      {/* Delete Confirm Dialog */}
      <DssDeleteConfirmDialog
        model={deleteModel}
        open={!!deleteModel}
        onClose={() => setDeleteModel(null)}
        onConfirm={handleDeleteConfirm}
        isBoardModels={modelsScope === 'project_models' || modelsScope === 'team_project_models'}
      />

      {/* 一括削除の確認ダイアログ */}
      <Dialog
        open={bulkDeleteOpen}
        onClose={() => { if (!bulkDeleteBusy) setBulkDeleteOpen(false); }}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', backgroundImage: 'none', border: '1px solid rgba(220,38,38,0.35)' } }}
      >
        <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', gap: 1, color: '#dc2626' }}>
          <DeleteOutlineRoundedIcon /> まとめて削除
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            選択中の {bulkDeletableCount} 件のモデルを{cardContext === 'boardModels' ? 'このボードから' : ''}削除しますか？
          </Typography>
          <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(220,38,38,0.1)', borderRadius: 1, border: '1px dashed rgba(220,38,38,0.3)' }}>
            <Typography variant="caption" sx={{ color: 'rgba(220,38,38,0.85)' }}>
              {cardContext === 'boardModels'
                ? '※モデル自体は削除されず、このボード（プロジェクト）との共有リンクが解除されます。'
                : '※この操作は取り消せません。選択したモデルがリストから削除されます。'}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDeleteOpen(false)} color="inherit" disabled={bulkDeleteBusy}>キャンセル</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleBulkDelete}
            disabled={bulkDeleteBusy || bulkDeletableCount === 0}
            startIcon={bulkDeleteBusy ? <CircularProgress size={14} sx={{ color: 'var(--brand-fg)' }} /> : undefined}
            sx={{ fontWeight: 600 }}
          >
            {bulkDeleteBusy ? '削除中…' : `${bulkDeletableCount} 件を削除`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 画像検索メニュー（カメラ）＋ Lens/カタログ ダイアログ：グリッド/詳細の両方で使えるよう常時描画 */}
      <Menu
        anchorEl={imgSearchAnchor}
        open={Boolean(imgSearchAnchor)}
        onClose={() => setImgSearchAnchor(null)}
        onClick={(e) => e.stopPropagation()}
        slotProps={{ paper: { sx: { bgcolor: 'var(--brand-surface)', color: 'var(--brand-fg)', border: '1px solid rgb(var(--slate-ink-rgb) / 0.22)', minWidth: 230 } } }}
      >
        <MenuItem disabled sx={{ opacity: 0.7, fontSize: 11, py: 0.5 }}>
          {selectedItem ? (selectedItem.title || selectedItem.name || '選択中のモデル') : '選択中のモデル'} を検索
        </MenuItem>
        {SEARCH_ENGINES.map((eng) => (
          <MenuItem
            key={eng.key}
            onClick={() => (eng.key === 'lens' ? handleLensSearch() : handleRunImageSearch(eng.key))}
            sx={{ fontSize: 13 }}
          >
            <ListItemIcon sx={{ color: 'light-dark(#0352aa, #93c5fd)', minWidth: 32 }}>
              <ImageSearchRoundedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primaryTypographyProps={{ fontSize: 13 }}
              secondary={eng.key === 'lens' ? '結果を一覧表示 → 関連URLに登録' : undefined}
              secondaryTypographyProps={{ fontSize: 10, color: 'rgb(var(--slate-ink-rgb) / 0.85)' }}
            >
              {eng.label}
            </ListItemText>
          </MenuItem>
        ))}
        <Divider sx={{ borderColor: 'rgb(var(--slate-ink-rgb) / 0.18)', my: 0.5 }} />
        <MenuItem disabled sx={{ opacity: 0.7, fontSize: 11, py: 0.5 }}>ローカル照合</MenuItem>
        <MenuItem onClick={handleSearchCatalog} sx={{ fontSize: 13 }}>
          <ListItemIcon sx={{ color: 'light-dark(#149944, #86efac)', minWidth: 32 }}>
            <MenuBookRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primaryTypographyProps={{ fontSize: 13 }}>S.Library カタログで探す</ListItemText>
        </MenuItem>
        {imgSearchError && (
          <MenuItem disabled sx={{ color: 'light-dark(#a80606, #fca5a5)', fontSize: 11, whiteSpace: 'normal', maxWidth: 260 }}>
            {imgSearchError}
          </MenuItem>
        )}
      </Menu>

      <CatalogMatchDialog
        open={catalogOpen}
        onClose={() => setCatalogOpen(false)}
        busy={catalogBusy}
        progressText={catalogProgress}
        error={catalogError}
        queryImage={catalogQueryImg}
        modelTitle={catalogModel?.title || catalogModel?.name || selectedItem?.title || selectedItem?.name || null}
        matches={catalogMatches}
        sources={catalogSources}
        canRegister={catalogCanRegister}
        registering={catalogRegistering}
        onRegister={handleRegisterCatalog}
      />

      <LensResultsDialog
        open={lensOpen}
        onClose={() => setLensOpen(false)}
        busy={lensBusy}
        error={lensError}
        queryImage={lensQueryImg}
        modelTitle={lensModel?.title || lensModel?.name || null}
        results={lensResults}
        diag={lensDiag}
        lensUrl={lensUrl}
        canRegister={lensCanRegister}
        registering={lensRegistering}
        onRegister={handleRegisterLensLinks}
      />

      {/* 選択時の一括操作バー（画面下中央フロート・1行レスポンシブ。1件でも表示）
          backdrop-filter を持つ sticky ヘッダーの containing block に捕まらないよう、
          ルート直下に置いて position:fixed をビューポート基準で効かせる。
          詳細ビュー中は同じアクションを右ペインに出すため、このフロートバーは隠す。 */}
      {selectedIds.length >= 1 && !detailModel && (() => {
        const rhinoCount = dccEligibleCount('rhino');
        const blenderCount = dccEligibleCount('blender');
        const cnt = (n: number) => (n > 0 ? `（${n}）` : '');
        const actionBtnSx = (bg: string, hover: string) => ({
          textTransform: 'none' as const, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' as const, flexShrink: 0,
          minWidth: 0, px: 1.25, py: 0.5, borderRadius: 999, bgcolor: bg, color: 'var(--brand-fg)',
          '& .MuiButton-startIcon': { mr: 0.5, ml: 0 },
          '&:hover': { bgcolor: hover },
          '&.Mui-disabled': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)', color: 'rgb(var(--brand-fg-rgb) / 0.35)' },
        });
        const divider = <Box sx={{ width: '1px', height: 20, bgcolor: 'rgb(var(--slate-ink-rgb) / 0.25)', flexShrink: 0 }} />;
        return (
        <Box
          data-no-dismiss="true"
          onPointerDown={(e) => e.stopPropagation()}
          sx={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 1200,
            display: 'flex', alignItems: 'center', flexWrap: 'nowrap', gap: 0.75, px: 1.5, py: 0.85, borderRadius: 999,
            maxWidth: 'min(94vw, 1040px)', width: 'max-content', overflowX: 'auto',
            bgcolor: 'rgb(var(--slate-panel-rgb) / 0.97)', border: '1px solid rgb(var(--slate-ink-rgb) / 0.3)', boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
            '&::-webkit-scrollbar': { height: 0 },
          }}
        >
          <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: 'var(--brand-fg)', whiteSpace: 'nowrap', flexShrink: 0, pl: 0.5 }}>{selectedIds.length}件選択</Typography>
          <Typography
            onClick={handleClearSelection}
            sx={{ fontSize: 11.5, color: 'rgb(var(--slate-ink-rgb) / 0.9)', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, '&:hover': { color: 'var(--brand-fg)' } }}
          >
            解除
          </Typography>
          {divider}
          <Tooltip title="選択モデルに関連URL（実商品リンク）を自動登録">
            <span style={{ flexShrink: 0, display: 'inline-flex' }}>
              <Button size="small" variant="contained" disabled={bulkEligibleCount === 0}
                startIcon={<ImageSearchRoundedIcon sx={{ fontSize: 16 }} />}
                onClick={() => handleBulkRegister()} sx={actionBtnSx('#2563eb', '#1d4ed8')}>
                関連URL{cnt(bulkEligibleCount)}
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="選択モデルに S.Library カタログの似た商品を自動登録">
            <span style={{ flexShrink: 0, display: 'inline-flex' }}>
              <Button size="small" variant="contained" disabled={bulkEligibleCount === 0}
                startIcon={<MenuBookRoundedIcon sx={{ fontSize: 16 }} />}
                onClick={() => handleBulkCatalog()} sx={actionBtnSx('#16a34a', '#15803d')}>
                カタログ{cnt(bulkEligibleCount)}
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="AIで寸法・カテゴリを自動入力">
            <span style={{ flexShrink: 0, display: 'inline-flex' }}>
              <Button size="small" variant="contained" disabled={bulkEligibleCount === 0}
                startIcon={<AutoFixHighRoundedIcon sx={{ fontSize: 16 }} />}
                onClick={() => handleBulkAutoFill()} sx={actionBtnSx('#7c3aed', '#6d28d9')}>
                AI入力{cnt(bulkEligibleCount)}
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="GLBから現在の設定でサムネイルを作り直す（構図と解像度が改善）">
            <span style={{ flexShrink: 0, display: 'inline-flex' }}>
              <Button size="small" variant="contained" disabled={bulkEligibleCount === 0 || thumbRegenBusy}
                startIcon={thumbRegenBusy
                  ? <CircularProgress size={14} sx={{ color: 'var(--brand-fg)' }} />
                  : <ImageRoundedIcon sx={{ fontSize: 16 }} />}
                onClick={handleBulkRegenerateThumbs} sx={actionBtnSx('#0891b2', '#0e7490')}>
                {thumbRegenBusy && thumbRegenProgress
                  ? `サムネ再生成 ${thumbRegenProgress.index + 1}/${thumbRegenProgress.total}`
                  : `サムネ再生成${cnt(bulkEligibleCount)}`}
              </Button>
            </span>
          </Tooltip>
          {canBulkDelete && (
            <Tooltip title="選択モデルをまとめて削除">
              <span style={{ flexShrink: 0, display: 'inline-flex' }}>
                <Button size="small" variant="contained" disabled={bulkDeletableCount === 0}
                  startIcon={<DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />}
                  onClick={() => setBulkDeleteOpen(true)} sx={actionBtnSx('#dc2626', '#b91c1c')}>
                  削除{cnt(bulkDeletableCount)}
                </Button>
              </span>
            </Tooltip>
          )}
          {divider}
          <Tooltip title="選択モデルを Rhino へ配置（開いて取り込み）">
            <span style={{ flexShrink: 0, display: 'inline-flex' }}>
              <Button size="small" variant="contained" disabled={rhinoCount === 0 || dccBusy !== null}
                startIcon={dccBusy === 'rhino' ? <CircularProgress size={14} sx={{ color: 'var(--brand-fg)' }} /> : <AutoAwesomeMotionRoundedIcon sx={{ fontSize: 16 }} />}
                onClick={() => handlePlaceInDcc('rhino')} sx={actionBtnSx('#0d9488', '#0f766e')}>
                Rhino{cnt(rhinoCount)}
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="選択モデルを Blender へ配置（開いて取り込み）">
            <span style={{ flexShrink: 0, display: 'inline-flex' }}>
              <Button size="small" variant="contained" disabled={blenderCount === 0 || dccBusy !== null}
                startIcon={dccBusy === 'blender' ? <CircularProgress size={14} sx={{ color: 'var(--brand-fg)' }} /> : <ThreeDRotationRoundedIcon sx={{ fontSize: 16 }} />}
                onClick={() => handlePlaceInDcc('blender')} sx={actionBtnSx('#ea7317', '#c2620f')}>
                Blender{cnt(blenderCount)}
              </Button>
            </span>
          </Tooltip>
        </Box>
        );
      })()}

    </Box>
  );
};

const styles = {
  root: {
    position: 'relative',
    height: '100%',
    minHeight: 0,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  stickyHeaderWrap: {
    position: 'sticky',
    top: 0,
    zIndex: 20,
    background: 'rgb(var(--slate-deep-rgb) / 0.92)',
    backdropFilter: 'blur(10px)',
    borderBottom: '1px solid rgb(var(--slate-ink-rgb) / 0.18)',
    minWidth: 0,
    flexShrink: 0,
  },
  topBar: {
    minHeight: 58,
    padding: '10px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    minWidth: 0,
  },
  titleBlock: {
    minWidth: 220,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  breadcrumb: {
    fontSize: 11,
    color: 'rgb(var(--slate-ink-rgb) / 0.85)',
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: 760,
    letterSpacing: 0.2,
    lineHeight: 1.2,
    color: 'var(--brand-fg)',
  },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    padding: '7px 10px',
    borderRadius: 999,
    border: '1px solid rgb(var(--slate-ink-rgb) / 0.30)',
    background: 'rgb(var(--slate-panel-rgb) / 0.62)',
    width: 'min(560px, 100%)',
    minWidth: 220,
  },
  searchIcon: { fontSize: 18, color: 'rgb(var(--slate-ink-rgb) / 0.9)' },
  searchInput: {
    width: '100%',
    minWidth: 0,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: 'var(--brand-fg)',
    fontSize: 12,
  },
  viewBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '4px',
  },
  miniLabel: { fontSize: 11, color: 'rgb(var(--slate-ink-rgb) / 0.85)' },
  densityGroup: {
    '& .MuiButton-root': {
      textTransform: 'none',
      borderColor: 'rgb(var(--slate-ink-rgb) / 0.22)',
    },
  },
  densityBtn: {
    color: 'light-dark(rgba(31,41,55,0.9), rgba(229,231,235,0.9))',
    background: 'rgb(var(--slate-panel-rgb) / 0.32)',
    borderColor: 'rgb(var(--slate-ink-rgb) / 0.22)',
    padding: '3px 10px',
    fontSize: 11,
  },
  densityBtnActive: {
    color: '#0b1220',
    background: 'rgba(96,165,250,0.9)',
    borderColor: 'rgba(96,165,250,0.9)',
    padding: '3px 10px',
    fontSize: 11,
    '&:hover': { background: 'rgba(96,165,250,0.95)' },
  },
  filterRow: {
    padding: '8px 16px 10px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minWidth: 0,
  },
  quickFilters: { display: 'flex', gap: 1, flexWrap: 'wrap' },
  selectFilter: {
    height: 28,
    fontSize: 12,
    color: 'var(--brand-fg)',
    background: 'rgb(var(--slate-panel-rgb) / 0.62)',
    boxShadow: 'none',
    '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(var(--slate-ink-rgb) / 0.22)' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(96,165,250,0.6)' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(var(--slate-ink-rgb) / 0.45)' },
    '.MuiSvgIcon-root': { color: 'rgb(var(--slate-ink-rgb) / 0.85)' }
  },
  chip: {
    borderRadius: 999,
    border: '1px solid rgb(var(--slate-ink-rgb) / 0.28)',
    background: 'rgb(var(--slate-panel-rgb) / 0.48)',
    color: 'var(--brand-fg)',
    fontSize: 11,
    height: 28,
    '&:hover': { background: 'rgb(var(--slate-panel-rgb) / 0.62)' },
  },
  dividerV: { borderColor: 'rgb(var(--slate-ink-rgb) / 0.14)', mx: 0.5 },
  actionsRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    flexWrap: 'wrap',
  },
  actionBtn: {
    textTransform: 'none',
    borderRadius: 999,
    border: '1px solid rgb(var(--slate-ink-rgb) / 0.22)',
    background: 'rgb(var(--slate-panel-rgb) / 0.52)',
    color: 'var(--brand-fg)',
    fontSize: 11,
    padding: '4px 12px',
    height: 30,
    '&:hover': { background: 'rgb(var(--slate-panel-rgb) / 0.70)' },
  },
  content: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    height: '100%',
  },
  pageBodyInner: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    padding: '0',
    height: '100%',
  },
};

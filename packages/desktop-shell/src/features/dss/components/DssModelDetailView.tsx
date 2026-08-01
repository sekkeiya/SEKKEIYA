import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Box, Typography, Button, IconButton, TextField, Tooltip, CircularProgress, Snackbar } from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import { normalizeGimmicks } from '../../shared/walkthrough/gimmicks';
import { isLoopAnim } from '../../shared/walkthrough/loopAnim';
import { useAppStore } from '../../../store/useAppStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { getDownloadUrlForModel, getCanonicalModelId } from '../utils/modelUtils';
import { prefetchModelGlb } from '../utils/prefetchModelGlb';
import type { DetailActions } from './detail/types';
import { DetailCanvasHost } from './detail/DetailCanvasHost';
import { DetailRail, type RailItem, type DetailRailUsage, type DetailRailMaintenanceActions } from './detail/DetailRail';
import { useScrollSpy } from './detail/useScrollSpy';
import { OverviewSection } from './detail/sections/OverviewSection';
import { MaterialSection } from './detail/sections/MaterialSection';
import { SwapSection } from './detail/sections/SwapSection';
import { SetSection } from './detail/sections/SetSection';
import { AnimSection } from './detail/sections/AnimSection';
import { ProductsSection } from './detail/sections/ProductsSection';
import { AuthorSection } from './detail/sections/AuthorSection';
import { readMaterialVariants, readMaterialPresets } from '../../shared/material/materialPresets';
import { readSwapModels } from '../utils/swapModels';

interface UsageLocation {
  optionId: string;
  pathName: string;
  count: number;
}

interface UsageInfo {
  totalCount: number;
  locations: UsageLocation[];
}

interface Props {
  model: any;
  allItems?: any[];
  onBack: () => void;
  onSelectRelated?: (model: any) => void;
  /** セクション6「同じ作者」の「作者ページへ →」。DssDashboard 側の既存 UserProfileDialog を開く。 */
  onAuthorClick?: () => void;
  usageMap?: Record<string, UsageInfo | number>;
  prevModel?: any | null;
  nextModel?: any | null;
  onNavigate?: (dir: 1 | -1) => void;
  // 上部の検索バー＋カメラ（機能はダッシュボードと同じ。ダッシュボード側から配線）
  searchQuery?: string;
  onSearchChange?: (v: string) => void;
  onSearchSubmit?: () => void;
  canImageSearch?: boolean;
  imgSearchBusy?: boolean;
  onCameraClick?: (el: HTMLElement) => void;
  // 表示中の 1 モデルに対するアクション（ダウンロード/関連URL/カタログ/AI入力/Rhino/Blender/保存/共有/削除）。
  detailActions?: DetailActions;
  /** 閲覧 / 編集の画面モード（DssDashboard 側の detailMode。「閲覧者の見え方」中は 'view' が渡る）。 */
  mode: 'view' | 'edit';
  /** 閲覧モードの左サイドバー差し替え（一覧画面と同じ ModelsSidebar を想定）。渡されたときだけ
   *  閲覧モードで CONTENTS レールの代わりに描画する。編集モードは常に DetailRail
   *  （「未」バッジ・情報を充実させる、の機能を持つため）。 */
  viewModeSidebar?: React.ReactNode;
  /** 自動保存の状態文言が変わるたびに呼ばれる（ヘッダー＝DssDashboard 側の DssDetailHeader へ橋渡しする）。
   *  概要フォームの保存とウォークスルー設定（説明・参考リンク・ギミック・常時アニメ）の保存、
   *  両方を合成した状態。DssDetailHeader はこのコンポーネントの子ではなく DssDashboard 側の
   *  兄弟コンポーネントのため、state を直接共有できず、コールバックで橋渡しする形にしている。 */
  onSaveStatusChange?: (status: string) => void;
}

/**
 * 詳細画面のヘッダー内容（戻る / 検索＋カメラ / 前後モデルナビ、または編集モードの専用ヘッダー）。
 * 一覧画面と同じく「全幅ヘッダー（右サイドバーの上まで届く）」にするため、
 * 詳細ビュー本体ではなく DssDashboard 側のヘッダー枠で描画する。
 * flex コンテナ（styles.topBar）の直接の子になる前提でフラグメントを返す。
 */
export const DssDetailHeader: React.FC<{
  mode: 'view' | 'edit';
  onBack: () => void;
  searchQuery?: string;
  onSearchChange?: (v: string) => void;
  onSearchSubmit?: () => void;
  canImageSearch?: boolean;
  imgSearchBusy?: boolean;
  onCameraClick?: (el: HTMLElement) => void;
  prevModel?: any | null;
  nextModel?: any | null;
  onNavigate?: (dir: 1 | -1) => void;
  /** 作成者のみ「編集モードへ」を出す（閲覧モード時）。 */
  isAuthor?: boolean;
  onEnterEdit?: () => void;
  // 編集モードのみ
  title?: string;
  /** 自動保存の状態文言（例:「自動保存 ・ 保存済み」）。Task 9 で実データに置き換える。 */
  saveStatus?: string;
  previewAsViewer?: boolean;
  onTogglePreviewAsViewer?: () => void;
  onExitEdit?: () => void;
}> = ({
  mode, onBack, searchQuery, onSearchChange, onSearchSubmit, canImageSearch, imgSearchBusy, onCameraClick,
  prevModel, nextModel, onNavigate, isAuthor, onEnterEdit, title, saveStatus, previewAsViewer, onTogglePreviewAsViewer, onExitEdit,
}) => {
  if (mode === 'edit') {
    return (
      <>
        <Button
          variant="contained"
          startIcon={<ArrowBackIcon />}
          onClick={onBack}
          sx={{
            bgcolor: 'rgb(var(--slate-panel-rgb) / 0.6)',
            color: 'var(--brand-fg)',
            borderRadius: 999,
            textTransform: 'none',
            flexShrink: 0,
            '&:hover': { bgcolor: 'rgb(var(--slate-panel-rgb) / 0.8)' }
          }}
        >
          Back
        </Button>

        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 1.25 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 700, color: 'var(--brand-fg)' }} noWrap>{title}</Typography>
          {saveStatus && (
            <Typography sx={{ fontSize: 11.5, color: 'rgb(var(--slate-ink-rgb) / 0.9)' }} noWrap>{saveStatus}</Typography>
          )}
        </Box>

        <Button
          variant="outlined"
          startIcon={<VisibilityRoundedIcon sx={{ fontSize: 17 }} />}
          onClick={onTogglePreviewAsViewer}
          sx={{
            height: 34, borderRadius: '8px', textTransform: 'none', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap',
            color: previewAsViewer ? '#9ec1ff' : 'rgba(255,255,255,0.85)',
            borderColor: previewAsViewer ? 'rgba(79,140,255,0.6)' : 'rgb(var(--brand-fg-rgb) / 0.14)',
            bgcolor: previewAsViewer ? 'rgba(79,140,255,0.18)' : 'transparent',
          }}
        >
          閲覧者の見え方
        </Button>
        <Button
          variant="contained"
          startIcon={<EditRoundedIcon sx={{ fontSize: 17 }} />}
          onClick={onExitEdit}
          sx={{
            height: 34, borderRadius: '8px', textTransform: 'none', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap',
            bgcolor: 'rgba(79,140,255,0.22)', border: '1px solid rgba(79,140,255,0.6)', color: '#9ec1ff',
            '&:hover': { bgcolor: 'rgba(79,140,255,0.32)' },
          }}
        >
          編集モード中 — 終了
        </Button>
      </>
    );
  }

  return (
    <>
      <Button
        variant="contained"
        startIcon={<ArrowBackIcon />}
        onClick={onBack}
        sx={{
          bgcolor: 'rgb(var(--slate-panel-rgb) / 0.6)',
          color: 'var(--brand-fg)',
          borderRadius: 999,
          textTransform: 'none',
          flexShrink: 0,
          '&:hover': { bgcolor: 'rgb(var(--slate-panel-rgb) / 0.8)' }
        }}
      >
        Back
      </Button>

      {/* 検索バー＋カメラ（機能はダッシュボードと同じ。中央配置） */}
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 0 }}>
        {onSearchChange && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', maxWidth: 620 }}>
            <TextField
              fullWidth
              size="small"
              value={searchQuery ?? ''}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onSearchSubmit?.(); } }}
              placeholder="Search models..."
              InputProps={{ startAdornment: <SearchRoundedIcon sx={{ fontSize: 18, color: 'rgb(var(--slate-ink-rgb) / 0.8)', mr: 1 }} /> }}
              sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgb(var(--slate-panel-rgb) / 0.55)', color: 'var(--brand-fg)', borderRadius: 999 }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(var(--slate-ink-rgb) / 0.25)' }, '& input': { fontSize: 13, py: 0.85 } }}
            />
            <Tooltip title={canImageSearch ? 'この3Dモデルを画像検索（実在する商品を探す）' : 'モデルを表示中のみ'} arrow>
              <span>
                <IconButton
                  size="small"
                  disabled={!canImageSearch || imgSearchBusy}
                  onClick={(e) => onCameraClick?.(e.currentTarget)}
                  sx={{ width: 38, height: 38, borderRadius: 999, border: '1px solid rgb(var(--slate-ink-rgb) / 0.30)', background: 'rgb(var(--slate-panel-rgb) / 0.62)', color: canImageSearch ? 'light-dark(#0352aa, #93c5fd)' : 'rgb(var(--slate-ink-rgb) / 0.5)', flexShrink: 0, '&:hover': { background: 'rgba(96,165,250,0.18)', borderColor: 'rgba(96,165,250,0.6)' } }}
                >
                  {imgSearchBusy ? <CircularProgress size={18} sx={{ color: 'light-dark(#0352aa, #93c5fd)' }} /> : <PhotoCameraRoundedIcon sx={{ fontSize: 20 }} />}
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        )}
      </Box>

      {/* 前/次のモデルナビ（クリック or ←/→キー） */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 1, maxWidth: '24%', minWidth: 0 }}>
        {prevModel && (
          <Box
            onClick={() => onNavigate?.(-1)}
            title="前のモデル（←）"
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, maxWidth: 140, minWidth: 0, px: 1.25, py: 0.6, borderRadius: 999, cursor: 'pointer', bgcolor: 'rgb(var(--slate-panel-rgb) / 0.5)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', color: 'rgb(var(--brand-fg-rgb) / 0.75)', transition: 'all 0.15s', '&:hover': { bgcolor: 'rgba(56,189,248,0.18)', borderColor: 'rgba(56,189,248,0.5)', color: 'var(--brand-fg)' } }}
          >
            <ChevronLeftRoundedIcon sx={{ fontSize: 18, flexShrink: 0 }} />
            <Typography sx={{ fontSize: 12.5, fontWeight: 600 }} noWrap>{prevModel.title || prevModel.name || 'Untitled'}</Typography>
          </Box>
        )}
        {nextModel && (
          <Box
            onClick={() => onNavigate?.(1)}
            title="次のモデル（→）"
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, maxWidth: 140, minWidth: 0, px: 1.25, py: 0.6, borderRadius: 999, cursor: 'pointer', bgcolor: 'rgb(var(--slate-panel-rgb) / 0.5)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', color: 'rgb(var(--brand-fg-rgb) / 0.75)', transition: 'all 0.15s', '&:hover': { bgcolor: 'rgba(56,189,248,0.18)', borderColor: 'rgba(56,189,248,0.5)', color: 'var(--brand-fg)' } }}
          >
            <Typography sx={{ fontSize: 12.5, fontWeight: 600 }} noWrap>{nextModel.title || nextModel.name || 'Untitled'}</Typography>
            <ChevronRightRoundedIcon sx={{ fontSize: 18, flexShrink: 0 }} />
          </Box>
        )}
      </Box>

      {isAuthor && (
        <>
          <Box sx={{ width: '1px', height: 24, bgcolor: 'rgba(255,255,255,0.12)', mx: 0.25, flexShrink: 0 }} />
          <Button
            variant="outlined"
            startIcon={<EditRoundedIcon sx={{ fontSize: 17 }} />}
            onClick={onEnterEdit}
            sx={{
              height: 34, borderRadius: '8px', textTransform: 'none', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap',
              color: '#93c5fd', borderColor: 'rgba(96,165,250,0.5)',
              '&:hover': { borderColor: 'rgba(96,165,250,0.9)', bgcolor: 'rgba(96,165,250,0.12)' },
            }}
          >
            編集モードへ
          </Button>
        </>
      )}
    </>
  );
};

// 外部リンクを既定ブラウザで開く（Tauri の plugin-opener、無ければ window.open にフォールバック）。
// スペック（OverviewSection）と「似ている商品・購入先」セクションの両方から使うため、モジュールスコープに置く。
const openExternalUrl = (raw: string) => {
  let u = raw;
  if (!/^https?:\/\//.test(u)) u = 'https://' + u;
  import('@tauri-apps/plugin-opener')
    .then((m: any) => (m.openUrl ? m.openUrl(u) : window.open(u, '_blank')))
    .catch(() => window.open(u, '_blank'));
};

// 検索/カメラ/前後ナビはヘッダー（DssDetailHeader）へ移したため、ここでは受け取らない。
export const DssModelDetailView: React.FC<Props> = ({ model, allItems, onBack, onSelectRelated, onAuthorClick, usageMap, prevModel, nextModel, onNavigate, detailActions, mode, viewModeSidebar, onSaveStatusChange }) => {
  const glbUrl = useMemo(() => getDownloadUrlForModel(model, 'glb'), [model]);
  // イベント委譲元（DetailCanvasHost）兼、画面全体のルート要素。
  const rootRef = useRef<HTMLDivElement>(null);
  // セクションが縦に並ぶ、実際にスクロールする列（scrollSpy の監視対象でもある）。
  const scrollRef = useRef<HTMLDivElement>(null);

  // プロジェクト複製アイテムかどうかの書き込み先分岐（persistAssetPatch 経由）に使う。
  // handleSaveViewAsThumbnail / saveWalkthroughSettings から参照するため、それらより前で宣言する。
  const activeProjectId = useAppStore((s) => s.activeProjectId);

  // Object.assign 等で model を直接ミューテートする保存経路は、model の参照自体は変わらないため
  // useMemo(..., [model]) が再計算されない（Finding I6）。保存成功のたびにこれを +1 し、
  // 表示用 useMemo の deps に加えることでキャッシュを強制的に無効化する「キャッシュバスター」。
  const [modelRevision, setModelRevision] = useState(0);
  const bumpModelRevision = useCallback(() => setModelRevision((r) => r + 1), []);

  // OverviewSection の「全画面」表示中かどうか。共有 Canvas（DetailCanvasHost）の zIndex を
  // 全画面コンテナ（zIndex:1300）より上へ引き上げるために必要（Finding I2）。
  const [overviewFullscreen, setOverviewFullscreen] = useState(false);

  // 矢印キー ←/→ で前後のモデルへ。入力欄にフォーカス中は無効。
  useEffect(() => {
    if (!onNavigate) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'ArrowLeft' && prevModel) { e.preventDefault(); onNavigate(-1); }
      else if (e.key === 'ArrowRight' && nextModel) { e.preventDefault(); onNavigate(1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onNavigate, prevModel, nextModel]);

  // 前後モデルのGLBを先読みして ←/→ ナビ時の3D表示を即時にする。
  // 表示中モデルのダウンロードを妨げないよう少し遅らせて開始する。
  useEffect(() => {
    if (!prevModel && !nextModel) return;
    const t = setTimeout(() => {
      if (nextModel) prefetchModelGlb(nextModel);
      if (prevModel) prefetchModelGlb(prevModel);
    }, 2000);
    return () => clearTimeout(t);
  }, [prevModel, nextModel]);

  // セクション2（置き換え）で選ばれた差し替え先。概要セクションのメインビューアへ配線する。
  const [swapSel, setSwapSel] = useState<{ url: string; dims: any } | null>(null);

  // パターンのサムネイル生成用：概要セクションのメインビューアの描画を取り出す
  const viewerCaptureRef = useRef<(() => string | null) | null>(null);
  const captureThumb = useCallback(() => viewerCaptureRef.current?.() ?? null, []);

  // 今見えている3Dビューをこのモデルのサムネイルとして保存する。
  const [thumbSaving, setThumbSaving] = useState(false);
  const [thumbMsg, setThumbMsg] = useState<string | null>(null);
  const handleSaveViewAsThumbnail = useCallback(async () => {
    const canonicalId = getCanonicalModelId(model) || model?.id;
    if (!canonicalId) return;
    setThumbSaving(true);
    setThumbMsg(null);
    try {
      const dataUrl = captureThumb();
      if (!dataUrl) throw new Error('3Dビューの取得に失敗しました');
      const { uploadModelThumbFromView } = await import('../utils/variantThumb');
      const url = await uploadModelThumbFromView(canonicalId, dataUrl);
      if (!url) throw new Error('画像の保存に失敗しました');
      // 書き込み先はプロジェクト複製アイテムかどうかで分岐する（Finding I5、persistAssetPatch 参照）。
      // 以前はここだけ無条件で assets/{canonical} に書いており、プロジェクト複製アイテムでは
      // 非所有のグローバル資産への書き込みが rules に拒否されて失敗しうる状態だった。
      const { persistAssetPatch } = await import('../utils/persistAssetPatch');
      await persistAssetPatch(model, activeProjectId, { thumbnailUrl: url });
      // 画面上のモデルにも反映して、2D表示や一覧へ戻ったときに新しい絵が出るようにする。
      model.thumbnailUrl = url;
      bumpModelRevision(); // Finding I6: [model] 参照は不変のため、表示用 useMemo のキャッシュを明示的に無効化する
      setThumbMsg('サムネイルを更新しました');
    } catch (e: any) {
      console.error('[DssModelDetailView] save view as thumbnail failed', e);
      setThumbMsg(e?.message || 'サムネイルの更新に失敗しました');
    } finally {
      setThumbSaving(false);
    }
  }, [model, captureThumb, activeProjectId, bumpModelRevision]);

  const [walkthroughChar, setWalkthroughChar] = useState<any>(model.extendedMetadata?.character || null);
  const [walkthroughGimmicks, setWalkthroughGimmicks] = useState<any[]>(() => normalizeGimmicks(model.extendedMetadata));
  const [walkthroughAnim, setWalkthroughAnim] = useState<any>(model.extendedMetadata?.anim || null);
  const [walkthroughInfo, setWalkthroughInfo] = useState<any>(model.extendedMetadata?.info || null);
  const [isSavingWalkthrough, setIsSavingWalkthrough] = useState(false);
  const [walkthroughDirty, setWalkthroughDirty] = useState(false);
  // 上記ウォークスルー系の state はモデル切替のたびに useState 初期化式で自動的にリセットされる
  // （Dashboard 側で motion.div に key={detailModel.id} が付いており、モデルが変わるたびに
  // このコンポーネント自体が unmount → remount されるため）。

  // ヘッダーの自動保存表示（「保存中…」/「HH:MM 保存済み」）。ウォークスルー設定の保存
  // （character/gimmicks/anim/info——info は Task 9 で概要フォームの説明欄へ吸収済み）と、
  // 概要フォーム自身の保存（OverviewSection）の両方を合成する。
  const [overviewSaving, setOverviewSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  // 概要フォームの保存失敗（Finding 1）。成功すれば OverviewSection 側から null が来てクリアされる。
  const [overviewSaveError, setOverviewSaveError] = useState<string | null>(null);
  // ウォークスルー設定の保存失敗（Finding I4）。以前は失敗しても walkthroughDirty が true のまま
  // 残り、下のデバウンス effect が際限なく（約1秒おきに）再アームして永久リトライしていた
  // （console.error のみで画面には何も出ない）。失敗時は walkthroughDirty を false に落として
  // ループを止め、この state で失敗を保持してヘッダーの自動保存表示へ流す。次の実編集
  // （setWalkthroughDirtyFromUI 経由）でのみクリア＝再アームする。
  const [walkthroughSaveError, setWalkthroughSaveError] = useState<string | null>(null);
  const markSaved = useCallback(() => setLastSavedAt(new Date()), []);
  const saveStatus = useMemo(() => {
    if (overviewSaveError) return overviewSaveError;
    if (walkthroughSaveError) return walkthroughSaveError;
    if (isSavingWalkthrough || overviewSaving) return '保存中…';
    if (lastSavedAt) {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${pad(lastSavedAt.getHours())}:${pad(lastSavedAt.getMinutes())} 保存済み`;
    }
    return '';
  }, [isSavingWalkthrough, overviewSaving, lastSavedAt, overviewSaveError, walkthroughSaveError]);
  useEffect(() => { onSaveStatusChange?.(saveStatus); }, [saveStatus, onSaveStatusChange]);

  /** AnimSection / OverviewSection（説明・参考リンク）から渡す setDirty はこちらを使う。
   *  実編集（true）が入るたびに、直前の保存失敗表示をクリア＝再アームする（Finding I4）。
   *  内部の「保存成功/失敗後に false へ戻す」処理は素の setWalkthroughDirty を使い続ける
   *  （それは「新しい編集」ではないため、ここを通す必要がない）。 */
  const setWalkthroughDirtyFromUI = useCallback((v: boolean) => {
    setWalkthroughDirty(v);
    if (v) setWalkthroughSaveError(null);
  }, []);

  // 変更は自動保存する（設計原則 State Synchronization）。連続操作をまとめるため少し待つ。
  useEffect(() => {
    if (!walkthroughDirty || isSavingWalkthrough) return;
    const t = setTimeout(() => { saveWalkthroughSettings(); }, 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walkthroughDirty, isSavingWalkthrough]);

  // アンマウント時のフラッシュ（OverviewSection の Finding 3 と同じパターンを対称的に適用）。
  // デバウンス中（<1秒）に画面遷移されると、説明/ギミック/常時アニメの直近編集が失われる。
  // 毎レンダーで ref に最新値を積んでおき、アンマウント時の cleanup だけが拾う。
  // savingInFlightRef は素の bool（React state ではない）——setState の反映を待つとフラッシュと
  // 実行中の保存が競合する窓ができるため、saveWalkthroughSettings の最初の同期行で立てる。
  const walkthroughLatestRef = useRef({
    char: walkthroughChar, gimmicks: walkthroughGimmicks, anim: walkthroughAnim, info: walkthroughInfo, dirty: walkthroughDirty,
  });
  walkthroughLatestRef.current = {
    char: walkthroughChar, gimmicks: walkthroughGimmicks, anim: walkthroughAnim, info: walkthroughInfo, dirty: walkthroughDirty,
  };
  const walkthroughSavingInFlightRef = useRef(false);

  /** overrides を渡すとその値で保存する（アンマウントフラッシュ用）。省略時は現在の state を使う
   *  （デバウンス経由の通常呼び出しは今までどおり）。 */
  const saveWalkthroughSettings = async (overrides?: { char: any; gimmicks: any[]; anim: any; info: any }) => {
    const char = overrides ? overrides.char : walkthroughChar;
    const gimmicks = overrides ? overrides.gimmicks : walkthroughGimmicks;
    const anim = overrides ? overrides.anim : walkthroughAnim;
    const info = overrides ? overrides.info : walkthroughInfo;
    walkthroughSavingInFlightRef.current = true;
    setIsSavingWalkthrough(true);
    try {
      // 情報リンクの空行を保存時に除去
      const cleanedInfo = info
        ? {
            description: info.description || '',
            links: Array.isArray(info.links)
              ? info.links.filter((l: any) => l && (l.title || l.url))
              : [],
          }
        : null;
      const cleanedInfoFinal = cleanedInfo && (cleanedInfo.description.trim() || cleanedInfo.links.length) ? cleanedInfo : null;
      const nextExtendedMetadata = {
        ...(model.extendedMetadata || {}),
        character: char || null,
        gimmicks: gimmicks || [],
        gimmick: (gimmicks && gimmicks[0]) || null, // 後方互換
        anim: anim || null,
        info: cleanedInfoFinal,
      };
      // 書き込み先はプロジェクト複製アイテムかどうかで分岐する（Finding I5）。以前はここだけ
      // updateDoc(doc(db,'assets',canonicalId), ...) で無条件に assets/{canonicalId} へ直接書いており、
      // OverviewSection（概要フォーム）とは別の書き込み先ロジック（＝分岐なし）になっていた。
      const { persistAssetPatch } = await import('../utils/persistAssetPatch');
      await persistAssetPatch(model, activeProjectId, { extendedMetadata: nextExtendedMetadata });
      // 画面上のモデルにも即時反映する（Finding I6: そうしないと閲覧モードの説明欄が
      // 保存後も古いままになる——OverviewSection の description は model.extendedMetadata.info を
      // 直接読む plain read で、これまでここが一切更新されていなかった）。
      model.extendedMetadata = nextExtendedMetadata;
      setWalkthroughDirty(false);
      setWalkthroughSaveError(null);
      markSaved();
      bumpModelRevision();
    } catch (e) {
      console.error('[WalkthroughSettings] save failed', e);
      // Finding I4: dirty を true のまま残すと、下のデバウンス effect が際限なく再アームして
      // 1秒おきの無限リトライになる（画面には何も出ず気付けない）。false に落としてループを止め、
      // 失敗はヘッダーの自動保存表示へ出す。再アームは次の実編集（setWalkthroughDirtyFromUI）のみ。
      setWalkthroughDirty(false);
      setWalkthroughSaveError('保存に失敗しました');
    } finally {
      setIsSavingWalkthrough(false);
      walkthroughSavingInFlightRef.current = false;
    }
  };

  useEffect(() => {
    return () => {
      const latest = walkthroughLatestRef.current;
      if (latest.dirty && !walkthroughSavingInFlightRef.current) {
        void saveWalkthroughSettings({ char: latest.char, gimmicks: latest.gimmicks, anim: latest.anim, info: latest.info });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 作成者判定（編集UI vs 閲覧UIの分岐）
  const currentUser = useAuthStore((s) => s.currentUser);
  const isAuthor = !!currentUser && (
    model?.authorId === currentUser.uid ||
    model?.ownerId === currentUser.uid ||
    model?.createdBy === currentUser.uid
  );

  // ── 左レール ──────────────────────────────────────────────────────
  // 「実在商品」＝旧「似ている商品・購入先」ブロック（カタログ照合 + Web関連リンク）の件数。
  // ProductsSection の削除は model.catalogLinks/relatedLinks を直接ミューテートするため、
  // model 参照自体は変わらず、このままでは削除後もレールの件数バッジが古いまま（Finding I6）。
  // modelRevision を deps に加えてキャッシュを明示的に無効化する。
  const productsCount = useMemo(() => {
    const cl = Array.isArray(model.catalogLinks) ? model.catalogLinks.filter((l: any) => l && l.url) : [];
    const rl: any[] = Array.isArray(model.relatedLinks)
      ? model.relatedLinks.filter((l: any) => l && l.url)
      : (model.sourceUrl ? [{ url: model.sourceUrl }] : []);
    return cl.length + rl.length;
    // modelRevision は本体から読まないが、ProductsSection の削除後にキャッシュを無効化する意図的な依存
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, modelRevision]);

  // 「同じ作者」＝ DssRelatedModels の「同じ作者」タブと同じ絞り込み（件数のみ、軽量に再計算）。
  const byAuthorCount = useMemo(() => {
    const ownerId = model?.ownerId || model?.authorId;
    if (!ownerId || !Array.isArray(allItems)) return 0;
    return allItems.filter((it: any) => it && it.id !== model.id && (it.ownerId || it.authorId) === ownerId).length;
  }, [model, allItems]);

  // セクション1（素材）: variants/presets が両方0件の閲覧モードでは行・セクションごと隠す。
  // 編集モードは常に表示（0件なら「未」バッジ）。
  const materialVariantsCount = useMemo(() => readMaterialVariants(model).length, [model]);
  const materialPresetsCount = useMemo(() => readMaterialPresets(model).length, [model]);
  const showMaterialSection = mode === 'edit' || materialVariantsCount > 0 || materialPresetsCount > 0;

  // セクション2（置き換え）: 素材と同じ隠し方（閲覧は0件なら非表示、編集は常に「未」バッジで表示）。
  const swapModelsCount = useMemo(() => readSwapModels(model).length, [model]);
  const showSwapSection = mode === 'edit' || swapModelsCount > 0;

  // セクション3（セット家具）: modelSets は Firestore の別コレクションなので、他セクションと違い
  // 件数を同期的に出せない。SetSection 側の onCountChange で橋渡しする（初期値 null = 未取得中は
  // 閲覧モードでは非表示のまま——取得できるまで一瞬でも空セクションを見せないための措置）。
  const [setSectionCount, setSetSectionCount] = useState<number | null>(null);
  const showSetSection = mode === 'edit' || (setSectionCount ?? 0) > 0;

  // セクション4（アニメ）: 素材/置き換えと同じ隠し方。件数はギミック数（＋常時アニメが
  // 設定されていれば+1）。walkthroughGimmicks/walkthroughAnim は AnimSection と共有する
  // 編集中のライブ state なので、編集モード中はバッジがその場で更新される。
  const animRailCount = walkthroughGimmicks.length + (isLoopAnim(walkthroughAnim) ? 1 : 0);
  const showAnimSection = mode === 'edit' || animRailCount > 0;

  // セクション5（実在商品）: 素材/置き換えと同じ隠し方。
  const showProductsSection = mode === 'edit' || productsCount > 0;
  // セクション6（同じ作者）: 閲覧は0件なら非表示。編集は常に表示し、常に「自動生成」バッジ
  // （リンク未登録のときの「未」とは違い、そもそも編集項目が無いセクションのため）。
  const showAuthorSection = mode === 'edit' || byAuthorCount > 0;

  // Rail の項目構成は暫定（この後のタスクで各セクションが自分の行を持つようになる）。
  // 「編集パネル（旧）」は作成者の編集モードのみ意味を持つため、そのときだけ出す。
  const railItems = useMemo<RailItem[]>(() => {
    const items: RailItem[] = [{ id: 'overview', label: '概要', state: 'done' }];
    if (showMaterialSection) {
      items.push(
        materialVariantsCount > 0
          ? { id: 'material', label: '1 素材', count: materialVariantsCount, state: 'done' }
          : { id: 'material', label: '1 素材', state: mode === 'edit' ? 'empty' : undefined }
      );
    }
    if (showSwapSection) {
      items.push(
        swapModelsCount > 0
          ? { id: 'swap', label: '2 置き換え', count: swapModelsCount, state: 'done' }
          : { id: 'swap', label: '2 置き換え', state: mode === 'edit' ? 'empty' : undefined }
      );
    }
    if (showSetSection) {
      items.push(
        (setSectionCount ?? 0) > 0
          ? { id: 'set', label: '3 セット家具', count: setSectionCount ?? undefined, state: 'done' }
          : { id: 'set', label: '3 セット家具', state: mode === 'edit' ? 'empty' : undefined }
      );
    }
    if (showAnimSection) {
      items.push(
        animRailCount > 0
          ? { id: 'anim', label: '4 アニメ', count: animRailCount, state: 'done' }
          : { id: 'anim', label: '4 アニメ', state: mode === 'edit' ? 'empty' : undefined }
      );
    }
    if (showProductsSection) {
      items.push(
        productsCount > 0
          ? { id: 'products', label: '5 実在商品', count: productsCount, state: 'done' }
          : { id: 'products', label: '5 実在商品', state: mode === 'edit' ? 'empty' : undefined }
      );
    }
    if (showAuthorSection) {
      items.push({
        id: 'author',
        label: '6 同じ作者',
        count: byAuthorCount > 0 ? byAuthorCount : undefined,
        state: mode === 'edit' ? 'auto' : 'done',
      });
    }
    return items;
  }, [mode, showMaterialSection, materialVariantsCount, showSwapSection, swapModelsCount, showSetSection, setSectionCount, showAnimSection, animRailCount, showProductsSection, productsCount, showAuthorSection, byAuthorCount]);
  const railIds = useMemo(() => railItems.map((i) => i.id), [railItems]);
  const activeId = useScrollSpy(scrollRef, railIds);

  const handleJump = useCallback((id: string) => {
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-section-id="${id}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const railUsage = useMemo<DetailRailUsage | null>(() => {
    if (mode !== 'view') return null;
    const raw = usageMap?.[model.id];
    if (raw == null) return null;
    if (typeof raw === 'number') {
      if (raw <= 0) return null;
      return { layouts: 1, items: raw, names: [] };
    }
    if (raw.totalCount <= 0) return null;
    return { layouts: raw.locations?.length || 1, items: raw.totalCount, names: (raw.locations || []).map((l) => l.pathName) };
  }, [mode, usageMap, model.id]);

  const railMaintenanceActions = useMemo<DetailRailMaintenanceActions | null>(() => {
    if (mode !== 'edit' || !detailActions?.canRegister) return null;
    return {
      onRegisterLinks: detailActions.onRegisterLinks,
      onCatalog: detailActions.onCatalog,
      onAutoFill: detailActions.onAutoFill,
      onSaveThumb: handleSaveViewAsThumbnail,
    };
  }, [mode, detailActions, handleSaveViewAsThumbnail]);

  return (
    <Box ref={rootRef} sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
      {/* eventSourceRef の型は drei/fiber の Canvas.eventSource（RefObject<HTMLElement>、current が
          null になり得ない前提の型）に合わせてある。実際には mount 前は null が入るが、これは
          three-fiber 側の型定義の慣習（プロジェクト内の他の Canvas 利用箇所と同様にキャストで吸収する）。 */}
      <DetailCanvasHost eventSourceRef={rootRef as React.RefObject<HTMLElement>} elevated={overviewFullscreen}>
        <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {mode === 'view' && viewModeSidebar != null ? (
            // 閲覧モード: 一覧画面と同じ左サイドバー（スコープ切替）。目次ジャンプより回遊性を優先する。
            viewModeSidebar
          ) : (
            <DetailRail
              mode={mode}
              items={railItems}
              activeId={activeId}
              onJump={handleJump}
              usage={railUsage}
              maintenanceActions={railMaintenanceActions}
            />
          )}

          <Box ref={scrollRef} sx={{ flex: 1, minWidth: 0, overflowY: 'auto', overflowX: 'hidden' }}>
            <Box data-section-id="overview">
              <OverviewSection
                model={model}
                mode={mode}
                isAuthor={isAuthor}
                detailActions={detailActions}
                usage={usageMap?.[model.id]}
                swapUrl={swapSel?.url ?? null}
                swapDims={swapSel?.dims ?? null}
                captureRef={viewerCaptureRef}
                onOpenLink={openExternalUrl}
                infoState={{
                  info: walkthroughInfo, setInfo: setWalkthroughInfo,
                  dirty: walkthroughDirty, setDirty: setWalkthroughDirtyFromUI,
                  saving: isSavingWalkthrough,
                }}
                onSaveThumbnail={handleSaveViewAsThumbnail}
                thumbSaving={thumbSaving}
                onOverviewSavingChange={setOverviewSaving}
                onOverviewSaved={() => { markSaved(); bumpModelRevision(); }}
                onOverviewSaveError={setOverviewSaveError}
                activeProjectId={activeProjectId}
                modelRevision={modelRevision}
                onFullscreenChange={setOverviewFullscreen}
              />
            </Box>

            {showMaterialSection && (
              <Box data-section-id="material">
                <MaterialSection model={model} mode={mode} isAuthor={isAuthor} projectId={activeProjectId || undefined} />
              </Box>
            )}

            {showSwapSection && (
              <Box data-section-id="swap">
                <SwapSection model={model} mode={mode} isAuthor={isAuthor} selected={swapSel} onSelect={setSwapSel} />
              </Box>
            )}

            {/* Finding C1: 以前は showSetSection（＝件数が確定してから）で mount 可否を決めていたが、
                setSectionCount は SetSection 自身の onCountChange でしか埋まらないため、
                閲覧モードでは「mount されない→件数が来ない→ mount されない」の循環で永久に
                表示されなかった。常時 mount し、0 件時は SetSection 自身が null を返して
                自己収縮する（SetSection.tsx の mode==='view' && sets.length===0 の早期 return）。
                レール行の表示可否だけは従来どおり showSetSection（＝件数が確定してから）のまま
                にして、0 件のときにレールへ空行を出さないようにする。 */}
            <Box data-section-id="set">
              <SetSection model={model} mode={mode} isAuthor={isAuthor} onCountChange={setSetSectionCount} />
            </Box>

            {showAnimSection && (
              <Box data-section-id="anim">
                <AnimSection
                  model={model}
                  mode={mode}
                  isAuthor={isAuthor}
                  glbUrl={glbUrl || null}
                  walkthrough={{
                    char: walkthroughChar, setChar: setWalkthroughChar,
                    gimmicks: walkthroughGimmicks, setGimmicks: setWalkthroughGimmicks,
                    anim: walkthroughAnim, setAnim: setWalkthroughAnim,
                    info: walkthroughInfo, setInfo: setWalkthroughInfo,
                    dirty: walkthroughDirty, setDirty: setWalkthroughDirtyFromUI,
                    saving: isSavingWalkthrough,
                  }}
                />
              </Box>
            )}

            {showProductsSection && (
              <Box data-section-id="products">
                <ProductsSection
                  model={model}
                  mode={mode}
                  isAuthor={isAuthor}
                  detailActions={detailActions}
                  onOpenLink={openExternalUrl}
                  activeProjectId={activeProjectId}
                  onModelChanged={bumpModelRevision}
                />
              </Box>
            )}

            {showAuthorSection && (
              <Box data-section-id="author">
                <AuthorSection
                  model={model}
                  mode={mode}
                  allItems={allItems}
                  onSelect={(m) => { scrollRef.current?.scrollTo(0, 0); onSelectRelated?.(m); }}
                  onBack={onBack}
                  onAuthorClick={() => onAuthorClick?.()}
                />
              </Box>
            )}
          </Box>
        </Box>
      </DetailCanvasHost>

      <Snackbar open={!!thumbMsg} autoHideDuration={4000} onClose={() => setThumbMsg(null)} message={thumbMsg || ''} />
      {thumbSaving && (
        <Box sx={{ position: 'absolute', bottom: 16, right: 16, display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.75, borderRadius: 999, bgcolor: 'rgba(0,0,0,0.6)' }}>
          <CircularProgress size={14} sx={{ color: '#fff' }} />
          <Typography sx={{ fontSize: 11.5, color: '#fff' }}>サムネイルを保存中…</Typography>
        </Box>
      )}
    </Box>
  );
};

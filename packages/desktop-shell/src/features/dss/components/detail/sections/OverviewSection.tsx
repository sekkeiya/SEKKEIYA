import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography, Button, IconButton, Chip, Menu, MenuItem, ListItemText, Tooltip, CircularProgress, Snackbar, Divider, TextField, Select } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import FavoriteBorderRoundedIcon from '@mui/icons-material/FavoriteBorderRounded';
import BookmarkAddRoundedIcon from '@mui/icons-material/BookmarkAddRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import StraightenRoundedIcon from '@mui/icons-material/StraightenRounded';
import OpenInFullRoundedIcon from '@mui/icons-material/OpenInFullRounded';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import AutoAwesomeMotionRoundedIcon from '@mui/icons-material/AutoAwesomeMotionRounded';
import ThreeDRotationRoundedIcon from '@mui/icons-material/ThreeDRotationRounded';
import ShareRoundedIcon from '@mui/icons-material/ShareRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import LaunchRoundedIcon from '@mui/icons-material/LaunchRounded';
import CameraAltRoundedIcon from '@mui/icons-material/CameraAltRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import { DetailViewport } from '../DetailViewport';
import { listDownloadFormats, downloadModelFile } from '../../../utils/modelDownload';
import { getDownloadUrlForModel, getCanonicalModelId } from '../../../utils/modelUtils';
import { useModelLike } from '../../../hooks/useModelLike';
import { useAuthStore } from '../../../../../store/useAuthStore';
import { useUserSettingsStore, MACRO_CATEGORY_ORDER } from '../../../../../store/useUserSettingsStore';
import { useDssLiveDimensionsStore } from '../../../../../store/useDssLiveDimensionsStore';
import { useLocalUploadStore } from '../../../store/useLocalUploadStore';
import { LocalCloudUploadDialog } from '../../../upload/LocalCloudUploadDialog';
import { ErrorBoundary } from '../../../../../shared/components/ErrorBoundary';
import WalkthroughMetadataEditor from '../../WalkthroughMetadataEditor';
import type { DetailActions } from '../types';

interface UsageLocation {
  optionId: string;
  pathName: string;
  count: number;
}
interface UsageInfo {
  totalCount: number;
  locations: UsageLocation[];
}

/** 説明・参考リンク（extendedMetadata.info）の編集状態。DssModelDetailView のウォークスルー設定 state
 *  を橋渡しする（保存も同じ 1 秒デバウンス・updateDoc パスに乗る。詳しくは DssModelDetailView 参照）。 */
export interface OverviewInfoState {
  info: any;
  setInfo: (v: any) => void;
  dirty: boolean;
  setDirty: (v: boolean) => void;
  saving: boolean;
}

export interface OverviewSectionProps {
  model: any;
  mode: 'view' | 'edit';
  isAuthor: boolean;
  detailActions?: DetailActions;
  usage?: UsageInfo | number;
  /** 「置き換え」（SwapSection）で選ばれた差し替え先の GLB。非 null の間はこちらを表示する。 */
  swapUrl?: string | null;
  /** swapUrl 選択中の差し替え先モデル自身の寸法（mm）。指定があれば寸法線・スケールをこちらに合わせる。 */
  swapDims?: { width?: number; depth?: number; height?: number } | null;
  /** 現在の3Dビュー描画を取り出す関数の置き場（サムネイル保存用）。渡すと DetailViewport 側で埋まる。 */
  captureRef?: React.MutableRefObject<(() => string | null) | null>;
  onOpenLink: (url: string) => void;
  /** 編集モードのみ: 説明・参考リンクの編集状態（DssModelDetailView 所有）。 */
  infoState?: OverviewInfoState;
  /** 編集モードのみ: 「この表示をサムネイルにする」（レールの「この表示をサムネに」と同じ関数）。 */
  onSaveThumbnail?: () => void;
  thumbSaving?: boolean;
  /** 編集モードのみ: このセクションの編集フォームの自動保存が進行中/完了したことを親（ヘッダーの
   *  自動保存表示）へ知らせる。ウォークスルー設定側の保存状態と合成される。 */
  onOverviewSavingChange?: (saving: boolean) => void;
  onOverviewSaved?: () => void;
  /** 編集モードのみ: 概要フォームの保存が失敗したことを親（ヘッダーの自動保存表示）へ知らせる。
   *  成功時は null を渡してクリアする。Task 9 時点ではこのコールバックが無く、保存失敗が
   *  console.error のみで握りつぶされていた（Finding 1 の指摘）ため追加した。 */
  onOverviewSaveError?: (message: string | null) => void;
  /** 編集モードのみ: プロジェクトへ複製されたアイテム（コピー）を編集しているときの書き込み先。
   *  `DssModelDetailView` が `useAppStore` の `activeProjectId` をそのまま渡す。 */
  activeProjectId?: string | null;
  /** 保存のたびに親（DssModelDetailView）が +1 するキャッシュバスター（Finding I6）。
   *  persistOverview は model を Object.assign で直接ミューテートするため、model の参照自体は
   *  変わらず、下の useMemo（categoryPath/dimensionsLabel/priceLabel/updatedLabel）が
   *  再計算されない。deps に加えて明示的に無効化する。 */
  modelRevision?: number;
  /** 全画面表示（fullscreen state）が変わるたびに呼ぶ。DssModelDetailView 側で
   *  DetailCanvasHost の elevated（共有 Canvas の zIndex 引き上げ）に橋渡しする（Finding I2）。 */
  onFullscreenChange?: (v: boolean) => void;
}

const overlayButtonSx = {
  height: 28,
  display: 'flex',
  alignItems: 'center',
  gap: '5px',
  px: '10px',
  borderRadius: '8px',
  bgcolor: 'rgba(2,6,23,0.7)',
  border: '1px solid rgba(255,255,255,0.14)',
  fontSize: 11.5,
  fontWeight: 600,
  color: 'rgba(255,255,255,0.85)',
  textTransform: 'none' as const,
  minWidth: 0,
  '&:hover': { bgcolor: 'rgba(2,6,23,0.9)' },
};

const specRowSx = { display: 'flex', justifyContent: 'space-between', gap: 1 } as const;
const specLabelSx = { fontSize: 12, color: 'rgba(255,255,255,0.5)' } as const;
const specValueSx = { fontSize: 13, color: 'rgba(255,255,255,0.92)' } as const;

// ── 編集フォームの入力トークン（プラン デザイントークン表に準拠）──
const fieldLabelSx = { fontSize: '11.5px', color: 'rgba(255,255,255,0.5)' } as const;
const editTextFieldSx = {
  '& .MuiInputBase-root': {
    height: 32,
    fontSize: 12.5,
    borderRadius: '6px',
    background: 'rgba(15,23,42,0.6)',
    color: '#fff',
    border: '1px solid rgba(148,163,184,0.28)',
    paddingLeft: '10px',
    paddingRight: '10px',
  },
  '& .MuiInputBase-root:hover': { borderColor: 'rgba(148,163,184,0.45)' },
  '& .MuiInputBase-root.Mui-focused': { borderColor: '#3b82f6' },
  '& .MuiInputBase-input': { padding: 0 },
} as const;
const editSelectSx = {
  height: 32,
  fontSize: 12.5,
  borderRadius: '6px',
  background: 'rgba(15,23,42,0.6)',
  color: '#fff',
  '& .MuiSelect-select': { display: 'flex', alignItems: 'center', paddingTop: 0, paddingBottom: 0, height: '32px', boxSizing: 'border-box' },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.28)' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.45)' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#3b82f6' },
} as const;
const editSelectMenuProps = { PaperProps: { sx: { bgcolor: '#101623', border: '1px solid rgba(148,163,184,0.28)', color: '#fff' } } } as const;
const editChipSx = { height: 20, fontSize: '10.5px', bgcolor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)', '& .MuiChip-deleteIcon': { fontSize: 14, color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff' } } } as const;
const editTagChipSx = { height: 22, fontSize: 11, bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)', '& .MuiChip-deleteIcon': { fontSize: 14, color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff' } } } as const;

interface OverviewFormState {
  title: string;
  price: string;
  macroCategory: string;
  mainCategory: string;
  subCategory: string;
  visibility: 'public' | 'private';
  width: string;
  depth: string;
  height: string;
  /** SH（座面高、mm・任意）。チェア/ソファ系のときだけ入力欄を出す。 */
  seatHeight: string;
  materials: string[];
  tags: string[];
}

/**
 * 概要編集フォームの初期値。フィールド名・読み出し元は `DssRightPanel.tsx` の
 * `DssModelInfoPanel`（Model Info パネル）の `editData` 初期化ロジックを正としてそのまま踏襲する
 * （Task 9 の brief に明記の「Panel の実装が正」原則。Panel 本体は未変更）。
 */
function buildOverviewFormState(model: any): OverviewFormState {
  return {
    title: model?.title || model?.name || '',
    price: model?.price != null && model.price !== '' ? String(model.price) : '',
    macroCategory: model?.macroCategory || '',
    mainCategory: model?.mainCategory || '',
    // Panel と同じ優先順位: userCategory（レガシー/カスタムカテゴリ）→ subCategory。
    subCategory: model?.userCategory || model?.subCategory || '',
    visibility: model?.visibility === 'private' ? 'private' : 'public',
    width: model?.dimensions?.width != null ? String(model.dimensions.width) : '',
    depth: model?.dimensions?.depth != null ? String(model.dimensions.depth) : '',
    height: model?.dimensions?.height != null ? String(model.dimensions.height) : '',
    seatHeight: Number(model?.dimensions?.seatHeight) > 0 ? String(model.dimensions.seatHeight) : '',
    materials: Array.isArray(model?.materials) ? [...model.materials] : [],
    tags: Array.isArray(model?.tags) ? [...model.tags] : [],
  };
}

/**
 * S.Model 詳細画面「概要」セクション。デザイン 117-189 行（閲覧）/ 548-601 行（編集）に準拠。
 *
 * 編集フォームの書き込み先フィールドは `DssRightPanel.tsx` の `DssModelInfoPanel` が正
 * （`macroCategory`/`mainCategory`/`subCategory`(+レガシー `userCategory`)/`price`/`materials[]`/
 * `tags[]`/`visibility`/`dimensions{width,depth,height}`/`type`/`modelType`）。書き込み先の
 * 分岐（プロジェクト複製アイテムはプロジェクト資産が正、グローバル資産へはベストエフォート同期）
 * も Panel の `persistModelInfo` の `isProjectAsset` 分岐を踏襲する（Task 9 レビュー Finding 1/2 で
 * 追随）。Panel 本体は変更していない
 * ——保存関数相当をここに新設フォームとして再実装した。説明（description）だけは Panel には
 * 無いフィールドで、旧 `DssDetailStudio`（Task 8 で info-only に縮小・本タスクで撤去）が
 * 使っていた `extendedMetadata.info.description`（ウォークスルー設定の一部）を踏襲する
 * ——`infoState` 経由で DssModelDetailView の既存 1 秒デバウンス保存パスに乗せる。
 */
export const OverviewSection: React.FC<OverviewSectionProps> = ({
  model, mode, isAuthor, detailActions, usage, swapUrl, swapDims, captureRef, onOpenLink,
  infoState, onSaveThumbnail, thumbSaving, onOverviewSavingChange, onOverviewSaved,
  onOverviewSaveError, activeProjectId, modelRevision, onFullscreenChange,
}) => {
  const currentUser = useAuthStore((s: any) => s.currentUser);

  // ── バージョン選択（編集モードのみ）。旧バージョンを選ぶと、このビューアの表示だけを
  //     そのバージョンの GLB/サムネへ切り替える（Panel の RightPanelModelViewer と同じ考え方の
  //     簡易版。「WEBにUP」「バージョン削除」は Rhino 同期状態に依存する専用フローのため、
  //     この画面には持ち込まない ——「バージョン選択」だけが Task 9 brief の要求範囲）。
  const versionsObj = useMemo(() => model?.versions || {}, [model?.versions]);
  const latestVersionNum = model?.latestVersion || 1;
  const versionKeys = useMemo(() => Object.keys(versionsObj).map(Number).sort((a, b) => b - a), [versionsObj]);
  const [selectedVersionId, setSelectedVersionId] = useState<number>(latestVersionNum);
  useEffect(() => { setSelectedVersionId(latestVersionNum); }, [latestVersionNum, model?.id]);
  const versionOverride = mode === 'edit' && selectedVersionId !== latestVersionNum ? versionsObj[selectedVersionId] : null;

  const glbUrl = useMemo(() => getDownloadUrlForModel(model, 'glb'), [model]);
  const displayGlbUrl = versionOverride?.glbUrl || swapUrl || glbUrl;
  const placeholderUrl = versionOverride?.thumbnailUrl || model?.thumbnailUrl || model?.thumbnail || undefined;

  const liveDims = useDssLiveDimensionsStore((s) => s.liveDimensions[model.id]);

  const targetDimensions = useMemo(() => {
    // 置き換え候補を表示中は、その候補自身の寸法（登録されていれば）を優先する。
    // 未登録なら候補モデルの実寸のまま表示する（元モデルの寸法へ強制スケールしない）。
    const src = swapUrl ? swapDims : (liveDims || model.dimensions);
    if (!src) return null;
    const w = Number(src.width) || 0;
    const d = Number(src.depth) || 0;
    const h = Number(src.height) || 0;
    if (!w && !d && !h) return null;
    return { width: w, depth: d, height: h };
  }, [swapUrl, swapDims, liveDims, model.dimensions]);

  // ── ビューア: 寸法線 / 全画面 / ホイールズームのクリックゲート ──
  const [showDimensions, setShowDimensions] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [zoomEnabled, setZoomEnabled] = useState(false);
  useEffect(() => { setZoomEnabled(false); }, [displayGlbUrl]);

  // 全画面の開始/終了を親（DssModelDetailView）へ伝える（Finding I2）。親はこれを
  // DetailCanvasHost の elevated（共有 Canvas の zIndex 引き上げ）に橋渡しする。
  // アンマウント時に全画面のまま消えた場合に備え、cleanup で明示的に false を送る。
  useEffect(() => {
    onFullscreenChange?.(fullscreen);
    return () => { if (fullscreen) onFullscreenChange?.(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullscreen]);

  // ── ダウンロード ──
  const formats = useMemo(() => listDownloadFormats(model), [model]);
  const nonGlbFormats = useMemo(() => formats.filter((f) => f.ext !== 'glb'), [formats]);
  const [dlAnchor, setDlAnchor] = useState<HTMLElement | null>(null);
  const [dlBusy, setDlBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const runDownload = async (ext: string) => {
    setDlAnchor(null);
    setDlBusy(true);
    try {
      await downloadModelFile(model, ext);
      setMsg(`${ext.toUpperCase()} をダウンロードしました`);
    } catch (e: any) {
      console.error('[OverviewSection] download failed', e);
      setMsg(e?.message || 'ダウンロードに失敗しました');
    } finally {
      setDlBusy(false);
    }
  };
  const handleDownloadClick = (e: React.MouseEvent<HTMLElement>) => {
    if (formats.length === 0) return;
    if (formats.length === 1) { void runDownload(formats[0].ext); return; }
    setDlAnchor(e.currentTarget);
  };

  // ── いいね ──
  const { liked, favoriteCount, loading: likeLoading, toggling: likeBusy, toggleLike } = useModelLike({
    model,
    uid: currentUser?.uid ?? null,
  });
  const handleToggleLike = () => {
    if (likeBusy || likeLoading || !currentUser?.uid) return;
    void toggleLike();
  };

  // ── ⋯ メニュー ──
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null);

  // ── 作成者名の解決（旧 DssSpecSheet=Task 8 で撤去済み、と同じ優先順位） ──
  const modelOwnerId = model?.ownerId || model?.authorId;
  const isOwnerViewer = Boolean(currentUser && modelOwnerId && currentUser.uid === modelOwnerId);
  const cachedAuthor = model?.handle || model?.ownerName || model?.authorName;
  const [resolvedAuthor, setResolvedAuthor] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    if (!modelOwnerId || cachedAuthor) return;
    (async () => {
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('../../../../../lib/firebase/client');
        const snap = await getDoc(doc(db, 'users', modelOwnerId));
        if (mounted && snap.exists()) {
          const data = snap.data();
          if (data.displayName) setResolvedAuthor(data.displayName);
        }
      } catch {
        /* noop: 表示名が引けなくても既定文言にフォールバックする */
      }
    })();
    return () => { mounted = false; };
  }, [modelOwnerId, cachedAuthor]);
  const authorName = isOwnerViewer && currentUser?.displayName
    ? currentUser.displayName
    : (resolvedAuthor || cachedAuthor || 'SEKKEIYA Creator');

  const title = model?.title || model?.name || 'Untitled';

  // Finding I6: persistOverview は model を Object.assign で直接ミューテートする（参照は不変）ため、
  // 下の4つは deps に modelRevision（親が保存成功のたびに +1 するキャッシュバスター）を加えないと
  // 保存後も再計算されず古い値のまま表示され続ける。title/tags/description のような plain read
  // （useMemo を経由しない値）は毎レンダー読み直されるため既に最新値を表示できている——ここが
  // 「タイトルは更新されるのに寸法/カテゴリ/価格/更新日だけ古い」というズレの原因だった。
  const categoryPath = useMemo(() => {
    const sub = model?.userCategory || model?.subCategory;
    return [model?.macroCategory, model?.mainCategory, sub].filter((v: any) => v && String(v).trim()).join(' / ');
    // modelRevision は本体から読まないが、Object.assign 直後のキャッシュ無効化に使う意図的な依存
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, modelRevision]);

  const updatedLabel = useMemo(() => {
    const raw = model?.updatedAt || model?.createdAt;
    if (!raw) return null;
    try {
      const d = raw?.toDate ? raw.toDate() : new Date(raw);
      if (Number.isNaN(d.getTime())) return null;
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, modelRevision]);

  const dimensionsLabel = useMemo(() => {
    const d = model?.dimensions;
    if (!d) return null;
    const w = Number(d.width) || 0, dp = Number(d.depth) || 0, h = Number(d.height) || 0;
    if (!w && !dp && !h) return null;
    return `W ${w} × D ${dp} × H ${h} mm`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, modelRevision]);

  const seatHeightLabel = useMemo(() => {
    const sh = Number(model?.dimensions?.seatHeight) || 0;
    return sh > 0 ? `SH ${sh.toLocaleString()} mm` : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, modelRevision]);

  const priceLabel = useMemo(() => {
    const p = model?.price;
    if (p == null || p === '' || Number(p) === 0) return null;
    const n = Number(p);
    return Number.isFinite(n) ? `¥${n.toLocaleString('ja-JP')}` : String(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, modelRevision]);

  const materials: string[] = Array.isArray(model?.materials) ? model.materials : [];
  const tags: string[] = Array.isArray(model?.tags) ? model.tags : [];
  const description: string = model?.extendedMetadata?.info?.description || '';

  const fileLabel = useMemo(() => {
    const parts = formats.map((f) => [f.ext.toUpperCase(), f.sizeLabel].filter(Boolean).join(' '));
    return parts.length > 0 ? parts.join(' ・ ') : null;
  }, [formats]);

  const usageObj = typeof usage === 'object' && usage !== null ? usage : null;
  const usageTotal = typeof usage === 'number' ? usage : (usageObj?.totalCount ?? 0);
  const usageLayoutCount = usageObj?.locations?.length || (usageTotal > 0 ? 1 : 0);

  // ── 編集フォーム本体 ──────────────────────────────────────────────
  const [formState, setFormState] = useState<OverviewFormState>(() => buildOverviewFormState(model));
  const [formDirty, setFormDirty] = useState(false);
  const [formSaving, setFormSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [materialInput, setMaterialInput] = useState('');
  const [tagInput, setTagInput] = useState('');

  // ── アンマウント時のフラッシュ用（Finding 3）。デバウンス中に画面遷移されると、直近の
  //     編集がそのまま失われる（自動保存の表記に反する）。unmount 時の cleanup は effect が
  //     登録された時点のクロージャしか見えないため、毎レンダーで ref を更新して最新値を渡す。
  //     savingInFlightRef は React state ではなく素の bool にしているのは、setState の反映が
  //     非同期なせいで「保存が始まった直後」にフラッシュ effect が二重に発火する窓を作らないため
  //     （persistOverview の最初の同期行で true にする＝React の再レンダーを待たない）。
  const formStateRef = useRef(formState);
  formStateRef.current = formState;
  const formDirtyRef = useRef(formDirty);
  formDirtyRef.current = formDirty;
  const savingInFlightRef = useRef(false);
  const isAuthorRef = useRef(isAuthor);
  isAuthorRef.current = isAuthor;

  const updateField = <K extends keyof OverviewFormState>(key: K, value: OverviewFormState[K]) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
    setFormDirty(true);
  };
  const setMacroCategory = (v: string) => {
    setFormState((prev) => ({ ...prev, macroCategory: v, mainCategory: '', subCategory: '' }));
    setFormDirty(true);
  };
  const setMainCategory = (v: string) => {
    setFormState((prev) => ({ ...prev, mainCategory: v, subCategory: '' }));
    setFormDirty(true);
  };

  // ── 編集中の寸法をビューアへ即時反映（DssRightPanel の setLiveDimensions と同じ仕組み）。
  //     これが無いと、保存は model のミューテートだけで再レンダーが起きないため、
  //     寸法を書き換えてもビューアの寸法線・スケールが古いままになる。
  const setLiveDimensions = useDssLiveDimensionsStore((s) => s.setLiveDimensions);
  useEffect(() => {
    if (mode !== 'edit' || !model?.id) return;
    setLiveDimensions(model.id, {
      width: Number(formState.width) || 0,
      depth: Number(formState.depth) || 0,
      height: Number(formState.height) || 0,
    });
  }, [mode, model?.id, formState.width, formState.depth, formState.height, setLiveDimensions]);

  // 幅と奥行の数値を入れ替える。AI の自動入力が W と D を取り違えて保存するケースが多く、
  // 手で打ち直すより1クリックで直せるほうが速い。保存は通常のフォームと同じ自動保存に乗せる。
  const swapWidthDepth = () => {
    setFormState((prev) => ({ ...prev, width: prev.depth, depth: prev.width }));
    setFormDirty(true);
  };

  // SH（座面高）はチェア/ソファ系のカテゴリのときだけ入力欄を出す。
  const isSeatCategory = /チェア|ソファ|椅子/.test(`${formState.mainCategory} ${formState.subCategory}`);

  const addMaterial = () => {
    const v = materialInput.trim();
    if (!v) return;
    if (!formState.materials.includes(v)) updateField('materials', [...formState.materials, v]);
    setMaterialInput('');
  };
  const removeMaterial = (v: string) => updateField('materials', formState.materials.filter((m) => m !== v));
  const addTag = () => {
    const v = tagInput.trim();
    if (!v) return;
    if (!formState.tags.includes(v)) updateField('tags', [...formState.tags, v]);
    setTagInput('');
  };
  const removeTag = (v: string) => updateField('tags', formState.tags.filter((t) => t !== v));

  const persistOverview = async (data: OverviewFormState) => {
    const canonicalId = getCanonicalModelId(model) || model?.id;
    if (!canonicalId) return;
    savingInFlightRef.current = true; // 同期的に立てる（setState の反映待ちだとフラッシュ effect と競合しうる）
    setFormSaving(true);
    onOverviewSavingChange?.(true);
    try {
      // タグへの家具区分の同期は DssModelInfoPanel の persistModelInfo と同じロジック
      // （同じ macroCategory 選択肢を使うため、挙動を分岐させないための踏襲）。
      let updatedTags = [...data.tags];
      if (data.macroCategory === '家具 (造作)') {
        if (!updatedTags.includes('造作家具')) updatedTags.push('造作家具');
        updatedTags = updatedTags.filter((t) => t !== '既製品家具');
      } else if (data.macroCategory === '家具 (既製品)') {
        if (!updatedTags.includes('既製品家具')) updatedTags.push('既製品家具');
        updatedTags = updatedTags.filter((t) => t !== '造作家具');
      } else {
        updatedTags = updatedTags.filter((t) => t !== '既製品家具' && t !== '造作家具');
      }

      // type/modelType の導出も Panel と同じ（DssRightPanel.tsx:687-693）。ここが抜けていると
      // S.Layout の Library タブが modelType でフィルタしているため、大分類を
      // 家具⇄建築・空間で変更してもフィルタ結果が古いままになる（Finding 2）。
      const inferredModelType = data.macroCategory === '建築・空間' ? 'Architecture' : 'Furniture';

      const payload = {
        title: data.title,
        name: data.title, // Panel と同じく name も同期しておく
        type: '3d-model', // Panel と同じ: assets クエリに載るために必須
        modelType: inferredModelType,
        macroCategory: data.macroCategory,
        mainCategory: data.mainCategory,
        subCategory: data.subCategory,
        // このフォームで小分類を選び直したら、レガシーの userCategory 優先読み込みで
        // 上書きされないよう明示的にクリアする。Panel の persistModelInfo も
        // saveUserCategory を既定 null で初期化し、カスタムカテゴリ選択時だけ上書きする
        // ——つまり通常の保存では Panel も userCategory を null にクリアしている
        // （DssRightPanel.tsx:676-684）。ここでは常に null（このフォームはカスタムカテゴリの
        // 新規作成に非対応）で、Panel の通常ケースと同じ挙動。
        userCategory: null,
        tags: updatedTags,
        materials: data.materials,
        dimensions: {
          ...(model.dimensions || {}),
          width: Number(data.width) || 0,
          depth: Number(data.depth) || 0,
          height: Number(data.height) || 0,
          seatHeight: Number(data.seatHeight) || 0,
        },
        price: Number(data.price) || 0,
        visibility: data.visibility,
      };

      // プロジェクトへ複製されたアイテム（コピー）かどうかで書き込み先を切り替える（Panel の
      // persistModelInfo の isProjectAsset 分岐を踏襲、DssRightPanel.tsx:724）。true の場合、
      // 書き込むべき正はプロジェクト資産ドキュメントであり、グローバル資産（コピー元）は
      // ユーザーが所有者とは限らない＝Firestore rules に拒否されうる。以前はグローバル資産だけに
      // 書いていたため、プロジェクト複製アイテムの編集はプロジェクト側に一切反映されず、かつ
      // 非所有のグローバル資産では書き込みそのものが rules に拒否されて編集が丸ごと消えていた
      // （Finding 1）。この分岐ロジックは他の保存経路（ウォークスルー設定/サムネイル/実在商品の
      // 削除）でも無条件書き込みという同じ穴があったため、`persistAssetPatch` へ切り出して
      // 共通化した（Finding I5）。
      const { persistAssetPatch } = await import('../../../utils/persistAssetPatch');
      await persistAssetPatch(model, activeProjectId, payload);

      // 画面上のモデルにも即時反映する（handleSaveViewAsThumbnail と同じ「in-memory refs を直接
      // 更新する」考え方）。参照ごと更新されるわけではないため、view モードは同じ model オブジェクト
      // を読み続ける限り再フェッチ無しで新しい値を表示できる。
      Object.assign(model, payload);

      // サーバー側で家具区分タグを注入/除去したので、フォームのチップ表示もその結果に合わせて
      // 再同期する（そうしないと保存直後は入力時点のタグのままで、実際の保存内容とズレる）。
      setFormState((prev) => ({ ...prev, tags: updatedTags }));

      setSaveError(null);
      onOverviewSaveError?.(null);
      onOverviewSaved?.();
    } catch (e) {
      console.error('[OverviewSection] overview save failed', e);
      const message = '保存に失敗しました';
      setSaveError(message);
      onOverviewSaveError?.(message);
    } finally {
      setFormSaving(false);
      setFormDirty(false);
      onOverviewSavingChange?.(false);
      savingInFlightRef.current = false;
    }
  };

  // 1秒デバウンス。`formState` は編集のたびに新しいオブジェクトになるため、
  // このエフェクトはキーストロークごとに再スケジュール（＝最後の入力から1秒後に保存）される
  // ——`dirty` という真偽値フラグだけを deps にすると「true→true」の再セットは
  // React の state 更新に見なされず（Object.is で同値バイル）、タイマーが最初の1回しか
  // リセットされない（＝入力途中の値で保存されてしまう）。実際、既存のウォークスルー設定の
  // 自動保存（DssModelDetailView の walkthroughDirty エフェクト）はこの形の依存配列を使っており、
  // その落とし穴を踏んでいる。ここでは同じ罠を避けるため `formState` 自体を deps に含めている。
  //
  // タイマー id を ref に持たせておく（Finding I3）: mode が edit→view へ切り替わったときに、
  // 下の「mode 遷移フラッシュ」effect からこのタイマーを明示的に止めて即時保存へ差し替えるため。
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!formDirty || mode !== 'edit' || !isAuthor) return;
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      void persistOverview(formState);
    }, 1000);
    return () => {
      if (debounceTimerRef.current) { clearTimeout(debounceTimerRef.current); debounceTimerRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formState, formDirty]);

  // mode が edit→view へ切り替わった瞬間の即時フラッシュ（Finding I3）。
  // 「編集モード中 — 終了」をデバウンス中（<1秒）に押すと、mode は変わるが formState/formDirty は
  // 変わらないため上のデバウンス effect は再実行されず、保留中のタイマーがそのまま残る。
  // そこへ追い打ちで「戻る」等の真の unmount が起きると、unmount フラッシュの mode ガードが
  // 既に 'view' になっていて弾かれ、かつこのタイマー自身は unmount 時の cleanup でキャンセル
  // されるため、直近の編集が保存されずに消える——というのが実際の再現手順。mode 遷移そのものを
  // トリガに即時保存してしまえば、後続で何が起きても既に保存済みになる。
  const prevModeForFlushRef = useRef(mode);
  useEffect(() => {
    if (prevModeForFlushRef.current === 'edit' && mode !== 'edit') {
      if (debounceTimerRef.current) { clearTimeout(debounceTimerRef.current); debounceTimerRef.current = null; }
      if (formDirtyRef.current && !savingInFlightRef.current && isAuthorRef.current) {
        void persistOverview(formStateRef.current);
      }
    }
    prevModeForFlushRef.current = mode;
    // persistOverview はレンダーのたびに新しい関数になるため、deps に含めると mode 以外の
    // 変化でも毎回発火してしまう（実行タイミングは ref 経由の最新値を読むので問題ない）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // アンマウント時のフラッシュ（Finding 3、I3 で mode ガードを撤去）。上のデバウンス effect の
  // cleanup は「毎回の再スケジュール」用（deps 変化のたびに走る）であり、アンマウント専用の合図
  // ではないため、ここは deps を空にした別 effect にして「本当にコンポーネントが消えるとき」だけ
  // 拾う。クロージャは初回レンダー時点のもので固まるため、中身は ref 経由で常に最新値を読む。
  //
  // 元は `modeRef.current === 'edit'` も条件にしていたが、formDirty は edit モードの UI 操作
  // （updateField/addTag/addMaterial 等）でしか true にならないため、フラッシュ時点で mode が
  // 既に 'view' に切り替わっていても「編集で入った未保存の変更」であることに変わりはない。
  // このガードが原因で、上の「mode 遷移フラッシュ」より前に mode が view へ変わった状態のまま
  // 実際に unmount された場合（例: 終了直後にすぐ別モデルへナビゲート等）に保存が握りつぶされて
  // いた（Finding I3）。isAuthor のガードのみ残す。
  useEffect(() => {
    return () => {
      if (formDirtyRef.current && !savingInFlightRef.current && isAuthorRef.current) {
        void persistOverview(formStateRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── カテゴリ選択肢（DssModelInfoPanel と同じ非リアクティブな .getState() 参照） ──
  const categoryMap = useUserSettingsStore.getState().getMergedCategoryMap();
  const macroOptions = useMemo(
    () => MACRO_CATEGORY_ORDER.filter((c) => Object.keys(categoryMap).includes(c)),
    [categoryMap]
  );
  const mainOptions = formState.macroCategory && categoryMap[formState.macroCategory]
    ? Object.keys(categoryMap[formState.macroCategory])
    : [];
  const subOptions = formState.macroCategory && formState.mainCategory
    ? (categoryMap[formState.macroCategory]?.[formState.mainCategory] || [])
    : [];

  // ── ローカルモデルのクラウド保存（Local Models のみ。DssModelInfoPanel と同じストア/ダイアログ） ──
  const uploadRecords = useLocalUploadStore((s) => s.records);
  const uploadingMap = useLocalUploadStore((s) => s.uploading);
  const uploadLocalModel = useLocalUploadStore((s) => s.upload);
  const revertLocalModel = useLocalUploadStore((s) => s.revertToLocal);
  const refreshUploadRecords = useLocalUploadStore((s) => s.refresh);
  useEffect(() => { if (model?.isLocal) refreshUploadRecords(); }, [model?.isLocal, refreshUploadRecords]);
  const localUploadRec = model?.isLocal && model?.localPath
    ? uploadRecords[String(model.localPath).toLowerCase()] || null
    : null;
  const localUploading = model?.localPath ? !!uploadingMap[String(model.localPath).toLowerCase()] : false;
  const [cloudDialogOpen, setCloudDialogOpen] = useState(false);

  return (
    <Box sx={{ display: 'flex', gap: '24px', padding: mode === 'edit' ? '22px 28px' : '24px 28px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      {/* 左カラム：ビューア＋アクション行 */}
      <Box sx={{ width: mode === 'edit' ? 440 : undefined, flex: mode === 'edit' ? 'none' : 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Finding I2: このラッパー自体は「レイアウト上の場所」を確保するだけの非昇格
            （zIndex を持たない）コンテナ。実際の背景色/ビューアと、寸法/全画面ボタン等の
            オーバーレイは、下で意図的に「別要素」に分離している——同じ Box の子のままだと、
            全画面時に共有 Canvas を隠さないための z-index 昇格（下記）が、背景と一緒に
            ボタンまで巻き込んでしまう（stacking context の親子関係の落とし穴、詳しくは
            DetailCanvasHost.tsx の elevated prop コメント参照）。 */}
        <Box sx={{ position: 'relative', width: fullscreen ? '100vw' : '100%', height: fullscreen ? '100vh' : (mode === 'edit' ? 300 : 420) }}>
          {/* 背景＋3Dトラッキング面。通常時は zIndex 無し（共有 Canvas と同じ「昇格されていない」
              層に属し、DOM順で Canvas より後ろ＝下に塗られる）。全画面時は zIndex:1300 に昇格
              しつつ、共有 Canvas 側も DssModelDetailView が elevated=true で 1301 まで
              昇格させるため、Canvas の実際の描画（3Dモデル）は不透明な背景色より前面に出て見える。 */}
          <Box
            onPointerDown={() => setZoomEnabled(true)}
            sx={{
              position: fullscreen ? 'fixed' : 'absolute',
              inset: 0,
              zIndex: fullscreen ? 1300 : undefined,
              borderRadius: fullscreen ? 0 : '12px',
              overflow: 'hidden',
              background: '#080b11',
              border: fullscreen ? 'none' : '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <ErrorBoundary>
              <DetailViewport
                glbUrl={displayGlbUrl}
                placeholderUrl={placeholderUrl}
                height="100%"
                targetDimensions={targetDimensions}
                showDimensions={showDimensions}
                enableZoom={zoomEnabled}
                captureRef={captureRef}
              />
            </ErrorBoundary>
          </Box>

          {/* オーバーレイ操作（寸法/全画面）。上の背景 Box とは別要素にして、共有 Canvas
              （通常時 zIndex:0）より確実に前面へ出す。全画面時は Canvas の elevated（1301）
              よりさらに上（1302）にする。 */}
          <Box sx={{
            position: fullscreen ? 'fixed' : 'absolute',
            top: 12, right: 12,
            zIndex: fullscreen ? 1302 : 2,
            display: 'flex', gap: '6px',
          }}>
            <Button
              size="small"
              onClick={() => setShowDimensions((v) => !v)}
              startIcon={<StraightenRoundedIcon sx={{ fontSize: 16 }} />}
              sx={{ ...overlayButtonSx, ...(showDimensions ? { color: '#93c5fd', borderColor: 'rgba(96,165,250,0.6)' } : null) }}
            >
              寸法
            </Button>
            {/* 幅と奥行の数値を入れ替える。ビューア内のラベルではなくこのバーに置くのは、
                共有 Canvas + <View> 構成では drei <Html> のクリック判定が通らないため
                （このバーの他ボタンと同じ、確実に押せる通常の DOM ボタン）。 */}
            {mode === 'edit' && isAuthor && !swapUrl && (
              <Tooltip title="幅(W)と奥行(D)の数値を入れ替えます" arrow>
                <Button
                  size="small"
                  onClick={swapWidthDepth}
                  startIcon={<SwapHorizRoundedIcon sx={{ fontSize: 16 }} />}
                  sx={overlayButtonSx}
                >
                  W⇄D
                </Button>
              </Tooltip>
            )}
            <Button
              size="small"
              onClick={() => setFullscreen((v) => !v)}
              startIcon={fullscreen ? <CloseRoundedIcon sx={{ fontSize: 16 }} /> : <OpenInFullRoundedIcon sx={{ fontSize: 16 }} />}
              sx={overlayButtonSx}
            >
              {fullscreen ? '閉じる' : '全画面'}
            </Button>
          </Box>

          {!zoomEnabled && displayGlbUrl && (
            <Box sx={{
              position: fullscreen ? 'fixed' : 'absolute',
              bottom: 8, left: '50%', transform: 'translateX(-50%)',
              zIndex: fullscreen ? 1302 : 2,
              px: 1.25, py: 0.4, borderRadius: 999, pointerEvents: 'none',
              bgcolor: 'rgba(0,0,0,0.5)', color: 'rgba(255,255,255,0.75)',
              fontSize: 10.5, whiteSpace: 'nowrap',
            }}>
              クリックすると拡大縮小できます
            </Box>
          )}
        </Box>

        {mode === 'edit' && isAuthor && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'ui-monospace, Menlo, monospace' }}>
              この向きをサムネイルに保存できる
            </Typography>
            <Button
              size="small"
              onClick={onSaveThumbnail}
              disabled={!onSaveThumbnail || thumbSaving}
              startIcon={thumbSaving ? <CircularProgress size={13} sx={{ color: '#93c5fd' }} /> : <CameraAltRoundedIcon sx={{ fontSize: 15 }} />}
              sx={{
                height: 28, borderRadius: '8px', textTransform: 'none', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
                color: '#93c5fd', border: '1px solid rgba(96,165,250,0.5)',
                '&:hover': { borderColor: 'rgba(96,165,250,0.9)', bgcolor: 'rgba(96,165,250,0.12)' },
              }}
            >
              この表示をサムネイルにする
            </Button>
          </Box>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-start' }}>
          <Tooltip title={formats.length === 0 ? 'ダウンロードできるファイルがありません' : 'モデルファイルをダウンロード'} arrow>
            <span style={{ flexShrink: 0 }}>
              <Button
                variant="contained"
                disabled={formats.length === 0 || dlBusy}
                onClick={handleDownloadClick}
                endIcon={dlBusy ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : (formats.length > 1 ? <ExpandMoreIcon /> : undefined)}
                sx={{
                  height: 38, bgcolor: '#3b82f6', color: '#fff', textTransform: 'none',
                  fontSize: 13, fontWeight: 700, px: 2.5,
                  '&:hover': { bgcolor: '#2563eb' },
                  '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' },
                }}
              >
                Download
              </Button>
            </span>
          </Tooltip>
          <Menu anchorEl={dlAnchor} open={!!dlAnchor} onClose={() => setDlAnchor(null)}>
            {formats.map((f) => (
              <MenuItem key={f.ext} onClick={() => void runDownload(f.ext)}>
                <ListItemText primary={f.label} secondary={f.sizeLabel || undefined} />
              </MenuItem>
            ))}
          </Menu>

          <Tooltip title={currentUser ? (liked ? 'いいねを外す' : 'いいね') : 'ログインすると押せます'} arrow>
            <span>
              <Button
                size="small"
                variant="outlined"
                disabled={!currentUser || likeBusy || likeLoading}
                onClick={handleToggleLike}
                startIcon={liked ? <FavoriteRoundedIcon sx={{ fontSize: 17 }} /> : <FavoriteBorderRoundedIcon sx={{ fontSize: 17 }} />}
                sx={{
                  height: 38, textTransform: 'none', fontSize: 12.5, fontWeight: 600, px: 1.75,
                  color: liked ? '#f97316' : 'rgba(255,255,255,0.9)', borderColor: 'rgba(255,255,255,0.14)',
                  '&:hover': { borderColor: 'rgba(255,255,255,0.3)' },
                }}
              >
                {favoriteCount}
              </Button>
            </span>
          </Tooltip>

          {detailActions && (
            <Button
              size="small"
              variant="outlined"
              onClick={detailActions.onSave}
              startIcon={<BookmarkAddRoundedIcon sx={{ fontSize: 17 }} />}
              sx={{ height: 38, textTransform: 'none', fontSize: 12.5, fontWeight: 600, px: 1.75, color: 'rgba(255,255,255,0.9)', borderColor: 'rgba(255,255,255,0.14)', '&:hover': { borderColor: 'rgba(255,255,255,0.3)' } }}
            >
              プロジェクトに保存
            </Button>
          )}

          <IconButton
            size="small"
            onClick={(e) => setMoreAnchor(e.currentTarget)}
            sx={{ width: 38, height: 38, borderRadius: '8px', border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.85)' }}
          >
            <MoreHorizRoundedIcon sx={{ fontSize: 20 }} />
          </IconButton>
          <Menu anchorEl={moreAnchor} open={!!moreAnchor} onClose={() => setMoreAnchor(null)}>
            {detailActions && [
              <MenuItem key="rhino" disabled={!detailActions.canRhino || detailActions.dccBusy !== null} onClick={() => { setMoreAnchor(null); detailActions.onRhino(); }}>
                <AutoAwesomeMotionRoundedIcon sx={{ fontSize: 18, mr: 1.25 }} /> Rhino へ配置
              </MenuItem>,
              <MenuItem key="blender" disabled={!detailActions.canBlender || detailActions.dccBusy !== null} onClick={() => { setMoreAnchor(null); detailActions.onBlender(); }}>
                <ThreeDRotationRoundedIcon sx={{ fontSize: 18, mr: 1.25 }} /> Blender へ配置
              </MenuItem>,
              <MenuItem key="share" onClick={() => { setMoreAnchor(null); detailActions.onShare(); }}>
                <ShareRoundedIcon sx={{ fontSize: 18, mr: 1.25 }} /> 共有
              </MenuItem>,
            ]}
            {nonGlbFormats.length > 0 && [
              <Divider key="fmt-divider" />,
              <MenuItem key="fmt-label" disabled sx={{ opacity: '0.6 !important', fontSize: 11 }}>GLB 以外の形式</MenuItem>,
              ...nonGlbFormats.map((f) => (
                <MenuItem key={f.ext} onClick={() => void runDownload(f.ext)}>
                  <ListItemText primary={f.label} secondary={f.sizeLabel || undefined} sx={{ pl: 1.5 }} />
                </MenuItem>
              )),
            ]}
            {detailActions?.canDelete && [
              <Divider key="del-divider" />,
              <MenuItem key="delete" onClick={() => { setMoreAnchor(null); detailActions.onDelete(); }} sx={{ color: '#f97316' }}>
                <DeleteOutlineRoundedIcon sx={{ fontSize: 18, mr: 1.25 }} /> 削除
              </MenuItem>,
            ]}
          </Menu>
        </Box>
      </Box>

      {/* 右カラム：閲覧＝スペック / 編集＝フォーム */}
      {mode === 'edit' ? (
        !isAuthor ? (
          <Box sx={{ width: 340, flex: 'none' }}>
            <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>作成者のみ編集できます。</Typography>
          </Box>
        ) : (
          <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', color: '#93c5fd', fontFamily: 'ui-monospace, Menlo, monospace' }}>
              概要 — 編集可
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: '76px 1fr 76px 1fr', gap: '8px 10px', alignItems: 'center' }}>
              <Typography sx={fieldLabelSx}>タイトル</Typography>
              <TextField
                sx={{ ...editTextFieldSx, gridColumn: 'span 3' }}
                value={formState.title}
                onChange={(e) => updateField('title', e.target.value)}
              />

              <Typography sx={fieldLabelSx}>価格</Typography>
              <TextField sx={editTextFieldSx} placeholder="価格" value={formState.price} onChange={(e) => updateField('price', e.target.value)} />

              <Typography sx={fieldLabelSx}>大分類</Typography>
              <Select
                displayEmpty
                size="small"
                sx={editSelectSx}
                MenuProps={editSelectMenuProps}
                IconComponent={ExpandMoreIcon}
                value={formState.macroCategory}
                onChange={(e) => setMacroCategory(e.target.value as string)}
              >
                <MenuItem value=""><em style={{ opacity: 0.6 }}>未選択</em></MenuItem>
                {macroOptions.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>

              <Typography sx={fieldLabelSx}>中分類</Typography>
              <Select
                displayEmpty
                size="small"
                disabled={!formState.macroCategory}
                sx={editSelectSx}
                MenuProps={editSelectMenuProps}
                IconComponent={ExpandMoreIcon}
                value={formState.mainCategory}
                onChange={(e) => setMainCategory(e.target.value as string)}
              >
                <MenuItem value=""><em style={{ opacity: 0.6 }}>未選択</em></MenuItem>
                {mainOptions.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>

              <Typography sx={fieldLabelSx}>小分類</Typography>
              <Select
                displayEmpty
                size="small"
                disabled={!formState.mainCategory}
                sx={editSelectSx}
                MenuProps={editSelectMenuProps}
                IconComponent={ExpandMoreIcon}
                value={formState.subCategory}
                onChange={(e) => updateField('subCategory', e.target.value as string)}
              >
                <MenuItem value=""><em style={{ opacity: 0.6 }}>未選択</em></MenuItem>
                {subOptions.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>

              <Typography sx={fieldLabelSx}>公開設定</Typography>
              <Select
                size="small"
                sx={editSelectSx}
                MenuProps={editSelectMenuProps}
                IconComponent={ExpandMoreIcon}
                value={formState.visibility}
                onChange={(e) => updateField('visibility', e.target.value as 'public' | 'private')}
              >
                <MenuItem value="public">公開</MenuItem>
                <MenuItem value="private">非公開</MenuItem>
              </Select>

              <Typography sx={fieldLabelSx}>寸法 mm</Typography>
              <Box sx={{ display: 'flex', gap: '6px' }}>
                {([['width', 'W 幅'], ['depth', 'D 奥行'], ['height', 'H 高さ']] as const).map(([key, label]) => (
                  <Box key={key} sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 10, color: 'rgba(148,163,184,0.85)', mb: '2px' }}>{label}</Typography>
                    <TextField sx={{ ...editTextFieldSx, width: '100%' }} placeholder="0" value={formState[key]} onChange={(e) => updateField(key, e.target.value)} />
                  </Box>
                ))}
                {isSeatCategory && (
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 10, color: 'rgba(148,163,184,0.85)', mb: '2px' }}>SH 座面高</Typography>
                    <TextField sx={{ ...editTextFieldSx, width: '100%' }} placeholder="任意" value={formState.seatHeight} onChange={(e) => updateField('seatHeight', e.target.value)} />
                  </Box>
                )}
              </Box>

              <Typography sx={fieldLabelSx}>素材</Typography>
              <Box sx={{ minHeight: 32, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '5px', padding: '4px 8px', borderRadius: '6px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.28)' }}>
                {formState.materials.map((m) => (
                  <Chip key={m} label={m} size="small" onDelete={() => removeMaterial(m)} sx={editChipSx} />
                ))}
                <Box
                  component="input"
                  value={materialInput}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMaterialInput(e.target.value)}
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') { e.preventDefault(); addMaterial(); } }}
                  onBlur={addMaterial}
                  placeholder="+ 追加"
                  sx={{
                    flex: '1 1 60px', minWidth: 60, border: 'none', outline: 'none', background: 'transparent',
                    color: '#fff', fontSize: '11px', '::placeholder': { color: 'rgba(255,255,255,0.35)' },
                  }}
                />
              </Box>
            </Box>

            {/* 説明・参考リンク。旧 DssDetailStudio（section="info"）が持っていた編集 UI をここへ吸収した。
                書き込み先（extendedMetadata.info）・保存経路（1秒デバウンス）は変更していない。 */}
            <Box sx={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <Typography sx={{ ...fieldLabelSx, width: 76, flexShrink: 0, pt: '8px' }}>説明</Typography>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                {infoState ? (
                  <WalkthroughMetadataEditor
                    glbUrl={null}
                    macroCategory={formState.macroCategory}
                    info={infoState.info}
                    infoOnly
                    onChange={({ info }) => { infoState.setInfo(info); infoState.setDirty(true); }}
                  />
                ) : (
                  <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>説明の編集を読み込めませんでした。</Typography>
                )}
              </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <Typography sx={{ ...fieldLabelSx, width: 76, flexShrink: 0 }}>タグ</Typography>
              <Box sx={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: '5px', alignItems: 'center' }}>
                {formState.tags.map((t) => (
                  <Chip key={t} label={t} size="small" onDelete={() => removeTag(t)} sx={editTagChipSx} />
                ))}
                <Box
                  component="input"
                  value={tagInput}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTagInput(e.target.value)}
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                  onBlur={addTag}
                  placeholder="+ タグ (Enter)"
                  sx={{
                    flex: '1 1 90px', minWidth: 90, border: 'none', outline: 'none', background: 'transparent',
                    color: '#fff', fontSize: '11px', '::placeholder': { color: 'rgba(255,255,255,0.35)' },
                  }}
                />
              </Box>
            </Box>

            {(formSaving || infoState?.saving) && (
              <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>保存中…</Typography>
            )}
            {saveError && !formSaving && (
              <Typography sx={{ fontSize: 11, color: '#f87171' }}>{saveError}</Typography>
            )}

            {/* バージョン選択（複数バージョンがある場合のみ） */}
            {versionKeys.length > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px', pt: '4px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <Typography sx={{ ...fieldLabelSx, width: 76, flexShrink: 0 }}>バージョン</Typography>
                <Select
                  size="small"
                  sx={{ ...editSelectSx, minWidth: 140 }}
                  MenuProps={editSelectMenuProps}
                  IconComponent={ExpandMoreIcon}
                  value={selectedVersionId}
                  onChange={(e) => setSelectedVersionId(Number(e.target.value))}
                  renderValue={(v) => `v${v} ${v === latestVersionNum ? '(最新版)' : ''}`}
                >
                  {versionKeys.map((v) => (
                    <MenuItem key={v} value={v}>v{v} {v === latestVersionNum ? '(最新版)' : ''}</MenuItem>
                  ))}
                </Select>
                <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)' }}>選ぶとビューアの表示だけ切り替わります</Typography>
              </Box>
            )}

            {/* ローカルモデルのクラウド保存（Local Models のみ） */}
            {model?.isLocal && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px', pt: '4px', borderTop: versionKeys.length > 0 ? undefined : '1px solid rgba(255,255,255,0.08)' }}>
                <Typography sx={{ ...fieldLabelSx, width: 76, flexShrink: 0 }}>クラウド保存</Typography>
                {localUploadRec ? (
                  <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {localUploadRec.visibility === 'private'
                      ? <LockRoundedIcon sx={{ fontSize: 15, color: '#fb923c' }} />
                      : <PublicRoundedIcon sx={{ fontSize: 15, color: '#a78bfa' }} />}
                    <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.8)' }}>
                      保存済み・{localUploadRec.visibility === 'private' ? '非公開' : '公開'}
                    </Typography>
                    <Button size="small" onClick={() => setCloudDialogOpen(true)} disabled={localUploading} sx={{ fontSize: 10.5, textTransform: 'none', color: '#93c5fd', minWidth: 0 }}>
                      設定変更
                    </Button>
                    <Button
                      size="small"
                      disabled={localUploading}
                      onClick={() => { if (window.confirm('クラウドのデータを削除してローカルのみに戻します。よろしいですか？')) revertLocalModel(model); }}
                      sx={{ fontSize: 10.5, textTransform: 'none', color: '#ff6b6b', minWidth: 0 }}
                    >
                      {localUploading ? <CircularProgress size={12} sx={{ color: '#ff6b6b' }} /> : 'ローカルに戻す'}
                    </Button>
                  </Box>
                ) : (
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={localUploading}
                    onClick={() => setCloudDialogOpen(true)}
                    startIcon={localUploading ? <CircularProgress size={13} sx={{ color: '#93c5fd' }} /> : <CloudUploadRoundedIcon sx={{ fontSize: 15 }} />}
                    sx={{ height: 28, borderRadius: '8px', textTransform: 'none', fontSize: 11, fontWeight: 600, color: '#93c5fd', borderColor: 'rgba(96,165,250,0.5)' }}
                  >
                    クラウドへ保存
                  </Button>
                )}
                <LocalCloudUploadDialog
                  open={cloudDialogOpen}
                  model={model}
                  uploading={localUploading}
                  onClose={() => setCloudDialogOpen(false)}
                  onConfirm={async (meta, visibility) => {
                    try {
                      await uploadLocalModel(model, visibility, meta);
                      setCloudDialogOpen(false);
                    } catch { /* エラーはストア側で通知 */ }
                  }}
                />
              </Box>
            )}

            {detailActions && (
              <Button
                size="small"
                onClick={detailActions.onAutoFill}
                startIcon={<AutoAwesomeRoundedIcon sx={{ fontSize: 15 }} />}
                sx={{
                  alignSelf: 'flex-start', height: 30, borderRadius: '8px', textTransform: 'none', fontSize: 11.5, fontWeight: 600,
                  color: '#93c5fd', border: '1px solid rgba(96,165,250,0.5)',
                  '&:hover': { borderColor: 'rgba(96,165,250,0.9)', bgcolor: 'rgba(96,165,250,0.12)' },
                }}
              >
                AI で項目を補完
              </Button>
            )}
          </Box>
        )
      ) : (
        <Box sx={{ width: 340, flex: 'none', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Box>
            {categoryPath && (
              <Typography sx={{ fontSize: 11, color: 'rgba(148,163,184,0.9)', letterSpacing: '0.04em' }}>{categoryPath}</Typography>
            )}
            <Typography sx={{ fontSize: 26, fontWeight: 700, lineHeight: 1.3, mt: '6px', color: '#fff' }}>{title}</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', mt: '10px' }}>
              <Box sx={{ width: 26, height: 26, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.12)', flexShrink: 0 }} />
              <Typography sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.8)' }}>{authorName}</Typography>
              {updatedLabel && <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)' }}>・ 更新 {updatedLabel}</Typography>}
            </Box>
          </Box>

          {(dimensionsLabel || seatHeightLabel || priceLabel || materials.length > 0 || fileLabel) && (
            <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.08)', pt: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {dimensionsLabel && (
                <Box sx={specRowSx}><Typography sx={specLabelSx}>寸法</Typography><Typography sx={specValueSx}>{dimensionsLabel}</Typography></Box>
              )}
              {seatHeightLabel && (
                <Box sx={specRowSx}><Typography sx={specLabelSx}>座面高</Typography><Typography sx={specValueSx}>{seatHeightLabel}</Typography></Box>
              )}
              {priceLabel && (
                <Box sx={specRowSx}><Typography sx={specLabelSx}>価格</Typography><Typography sx={{ ...specValueSx, fontWeight: 700 }}>{priceLabel}</Typography></Box>
              )}
              {materials.length > 0 && (
                <Box sx={specRowSx}><Typography sx={specLabelSx}>素材</Typography><Typography sx={specValueSx}>{materials.join('、')}</Typography></Box>
              )}
              {fileLabel && (
                <Box sx={specRowSx}><Typography sx={specLabelSx}>ファイル</Typography><Typography sx={{ ...specValueSx, color: 'rgba(255,255,255,0.75)' }}>{fileLabel}</Typography></Box>
              )}
            </Box>
          )}

          {tags.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {tags.map((t) => (
                <Chip key={t} label={t} size="small" sx={{ height: 22, fontSize: 11, bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.72)' }} />
              ))}
            </Box>
          )}

          {description && (
            <Typography sx={{ fontSize: 13, lineHeight: 1.85, color: 'rgba(255,255,255,0.72)', whiteSpace: 'pre-wrap' }}>{description}</Typography>
          )}

          {model?.catalogLinks?.length > 0 || model?.relatedLinks?.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {[...(Array.isArray(model?.catalogLinks) ? model.catalogLinks : []), ...(Array.isArray(model?.relatedLinks) ? model.relatedLinks : [])]
                .filter((l: any) => l && l.url)
                .slice(0, 3)
                .map((l: any, i: number) => (
                  <Box key={i} onClick={() => onOpenLink(l.url)} sx={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', color: '#93c5fd', '&:hover': { color: '#bfdbfe' } }}>
                    <LaunchRoundedIcon sx={{ fontSize: 13, flexShrink: 0 }} />
                    <Typography sx={{ fontSize: 11.5 }} noWrap>{l.title || l.source || l.url}</Typography>
                  </Box>
                ))}
            </Box>
          ) : null}

          {usageTotal > 0 && (
            <Box sx={{
              mt: 'auto', display: 'flex', gap: '8px', alignItems: 'center', padding: '10px 12px',
              borderRadius: '8px', bgcolor: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)',
            }}>
              <PlaceRoundedIcon sx={{ fontSize: 16, color: '#facc15', flexShrink: 0 }} />
              <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.75)' }}>
                このモデルは {usageLayoutCount} レイアウトで {usageTotal} 個使われています
              </Typography>
            </Box>
          )}
        </Box>
      )}

      <Snackbar open={!!msg} autoHideDuration={4000} onClose={() => setMsg(null)} message={msg || ''} />
    </Box>
  );
};

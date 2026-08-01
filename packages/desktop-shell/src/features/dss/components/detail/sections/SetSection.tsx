import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Typography, Button, Dialog, CircularProgress, Menu, MenuItem } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import PlaylistAddRoundedIcon from '@mui/icons-material/PlaylistAddRounded';
import CategoryIcon from '@mui/icons-material/Category';
import { DetailViewport } from '../DetailViewport';
import { getDownloadUrlForModel, getCanonicalModelId } from '../../../utils/modelUtils';
import { useAuthStore } from '../../../../../store/useAuthStore';
import { useAppStore } from '../../../../../store/useAppStore';
import { SetFurnitureEditor } from '../../SetFurnitureEditor';
import type { ModelSetWithId, PlacedItem } from '../../SetFurnitureEditor';

export interface SetSectionProps {
  model: any;
  mode: 'view' | 'edit';
  isAuthor: boolean;
  /** セット件数が変わるたびに呼ばれる（DssModelDetailView 側のレール行「3 セット家具」の
   *  カウント/表示可否に橋渡しするため。Firestore クエリが非同期なので、他セクションと違い
   *  この画面側では同期的に件数を出せない——OverviewSection の onOverviewSavingChange と同じ
   *  「子→親コールバック橋渡し」パターン）。 */
  onCountChange?: (count: number) => void;
}

type EditorState =
  | { mode: 'create' }
  | { mode: 'edit'; set: ModelSetWithId };

/**
 * companionModelIds の array-contains クエリは Firestore ルール上「public または自分がオーナー」
 * の読み取りしか許可されないため、DssSetFurnitureGrid（fetchOfficialSets）と同じく2クエリに
 * 分割してマージする。companionModelIds 未設定の旧セット（バックフィル未実行）はヒットしない
 * ——これは既知の制約で、バックフィルスクリプト実行後に解消される（Task 10 self-review 参照）。
 */
async function fetchSetsContainingModel(canonicalId: string, uid: string | undefined): Promise<ModelSetWithId[]> {
  const { collection, query, where, getDocs } = await import('firebase/firestore');
  const { db } = await import('../../../../../lib/firebase/client');
  const publicQ = query(
    collection(db, 'modelSets'),
    where('companionModelIds', 'array-contains', canonicalId),
    where('visibility', '==', 'public'),
  );
  const queries = [getDocs(publicQ)];
  if (uid) {
    const ownQ = query(
      collection(db, 'modelSets'),
      where('companionModelIds', 'array-contains', canonicalId),
      where('ownerId', '==', uid),
    );
    queries.push(getDocs(ownQ));
  }
  const snaps = await Promise.all(queries);
  const byId = new Map<string, ModelSetWithId>();
  for (const snap of snaps) {
    snap.docs.forEach(d => byId.set(d.id, { id: d.id, ...(d.data() as Omit<ModelSetWithId, 'id'>) }));
  }
  return Array.from(byId.values());
}

/** 「既存のセットに追加」の候補一覧（自分がオーナーの全セット）。DssSetFurnitureGrid.fetchMySets と同じクエリ。 */
async function fetchOwnSets(uid: string): Promise<ModelSetWithId[]> {
  const { collection, query, where, getDocs, orderBy } = await import('firebase/firestore');
  const { db } = await import('../../../../../lib/firebase/client');
  const q = query(
    collection(db, 'modelSets'),
    where('ownerId', '==', uid),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<ModelSetWithId, 'id'>) }));
}

/**
 * 2つの PlacedItem（このモデル基準/他メンバー）から「右120mm / 回転15°」のような相対配置テキストを
 * 作る。実データ（保存済み x/y/rotation）が両方無ければ null（呼び出し側は行ごとテキストを隠す）。
 * x=左右, y=前後（PlacedItem の定義どおり）。
 */
function relativePositionLabel(own: PlacedItem | null, other: PlacedItem | null): string | null {
  if (!own || !other) return null;
  const dx = Math.round(other.x - own.x);
  const dy = Math.round(other.y - own.y);
  const rot = Math.round((other.rotation ?? 0) - (own.rotation ?? 0));
  if (dx === 0 && dy === 0 && rot === 0) return null;
  const parts: string[] = [];
  const horiz = dx === 0 ? '' : (dx > 0 ? `右${Math.abs(dx)}mm` : `左${Math.abs(dx)}mm`);
  const vert = dy === 0 ? '' : (dy > 0 ? `奥${Math.abs(dy)}mm` : `手前${Math.abs(dy)}mm`);
  const posLabel = [horiz, vert].filter(Boolean).join(' ');
  if (posLabel) parts.push(posLabel);
  if (rot !== 0) parts.push(`回転 ${rot}°`);
  return parts.length > 0 ? parts.join(' / ') : null;
}

/** そのセット内で assetId が一致する最初の PlacedItem（同一モデルの複数配置は先頭のみ代表させる）。 */
function findPlacedItem(set: ModelSetWithId, assetId: string): PlacedItem | null {
  return (set.placedItems || []).find(i => i.assetId === assetId) ?? null;
}

/**
 * S.Model 詳細画面「セクション3: セット家具」。デザイン 281-322 行（閲覧）に準拠。
 * Phase A スコープ: このモデルを含む modelSets（S.Layout が所有するデータ）の「どのセットに
 * 含まれているか」を見せる／既存 SetFurnitureEditor への入口を提供するだけで、その場編集は
 * 作らない（SCREEN B 721-767 行・仕様 4.6 は対象外）。
 */
export const SetSection: React.FC<SetSectionProps> = ({ model, mode, isAuthor, onCountChange }) => {
  const currentUser = useAuthStore(s => s.currentUser);
  const canonicalId = useMemo(() => getCanonicalModelId(model) || model?.id, [model]);
  const glbUrl = useMemo(() => getDownloadUrlForModel(model, 'glb'), [model]);
  const placeholderUrl = model?.thumbnailUrl || model?.thumbnail || undefined;

  const [sets, setSets] = useState<ModelSetWithId[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);

  const loadSets = useCallback(async () => {
    if (!canonicalId) return;
    setLoading(true);
    try {
      const result = await fetchSetsContainingModel(canonicalId, currentUser?.uid);
      setSets(result);
    } catch (e) {
      console.error('[SetSection] fetchSetsContainingModel error:', e);
      setSets([]);
    } finally {
      setLoading(false);
    }
  }, [canonicalId, currentUser?.uid]);

  useEffect(() => {
    // 未ログイン（匿名含む）でも public セットは見えるように uid 無しで実行する。
    void loadSets();
  }, [loadSets]);

  useEffect(() => { onCountChange?.(sets.length); }, [sets, onCountChange]);

  useEffect(() => {
    if (sets.length === 0) { setSelectedSetId(null); return; }
    setSelectedSetId(prev => (prev && sets.some(s => s.id === prev)) ? prev : sets[0].id);
  }, [sets]);

  const selectedSet = useMemo(() => sets.find(s => s.id === selectedSetId) ?? null, [sets, selectedSetId]);

  // ── 編集: 新規作成 / 既存セットへ追加 ──────────────────────────────
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const [pickerAnchor, setPickerAnchor] = useState<HTMLElement | null>(null);
  const [ownSets, setOwnSets] = useState<ModelSetWithId[] | null>(null);
  const [ownSetsLoading, setOwnSetsLoading] = useState(false);

  const openPicker = useCallback(async (el: HTMLElement) => {
    setPickerAnchor(el);
    if (ownSets !== null || ownSetsLoading || !currentUser?.uid) return;
    setOwnSetsLoading(true);
    try {
      const result = await fetchOwnSets(currentUser.uid);
      setOwnSets(result);
    } catch (e) {
      console.error('[SetSection] fetchOwnSets error:', e);
      setOwnSets([]);
    } finally {
      setOwnSetsLoading(false);
    }
  }, [ownSets, ownSetsLoading, currentUser?.uid]);

  const handlePickExisting = (set: ModelSetWithId) => {
    setPickerAnchor(null);
    setEditorState({ mode: 'edit', set });
  };

  const handleEditorSaved = () => {
    setEditorState(null);
    void loadSets();
  };

  // 「新しいセットを作る」は常にこのモデルを初期配置する。「既存に追加」はピッカー側で
  // 既にこのモデルを含むセットを除外しているため通常は常に追加対象だが、念のため二重登録を防ぐ。
  const editorInitialModels = useMemo(() => {
    if (!editorState) return undefined;
    if (editorState.mode === 'create') return [model];
    const already = (editorState.set.companionModelIds ?? editorState.set.companionModels.map(c => c.id)).includes(canonicalId || '');
    return already ? undefined : [model];
  }, [editorState, model, canonicalId]);

  const ownSetsForPicker = useMemo(
    () => (ownSets ?? []).filter(s => !(s.companionModelIds ?? s.companionModels.map(c => c.id)).includes(canonicalId || '')),
    [ownSets, canonicalId],
  );

  // ── S.Layout への誘導 ──────────────────────────────────────────────
  // WorkspaceTabBar.activateTab（'3dsl' タブ）と同じ遷移: プロジェクト未選択なら
  // グローバル閲覧スコープへフォールバックしてから、S.Layout ワークスペースを開く。
  const goToLayout = useCallback(() => {
    const store = useAppStore.getState();
    if (!store.activeProjectId) store.setDslScope('global_layouts');
    store.setActiveWorkspaceId('layout');
    store.setLastActiveAppScope('3dsl');
    if (store.currentMainView !== 'workspace') store.setCurrentMainView('workspace');
  }, []);

  if (mode === 'view' && !loading && sets.length === 0) return null;

  const memberRows = selectedSet
    ? (() => {
        const ownItem = canonicalId ? findPlacedItem(selectedSet, canonicalId) : null;
        return selectedSet.companionModels.map(cm => ({
          id: cm.id,
          title: cm.title,
          thumbnailUrl: cm.thumbnailUrl,
          isSelf: !!canonicalId && cm.id === canonicalId,
          positionLabel: (!canonicalId || cm.id === canonicalId)
            ? null
            : relativePositionLabel(ownItem, findPlacedItem(selectedSet, cm.id)),
        }));
      })()
    : [];

  return (
    <Box sx={{ padding: mode === 'view' ? '24px 28px' : '22px 28px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: '10px', mb: mode === 'view' ? '16px' : '14px' }}>
        <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', color: '#93c5fd', fontFamily: 'ui-monospace, Menlo, monospace' }}>
          SECTION 3
        </Typography>
        <Typography sx={{ fontSize: mode === 'view' ? 19 : 17, fontWeight: 700, color: '#fff' }}>セット家具</Typography>
        <Typography sx={{ fontSize: mode === 'view' ? 12.5 : 12, color: 'rgba(148,163,184,0.9)' }}>
          S.Layout の自動レイアウトが一緒に配置する組み合わせ
        </Typography>
        {mode === 'edit' && (
          <>
            <Box sx={{ flex: 1 }} />
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddRoundedIcon sx={{ fontSize: 16 }} />}
              onClick={() => setEditorState({ mode: 'create' })}
              disabled={!isAuthor}
              sx={{
                height: 28, borderRadius: '8px', textTransform: 'none', fontSize: 11.5, fontWeight: 600,
                color: '#93c5fd', borderColor: 'rgba(96,165,250,0.5)',
                '&:hover': { borderColor: 'rgba(96,165,250,0.9)', bgcolor: 'rgba(96,165,250,0.12)' },
              }}
            >
              このモデルで新しいセットを作る
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<PlaylistAddRoundedIcon sx={{ fontSize: 16 }} />}
              onClick={(e) => void openPicker(e.currentTarget)}
              disabled={!isAuthor}
              sx={{
                height: 28, borderRadius: '8px', textTransform: 'none', fontSize: 11.5, fontWeight: 600,
                color: 'rgba(255,255,255,0.75)', borderColor: 'rgba(255,255,255,0.2)',
                '&:hover': { borderColor: 'rgba(255,255,255,0.4)', bgcolor: 'rgba(255,255,255,0.06)' },
              }}
            >
              既存のセットに追加
            </Button>
          </>
        )}
      </Box>

      {mode === 'edit' && !isAuthor ? (
        <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>作成者のみ編集できます。</Typography>
      ) : loading && sets.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={20} sx={{ color: '#93c5fd' }} />
        </Box>
      ) : sets.length === 0 ? (
        <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
          このモデルを含むセットはまだありません。
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', gap: '20px' }}>
          {/* 左: このモデル単体のビューア（セット構成は静的な部材一覧で見せる。マルチモデル3Dは持たない） */}
          <Box sx={{ width: 360, flex: 'none', borderRadius: '10px', overflow: 'hidden', background: '#080b11', border: '1px solid rgba(255,255,255,0.06)' }}>
            <DetailViewport glbUrl={glbUrl} placeholderUrl={placeholderUrl} height={210} frames={30} />
          </Box>

          <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* セット切替チップ */}
            <Box sx={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {sets.map(s => {
                const selected = s.id === selectedSetId;
                return (
                  <Box
                    key={s.id}
                    component="button"
                    type="button"
                    onClick={() => setSelectedSetId(s.id)}
                    sx={{
                      height: '30px', display: 'flex', alignItems: 'center', gap: '6px', padding: '0 14px',
                      borderRadius: '999px', fontSize: 12, fontWeight: 700, cursor: 'pointer', font: 'inherit',
                      bgcolor: selected ? 'rgba(59,130,246,0.9)' : 'transparent',
                      color: selected ? '#fff' : 'rgba(255,255,255,0.72)',
                      border: selected ? '1px solid transparent' : '1px solid rgba(255,255,255,0.15)',
                    }}
                  >
                    {s.title}
                    <Box component="span" sx={{ opacity: selected ? 0.85 : 0.7, fontWeight: 500 }}>
                      {s.companionModels.length}点
                    </Box>
                  </Box>
                );
              })}
            </Box>

            {/* 選択中セットのメンバー一覧 */}
            {selectedSet && (
              <Box sx={{ borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                {memberRows.map((row, i) => (
                  <Box
                    key={row.id + i}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
                      bgcolor: row.isSelf ? 'rgba(59,130,246,0.1)' : 'transparent',
                      borderBottom: i < memberRows.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                    }}
                  >
                    {row.thumbnailUrl ? (
                      <Box component="img" src={row.thumbnailUrl} alt="" sx={{ width: 28, height: 28, borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <Box sx={{
                        width: 28, height: 28, borderRadius: '6px', flexShrink: 0,
                        bgcolor: row.isSelf ? 'rgba(96,165,250,0.5)' : 'rgba(255,255,255,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <CategoryIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }} />
                      </Box>
                    )}
                    <Typography sx={{ flex: 1, fontSize: 12.5, fontWeight: row.isSelf ? 600 : 400, color: row.isSelf ? '#fff' : 'rgba(255,255,255,0.85)' }} noWrap>
                      {row.title}
                    </Typography>
                    {row.isSelf ? (
                      <Typography sx={{ fontSize: 11.5, color: 'rgba(147,197,253,0.9)', flexShrink: 0 }}>基準アイテム</Typography>
                    ) : row.positionLabel ? (
                      <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)', flexShrink: 0 }}>{row.positionLabel}</Typography>
                    ) : null}
                  </Box>
                ))}
              </Box>
            )}

            {/* アクション行 */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <Button
                onClick={goToLayout}
                sx={{
                  height: 34, padding: '0 14px', borderRadius: '8px', textTransform: 'none',
                  fontSize: 12.5, fontWeight: 700, color: '#fff', bgcolor: '#3b82f6',
                  '&:hover': { bgcolor: '#2f6fe0' },
                }}
              >
                S.Layout で自動配置
              </Button>
              <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                配置ルールを持つセットのみ自動レイアウト対象
              </Typography>
            </Box>
          </Box>
        </Box>
      )}

      {/* 「既存のセットに追加」候補メニュー */}
      <Menu anchorEl={pickerAnchor} open={!!pickerAnchor} onClose={() => setPickerAnchor(null)}>
        {ownSetsLoading ? (
          <MenuItem disabled>
            <CircularProgress size={16} sx={{ mr: 1 }} /> 読み込み中…
          </MenuItem>
        ) : !ownSets || ownSets.length === 0 ? (
          <MenuItem disabled>マイセットがありません</MenuItem>
        ) : ownSetsForPicker.length === 0 ? (
          <MenuItem disabled>追加できるセットがありません（全て登録済み）</MenuItem>
        ) : (
          ownSetsForPicker.map(s => (
            <MenuItem key={s.id} onClick={() => handlePickExisting(s)}>
              {s.title}（{s.companionModels.length}点）
            </MenuItem>
          ))
        )}
      </Menu>

      {/* エディタ（新規作成 / 既存セットへ追加）— ダイアログの中で既存 SetFurnitureEditor を開く。
          その場編集 UI は Phase A の対象外のため、必ずこのダイアログ経由。 */}
      <Dialog
        open={editorState !== null}
        onClose={() => setEditorState(null)}
        PaperProps={{
          sx: {
            width: '92vw', height: '88vh',
            maxWidth: 'none', maxHeight: 'none',
            bgcolor: 'var(--brand-surface)', overflow: 'hidden',
            border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
            borderRadius: 2,
          },
        }}
      >
        {editorState && (
          <SetFurnitureEditor
            availableModels={[model]}
            currentUser={currentUser}
            projectId={null}
            initialTitle={editorState.mode === 'edit' ? editorState.set.title : ''}
            initialVisibility={editorState.mode === 'edit' ? editorState.set.visibility : 'private'}
            initialBuildingType={editorState.mode === 'edit' ? (editorState.set.buildingType ?? 'residential') : 'residential'}
            initialPlacedItems={editorState.mode === 'edit' ? (editorState.set.placedItems ?? []) : []}
            initialPlacementRule={editorState.mode === 'edit' ? editorState.set.placementRule : undefined}
            initialModels={editorInitialModels}
            existingSetId={editorState.mode === 'edit' ? editorState.set.id : undefined}
            initialIsOfficial={editorState.mode === 'edit' ? (editorState.set.isOfficial ?? false) : false}
            onBack={() => setEditorState(null)}
            onSaved={handleEditorSaved}
          />
        )}
      </Dialog>
    </Box>
  );
};

// 「図」ビュー: 4種の設計図（システム構成図/ER図/画面遷移図/フロー図）を Mermaid で表示・編集・AI生成依頼。
// Mermaid ソースが正。AI 生成は既存キューと同じ Claude Code 経路（クラウド=MCP / ローカル=/queue スキル）。
import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import type { BacklogStore } from './BacklogStore';
import type { DiagramType, DiagramDoc } from './diagramsLogic';
import { DIAGRAM_TYPES, isDiagramType } from './diagramsLogic';
import MermaidPreview from './MermaidPreview';
import type { Sprint } from '../DevStatusPanel';

const TYPE_STORAGE_KEY = 'sekkeiya.devStatus.diagramType';

export default function DiagramsView({ store, snapshotSprint }: { store: BacklogStore; snapshotSprint?: Sprint | null }) {
  const [active, setActive] = useState<DiagramType>(() => {
    const stored = localStorage.getItem(TYPE_STORAGE_KEY);
    return isDiagramType(stored) ? stored : 'system';
  });
  const [docs, setDocs] = useState<Partial<Record<DiagramType, DiagramDoc>>>({});
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');       // 編集中ローカル draft（watch 通知で潰さない）
  const [saving, setSaving] = useState(false);
  const [askOpen, setAskOpen] = useState(false); // AI 依頼ダイアログ
  const [askNote, setAskNote] = useState('');
  const [askBusy, setAskBusy] = useState(false);

  // store 切替（プロジェクト切替）・スナップショット切替（現在⇄履歴）で
  // 前の図・編集状態を持ち越さない。
  // useEffect 内で直接 setState すると react-hooks/set-state-in-effect に引っかかるため、
  // React 公式が推奨する「レンダー中に props 変化を検知して state をリセットする」パターンを使う。
  const snapshotKey = snapshotSprint?.id ?? null;
  const [prevKey, setPrevKey] = useState<[BacklogStore, string | null]>([store, snapshotKey]);
  if (store !== prevKey[0] || snapshotKey !== prevKey[1]) {
    setPrevKey([store, snapshotKey]);
    setDocs({}); setError(null); setEditing(false); setDraft(''); setAskOpen(false);
  }

  useEffect(() => {
    if (snapshotKey) {
      let cancelled = false;
      store.getDiagramSnapshots(snapshotKey)
        .then((snap) => {
          if (cancelled) return;
          const built: Partial<Record<DiagramType, DiagramDoc>> = {};
          for (const t of DIAGRAM_TYPES) {
            const mermaid = snap[t.key];
            if (mermaid) built[t.key] = { type: t.key, mermaid, queue: null };
          }
          setDocs(built);
          setError(null);
        })
        .catch((e) => { if (cancelled) return; setError(e instanceof Error ? e.message : String(e)); });
      return () => { cancelled = true; };
    }
    return store.subscribeDiagrams(
      (d) => { setDocs(d); setError(null); },
      (e) => setError(e instanceof Error ? e.message : String(e)),
    );
  }, [store, snapshotKey]);

  const def = useMemo(() => DIAGRAM_TYPES.find(t => t.key === active)!, [active]);
  const current = docs[active];

  const changeType = (v: DiagramType | null) => {
    if (!v || editing) return; // 編集中の切替は保存/破棄を明確にしたいので不可（保存ボタンを促す）
    setActive(v);
    try { localStorage.setItem(TYPE_STORAGE_KEY, v); } catch { /* private mode 等は無視 */ }
  };

  const startEdit = () => { setDraft(current?.mermaid || def.sample); setEditing(true); };
  const save = () => {
    setSaving(true);
    void store.saveDiagram(active, draft)
      .then(() => setEditing(false))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setSaving(false));
  };
  const requestGenerate = () => {
    setAskBusy(true);
    void store.requestDiagram(active, askNote)
      .then(() => { setAskOpen(false); setAskNote(''); })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setAskBusy(false));
  };

  const isSnapshot = !!snapshotSprint;

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
      {/* ツールバー: 種類切替 + 依頼中チップ + 編集/保存/AI依頼（スナップショットモードでは読み取り専用チップのみ） */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <ToggleButtonGroup
          size="small" exclusive value={active} onChange={(_, v) => changeType(v)}
          sx={{ '& .MuiToggleButton-root': { textTransform: 'none', px: 1.25, py: 0.25, fontSize: 13 } }}
        >
          {DIAGRAM_TYPES.map(t => (
            <ToggleButton key={t.key} value={t.key} disabled={editing && t.key !== active}>
              {t.label}
              {docs[t.key]?.queue === 'generate' && (
                <AutoAwesomeRoundedIcon fontSize="small" sx={{ ml: 0.5, color: 'warning.main' }} />
              )}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        {isSnapshot ? (
          <Chip size="small" variant="outlined" icon={<HistoryRoundedIcon />}
            label={`スプリント${snapshotSprint.seq} 完了時点の図（読み取り専用）`} sx={{ maxWidth: 360 }} />
        ) : current?.queue === 'generate' && (
          <Chip size="small" color="warning" variant="outlined" icon={<AutoAwesomeRoundedIcon />}
            label={`生成依頼中${current.queueNote ? `: ${current.queueNote}` : ''}（/queue で処理）`} sx={{ maxWidth: 360 }} />
        )}
        <Box sx={{ flex: 1 }} />
        {isSnapshot ? null : editing ? (
          <>
            <Button size="small" disabled={saving} onClick={() => setEditing(false)} sx={{ textTransform: 'none' }}>破棄</Button>
            <Button size="small" variant="contained" disableElevation disabled={saving} onClick={save} sx={{ textTransform: 'none' }}>
              保存
            </Button>
          </>
        ) : (
          <>
            <Button size="small" variant="outlined" startIcon={<EditRoundedIcon />} onClick={startEdit} sx={{ textTransform: 'none' }}>
              ソース編集
            </Button>
            <Button size="small" variant="contained" disableElevation startIcon={<AutoAwesomeRoundedIcon />}
              onClick={() => setAskOpen(true)} sx={{ textTransform: 'none' }}>
              AIに生成/更新を依頼
            </Button>
          </>
        )}
      </Box>

      {error && <Typography variant="body2" sx={{ color: 'error.main' }}>{error}</Typography>}

      {/* 本体: 編集 textarea ⇄ プレビュー ⇄ 空状態 */}
      {editing ? (
        <TextField
          multiline fullWidth minRows={16} value={draft} onChange={(e) => setDraft(e.target.value)}
          slotProps={{ input: { sx: { fontFamily: 'monospace', fontSize: 13 } } }}
          sx={{ flex: 1, minHeight: 0, '& .MuiInputBase-root': { height: '100%', alignItems: 'flex-start', overflow: 'auto' } }}
        />
      ) : current?.mermaid ? (
        <MermaidPreview code={current.mermaid} />
      ) : isSnapshot ? (
        <Box sx={{ m: 'auto', textAlign: 'center', maxWidth: 460, px: 2 }}>
          <VisibilityRoundedIcon sx={{ fontSize: 44, color: 'text.disabled' }} />
          <Typography variant="h6" sx={{ fontWeight: 700, mt: 1 }}>この時点の図はありません</Typography>
        </Box>
      ) : (
        <Box sx={{ m: 'auto', textAlign: 'center', maxWidth: 460, px: 2 }}>
          <VisibilityRoundedIcon sx={{ fontSize: 44, color: 'text.disabled' }} />
          <Typography variant="h6" sx={{ fontWeight: 700, mt: 1 }}>{def.label}はまだありません</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
            「AIに生成/更新を依頼」で依頼を積むと、Claude Code が <code>/queue</code> でコードとバックログを読んで
            Mermaid を生成します。「ソース編集」で手書きから始めることもできます。
          </Typography>
        </Box>
      )}

      {/* AI 依頼ダイアログ */}
      <Dialog open={askOpen} onClose={() => !askBusy && setAskOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontSize: 16, fontWeight: 700 }}>{def.label}の生成/更新を AI に依頼</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
            依頼はキューに積まれ、Claude Code の <code>/queue</code> 実行時に処理されます。
          </Typography>
          <TextField
            fullWidth autoFocus size="small" label="依頼メモ（任意）" value={askNote}
            onChange={(e) => setAskNote(e.target.value)}
            placeholder="例: 認証まわりを重点的に / 〇〇画面を追加したので反映して"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAskOpen(false)} disabled={askBusy} sx={{ textTransform: 'none' }}>キャンセル</Button>
          <Button variant="contained" disableElevation onClick={requestGenerate} disabled={askBusy} sx={{ textTransform: 'none' }}>
            依頼を積む
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

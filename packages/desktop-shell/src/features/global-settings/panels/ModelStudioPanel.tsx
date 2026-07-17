/**
 * ModelStudioPanel — 管理者「モデル製造ライン（LoRA Studio）」。
 * 用途別LoRAを「教材 → 学習 → 配信 → 運用」の4工程で一望・管理する1画面。
 * 実際の学習は tools/lora の CLI（fal）で行い、出力された重み URL をここへ登録する。
 * Firestore loraModels（管理者専用）と同期。
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Typography, Button, IconButton, TextField, Switch, Chip, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, Menu, MenuItem, CircularProgress,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded';
import CloudRoundedIcon from '@mui/icons-material/CloudRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import {
  subscribeLoraModels, createLoraModel, updateLoraModel, deleteLoraModel, seedInteriorModel,
  deriveStage, STAGE_INDEX, STAGE_LABELS, type LoraModel, type LoraStage,
} from '../../dsi/loraModels';
import { useAIDriveStore } from '../../../store/useAIDriveStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { useAppStore } from '../../../store/useAppStore';
import { useLoraTrainStore } from '../../dsi/useLoraTrainStore';
import { LinearProgress } from '@mui/material';

const ACCENT = '#ec407a';
const USAGES = ['内観', '外観', '家具', '素材', '図面', 'その他'];
const BASES = ['FLUX', 'SDXL'];

const STAGE_DESC: Record<LoraStage, string> = {
  concept: '構想（未着手）',
  collecting: '教材を集めている',
  trained: '学習済み・未配信',
  live: '配信中',
};
const STAGE_COLOR: Record<LoraStage, string> = {
  concept: 'rgb(var(--brand-fg-rgb) / 0.35)',
  collecting: '#e0a030',
  trained: '#42a5f5',
  live: '#2ecc71',
};

/** 4工程ドット（現在の工程まで点灯）。 */
const StageDots: React.FC<{ stage: LoraStage }> = ({ stage }) => {
  const idx = STAGE_INDEX[stage];
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      {STAGE_LABELS.map((label, i) => (
        <React.Fragment key={label}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25 }}>
            <Box sx={{
              width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
              bgcolor: i <= idx ? ACCENT : 'transparent',
              border: `2px solid ${i <= idx ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.25)'}`,
            }} />
            <Typography sx={{ fontSize: 9, color: i <= idx ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.4)' }}>{label}</Typography>
          </Box>
          {i < STAGE_LABELS.length - 1 && (
            <Box sx={{ width: 26, height: 2, mt: -1.5, bgcolor: i < idx ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.15)' }} />
          )}
        </React.Fragment>
      ))}
    </Box>
  );
};

const fieldSx = {
  '& .MuiOutlinedInput-root': { color: 'var(--brand-fg)', fontSize: 13, borderRadius: 2,
    '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' }, '&.Mui-focused fieldset': { borderColor: ACCENT } },
  '& .MuiInputLabel-root': { color: 'rgb(var(--brand-fg-rgb) / 0.6)', fontSize: 13 },
} as const;

/* ───────────────────────── 解説（はじめての方へ） ───────────────────────── */

const GBox: React.FC<{ children: React.ReactNode; sx?: any }> = ({ children, sx }) => (
  <Box sx={{ p: 2.25, borderRadius: 3, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.09)', ...sx }}>{children}</Box>
);
const GH: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography sx={{ fontSize: 16, fontWeight: 800, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
    <Box component="span" sx={{ width: 4, height: 18, borderRadius: 2, bgcolor: ACCENT, flexShrink: 0 }} />{children}
  </Typography>
);
const P: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography sx={{ fontSize: 13.5, lineHeight: 1.8, color: 'rgb(var(--brand-fg-rgb) / 0.82)' }}>{children}</Typography>
);
const Pink = ({ children }: { children: React.ReactNode }) => <Box component="span" sx={{ color: ACCENT, fontWeight: 700 }}>{children}</Box>;
const Free = ({ children }: { children: React.ReactNode }) => <Box component="span" sx={{ color: '#2ecc71', fontWeight: 700 }}>{children}</Box>;

const ModelStudioGuide: React.FC = () => {
  const cell = { padding: '9px 12px', fontSize: 13, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.09)', verticalAlign: 'top' as const };
  const th = { ...cell, fontWeight: 700, textAlign: 'left' as const, color: 'rgb(var(--brand-fg-rgb) / 0.55)', fontSize: 11.5, textTransform: 'uppercase' as const, letterSpacing: '.04em' };
  return (
    <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 2.5, overflowY: 'auto', color: 'var(--brand-fg)', maxWidth: 900 }}>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <AutoAwesomeRoundedIcon sx={{ color: ACCENT }} />
          <Typography variant="h5" sx={{ fontWeight: 700 }}>モデルの仕組み</Typography>
          <Chip size="small" label="はじめての方へ" sx={{ height: 22, fontSize: 11, bgcolor: `${ACCENT}22`, color: ACCENT }} />
        </Box>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
          画像生成AIの“自前モデル”を作る・使うときに知っておきたい基礎を、専門用語ぬきでまとめました。
        </Typography>
      </Box>

      <GBox>
        <GH>① そもそも「モデル」って？ ＝ 2階建て</GH>
        <P>
          画像生成は<Pink>ベースモデル（絵を描く本体）</Pink>の上に、<Pink>LoRA（作風の追加ファイル）</Pink>を薄く重ねて作ります。
          本体はそのまま、上に“味付け”を載せるイメージです。
        </P>
        <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
          <Box sx={{ flex: 1, minWidth: 200, p: 1.5, borderRadius: 2, border: '1px solid rgb(var(--brand-fg-rgb) / 0.15)', textAlign: 'center' }}>
            <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>本体（ベース）</Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 700 }}>FLUX / SDXL</Typography>
            <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>単体でも“ふつうの絵”は出る</Typography>
          </Box>
          <Box sx={{ display: 'grid', placeItems: 'center', color: ACCENT, fontSize: 20, fontWeight: 700 }}>＋</Box>
          <Box sx={{ flex: 1, minWidth: 200, p: 1.5, borderRadius: 2, border: `1px solid ${ACCENT}55`, bgcolor: `${ACCENT}0f`, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 12, color: ACCENT }}>作風（LoRA）</Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 700 }}>内観パース 等</Typography>
            <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>“SEKKEIYAらしさ”を足す</Typography>
          </Box>
        </Box>
      </GBox>

      <GBox>
        <GH>② 「学習」と「生成」は別物</GH>
        <P><Pink>学習＝作る（1回だけ）</Pink>。教材を渡してLoRAという作風ファイルを1本つくる工程。<br />
        <Pink>生成＝使う（何回でも）</Pink>。できたモデルで絵を出す工程。<b>生成のたびに学習し直したりはしません</b>。一度学習すればずっと使い回せます。</P>
      </GBox>

      <GBox sx={{ borderColor: '#2ecc7155', bgcolor: 'rgba(46,204,113,0.06)' }}>
        <GH>③ “ローカル無料”の本当の意味</GH>
        <P>
          無料になる理由は<Free>「自分のPCのGPUで描くから」</Free>であって、<b>誰が作ったモデルかは関係ありません</b>。
          いま SEKKEIYA も、<b>ダウンロードしてきたベース（FLUX）</b>＋<b>自作の内観LoRA</b>の両方をローカルで無料生成しています。
          ダウンロードして手元で動くモデルは、本体でも他人の作風でも<Free>すべて$0</Free>で回せます。
        </P>
      </GBox>

      <GBox>
        <GH>④ 自分で“学習”が要るのはどれ？</GH>
        <Box sx={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 420 }}>
            <thead><tr><th style={th}>種類</th><th style={th}>学習は必要？</th><th style={th}>入手</th></tr></thead>
            <tbody>
              <tr><td style={cell}>ベースモデル本体</td><td style={cell}><Free>不要</Free></td><td style={cell}>ダウンロードするだけ</td></tr>
              <tr><td style={cell}>他人が公開した作風LoRA</td><td style={cell}><Free>不要</Free></td><td style={cell}>ダウンロードするだけ</td></tr>
              <tr><td style={cell}><b>自分だけの作風（内観パース等）</b></td><td style={cell}><Pink>必要</Pink></td><td style={cell}>自分で学習</td></tr>
            </tbody>
          </table>
        </Box>
        <P><Box component="span" sx={{ fontSize: 12.5, color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>＝ 自分で学習するのは「SEKKEIYA独自の作風」を作るときだけ。それ以外はDLで済みます。</Box></P>
      </GBox>

      <GBox>
        <GH>⑤ FLUX と SDXL のちがい</GH>
        <Box sx={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 480 }}>
            <thead><tr><th style={th}></th><th style={th}>FLUX（今回使用）</th><th style={th}>SDXL</th></tr></thead>
            <tbody>
              <tr><td style={{ ...cell, fontWeight: 700 }}>品質</td><td style={cell}>◎ 高い（写実・構図が強い）</td><td style={cell}>○ 十分（やや粗が出やすい）</td></tr>
              <tr><td style={{ ...cell, fontWeight: 700 }}>学習のGPU</td><td style={cell}>16〜24GB → 8GBでは不可 → <Pink>falで$2</Pink></td><td style={cell}>8GBでもOK → <Free>ローカル$0</Free></td></tr>
              <tr><td style={{ ...cell, fontWeight: 700 }}>図面制御(ControlNet)</td><td style={cell}>発展途上</td><td style={cell}>成熟（有利）</td></tr>
            </tbody>
          </table>
        </Box>
        <P><Box component="span" sx={{ fontSize: 12.5, color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>
          使い分け: 見栄え最優先＝FLUX（$2の価値あり） / 無料で量産・図面制御＝SDXL（$0）。
        </Box></P>
      </GBox>

      <GBox>
        <GH>⑥ お金の早見表</GH>
        <Box sx={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 460 }}>
            <thead><tr><th style={th}>操作</th><th style={th}>費用</th><th style={th}>頻度</th></tr></thead>
            <tbody>
              <tr><td style={cell}>新規モデルを台帳に作る</td><td style={cell}><Free>$0</Free></td><td style={cell}>何個でも無料</td></tr>
              <tr><td style={cell}>学習を1本回す（fal・FLUX）</td><td style={cell}><Pink>約$2</Pink></td><td style={cell}>1モデル基本1回（作り直すと+$2）</td></tr>
              <tr><td style={cell}>生成（ローカル・ComfyUI）</td><td style={cell}><Free>$0</Free></td><td style={cell}>電気代のみ・使い放題</td></tr>
              <tr><td style={cell}>生成（クラウド・fal）</td><td style={cell}>1枚 数円</td><td style={cell}>1枚ごと</td></tr>
            </tbody>
          </table>
        </Box>
        <P><Box component="span" sx={{ fontSize: 12.5, color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>
          例: モデルを10個構想＝$0 / そのうち3個を実際に学習＝約$6 / ローカルで使う限り運用は$0。
        </Box></P>
      </GBox>

      <GBox>
        <GH>⑦ この画面（製造ライン）の4工程</GH>
        <P>
          <Pink>① 教材</Pink> 見本画像を集める（自前レンダが“堀”）　→　<Pink>② 学習</Pink> LoRAを1本つくる（$2）　→
          <Pink> ③ 配信</Pink> クラウド／ローカル(無料)に載せる　→　<Pink>④ 運用</Pink> 採用/破棄で教材を選別し再学習。<br />
          <Box component="span" sx={{ fontSize: 12.5, color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>「概要」タブで、各モデルが今どの工程にいるか一目で管理できます。</Box>
        </P>
      </GBox>
    </Box>
  );
};

/* ── SEKKEIYA Drive 画像ピッカー（教材選択用・パネル内完結） ── */
const DRIVE_IMG_TYPES = ['image', 'render', 'screenshot', 'cover'];
const driveUrlOf = (a: any): string => a?.downloadUrl || a?.storageUrl || a?.imageUrl || '';

const DriveImagePicker: React.FC<{ open: boolean; onClose: () => void; onPick: (urls: string[]) => void }> = ({ open, onClose, onPick }) => {
  const assets = useAIDriveStore((s) => s.assets);
  const [sel, setSel] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) { setSel(new Set()); return; }
    const uid = useAuthStore.getState().currentUser?.uid || null;
    const pid = useAppStore.getState().activeProjectId || null;
    try { useAIDriveStore.getState().subscribeToAssets(pid, uid); } catch (e) { console.warn('[ModelStudio] drive subscribe', e); }
  }, [open]);

  const imgs = useMemo(
    () => assets.filter((a: any) => DRIVE_IMG_TYPES.includes((a.type || '').toLowerCase()) && driveUrlOf(a)),
    [assets],
  );
  const toggle = (id: string) => setSel((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', backgroundImage: 'none', color: 'var(--brand-fg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)' } }}>
      <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
        <CloudRoundedIcon sx={{ color: ACCENT }} /> SEKKEIYA Drive から教材を選ぶ
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ fontSize: 13, color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>{sel.size} 枚選択中</Typography>
      </DialogTitle>
      <DialogContent dividers sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.1)' }}>
        {imgs.length === 0 ? (
          <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', textAlign: 'center', py: 5 }}>
            Drive に画像がありません。<br />生成結果やアップロードした画像がここに並びます。
          </Typography>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 1 }}>
            {imgs.map((a: any) => {
              const on = sel.has(a.id);
              return (
                <Box key={a.id} onClick={() => toggle(a.id)}
                  sx={{ position: 'relative', aspectRatio: '1 / 1', borderRadius: 2, overflow: 'hidden', cursor: 'pointer',
                    border: on ? `2px solid ${ACCENT}` : '2px solid transparent', bgcolor: 'var(--brand-bg)' }}>
                  <img src={driveUrlOf(a)} alt={a.name || ''} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: on ? 0.85 : 1 }} />
                  {on && <CheckCircleRoundedIcon sx={{ position: 'absolute', top: 4, right: 4, color: ACCENT, bgcolor: '#fff', borderRadius: '50%', fontSize: 22 }} />}
                </Box>
              );
            })}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>キャンセル</Button>
        <Button variant="contained" disabled={sel.size === 0}
          onClick={() => onPick(imgs.filter((a: any) => sel.has(a.id)).map(driveUrlOf).filter(Boolean))}
          sx={{ bgcolor: ACCENT, color: 'var(--brand-fg)', '&:hover': { bgcolor: '#f48fb1' } }}>
          この {sel.size} 枚を教材に追加
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/** データセット名（教材フォルダ名）。dataset 未設定の旧ドキュメントは名前/用途から決定的に導出。 */
const datasetOf = (m: LoraModel): string =>
  m.dataset || (m.usage === '内観' ? 'interior-perspective'
    : ((m.name || '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || m.id));

export const ModelStudioPanel: React.FC<{ section?: string }> = ({ section }) => {
  const [rows, setRows] = useState<LoraModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState({ name: '', usage: '内観', base: 'FLUX', triggerWord: '' });

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeLoraModels((r) => { setRows(r); setLoading(false); });
    return unsub;
  }, []);

  const selected = useMemo(() => rows.find((m) => m.id === selectedId) || null, [rows, selectedId]);
  const patch = (p: Partial<LoraModel>) => selected && updateLoraModel(selected.id, p).catch((e) => console.error(e));

  const [uploadAnchor, setUploadAnchor] = useState<HTMLElement | null>(null);
  const [busyUpload, setBusyUpload] = useState(false);
  // 学習状態はグローバルストア（画面遷移しても継続表示。プロセスは Rust 側で動き続ける）。
  const trainRunning = useLoraTrainStore((s) => s.running);
  const trainModelId = useLoraTrainStore((s) => s.modelId);
  const trainModelName = useLoraTrainStore((s) => s.modelName);
  const trainProgress = useLoraTrainStore((s) => s.progress);
  const trainNotice = useLoraTrainStore((s) => s.notice);
  const trainCancelling = useLoraTrainStore((s) => s.cancelling);
  const clearNotice = useLoraTrainStore((s) => s.clearNotice);
  const startTraining = useLoraTrainStore((s) => s.start);
  const cancelTraining = useLoraTrainStore((s) => s.cancel);
  const training = trainRunning && trainModelId === selectedId;
  const [trainConfirm, setTrainConfirm] = useState<{ trigger: string } | null>(null);
  // 学習の中断（確認してから kill）。
  const onCancelTraining = () => {
    if (window.confirm('学習を中断しますか？ここまでの学習結果は保存されません。')) {
      void cancelTraining();
    }
  };
  // 進捗の見せ方（フェーズ別）。training のときだけ確定% + 残り時間。
  const tp = trainProgress;
  const trainPct = tp && tp.phase === 'training' && tp.total
    ? Math.min(100, Math.round((tp.step! / tp.total) * 100)) : null;
  const trainDeterminate = trainPct !== null;
  // "39:32" / "1:02:10" → "約39分" / "約1時間2分"
  const humanRemain = (r?: string): string => {
    if (!r) return '計算中…';
    const parts = r.split(':').map((n) => parseInt(n, 10));
    if (parts.some(isNaN)) return r;
    let h = 0, m = 0;
    if (parts.length === 3) { h = parts[0]; m = parts[1]; }
    else if (parts.length === 2) { m = parts[0]; }
    if (h > 0) return `約${h}時間${m}分`;
    if (m > 0) return `約${m}分`;
    return 'まもなく完了';
  };
  // 学習中の一行サマリ（バナー/②学習で共用）。
  const trainSummary = (): string => {
    if (!tp || tp.phase === 'loading') return '準備中…（モデルを読み込み中）';
    if (tp.phase === 'caching') {
      const pct = tp.total ? Math.round((tp.step! / tp.total) * 100) : 0;
      return `準備中：教材をキャッシュ中 ${pct}%`;
    }
    return `${trainPct}%（${tp.step} / ${tp.total} ステップ）・残り ${humanRemain(tp.remaining)}`;
  };
  const [preview, setPreview] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [drivePickerOpen, setDrivePickerOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const isSDXL = selected?.base === 'SDXL';
  // SDXL ローカル学習環境（sd-scripts + venv + base）が使えるか。
  const [sdxlReady, setSdxlReady] = useState<boolean | null>(null);
  useEffect(() => {
    if (!isSDXL) { setSdxlReady(null); return; }
    let alive = true;
    (async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const ok = await invoke<boolean>('lora_sdxl_available');
        if (alive) setSdxlReady(!!ok);
      } catch { if (alive) setSdxlReady(false); }
    })();
    return () => { alive = false; };
  }, [isSDXL, selectedId]);

  // 教材プレビュー: 選択モデルの教材画像を読み込む（学習前に“教材の質”を確認＝事前テスト）。
  useEffect(() => {
    if (!selected) { setPreview([]); return; }
    let alive = true;
    (async () => {
      try {
        const { invoke, convertFileSrc } = await import('@tauri-apps/api/core');
        const paths = await invoke<string[]>('lora_dataset_images', { dataset: datasetOf(selected) });
        if (alive) setPreview(paths.map((p) => convertFileSrc(p)));
      } catch { if (alive) setPreview([]); }
    })();
    return () => { alive = false; };
  }, [selectedId, selected?.imageCount]);

  // File → base64（data URL の接頭辞を除いた本体）。
  const readB64 = (file: File) => new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => { const s = String(r.result || ''); res(s.slice(s.indexOf(',') + 1)); };
    r.onerror = rej;
    r.readAsDataURL(file);
  });

  // 画像ファイル群を教材フォルダへ保存（エクスプローラー選択・DnD 共通）。
  const saveFiles = async (files: File[]) => {
    const imgs = files.filter((f) => f.type.startsWith('image/'));
    if (!selected || imgs.length === 0) return;
    setBusyUpload(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      let count = selected.imageCount;
      for (const f of imgs) {
        const dataB64 = await readB64(f);
        count = await invoke<number>('lora_save_dataset_image', { dataset: datasetOf(selected), filename: f.name, dataB64 });
      }
      await updateLoraModel(selected.id, { imageCount: count });
    } catch (err: any) { window.alert('教材の保存に失敗しました: ' + (err?.message || err)); }
    finally { setBusyUpload(false); }
  };
  const onExplorerFiles = (e: React.ChangeEvent<HTMLInputElement>) => { const fs = Array.from(e.target.files || []); e.target.value = ''; void saveFiles(fs); };
  const onDrop = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); void saveFiles(Array.from(e.dataTransfer.files || [])); };

  // SEKKEIYA Drive のピッカーで選んだ URL を教材フォルダへダウンロード。
  const onDrivePicked = async (urls: string[]) => {
    setDrivePickerOpen(false);
    const sel = selected;
    if (!sel || urls.length === 0) return;
    setBusyUpload(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const count = await invoke<number>('lora_add_images_from_urls', { dataset: datasetOf(sel), urls });
      await updateLoraModel(sel.id, { imageCount: count });
    } catch (e) { console.error('[ModelStudio] drive add failed', e); }
    finally { setBusyUpload(false); }
  };

  // 「学習を実行」→ 確認ダイアログを開く（トリガー語未設定なら自動生成して台帳に保存）。
  const onTrain = async () => {
    if (!selected || trainRunning) return;
    let trigger = (selected.triggerWord || '').replace(/[^a-zA-Z0-9]/g, '');
    if (!trigger) {
      trigger = `skv${datasetOf(selected).replace(/[^a-zA-Z0-9]/g, '').slice(0, 5).toLowerCase() || 'lora'}`;
      await updateLoraModel(selected.id, { triggerWord: trigger });
    }
    setTrainConfirm({ trigger });
  };

  // ダイアログの「学習を開始」→ グローバルストアで実行（画面遷移しても継続）。
  const doStartTraining = () => {
    if (!selected || !trainConfirm) return;
    void startTraining(selected, datasetOf(selected), trainConfirm.trigger);
    setTrainConfirm(null);
  };

  const doCreate = async () => {
    const id = await createLoraModel({ ...draft });
    setDraft({ name: '', usage: '内観', base: 'FLUX', triggerWord: '' });
    setCreateOpen(false);
    setSelectedId(id);
  };

  const trainCmd = selected ? `cd tools/lora\nnode lora-poc.mjs train ${datasetOf(selected)}` : '';

  // 「モデルの仕組み」サブタブ = 初心者向け解説。
  if (section === 'guide') return <ModelStudioGuide />;

  return (
    <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto', color: 'var(--brand-fg)' }}>
      {/* ヘッダー */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <AutoAwesomeRoundedIcon sx={{ color: ACCENT }} />
          <Typography variant="h5" sx={{ fontWeight: 700 }}>モデル製造ライン</Typography>
          <Box sx={{ flex: 1 }} />
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setCreateOpen(true)}
            sx={{ bgcolor: ACCENT, color: 'var(--brand-fg)', '&:hover': { bgcolor: '#f48fb1' } }}>
            新規モデル
          </Button>
        </Box>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
          用途別 LoRA（作風の追加モデル）を「教材 → 学習 → 配信 → 運用」の流れで管理します。
          学習コストはベース次第（<b>FLUX＝fal・約$2</b> / <b>SDXL＝ローカル・無料</b>）。学習後、出力された重み URL を配信して使えるようになります。
        </Typography>
      </Box>

      {/* 学習中バナー（どのモデルを選んでいても見える） */}
      {trainRunning && (
        <Box sx={{ p: 1.75, borderRadius: 3, border: '1px solid #2ecc7166', bgcolor: 'rgba(46,204,113,0.08)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
            <CircularProgress size={14} sx={{ color: '#2ecc71' }} />
            <Typography sx={{ fontSize: 13, fontWeight: 700 }}>「{trainModelName}」を学習中</Typography>
            {trainDeterminate && (
              <Typography sx={{ fontSize: 15, fontWeight: 800, color: '#2ecc71', ml: 0.5 }}>{trainPct}%</Typography>
            )}
            <Box sx={{ flex: 1 }} />
            <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>{trainSummary()}</Typography>
            <Button size="small" onClick={onCancelTraining} disabled={trainCancelling}
              sx={{ ml: 1, fontSize: 11.5, color: '#ff7b7b', minWidth: 0, px: 1, '&:hover': { bgcolor: 'rgba(255,123,123,0.08)' } }}>
              {trainCancelling ? '中断中…' : '中断'}
            </Button>
          </Box>
          <LinearProgress
            variant={trainDeterminate ? 'determinate' : 'indeterminate'}
            value={trainDeterminate ? trainPct! : undefined}
            sx={{ height: 6, borderRadius: 3, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)', '& .MuiLinearProgress-bar': { bgcolor: '#2ecc71', borderRadius: 3 } }}
          />
          <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.5)', mt: 0.5 }}>
            画面を移動してもOK・アプリは閉じないでください
          </Typography>
        </Box>
      )}

      {/* パイプライン全体像 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0, p: 2, borderRadius: 3, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)' }}>
        {[
          { t: '① 教材', d: '見本画像を集める（自前レンダが堀）' },
          { t: '② 学習', d: 'LoRAを1本学習（FLUX:約$2 / SDXL:無料）' },
          { t: '③ 配信', d: 'クラウド / ローカル(無料) に載せる' },
          { t: '④ 運用', d: '採用/破棄で教材を選別し再学習' },
        ].map((s, i, arr) => (
          <React.Fragment key={s.t}>
            <Box sx={{ flex: 1, textAlign: 'center', px: 1 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>{s.t}</Typography>
              <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.6)', mt: 0.5 }}>{s.d}</Typography>
            </Box>
            {i < arr.length - 1 && <Box sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.3)', fontSize: 18 }}>→</Box>}
          </React.Fragment>
        ))}
      </Box>

      {/* モデルカード一覧 */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress sx={{ color: ACCENT }} /></Box>
      ) : rows.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 5, border: '1px dashed rgb(var(--brand-fg-rgb) / 0.2)', borderRadius: 3 }}>
          <Typography sx={{ color: 'text.secondary', mb: 2 }}>まだモデルがありません。</Typography>
          <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center' }}>
            <Button variant="outlined" onClick={() => seedInteriorModel(rows)}
              sx={{ color: 'var(--brand-fg)', borderColor: 'rgb(var(--brand-fg-rgb) / 0.3)' }}>
              稼働中の「内観パース」を取り込む
            </Button>
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setCreateOpen(true)}
              sx={{ bgcolor: ACCENT, color: 'var(--brand-fg)', '&:hover': { bgcolor: '#f48fb1' } }}>新規モデル</Button>
          </Box>
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 1.5 }}>
          {rows.map((m) => {
            const stage = deriveStage(m);
            const active = m.id === selectedId;
            return (
              <Box key={m.id} onClick={() => setSelectedId(active ? null : m.id)}
                sx={{
                  p: 2, borderRadius: 3, cursor: 'pointer', bgcolor: 'var(--brand-surface, rgb(var(--brand-fg-rgb) / 0.03))',
                  border: `1px solid ${active ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.1)'}`,
                  transition: 'border-color .15s',
                  '&:hover': { borderColor: active ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.25)' },
                }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1.5 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontSize: 15, fontWeight: 700 }}>{m.name}</Typography>
                    <Typography sx={{ fontSize: 11.5, color: 'rgb(var(--brand-fg-rgb) / 0.55)' }}>
                      用途:{m.usage}　base:{m.base}{m.triggerWord ? `　trig:${m.triggerWord}` : ''}
                    </Typography>
                  </Box>
                  <Chip size="small" label={STAGE_DESC[stage]} sx={{ height: 22, fontSize: 11, color: '#fff', bgcolor: STAGE_COLOR[stage] }} />
                </Box>
                <StageDots stage={stage} />
              </Box>
            );
          })}
        </Box>
      )}

      {/* 選択モデルの詳細（4工程の状態＋操作） */}
      {selected && (
        <Box sx={{ p: 3, borderRadius: 3, border: `1px solid ${ACCENT}55`, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.02)', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 700 }}>{selected.name} の工程</Typography>
            <Box sx={{ flex: 1 }} />
            <Tooltip title="このモデルを削除">
              <IconButton size="small" onClick={() => { if (window.confirm(`「${selected.name}」を台帳から削除しますか？`)) { deleteLoraModel(selected.id); setSelectedId(null); } }}
                sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&:hover': { color: '#ef9a9a' } }}>
                <DeleteOutlineRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          {/* ① 教材 */}
          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: ACCENT, mb: 0.75 }}>① 教材</Typography>
            {/* DnD アップロード枠（ドロップで即保存・クリックでアップロードメニュー） */}
            <Box
              onClick={(e) => setUploadAnchor(e.currentTarget)}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              sx={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.5,
                py: 2.5, px: 2, borderRadius: 3, cursor: 'pointer', textAlign: 'center',
                border: `2px dashed ${dragOver ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.25)'}`,
                bgcolor: dragOver ? `${ACCENT}14` : 'rgb(var(--brand-fg-rgb) / 0.02)',
                transition: 'border-color .15s, background-color .15s',
                '&:hover': { borderColor: ACCENT, bgcolor: `${ACCENT}08` },
              }}
            >
              {busyUpload ? <CircularProgress size={22} sx={{ color: ACCENT }} /> : <UploadFileRoundedIcon sx={{ fontSize: 26, color: ACCENT }} />}
              <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>{busyUpload ? '保存中…' : '教材をここにドラッグ＆ドロップ'}</Typography>
              <Typography sx={{ fontSize: 11.5, color: 'rgb(var(--brand-fg-rgb) / 0.55)' }}>
                または クリックしてアップロード（エクスプローラー / SEKKEIYA Drive）
              </Typography>
              <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.45)' }}>
                現在 <b>{selected.imageCount}</b> 枚 ・ 15〜30枚推奨 ・ 保存先 <code>datasets/{datasetOf(selected)}/images</code>
              </Typography>
            </Box>
            <Menu anchorEl={uploadAnchor} open={!!uploadAnchor} onClose={() => setUploadAnchor(null)}
              PaperProps={{ sx: { bgcolor: 'var(--brand-surface2)', color: 'var(--brand-fg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)' } }}>
              <MenuItem onClick={() => { setUploadAnchor(null); fileRef.current?.click(); }} sx={{ fontSize: 13, gap: 1 }}>
                <FolderOpenRoundedIcon fontSize="small" /> エクスプローラーから選ぶ
              </MenuItem>
              <MenuItem onClick={() => { setUploadAnchor(null); setDrivePickerOpen(true); }} sx={{ fontSize: 13, gap: 1 }}>
                <CloudRoundedIcon fontSize="small" /> SEKKEIYA Drive から選ぶ
              </MenuItem>
            </Menu>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onExplorerFiles} />
            <DriveImagePicker open={drivePickerOpen} onClose={() => setDrivePickerOpen(false)} onPick={onDrivePicked} />

            {/* 教材プレビュー（学習前の“事前チェック”＝教材の質を確認） */}
            {preview.length > 0 && (
              <Box sx={{ display: 'flex', gap: 0.75, mt: 1.25, flexWrap: 'wrap', alignItems: 'center' }}>
                {preview.slice(0, 24).map((src, i) => (
                  <Box key={i} sx={{ width: 54, height: 40, borderRadius: 1, overflow: 'hidden', border: '1px solid rgb(var(--brand-fg-rgb) / 0.15)', bgcolor: 'var(--brand-bg)' }}>
                    <img src={src} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </Box>
                ))}
                {preview.length > 24 && <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>＋{preview.length - 24}</Typography>}
              </Box>
            )}
            <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.5)', mt: 0.75 }}>
              ※ 学習<b>前</b>は完成モデルの出力プレビューはできません（モデルがまだ無いため）。まずここで<b>教材の質</b>を確認するのが事前チェックです。学習<b>後</b>は S.Image で生成して確認 → 良ければ③配信、が「テストしてから本採用」の流れになります。
            </Typography>
          </Box>

          {/* ② 学習 */}
          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: ACCENT, mb: 0.75 }}>
              ② 学習（{isSDXL ? 'ローカル・無料' : 'fal・約$2'}）
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1, flexWrap: 'wrap' }}>
              <Button variant="contained" disabled={trainRunning || selected.imageCount < 4 || (isSDXL && sdxlReady === false)}
                startIcon={training ? <CircularProgress size={15} color="inherit" /> : <PlayArrowRoundedIcon />}
                onClick={onTrain}
                sx={{ bgcolor: '#2ecc71', color: '#08320f', fontWeight: 700, '&:hover': { bgcolor: '#3fd984' }, '&.Mui-disabled': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.12)', color: 'rgb(var(--brand-fg-rgb) / 0.4)' } }}>
                {training ? '学習中…' : trainRunning ? `学習中: ${trainModelName}` : isSDXL ? '学習を実行（無料）' : '学習を実行（約$2）'}
              </Button>
              {selected.imageCount < 4 ? (
                <Typography sx={{ fontSize: 12, color: '#e0a030' }}>※ 教材が4枚以上必要です（現在 {selected.imageCount} 枚）。</Typography>
              ) : isSDXL && sdxlReady === false ? (
                <Typography sx={{ fontSize: 12, color: '#e0a030' }}>※ SDXL 学習環境（sd-scripts）が未セットアップです。</Typography>
              ) : isSDXL ? (
                <Typography sx={{ fontSize: 11.5, color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>あなたのGPUで学習（無料）。目安 40分〜2時間・完了で重みが自動登録されます。</Typography>
              ) : (
                <Typography sx={{ fontSize: 11.5, color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>完了すると重み URL が自動で入ります。</Typography>
              )}
            </Box>
            {/* 進捗バー（学習中のみ・画面を移動しても学習は継続） */}
            {training && (
              <Box sx={{ mb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.5 }}>
                  <Typography sx={{ fontSize: 22, fontWeight: 800, color: '#2ecc71', lineHeight: 1 }}>
                    {trainDeterminate ? `${trainPct}%` : '—'}
                  </Typography>
                  <Typography sx={{ fontSize: 12.5, color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>
                    {trainDeterminate ? `残り ${humanRemain(tp?.remaining)}` : trainSummary()}
                  </Typography>
                  <Box sx={{ flex: 1 }} />
                  <Button size="small" onClick={onCancelTraining} disabled={trainCancelling}
                    sx={{ fontSize: 11.5, color: '#ff7b7b', minWidth: 0, px: 1, '&:hover': { bgcolor: 'rgba(255,123,123,0.08)' } }}>
                    {trainCancelling ? '中断中…' : '学習を中断'}
                  </Button>
                </Box>
                <LinearProgress
                  variant={trainDeterminate ? 'determinate' : 'indeterminate'}
                  value={trainDeterminate ? trainPct! : undefined}
                  sx={{ height: 8, borderRadius: 4, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)', '& .MuiLinearProgress-bar': { bgcolor: '#2ecc71', borderRadius: 4 } }}
                />
                <Typography sx={{ fontSize: 11.5, color: 'rgb(var(--brand-fg-rgb) / 0.55)', mt: 0.5 }}>
                  {trainDeterminate
                    ? `${tp?.step} / ${tp?.total} ステップ　※ 画面を移動しても学習は続きます。アプリは閉じないでください。`
                    : '最初の数分はモデル読み込み・教材キャッシュのため % が出ません。少しお待ちください。'}
                </Typography>
              </Box>
            )}
            {/* 手動でやる場合の CLI（参考・FLUX/fal のみ。SDXL はボタンからローカル実行） */}
            {!isSDXL && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Box component="pre" sx={{ flex: 1, m: 0, p: 1.25, borderRadius: 2, fontSize: 11.5, fontFamily: 'monospace', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)', overflowX: 'auto', whiteSpace: 'pre', opacity: 0.75 }}>
                {trainCmd}
              </Box>
              <Tooltip title="手動用コマンドをコピー">
                <IconButton size="small" onClick={() => navigator.clipboard?.writeText(trainCmd)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>
                  <ContentCopyRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            )}
            <TextField size="small" fullWidth label={isSDXL ? '学習済み LoRA 重み（ローカルパス・自動入力）' : '学習済み LoRA 重み URL（自動入力 / 手動貼付も可）'} value={selected.weightsUrl}
              onChange={(e) => patch({ weightsUrl: e.target.value.trim() })} placeholder={isSDXL ? 'C:\\…\\output\\xxx-sdxl-lora.safetensors' : 'https://…/pytorch_lora_weights.safetensors'} sx={fieldSx} />
            <Box sx={{ display: 'flex', gap: 1.5, mt: 1 }}>
              <TextField size="small" label="トリガー語" value={selected.triggerWord} onChange={(e) => patch({ triggerWord: e.target.value.trim() })} sx={{ width: 160, ...fieldSx }} />
              <TextField size="small" label="効き(scale)" type="number" value={selected.scale}
                onChange={(e) => patch({ scale: Math.min(2, Math.max(0, parseFloat(e.target.value || '1'))) })} sx={{ width: 120, ...fieldSx }} inputProps={{ step: 0.1 }} />
            </Box>
          </Box>

          {/* ③ 配信 */}
          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: ACCENT, mb: 0.75 }}>③ 配信</Typography>
            {!selected.weightsUrl && (
              <Typography sx={{ fontSize: 12, color: '#e0a030', mb: 0.5 }}>※ 先に重み URL を登録すると配信できます。</Typography>
            )}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Switch checked={selected.deployCloud} disabled={!selected.weightsUrl || isSDXL} onChange={(e) => patch({ deployCloud: e.target.checked })}
                  sx={{ '& .Mui-checked': { color: ACCENT }, '& .Mui-checked + .MuiSwitch-track': { bgcolor: `${ACCENT} !important` } }} />
                <Typography sx={{ fontSize: 13, opacity: isSDXL ? 0.5 : 1 }}>
                  クラウド配信（airender・1枚 数円）{isSDXL ? '｜SDXL はローカル配信のみ（クラウドは FLUX 系のみ）' : ''}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Switch checked={selected.deployLocal} disabled={!selected.weightsUrl} onChange={(e) => patch({ deployLocal: e.target.checked })}
                  sx={{ '& .Mui-checked': { color: '#2ecc71' }, '& .Mui-checked + .MuiSwitch-track': { bgcolor: '#2ecc71 !important' } }} />
                <Typography sx={{ fontSize: 13 }}>ローカル配信（ComfyUI・無料）</Typography>
              </Box>
            </Box>
            <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.5)', mt: 0.75 }}>
              ※ 現状はトグルで状態管理まで。airender の <code>officialLoras.js</code> / ComfyUI の <code>models/loras</code> への実反映は次段（自動同期）。
            </Typography>
          </Box>

          {/* ④ 運用 */}
          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: ACCENT, mb: 0.75 }}>④ 運用・メモ</Typography>
            <TextField size="small" fullWidth multiline maxRows={3} label="メモ（学習条件・課題・再学習の方針など）" value={selected.note}
              onChange={(e) => patch({ note: e.target.value })} sx={fieldSx} />
          </Box>
        </Box>
      )}

      {/* 学習結果ダイアログ（完了 / 失敗 / 中断） */}
      <Dialog open={!!trainNotice} onClose={clearNotice}
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', backgroundImage: 'none', color: 'var(--brand-fg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', minWidth: 460, maxWidth: 560 } }}>
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          {trainNotice?.kind === 'done' ? (
            <><AutoAwesomeRoundedIcon sx={{ color: '#2ecc71' }} />学習が完了しました</>
          ) : trainNotice?.kind === 'cancelled' ? (
            <>学習を中断しました</>
          ) : (
            <>学習に失敗しました</>
          )}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {trainNotice?.kind === 'done' && (
            <>
              {([
                ['モデル', trainNotice.modelName],
                ['ベース', trainNotice.base],
                ['学習時間', trainNotice.minutes ? `約${trainNotice.minutes}分` : '—'],
                ['重みの保存先', trainNotice.weights || '—'],
              ] as const).map(([k, v]) => (
                <Box key={k} sx={{ display: 'flex', gap: 1.5 }}>
                  <Typography sx={{ width: 100, fontSize: 13, color: 'rgb(var(--brand-fg-rgb) / 0.55)', flexShrink: 0 }}>{k}</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, wordBreak: 'break-all' }}>{v}</Typography>
                </Box>
              ))}
              <Box sx={{ mt: 1, p: 1.5, borderRadius: 2, bgcolor: 'rgba(46,204,113,0.08)', border: '1px solid #2ecc7133' }}>
                <Typography sx={{ fontSize: 12.5, lineHeight: 1.7 }}>
                  <b>次のステップ</b>：S.Image → 新規生成 → モデルで
                  「学習モデル: {trainNotice.modelName}{trainNotice.base === 'SDXL' ? '（SDXL・無料）' : ''}」を選んでテスト生成。
                  良ければ ③配信、イマイチなら教材を見直して再学習（④運用にメモ）。
                </Typography>
              </Box>
            </>
          )}
          {trainNotice?.kind === 'cancelled' && (
            <Typography sx={{ fontSize: 13, lineHeight: 1.7 }}>
              「{trainNotice.modelName}」の学習を中断しました（{trainNotice.minutes ? `約${trainNotice.minutes}分` : ''}経過時点）。
              途中結果は保存されていません。前回の重みがあればそのまま使えます。
            </Typography>
          )}
          {trainNotice?.kind === 'error' && (
            <>
              <Typography sx={{ fontSize: 13, lineHeight: 1.7 }}>「{trainNotice.modelName}」の学習中にエラーが発生しました。</Typography>
              <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: 'rgba(255,123,123,0.08)', border: '1px solid rgba(255,123,123,0.25)', maxHeight: 140, overflow: 'auto' }}>
                <Typography sx={{ fontSize: 11.5, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {trainNotice.detail}
                </Typography>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={clearNotice} variant="contained"
            sx={{ bgcolor: trainNotice?.kind === 'done' ? '#2ecc71' : 'rgb(var(--brand-fg-rgb) / 0.15)', color: trainNotice?.kind === 'done' ? '#08320f' : 'var(--brand-fg)', fontWeight: 700, '&:hover': { bgcolor: trainNotice?.kind === 'done' ? '#3fd984' : 'rgb(var(--brand-fg-rgb) / 0.25)' } }}>
            OK
          </Button>
        </DialogActions>
      </Dialog>

      {/* 学習開始の確認ダイアログ */}
      <Dialog open={!!trainConfirm} onClose={() => setTrainConfirm(null)}
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', backgroundImage: 'none', color: 'var(--brand-fg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', minWidth: 440 } }}>
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <PlayArrowRoundedIcon sx={{ color: '#2ecc71' }} />
          {selected?.name} の学習を開始
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {([
            ['ベース', selected?.base === 'SDXL' ? 'SDXL（ローカルGPU）' : 'FLUX（fal クラウド）'],
            ['費用', selected?.base === 'SDXL' ? '無料（電気代のみ）' : '約$2 / 回'],
            ['目安時間', selected?.base === 'SDXL' ? '40分〜2時間（1200ステップ）' : '数分'],
            ['教材', `${selected?.imageCount ?? 0} 枚`],
            ['トリガー語', trainConfirm?.trigger || ''],
          ] as const).map(([k, v]) => (
            <Box key={k} sx={{ display: 'flex', gap: 1.5 }}>
              <Typography sx={{ width: 90, fontSize: 13, color: 'rgb(var(--brand-fg-rgb) / 0.55)', flexShrink: 0 }}>{k}</Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{v}</Typography>
            </Box>
          ))}
          <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.55)', mt: 1 }}>
            学習中は進捗バーで残り時間を確認できます。画面を移動しても学習は続きますが、アプリは閉じないでください。
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setTrainConfirm(null)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>キャンセル</Button>
          <Button onClick={doStartTraining} variant="contained"
            sx={{ bgcolor: '#2ecc71', color: '#08320f', fontWeight: 700, '&:hover': { bgcolor: '#3fd984' } }}>
            学習を開始
          </Button>
        </DialogActions>
      </Dialog>

      {/* 新規モデル ダイアログ */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)}
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', backgroundImage: 'none', color: 'var(--brand-fg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', minWidth: 420 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>新規モデル（LoRA）</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
          <TextField size="small" label="表示名（例: 家具）" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus sx={fieldSx} />
          <TextField size="small" select label="用途" value={draft.usage} onChange={(e) => setDraft({ ...draft, usage: e.target.value })} sx={fieldSx}>
            {USAGES.map((u) => <MenuItem key={u} value={u} sx={{ fontSize: 13 }}>{u}</MenuItem>)}
          </TextField>
          <TextField size="small" select label="ベースモデル" value={draft.base} onChange={(e) => setDraft({ ...draft, base: e.target.value })} sx={fieldSx}>
            {BASES.map((b) => <MenuItem key={b} value={b} sx={{ fontSize: 13 }}>{b}</MenuItem>)}
          </TextField>
          <TextField size="small" label="トリガー語（任意・生成時に付与）" value={draft.triggerWord} onChange={(e) => setDraft({ ...draft, triggerWord: e.target.value.trim() })} placeholder="例: skvfurn" sx={fieldSx} />
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setCreateOpen(false)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>キャンセル</Button>
          <Button onClick={doCreate} disabled={!draft.name.trim()} variant="contained" sx={{ bgcolor: ACCENT, color: 'var(--brand-fg)', '&:hover': { bgcolor: '#f48fb1' } }}>作成</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ModelStudioPanel;

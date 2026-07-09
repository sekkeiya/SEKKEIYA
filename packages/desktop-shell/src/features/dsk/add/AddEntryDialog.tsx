import React, { useMemo, useRef, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Box, Typography,
  ToggleButtonGroup, ToggleButton, MenuItem, Chip, CircularProgress,
} from '@mui/material';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import StickyNote2RoundedIcon from '@mui/icons-material/StickyNote2Rounded';
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import { listKnownCategories, isWeakCategory, type KnowledgeKind } from '../types';
import { saveKnowledgeEntry, saveUrlSnapshot, fetchUrlContent, readLocalBinaryFile } from '../api/knowledgeApi';
import { CATALOG_SOURCES } from '../data/catalogSources';
import { useDskStore } from '../store/useDskStore';
import { classifyKnowledge, looksLikeBook } from '../lib/ruleClassify';
import { autoEnrichInBackground } from '../lib/autoEnrich';
import { extractPdfTextWithMeta } from '../../dsf/lib/pdf';

const ACCENT = '#26a69a';

interface AddEntryDialogProps {
  open: boolean;
  onClose: () => void;
}

type AddKind = KnowledgeKind; // 書籍(book) / 書類(pdf) / Web(url) / メモ(note)

const uuid = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.floor(Math.random() * 1e9)}`);

export const AddEntryDialog: React.FC<AddEntryDialogProps> = ({ open, onClose }) => {
  const upsert = useDskStore(s => s.upsert);
  const entries = useDskStore(s => s.entries);
  // 既定は「書類」。ユーザーが種別を手で選んだかを覚え、選んでいないときだけ自動判定で書籍へ昇格する。
  const [kind, setKind] = useState<AddKind>('pdf');
  const kindTouchedRef = useRef(false);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [category, setCategory] = useState<string>('その他');
  const [tagsInput, setTagsInput] = useState('');
  const [sourcePath, setSourcePath] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [body, setBody] = useState('');
  const [saveSnapshot, setSaveSnapshot] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [classifying, setClassifying] = useState(false);
  const [autoHint, setAutoHint] = useState<string | null>(null);

  // 既存データから動的に育つカテゴリ選択肢（自動分類が付けた新カテゴリも合流させる）。
  const categoryOptions = useMemo(() => {
    const base = listKnownCategories(entries);
    return base.includes(category) ? base : [...base, category];
  }, [entries, category]);

  const reset = () => {
    setKind('pdf'); kindTouchedRef.current = false;
    setTitle(''); setAuthor(''); setCategory('その他');
    setTagsInput(''); setSourcePath(null); setSourceUrl(''); setBody('');
    setSaveSnapshot(true); setBusy(false); setError(null);
    setClassifying(false); setAutoHint(null);
  };

  // ファイル名＋抽出テキストからルールベースで分類し、カテゴリ・タグを自動補完する。
  const autoClassify = (opts: { fileName?: string; text?: string }) => {
    const r = classifyKnowledge(opts);
    if (r.matched) {
      setCategory(r.category);
      if (r.tags.length) {
        // 既存タグ入力に重複なくマージ
        setTagsInput((prev) => {
          const existing = prev.split(/[,、\s]+/).map((t) => t.trim()).filter(Boolean);
          const merged = Array.from(new Set([...existing, ...r.tags]));
          return merged.join(', ');
        });
      }
      setAutoHint(`自動分類: ${r.category}`);
    } else {
      setAutoHint(null);
    }
  };

  const handleClose = () => { if (!busy) { reset(); onClose(); } };

  const pickFile = async () => {
    setError(null);
    try {
      const { open: openDialog } = await import('@tauri-apps/plugin-dialog');
      const selected = await openDialog({
        multiple: false,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });
      if (typeof selected === 'string') {
        setSourcePath(selected);
        const fileName = selected.replace(/\\/g, '/').split('/').pop() || '';
        if (!title) setTitle(fileName.replace(/\.pdf$/i, ''));
        // ルールベース自動分類（完全ローカル）。ファイル名で即時、PDF本文でさらに精度化。
        autoClassify({ fileName });
        setClassifying(true);
        try {
          const bytes = await readLocalBinaryFile(selected);
          const buf = new Uint8Array(bytes).buffer;
          const meta = await extractPdfTextWithMeta(buf, 5);
          autoClassify({ fileName, text: meta.text });
          // 種別の自動補正: ユーザーが種別を触っていない（既定の書類のまま）ときだけ、
          // 内容が書籍らしければ「書籍」へ昇格する。
          if (!kindTouchedRef.current && kind === 'pdf' && looksLikeBook({ fileName, text: meta.text })) {
            setKind('book');
            setAutoHint((h) => (h ? `${h} / 書籍として判定` : '書籍として判定'));
          }
        } catch (e) {
          console.warn('[AddEntryDialog] auto-classify text extract failed', e);
        } finally {
          setClassifying(false);
        }
      }
    } catch (e: any) {
      console.error('[AddEntryDialog] pickFile failed', e);
      setError('ファイル選択に失敗しました。');
    }
  };

  const fetchTitleFromUrl = async () => {
    const url = sourceUrl.trim();
    if (!url) return;
    // PDF など非HTMLの直リンクは HTML 取得（fetch_url_content）に通さない。
    // ファイル名からタイトルを補完し、ルール分類する。
    const isPdfUrl = /\.pdf(\?|#|$)/i.test(url);
    if (isPdfUrl) {
      setSaveSnapshot(false); // PDF直リンクは HTML スナップショット不要
      try {
        const path = decodeURIComponent(new URL(url).pathname);
        const fileName = path.split('/').pop() || 'カタログ';
        const niceTitle = fileName.replace(/\.pdf$/i, '');
        if (!title) setTitle(niceTitle);
        autoClassify({ fileName: niceTitle });
      } catch {
        if (!title) setTitle('PDF カタログ');
      }
      return;
    }
    setBusy(true); setError(null);
    try {
      const content = await fetchUrlContent(url);
      if (content.title && !title) setTitle(content.title);
      // 取得した本文＋タイトルからルールベースで即時分類（URL も対象に）。
      autoClassify({ fileName: content.title || title, text: content.text });
    } catch (e: any) {
      console.error('[AddEntryDialog] fetch url failed', e);
      setError('URL の取得に失敗しました。手動でタイトルを入力してください。');
    } finally {
      setBusy(false);
    }
  };

  const canSave =
    !!title.trim() &&
    !busy &&
    (kind === 'note' ? !!body.trim() : kind === 'url' ? !!sourceUrl.trim() : !!sourcePath);

  const handleSave = async () => {
    if (!canSave) return;
    setBusy(true); setError(null);
    const localId = uuid();
    // メモはファイルが無いので、保存直前に本文＋タイトルでルール分類（カテゴリ既定のときのみ反映）。
    let finalCategory = category;
    if (kind === 'note' && category === 'その他') {
      const r = classifyKnowledge({ fileName: title, text: body });
      if (r.matched) finalCategory = r.category;
    }
    const tags = tagsInput.split(/[,、\s]+/).map(t => t.trim()).filter(Boolean);
    try {
      const entry = await saveKnowledgeEntry({
        localId,
        kind, // book/pdf は Rust 側で PDF を LocalAssets\Documents\PDF にコピー
        title: title.trim(),
        category: finalCategory,
        author: author.trim() || null,
        tags,
        sourcePath: kind === 'book' || kind === 'pdf' ? sourcePath : null,
        sourceUrl: kind === 'url' ? sourceUrl.trim() : null,
        bodyMarkdown: kind === 'note' ? body : null,
      });
      upsert(entry);

      // URL: 任意で HTML スナップショットを保存
      if (kind === 'url' && saveSnapshot) {
        try {
          await saveUrlSnapshot(localId, sourceUrl.trim());
          await useDskStore.getState().refresh();
        } catch (e) {
          console.warn('[AddEntryDialog] snapshot failed (best-effort)', e);
        }
      }

      // ハイブリッド後段: ルールで分類しきれなかった（その他のまま）ものだけ、
      // バックグラウンドで AI に本文を読ませてカテゴリ/タグ/要約を補完する。
      // fire-and-forget（ダイアログは即閉じる。未デプロイ時は静かに無視）。
      if (isWeakCategory(finalCategory)) {
        void autoEnrichInBackground(entry);
      }

      reset();
      onClose();
    } catch (e: any) {
      console.error('[AddEntryDialog] save failed', e);
      setError(String(e?.message ?? e));
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', backgroundImage: 'none', color: 'var(--brand-fg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)' } }}>
      <DialogTitle sx={{ pb: 1, fontSize: 18, fontWeight: 700 }}>知識を追加</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        <ToggleButtonGroup
          exclusive value={kind} onChange={(_, v) => { if (v) { setKind(v); kindTouchedRef.current = true; setAutoHint(null); } }} size="small" fullWidth
          sx={{ '& .MuiToggleButton-root': { color: 'rgb(var(--brand-fg-rgb) / 0.6)', borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)', gap: 0.75, py: 1 }, '& .Mui-selected': { color: '#fff !important', bgcolor: `${ACCENT} !important` } }}
        >
          <ToggleButton value="book"><MenuBookRoundedIcon sx={{ fontSize: 18 }} />書籍</ToggleButton>
          <ToggleButton value="pdf"><DescriptionRoundedIcon sx={{ fontSize: 18 }} />書類</ToggleButton>
          <ToggleButton value="url"><LanguageRoundedIcon sx={{ fontSize: 18 }} />Web URL</ToggleButton>
          <ToggleButton value="note"><StickyNote2RoundedIcon sx={{ fontSize: 18 }} />メモ</ToggleButton>
        </ToggleButtonGroup>

        {(kind === 'book' || kind === 'pdf') && (
          <Box>
            <Button variant="outlined" startIcon={<FolderOpenRoundedIcon />} onClick={pickFile}
              sx={{ color: ACCENT, borderColor: ACCENT, '&:hover': { borderColor: '#4db6ac' } }}>
              PDF を選択
            </Button>
            {sourcePath && (
              <Typography noWrap sx={{ mt: 1, fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>{sourcePath}</Typography>
            )}
            <Typography sx={{ mt: 1, fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>
              書籍＝通読する出版物（本・雑誌）／書類＝カタログ・仕様書などの実務資料。内容から自動判定します（変更可）。
              <br />※ 選択した PDF は PC\SEKKEIYA\LocalAssets\Documents\PDF にコピーされ、クラウドには上がりません。
            </Typography>
          </Box>
        )}

        {kind === 'url' && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              label="URL" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)}
              fullWidth size="small" placeholder="https://..." sx={textSx}
            />
            <Button onClick={fetchTitleFromUrl} disabled={!sourceUrl.trim() || busy} sx={{ color: ACCENT, whiteSpace: 'nowrap' }}>取得</Button>
          </Box>
        )}

        {/* メーカー電子カタログのワンクリック・プリフィル（クリックで下のフォームに反映→「追加」で登録） */}
        {kind === 'url' && (
          <Box>
            <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.5)', mb: 0.75 }}>
              主要仕上げメーカーの電子カタログ（クリックで入力 → 「追加」で登録）
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {CATALOG_SOURCES.map((c) => (
                <Chip
                  key={c.manufacturer}
                  label={c.manufacturer}
                  size="small"
                  onClick={() => {
                    setSourceUrl(c.url);
                    setTitle(c.title);
                    setAuthor(c.manufacturer);
                    setCategory('素材・建材');
                    setTagsInput((prev) => {
                      const existing = prev.split(/[,、\s]+/).map((t) => t.trim()).filter(Boolean);
                      return Array.from(new Set([...existing, c.manufacturer, c.genre])).join(', ');
                    });
                    setAutoHint(`${c.manufacturer}（${c.genre}）`);
                  }}
                  sx={{ height: 24, fontSize: 11, color: 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.15)', cursor: 'pointer', '&:hover': { borderColor: ACCENT, bgcolor: `${ACCENT}22` } }}
                />
              ))}
            </Box>
          </Box>
        )}

        <TextField label="タイトル" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth size="small" sx={textSx} />

        {kind !== 'note' && (
          <TextField label="著者 / 発信元（任意）" value={author} onChange={(e) => setAuthor(e.target.value)} fullWidth size="small" sx={textSx} />
        )}

        {kind === 'note' && (
          <TextField label="本文（Markdown）" value={body} onChange={(e) => setBody(e.target.value)} fullWidth multiline minRows={5} size="small" sx={textSx} />
        )}

        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField select label="カテゴリ" value={category} onChange={(e) => setCategory(e.target.value)} size="small" sx={{ ...textSx, minWidth: 140 }}>
            {categoryOptions.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </TextField>
          <TextField label="タグ（カンマ区切り）" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} fullWidth size="small" sx={textSx} />
        </Box>

        {(classifying || autoHint) && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: -0.5 }}>
            {classifying ? (
              <>
                <CircularProgress size={12} sx={{ color: ACCENT }} />
                <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>内容から自動分類中…</Typography>
              </>
            ) : (
              <>
                <AutoAwesomeRoundedIcon sx={{ fontSize: 14, color: ACCENT }} />
                <Typography sx={{ fontSize: 11, color: ACCENT }}>{autoHint}（ルールベース・変更可）</Typography>
              </>
            )}
          </Box>
        )}

        {kind === 'url' && (
          <Chip
            onClick={() => setSaveSnapshot(v => !v)}
            label={saveSnapshot ? 'HTMLスナップショットを保存する' : 'スナップショットを保存しない'}
            sx={{ alignSelf: 'flex-start', bgcolor: saveSnapshot ? `${ACCENT}33` : 'rgb(var(--brand-fg-rgb) / 0.08)', color: saveSnapshot ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.6)', cursor: 'pointer' }}
          />
        )}

        {error && <Typography sx={{ color: 'light-dark(#ad0000, #ff6b6b)', fontSize: 13 }}>{error}</Typography>}
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 0, gap: 1 }}>
        <Button onClick={handleClose} disabled={busy} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>キャンセル</Button>
        <Button onClick={handleSave} disabled={!canSave} variant="contained"
          startIcon={busy ? <CircularProgress size={16} sx={{ color: 'var(--brand-fg)' }} /> : undefined}
          sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#4db6ac' }, '&.Mui-disabled': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.12)', color: 'rgb(var(--brand-fg-rgb) / 0.4)' } }}>
          {busy ? '保存中...' : '追加'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const textSx = {
  '& .MuiInputBase-root': { color: 'var(--brand-fg)' },
  '& .MuiInputLabel-root': { color: 'rgb(var(--brand-fg-rgb) / 0.6)' },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' },
  '& .MuiSvgIcon-root': { color: 'rgb(var(--brand-fg-rgb) / 0.6)' },
} as const;

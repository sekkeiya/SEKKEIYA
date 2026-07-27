// backlog/rowFields.tsx — DevStatusPanel の行/セルで共有する小さな presentational コンポーネント群。
// （ドット・バッジ・各種セレクト・インライン編集）。react-refresh を満たすため、この .tsx は
// コンポーネントのみを export する（定数・型は rowConstants.ts / DevStatusPanel から import）。
import React, { useState } from 'react';
import {
  Box, Typography, TextField, Button, IconButton, Tooltip, Select, MenuItem, Autocomplete, TableCell, Badge,
} from '@mui/material';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';
import { CAT_MAP, toolLabel, toolColor } from '../devStatusLogic';
import {
  STATUSES, STATUS_MAP, PLATFORMS, PLATFORM_MAP, KINDS, KIND_MAP,
  SELECT_SX, MENU_PROPS, AC_SLOT_PROPS, AC_COMPACT_SX,
  type Platform, type Kind, type ReqStatus,
} from './rowConstants';
import type { BacklogItem, Sprint } from '../DevStatusPanel';

// ── カテゴリの丸ドット＋ラベル ────────────────────────────────────
export const CatDot: React.FC<{ id?: string | null; withLabel?: boolean }> = ({ id, withLabel }) => {
  const c = id ? CAT_MAP[id] : undefined;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: c ? c.color : 'transparent', border: c ? 'none' : '1px solid', borderColor: 'text.disabled', flexShrink: 0 }} />
      {withLabel && <Typography variant="caption" sx={{ color: c ? 'text.primary' : 'text.disabled', whiteSpace: 'nowrap' }}>{c ? c.label : '未分類'}</Typography>}
    </Box>
  );
};

// ── プラットフォームの角バッジ（D / W / 共 / BE） ─────────────────
export const PlatformBadge: React.FC<{ id: Platform; withLabel?: boolean }> = ({ id, withLabel }) => {
  const p = PLATFORM_MAP[id];
  if (!p) return null;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
      <Box sx={{ px: 0.5, minWidth: 18, textAlign: 'center', borderRadius: 0.75, bgcolor: p.color, color: 'rgba(0,0,0,0.82)', fontSize: 10, fontWeight: 800, lineHeight: '16px', flexShrink: 0 }}>
        {p.short}
      </Box>
      {withLabel && <Typography variant="caption" sx={{ whiteSpace: 'nowrap', fontSize: 13 }}>{p.label}</Typography>}
    </Box>
  );
};

export const Dash: React.FC = () => <Typography variant="caption" sx={{ color: 'text.disabled' }}>—</Typography>;

// ツール（CategorySelect の入力欄プレースホルダー ⇄ ToolDisplay の空表示）で共有する「未設定時の文言」。
// 値が無く親要求から継承できるときは「◯◯（継承）」、それ以外は渡された placeholder（既定 '—'）。
const toolPlaceholder = (value: string | null | undefined, inherited: string | null | undefined, placeholder?: string) =>
  (value == null && inherited) ? `${toolLabel(inherited)}（継承）` : (placeholder ?? '—');

// ── テーブル/詳細で使う小さなセレクト（安定したトップレベル定義＝再マウント防止） ──
// autoOpen: EditableCell から「クリックで初めてマウント」された時に true。マウント即プルダウンを
//   開き（Select=defaultOpen / Autocomplete=open 初期値 true）、1 クリックで開く体験を保つ。
// onClose: 閉じたら表示ノードへ戻すための EditableCell の close()。Select は選択・Escape・
//   バックドロップのいずれでも onClose が出る（onChange → onClose の順なので確定は取りこぼさない）。
export const PlatformSelect: React.FC<{ value?: Platform | null; onChange: (v: Platform | null) => void; placeholder?: string; inherited?: Platform | null; autoOpen?: boolean; onClose?: () => void }> = ({ value, onChange, placeholder, inherited, autoOpen, onClose }) => (
  <Select
    size="small" displayEmpty value={value || ''}
    defaultOpen={autoOpen} onClose={onClose}
    onChange={(e) => onChange((e.target.value || null) as Platform | null)}
    renderValue={(v) => <PlatformDisplay value={v as Platform} inherited={inherited} placeholder={placeholder} />}
    MenuProps={MENU_PROPS}
    sx={{ ...SELECT_SX, minWidth: 52 }}
  >
    <MenuItem value=""><em>{inherited ? '継承（親要求）' : '—'}</em></MenuItem>
    {PLATFORMS.map(p => <MenuItem key={p.id} value={p.id}><PlatformBadge id={p.id} withLabel /></MenuItem>)}
  </Select>
);

// ツール色ドット（既知=色 / 自由入力=無色の輪郭）
export const ToolDot: React.FC<{ id?: string | null }> = ({ id }) => {
  const known = !!(id && CAT_MAP[id]);
  return <Box sx={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, bgcolor: known ? toolColor(id) : 'transparent', border: known ? 'none' : '1px solid', borderColor: 'text.disabled' }} />;
};
// ツール選択（既知=色つき候補 / 自由入力で追加可 / 親要求からの継承はゴースト表示）
// 要件79: 候補は options で丸ごと受け取る（プロジェクト種別で語彙が変わるため、ここで
// SEKKEIYA の子アプリ一覧を混ぜない）。呼び出し側が「基本候補＋実データの既出値」を渡す。
export const CategorySelect: React.FC<{
  value?: string | null; onChange: (v: string | null) => void;
  placeholder?: string; options?: string[]; inherited?: string | null;
  autoOpen?: boolean; onClose?: () => void;
}> = ({ value, onChange, placeholder, options = [], inherited, autoOpen, onClose }) => {
  const opts = [...new Set(options)];
  const ph = toolPlaceholder(value, inherited, placeholder);
  // Autocomplete には defaultOpen が無いので open を自前で持つ（初期値＝autoOpen）。
  // onOpen/onClose をそのまま反映するだけなので、autoOpen なしの挙動は非制御時と同一。
  const [open, setOpen] = useState(!!autoOpen);
  return (
    <Autocomplete
      freeSolo autoSelect selectOnFocus handleHomeEndKeys size="small" popupIcon={null} slotProps={AC_SLOT_PROPS}
      open={open} onOpen={() => setOpen(true)}
      onClose={() => { setOpen(false); onClose?.(); }}
      openOnFocus={autoOpen}
      options={opts} value={value ?? null}
      onChange={(_, v) => onChange((typeof v === 'string' ? v.trim() : v) || null)}
      getOptionLabel={(o) => toolLabel(typeof o === 'string' ? o : '')}
      renderOption={(props, o) => {
        const { key, ...rest } = props as React.HTMLAttributes<HTMLLIElement> & { key?: string };
        return <Box component="li" key={key} {...rest} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 13 }}><ToolDot id={o} /> {toolLabel(o)}</Box>;
      }}
      renderInput={(params) => (
        <TextField
          {...params} variant="outlined" placeholder={ph} autoFocus={autoOpen}
          slotProps={{ input: {
            ...params.InputProps,
            startAdornment: value ? <Box sx={{ ml: 0.25, display: 'flex', flexShrink: 0 }}><ToolDot id={value} /></Box> : undefined,
          } }}
        />
      )}
      sx={{ width: '100%', ...AC_COMPACT_SX }}
    />
  );
};

// 画面選択（既知候補＋自由入力）
export const ScreenSelect: React.FC<{ value?: string | null; onChange: (v: string | null) => void; options?: string[]; autoOpen?: boolean; onClose?: () => void }> = ({ value, onChange, options = [], autoOpen, onClose }) => {
  const opts = [...new Set(options)];
  const [open, setOpen] = useState(!!autoOpen);
  return (
    <Autocomplete
      freeSolo autoSelect selectOnFocus handleHomeEndKeys size="small" popupIcon={null} slotProps={AC_SLOT_PROPS}
      open={open} onOpen={() => setOpen(true)}
      onClose={() => { setOpen(false); onClose?.(); }}
      openOnFocus={autoOpen}
      options={opts} value={value ?? null}
      onChange={(_, v) => onChange((typeof v === 'string' ? v.trim() : v) || null)}
      renderInput={(params) => (
        <TextField
          {...params} variant="outlined" placeholder="—" autoFocus={autoOpen}
          slotProps={{ input: { ...params.InputProps } }}
        />
      )}
      sx={{ width: '100%', ...AC_COMPACT_SX }}
    />
  );
};

export const KindSelect: React.FC<{ value?: Kind | null; onChange: (v: Kind | null) => void; autoOpen?: boolean; onClose?: () => void }> = ({ value, onChange, autoOpen, onClose }) => (
  <Select
    size="small" displayEmpty value={value || ''}
    defaultOpen={autoOpen} onClose={onClose}
    onChange={(e) => onChange((e.target.value || null) as Kind | null)}
    renderValue={(v) => <KindDisplay value={v as Kind} />}
    MenuProps={MENU_PROPS}
    sx={{ ...SELECT_SX, minWidth: 72 }}
  >
    <MenuItem value=""><em>—</em></MenuItem>
    {KINDS.map(k => <MenuItem key={k.id} value={k.id}><Typography variant="caption" sx={{ color: k.color, fontWeight: 600, fontSize: 13 }}>{k.label}</Typography></MenuItem>)}
  </Select>
);

export const StatusSelect: React.FC<{ value: ReqStatus; onChange: (v: ReqStatus) => void; autoOpen?: boolean; onClose?: () => void }> = ({ value, onChange, autoOpen, onClose }) => (
  <Select
    size="small" value={value}
    defaultOpen={autoOpen} onClose={onClose}
    onChange={(e) => onChange(e.target.value as ReqStatus)}
    renderValue={(v) => <StatusDisplay value={v as ReqStatus} />}
    MenuProps={MENU_PROPS}
    sx={{ ...SELECT_SX, minWidth: 72 }}
  >
    {STATUSES.map(s => <MenuItem key={s.id} value={s.id}><Typography variant="caption" sx={{ color: s.color, fontWeight: 600, fontSize: 13 }}>{s.label}</Typography></MenuItem>)}
  </Select>
);

export const SprintSelect: React.FC<{ value?: string | null; sprints: Sprint[]; onChange: (v: string | null) => void; autoOpen?: boolean; onClose?: () => void }> = ({ value, sprints, onChange, autoOpen, onClose }) => {
  const sorted = [...sprints].sort((a, b) => a.seq - b.seq);
  const options = sorted.filter(s => !s.archived);
  const cur = value ? sorted.find(s => s.id === value) : undefined;
  if (cur && cur.archived) options.push(cur); // 履歴の完了要件でも現在値は残す
  return (
    <Select
      size="small" displayEmpty value={value || ''}
      defaultOpen={autoOpen} onClose={onClose}
      onChange={(e) => onChange(e.target.value || null)}
      renderValue={(v) => <SprintDisplay value={v as string} sprints={sprints} />}
      MenuProps={MENU_PROPS}
      sx={{ ...SELECT_SX, minWidth: 96 }}
    >
      <MenuItem value=""><em>バックログ</em></MenuItem>
      {options.map(s => <MenuItem key={s.id} value={s.id}>Sprint {s.seq}{s.archived ? '（完了）' : ''}</MenuItem>)}
    </Select>
  );
};

// ── 表示専用ノード（EditableCell の非編集時に描く軽量な見た目） ──────────────
// 各コントロールの renderValue（Autocomplete は「閉じた入力欄」）と同じ見た目を、
// MUI の Select / Autocomplete をマウントせずに再現する。ここが実コントロールと
// ずれると「クリックした瞬間に表示が変わる」ので、対応する renderValue と必ず対で直すこと。

/** PlatformSelect の renderValue と同一（値=バッジ / 継承=ゴーストバッジ＋「継承」/ 無し=placeholder or —）。 */
export const PlatformDisplay: React.FC<{ value?: Platform | null; inherited?: Platform | null; placeholder?: string }> = ({ value, inherited, placeholder }) => {
  if (value) return <PlatformBadge id={value} />;
  if (inherited) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, opacity: 0.6, minWidth: 0 }}>
        <PlatformBadge id={inherited} />
        <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: 9 }}>継承</Typography>
      </Box>
    );
  }
  return placeholder ? <Typography variant="caption" noWrap sx={{ color: 'text.disabled' }}>{placeholder}</Typography> : <Dash />;
};

/** CategorySelect（ツール）の閉じた入力欄と同一（値=ドット＋ラベル / 無し=継承 or placeholder の薄字）。 */
export const ToolDisplay: React.FC<{ value?: string | null; inherited?: string | null; placeholder?: string }> = ({ value, inherited, placeholder }) => {
  const ph = toolPlaceholder(value, inherited, placeholder);
  if (!value) return <Typography variant="caption" noWrap sx={{ color: 'text.disabled', minWidth: 0 }}>{ph}</Typography>;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
      <ToolDot id={value} />
      <Typography variant="caption" noWrap sx={{ minWidth: 0 }}>{toolLabel(value)}</Typography>
    </Box>
  );
};

/** ScreenSelect の閉じた入力欄と同一（値=そのまま / 無し=—）。 */
export const ScreenDisplay: React.FC<{ value?: string | null }> = ({ value }) => (
  value ? <Typography variant="caption" noWrap sx={{ minWidth: 0 }}>{value}</Typography> : <Dash />
);

/** KindSelect の renderValue と同一。 */
export const KindDisplay: React.FC<{ value?: Kind | null }> = ({ value }) => {
  const k = value ? KIND_MAP[value] : undefined;
  return k
    ? <Typography variant="caption" noWrap sx={{ color: k.color, fontWeight: 600 }}>{k.label}</Typography>
    : <Dash />;
};

/** StatusSelect の renderValue と同一。 */
export const StatusDisplay: React.FC<{ value: ReqStatus }> = ({ value }) => {
  const s = STATUS_MAP[value];
  return <Typography variant="caption" noWrap sx={{ color: s ? s.color : 'text.disabled', fontWeight: 600 }}>{s ? s.label : value}</Typography>;
};

/** SprintSelect の renderValue と同一（未割当は「バックログ」）。 */
export const SprintDisplay: React.FC<{ value?: string | null; sprints: Sprint[] }> = ({ value, sprints }) => {
  const s = value ? sprints.find(x => x.id === value) : undefined;
  return s
    ? <Typography variant="caption" noWrap>Sprint {s.seq}{s.archived ? '（完了）' : ''}</Typography>
    : <Typography variant="caption" noWrap sx={{ color: 'text.secondary' }}>バックログ</Typography>;
};

// インライン編集テキスト（要件8: 内容/理由をダイアログを開かず直接編集）。IME 対策で編集中は
// ローカル draft を持ち、blur / Enter で確定。required=true は空を許さず元値へ戻す（内容用）。
export const InlineText: React.FC<{
  value?: string | null; onCommit: (v: string | null) => void;
  placeholder?: string; required?: boolean; bold?: boolean; strike?: boolean;
}> = ({ value, onCommit, placeholder, required, bold, strike }) => {
  const external = value ?? '';
  const [draft, setDraft] = useState(external);
  const [prev, setPrev] = useState(external);
  if (external !== prev) { setPrev(external); setDraft(external); }
  const commit = () => {
    const t = draft.trim();
    if (required && !t) { setDraft(external); return; }
    if ((t || null) !== (value ?? null)) onCommit(t || null);
  };
  return (
    <TextField
      variant="standard" size="small" fullWidth multiline maxRows={6} placeholder={placeholder}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); } }}
      slotProps={{ input: { disableUnderline: true, sx: { fontSize: 13, fontWeight: bold ? 700 : 400, textDecoration: strike ? 'line-through' : 'none', lineHeight: 1.35 } } }}
    />
  );
};

// 追加用インライン入力（要件24: ローカル state で持ち、1文字ごとに親テーブルを再描画しない）。
export const InlineAddInput: React.FC<{
  placeholder: string; onAdd: (text: string) => void;
  variant?: 'standard' | 'outlined'; fontSize?: number; maxWidth?: number;
}> = ({ placeholder, onAdd, variant = 'standard', fontSize = 13, maxWidth }) => {
  const [text, setText] = useState('');
  const submit = () => { const t = text.trim(); if (!t) return; onAdd(t); setText(''); };
  return (
    <>
      <TextField
        variant={variant} size="small" placeholder={placeholder} value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !(e.nativeEvent as KeyboardEvent).isComposing) submit(); }}
        slotProps={variant === 'standard' ? { input: { disableUnderline: true, sx: { fontSize } } } : undefined}
        sx={{ flex: 1, minWidth: 120, maxWidth, ...(variant === 'outlined' ? { '& .MuiInputBase-root': { height: 30 }, '& .MuiInputBase-input': { fontSize, py: 0 } } : {}) }}
      />
      <Button size="small" disableElevation variant={variant === 'outlined' ? 'contained' : 'text'} disabled={!text.trim()} onClick={submit} sx={{ textTransform: 'none', whiteSpace: 'nowrap', minWidth: 0, ...(variant === 'outlined' ? { minHeight: 30, py: 0.25 } : {}) }}>追加</Button>
    </>
  );
};

// 添付セル（要件27: ボタンだけ。押すと D&D 対応の添付ダイアログを開く）。
// 元 renderAttachCell と同一。onOpen は DevStatusPanel の setAttachTargetId。
export const AttachCell: React.FC<{ item: BacklogItem; onOpen: (id: string) => void }> = ({ item, onOpen }) => {
  const n = item.attachments?.length ?? 0;
  return (
    <TableCell align="center">
      <Tooltip title={n > 0 ? `添付 ${n} 件` : '添付を追加'} arrow>
        <IconButton size="small" onClick={() => onOpen(item.id)} sx={{ p: 0.25, color: n > 0 ? 'light-dark(#0875a6, #4fc3f7)' : 'text.disabled' }}>
          {n > 0
            ? <Badge badgeContent={n} color="primary" slotProps={{ badge: { style: { fontSize: 9, height: 14, minWidth: 14 } } }}><AttachFileRoundedIcon fontSize="small" /></Badge>
            : <AttachFileRoundedIcon fontSize="small" />}
        </IconButton>
      </Tooltip>
    </TableCell>
  );
};

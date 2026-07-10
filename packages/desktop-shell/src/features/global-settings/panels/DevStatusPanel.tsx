// Global Settings > 管理者 > 開発状況（管理者専用）。
// SEKKEIYA の開発状況をアジャイルのバックログのように把握・チェックする画面。
// - 上部トグルで「要求定義」「要件定義」の2リストを切り替え
// - 各項目: 期限（いつまでに）/ 進捗（どこまで）/ 完了チェック を確認・編集できる
// データは Firestore /devBacklog（管理者のみ読み書き・firestore.rules 参照）に保存し、
// onSnapshot で購読するので Web/Desktop どちらで編集しても即時同期される。
import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Paper, ToggleButtonGroup, ToggleButton, TextField, Button,
  Checkbox, IconButton, Chip, LinearProgress, Slider, Tooltip, CircularProgress,
} from '@mui/material';
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase/client';

type BacklogType = 'request' | 'requirement';

interface BacklogItem {
  id: string;
  type: BacklogType;
  title: string;
  detail?: string;
  dueDate?: string | null;   // 'YYYY-MM-DD'（いつまでに対応する予定か）
  progress: number;          // 0-100（どこまで開発が進んでいるか）
  done: boolean;             // 完了しているかどうか
  createdAt?: unknown;
  updatedAt?: unknown;
}

const TYPE_LABEL: Record<BacklogType, string> = {
  request: '要求定義',
  requirement: '要件定義',
};
const TYPE_HINT: Record<BacklogType, string> = {
  request: 'ユーザー・事業として「何を実現したいか」のリスト。',
  requirement: 'それをシステムとして「どう実現するか」の仕様レベルのリスト。',
};

const jstToday = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

export const DevStatusPanel = () => {
  const [tab, setTab] = useState<BacklogType>('request');
  const [items, setItems] = useState<BacklogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDue, setNewDue] = useState('');

  // /devBacklog を全件購読（件数は小さい想定）。タブ絞り込みはクライアント側で行い、
  // where+orderBy の複合インデックスを不要にする。
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'devBacklog'),
      (snap) => {
        setItems(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<BacklogItem, 'id'>) })));
        setLoading(false);
      },
      (e) => { setError(e?.message || '読み込みに失敗しました'); setLoading(false); },
    );
    return unsub;
  }, []);

  const today = jstToday();
  const list = useMemo(() => {
    const filtered = items.filter(i => i.type === tab);
    // 未完了を先に（期限昇順・期限なしは後ろ）、完了は下に。
    return filtered.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      const ad = a.dueDate || '9999-99-99';
      const bd = b.dueDate || '9999-99-99';
      return ad.localeCompare(bd);
    });
  }, [items, tab]);

  const doneCount = list.filter(i => i.done).length;
  const avgProgress = list.length
    ? Math.round(list.reduce((s, i) => s + (i.done ? 100 : (i.progress || 0)), 0) / list.length)
    : 0;

  const addItem = async () => {
    const title = newTitle.trim();
    if (!title) return;
    setNewTitle('');
    setNewDue('');
    try {
      await addDoc(collection(db, 'devBacklog'), {
        type: tab, title, dueDate: newDue || null, progress: 0, done: false,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
    } catch (e: any) { setError(e?.message || '追加に失敗しました'); }
  };

  const patch = (id: string, data: Record<string, unknown>) => {
    updateDoc(doc(db, 'devBacklog', id), { ...data, updatedAt: serverTimestamp() })
      .catch((e) => setError(e?.message || '更新に失敗しました'));
  };

  const remove = (item: BacklogItem) => {
    if (!window.confirm(`「${item.title}」を削除しますか？`)) return;
    deleteDoc(doc(db, 'devBacklog', item.id))
      .catch((e) => setError(e?.message || '削除に失敗しました'));
  };

  const sectionSx = {
    p: 3, borderRadius: 3, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider',
  } as const;

  return (
    <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <FactCheckRoundedIcon sx={{ color: 'light-dark(#0875a6, #4fc3f7)' }} />
        <Typography variant="h5" sx={{ fontWeight: 700 }}>開発状況</Typography>
        <Box sx={{ flex: 1 }} />
        {/* 上部の切り替えボタン: 要求定義 / 要件定義 */}
        <ToggleButtonGroup
          exclusive size="small" value={tab}
          onChange={(_, v: BacklogType | null) => { if (v) setTab(v); }}
        >
          <ToggleButton value="request" sx={{ px: 2.5, textTransform: 'none' }}>要求定義</ToggleButton>
          <ToggleButton value="requirement" sx={{ px: 2.5, textTransform: 'none' }}>要件定義</ToggleButton>
        </ToggleButtonGroup>
      </Box>
      <Typography variant="body2" sx={{ color: 'text.secondary', mt: -1.5 }}>
        {TYPE_HINT[tab]} バックログとして期限・進捗・完了を管理します（管理者のみ・Web/Desktop 間で即時同期）。
      </Typography>

      {/* 全体サマリー */}
      <Paper elevation={0} sx={{ ...sectionSx, p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {TYPE_LABEL[tab]}: {list.length} 件中 {doneCount} 件完了
          </Typography>
          <Box sx={{ flex: 1, minWidth: 160, display: 'flex', alignItems: 'center', gap: 1 }}>
            <LinearProgress variant="determinate" value={avgProgress} sx={{ flex: 1, height: 8, borderRadius: 4 }} />
            <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: 36, textAlign: 'right' }}>{avgProgress}%</Typography>
          </Box>
        </Box>
      </Paper>

      {/* 追加フォーム */}
      <Paper elevation={0} sx={{ ...sectionSx, p: 2 }}>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            size="small" placeholder={`${TYPE_LABEL[tab]}の項目を追加…`} value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void addItem(); }}
            sx={{ flex: 1, minWidth: 220 }}
          />
          <Tooltip title="いつまでに対応する予定か（任意）" arrow>
            <TextField type="date" size="small" value={newDue} onChange={(e) => setNewDue(e.target.value)} sx={{ width: 160 }} />
          </Tooltip>
          <Button
            variant="contained" size="small" disableElevation startIcon={<AddRoundedIcon />}
            onClick={() => void addItem()} disabled={!newTitle.trim()}
            sx={{ textTransform: 'none' }}
          >
            追加
          </Button>
        </Box>
      </Paper>

      {error && (
        <Paper elevation={0} sx={{ ...sectionSx, borderColor: 'error.main', color: 'error.main', p: 2 }}>{error}</Paper>
      )}

      {/* バックログ一覧 */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : list.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          まだ項目がありません。上のフォームから{TYPE_LABEL[tab]}の項目を追加してください。
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {list.map(item => {
            const overdue = !item.done && !!item.dueDate && item.dueDate < today;
            return (
              <Paper
                key={item.id} elevation={0}
                sx={{ ...sectionSx, p: 1.5, pl: 1, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', opacity: item.done ? 0.6 : 1 }}
              >
                {/* 完了チェック */}
                <Tooltip title={item.done ? '未完了に戻す' : '完了にする'} arrow>
                  <Checkbox
                    checked={item.done}
                    onChange={(e) => patch(item.id, e.target.checked ? { done: true, progress: 100 } : { done: false })}
                  />
                </Tooltip>
                {/* タイトル */}
                <Typography
                  variant="body2"
                  sx={{ flex: 1, minWidth: 180, fontWeight: 500, textDecoration: item.done ? 'line-through' : 'none' }}
                >
                  {item.title}
                </Typography>
                {/* 状態チップ */}
                {item.done ? (
                  <Chip label="完了" size="small" color="success" />
                ) : overdue ? (
                  <Chip label="期限超過" size="small" color="error" variant="outlined" />
                ) : (item.progress || 0) > 0 ? (
                  <Chip label="進行中" size="small" color="info" variant="outlined" />
                ) : (
                  <Chip label="未着手" size="small" variant="outlined" />
                )}
                {/* 進捗スライダー（どこまで開発が進んでいるか） */}
                <Tooltip title={`進捗 ${item.done ? 100 : (item.progress || 0)}%`} arrow>
                  <Box sx={{ width: 140, px: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Slider
                      size="small" step={5} min={0} max={100}
                      value={item.done ? 100 : (item.progress || 0)}
                      disabled={item.done}
                      onChangeCommitted={(_, v) => {
                        const p = Array.isArray(v) ? v[0] : v;
                        patch(item.id, p >= 100 ? { progress: 100, done: true } : { progress: p });
                      }}
                    />
                    <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: 32, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {item.done ? 100 : (item.progress || 0)}%
                    </Typography>
                  </Box>
                </Tooltip>
                {/* 期限（いつまでに対応する予定か） */}
                <Tooltip title="いつまでに対応する予定か" arrow>
                  <TextField
                    type="date" size="small" value={item.dueDate || ''}
                    onChange={(e) => patch(item.id, { dueDate: e.target.value || null })}
                    sx={{
                      width: 150,
                      '& input': { fontSize: 12.5, py: 0.6, color: overdue ? 'error.main' : undefined },
                    }}
                  />
                </Tooltip>
                {/* 削除 */}
                <IconButton size="small" onClick={() => remove(item)}>
                  <DeleteOutlineRoundedIcon fontSize="small" />
                </IconButton>
              </Paper>
            );
          })}
        </Box>
      )}
    </Box>
  );
};

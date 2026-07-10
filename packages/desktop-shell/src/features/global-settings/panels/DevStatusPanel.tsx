// Global Settings > 管理者 > 開発状況（管理者専用）。Jira のアジャイルボード風。
// - 上段: 左=要求定義（ユーザーの「〜がいい」フィードバック）/ 右=要件定義（それを実現する機能）
//   の2カラム。項目は自動採番（要求1 / 要件1 …）され、行を選択すると対応する相手側が
//   ハイライトされる。相手側の行に出るリンクボタンで「つなぐ/外す」をワンクリック。
//   リンクは要件側 requestIds[]（多対多）に保存。
// - 下段: アイデアバックログ。思い付きを追加していき、「要求へ昇格」で左カラムへ。
// - 各項目: 期限（いつまでに）/ 進捗（どこまで）/ 完了チェック。
// データは Firestore /devBacklog（管理者のみ読み書き）。onSnapshot で Web/Desktop 即時同期。
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Typography, Paper, TextField, Button, Checkbox, IconButton, Chip,
  LinearProgress, Slider, Tooltip, CircularProgress,
} from '@mui/material';
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import AddLinkRoundedIcon from '@mui/icons-material/AddLinkRounded';
import LinkOffRoundedIcon from '@mui/icons-material/LinkOffRounded';
import UpgradeRoundedIcon from '@mui/icons-material/UpgradeRounded';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
  arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase/client';

type BacklogType = 'request' | 'requirement' | 'idea';

interface BacklogItem {
  id: string;
  type: BacklogType;
  seq?: number;              // 種別内の自動採番（要求1, 要件1, …）
  title: string;
  dueDate?: string | null;   // 'YYYY-MM-DD'（いつまでに対応する予定か）
  progress: number;          // 0-100（どこまで開発が進んでいるか）
  done: boolean;             // 完了しているかどうか
  requestIds?: string[];     // 要件のみ: 対応する要求のドキュメントID（多対多）
  createdAt?: { toMillis?: () => number } | null;
  updatedAt?: unknown;
}

const KEY_PREFIX: Record<BacklogType, string> = { request: '要求', requirement: '要件', idea: '案' };
const jstToday = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const ms = (i: BacklogItem) => i.createdAt?.toMillis?.() ?? 0;

export const DevStatusPanel = () => {
  const [items, setItems] = useState<BacklogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 選択（左右どちらの行でも選択でき、相手側のリンク状態がハイライトされる）
  const [sel, setSel] = useState<{ side: 'request' | 'requirement'; id: string } | null>(null);
  const [newTitle, setNewTitle] = useState<Record<BacklogType, string>>({ request: '', requirement: '', idea: '' });
  const [newDue, setNewDue] = useState<Record<BacklogType, string>>({ request: '', requirement: '', idea: '' });

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

  const patch = (id: string, data: Record<string, unknown>) => {
    updateDoc(doc(db, 'devBacklog', id), { ...data, updatedAt: serverTimestamp() })
      .catch((e) => setError(e?.message || '更新に失敗しました'));
  };

  // seq（自動採番）が無い既存項目に一度だけ振る（作成順）。
  const backfilled = useRef(false);
  useEffect(() => {
    if (loading || backfilled.current) return;
    backfilled.current = true;
    (['request', 'requirement', 'idea'] as BacklogType[]).forEach(t => {
      const of = items.filter(i => i.type === t);
      let max = Math.max(0, ...of.map(i => i.seq || 0));
      of.filter(i => !i.seq).sort((a, b) => ms(a) - ms(b)).forEach(i => { max += 1; patch(i.id, { seq: max }); });
    });
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const today = jstToday();
  const byId = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);
  const keyOf = (i: BacklogItem | undefined) => i ? `${KEY_PREFIX[i.type]}${i.seq ?? '?'}` : '?';

  const listOf = (t: BacklogType) => items
    .filter(i => i.type === t)
    .sort((a, b) => {
      if (t === 'idea') return ms(b) - ms(a); // アイデアは新しい順
      if (a.done !== b.done) return a.done ? 1 : -1;
      return (a.dueDate || '9999-99-99').localeCompare(b.dueDate || '9999-99-99');
    });
  const requests = useMemo(() => listOf('request'), [items]);       // eslint-disable-line react-hooks/exhaustive-deps
  const requirements = useMemo(() => listOf('requirement'), [items]); // eslint-disable-line react-hooks/exhaustive-deps
  const ideas = useMemo(() => listOf('idea'), [items]);             // eslint-disable-line react-hooks/exhaustive-deps

  // 選択に対応する「相手側でハイライトすべき id 集合」
  const linkedIds = useMemo(() => {
    if (!sel) return new Set<string>();
    if (sel.side === 'request') {
      return new Set(requirements.filter(r => (r.requestIds || []).includes(sel.id)).map(r => r.id));
    }
    return new Set(byId.get(sel.id)?.requestIds || []);
  }, [sel, requirements, byId]);

  const addItem = async (t: BacklogType) => {
    const title = newTitle[t].trim();
    if (!title) return;
    setNewTitle(s => ({ ...s, [t]: '' }));
    setNewDue(s => ({ ...s, [t]: '' }));
    const seq = Math.max(0, ...items.filter(i => i.type === t).map(i => i.seq || 0)) + 1;
    try {
      await addDoc(collection(db, 'devBacklog'), {
        type: t, seq, title, dueDate: newDue[t] || null, progress: 0, done: false,
        ...(t === 'requirement' ? { requestIds: [] } : {}),
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
    } catch (e: any) { setError(e?.message || '追加に失敗しました'); }
  };

  const remove = (item: BacklogItem) => {
    if (!window.confirm(`「${keyOf(item)}: ${item.title}」を削除しますか？`)) return;
    // 要求を消す場合は、それを参照している要件からもリンクを外す
    if (item.type === 'request') {
      requirements.filter(r => (r.requestIds || []).includes(item.id))
        .forEach(r => patch(r.id, { requestIds: arrayRemove(item.id) }));
    }
    if (sel?.id === item.id) setSel(null);
    deleteDoc(doc(db, 'devBacklog', item.id)).catch((e) => setError(e?.message || '削除に失敗しました'));
  };

  /** 選択中の項目と、相手側 targetItem のリンクを付け外しする（保存先は常に要件側 requestIds） */
  const toggleLink = (target: BacklogItem) => {
    if (!sel) return;
    const reqId = sel.side === 'request' ? sel.id : target.id;                 // 要求のID
    const sysItem = sel.side === 'request' ? target : byId.get(sel.id);        // 要件の項目
    if (!sysItem) return;
    const linked = (sysItem.requestIds || []).includes(reqId);
    patch(sysItem.id, { requestIds: linked ? arrayRemove(reqId) : arrayUnion(reqId) });
  };

  /** アイデアを要求定義へ昇格 */
  const promote = (item: BacklogItem) => {
    const seq = Math.max(0, ...items.filter(i => i.type === 'request').map(i => i.seq || 0)) + 1;
    patch(item.id, { type: 'request', seq });
  };

  const sectionSx = {
    p: 2.5, borderRadius: 3, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider',
  } as const;

  /** 列サマリー（N件中M件完了＋平均進捗）。コンポーネント化すると毎レンダーで別型に
      なり再マウントされるため、ただの関数として呼ぶ（AddForm/ItemRow も同様）。 */
  const renderColumnSummary = (list: BacklogItem[]) => {
    const doneCount = list.filter(i => i.done).length;
    const avg = list.length ? Math.round(list.reduce((s, i) => s + (i.done ? 100 : (i.progress || 0)), 0) / list.length) : 0;
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
          {list.length} 件中 {doneCount} 件完了
        </Typography>
        <LinearProgress variant="determinate" value={avg} sx={{ flex: 1, height: 6, borderRadius: 3 }} />
        <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: 32, textAlign: 'right' }}>{avg}%</Typography>
      </Box>
    );
  };

  /** 追加フォーム（タイトル＋期限） */
  const renderAddForm = (type: BacklogType, placeholder: string, withDue: boolean = true) => (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 1.5 }}>
      <TextField
        size="small" placeholder={placeholder} value={newTitle[type]}
        onChange={(e) => setNewTitle(s => ({ ...s, [type]: e.target.value }))}
        onKeyDown={(e) => { if (e.key === 'Enter') void addItem(type); }}
        sx={{ flex: 1, minWidth: 140 }}
      />
      {withDue && (
        <Tooltip title="いつまでに対応する予定か（任意）" arrow>
          <TextField type="date" size="small" value={newDue[type]} onChange={(e) => setNewDue(s => ({ ...s, [type]: e.target.value }))} sx={{ width: 150 }} />
        </Tooltip>
      )}
      <Button
        variant="contained" size="small" disableElevation startIcon={<AddRoundedIcon />}
        onClick={() => void addItem(type)} disabled={!newTitle[type].trim()}
        sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
      >
        追加
      </Button>
    </Box>
  );

  /** 要求/要件の1行 */
  const renderItemRow = (item: BacklogItem, side: 'request' | 'requirement') => {
    const overdue = !item.done && !!item.dueDate && item.dueDate < today;
    const isSelected = sel?.id === item.id;
    const isCounterpart = !!sel && sel.side !== side && linkedIds.has(item.id);
    const showLinkToggle = !!sel && sel.side !== side;
    const linkedToThis = side === 'requirement'
      ? (item.requestIds || []).map(id => byId.get(id)).filter(Boolean) as BacklogItem[]
      : requirements.filter(r => (r.requestIds || []).includes(item.id));
    return (
      <Paper
        elevation={0}
        onClick={() => setSel(isSelected ? null : { side, id: item.id })}
        sx={{
          ...sectionSx, p: 1.25, cursor: 'pointer',
          opacity: item.done ? 0.6 : 1,
          borderColor: isSelected ? 'light-dark(#0875a6, #4fc3f7)' : isCounterpart ? 'light-dark(rgba(8,117,166,0.5), rgba(79,195,247,0.5))' : 'divider',
          borderWidth: isSelected ? 2 : 1,
          bgcolor: isCounterpart ? 'light-dark(rgba(8,117,166,0.06), rgba(79,195,247,0.06))' : 'background.paper',
          transition: 'border-color .15s, background-color .15s',
        }}
      >
        {/* 1行目: チェック / キー / タイトル / リンクトグル / 削除 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Checkbox
            size="small" checked={item.done}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => patch(item.id, e.target.checked ? { done: true, progress: 100 } : { done: false })}
          />
          <Chip label={keyOf(item)} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: 11, height: 22 }} />
          <Typography
            variant="body2"
            sx={{ flex: 1, minWidth: 80, fontWeight: 500, textDecoration: item.done ? 'line-through' : 'none', lineHeight: 1.4 }}
          >
            {item.title}
          </Typography>
          {showLinkToggle && (
            <Tooltip title={isCounterpart ? `${keyOf(byId.get(sel!.id))} とのリンクを外す` : `${keyOf(byId.get(sel!.id))} とリンクする`} arrow>
              <IconButton
                size="small" color={isCounterpart ? 'primary' : 'default'}
                onClick={(e) => { e.stopPropagation(); toggleLink(item); }}
              >
                {isCounterpart ? <LinkOffRoundedIcon fontSize="small" /> : <AddLinkRoundedIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          )}
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); remove(item); }}>
            <DeleteOutlineRoundedIcon fontSize="small" />
          </IconButton>
        </Box>
        {/* 2行目: 状態 / 進捗 / 期限 / リンク先チップ */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', pl: 4.5, pr: 0.5, mt: 0.25 }}>
          {item.done ? (
            <Chip label="完了" size="small" color="success" sx={{ height: 20 }} />
          ) : overdue ? (
            <Chip label="期限超過" size="small" color="error" variant="outlined" sx={{ height: 20 }} />
          ) : (item.progress || 0) > 0 ? (
            <Chip label="進行中" size="small" color="info" variant="outlined" sx={{ height: 20 }} />
          ) : (
            <Chip label="未着手" size="small" variant="outlined" sx={{ height: 20 }} />
          )}
          <Box sx={{ width: 110, px: 0.5, display: 'flex', alignItems: 'center', gap: 0.75 }} onClick={(e) => e.stopPropagation()}>
            <Slider
              size="small" step={5} min={0} max={100}
              value={item.done ? 100 : (item.progress || 0)}
              disabled={item.done}
              onChangeCommitted={(_, v) => {
                const p = Array.isArray(v) ? v[0] : v;
                patch(item.id, p >= 100 ? { progress: 100, done: true } : { progress: p });
              }}
            />
            <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: 30, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {item.done ? 100 : (item.progress || 0)}%
            </Typography>
          </Box>
          <TextField
            type="date" size="small" value={item.dueDate || ''}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => patch(item.id, { dueDate: e.target.value || null })}
            sx={{ width: 140, '& input': { fontSize: 12, py: 0.4, color: overdue ? 'error.main' : undefined } }}
          />
          {/* つながりの可視化: 相手側のキーをチップ表示（クリックで相手を選択） */}
          {linkedToThis.map(l => (
            <Chip
              key={l.id} label={keyOf(l)} size="small"
              sx={{ height: 20, fontFamily: 'monospace', fontSize: 11, bgcolor: 'light-dark(rgba(8,117,166,0.12), rgba(79,195,247,0.14))' }}
              onClick={(e) => { e.stopPropagation(); setSel({ side: side === 'request' ? 'requirement' : 'request', id: l.id }); }}
            />
          ))}
          {side === 'requirement' && linkedToThis.length === 0 && (
            <Typography variant="caption" sx={{ color: 'warning.main', opacity: 0.9 }}>未リンク</Typography>
          )}
        </Box>
      </Paper>
    );
  };

  return (
    <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <FactCheckRoundedIcon sx={{ color: 'light-dark(#0875a6, #4fc3f7)' }} />
        <Typography variant="h5" sx={{ fontWeight: 700 }}>開発状況</Typography>
      </Box>
      <Typography variant="body2" sx={{ color: 'text.secondary', mt: -1.5 }}>
        左＝ユーザーの「〜がいい」（要求定義）、右＝それをどう実現するか（要件定義）。
        行をクリックで選択すると<b>つながっている相手側がハイライト</b>され、相手側の行のリンクボタンでつなぐ/外すができます。
        下段は思い付きのアイデア置き場 — 育ったら「要求へ昇格」。
      </Typography>

      {error && (
        <Paper elevation={0} sx={{ ...sectionSx, borderColor: 'error.main', color: 'error.main', p: 2 }}>{error}</Paper>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : (
        <>
          {/* ── 上段: 要求定義（左）⇔ 要件定義（右） ─────────────── */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, alignItems: 'start' }}>
            {/* 要求定義 */}
            <Paper elevation={0} sx={{ ...sectionSx, p: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, fontSize: 16 }}>要求定義</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                ユーザーのフィードバック・「〜がほしい」
              </Typography>
              {renderColumnSummary(requests)}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {requests.length === 0 ? (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>まだ項目がありません。</Typography>
                ) : requests.map(item => <React.Fragment key={item.id}>{renderItemRow(item, 'request')}</React.Fragment>)}
              </Box>
              {renderAddForm('request', '要求を追加（例: 〜できるようにしたい）…')}
            </Paper>

            {/* 要件定義 */}
            <Paper elevation={0} sx={{ ...sectionSx, p: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, fontSize: 16 }}>要件定義</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                「ほしい」をシステム的にどう実現するか
              </Typography>
              {renderColumnSummary(requirements)}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {requirements.length === 0 ? (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>まだ項目がありません。</Typography>
                ) : requirements.map(item => <React.Fragment key={item.id}>{renderItemRow(item, 'requirement')}</React.Fragment>)}
              </Box>
              {renderAddForm('requirement', '要件を追加（例: ○○機能を実装する）…')}
            </Paper>
          </Box>

          {/* ── 下段: アイデアバックログ ─────────────────────── */}
          <Paper elevation={0} sx={{ ...sectionSx, p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <LightbulbOutlinedIcon fontSize="small" sx={{ color: 'light-dark(#bf7a2e, #ffd740)' }} />
              <Typography variant="h6" sx={{ fontWeight: 600, fontSize: 16 }}>アイデアバックログ</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', ml: 1 }}>
                思い付きの「あったらいい」を気軽に追加。育ったら要求へ昇格。
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mt: 1.5 }}>
              {ideas.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>まだアイデアがありません。</Typography>
              ) : ideas.map(item => (
                <Box key={item.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.5, borderRadius: 2, '&:hover': { bgcolor: 'action.hover' } }}>
                  <Chip label={keyOf(item)} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: 11, height: 22 }} />
                  <Typography variant="body2" sx={{ flex: 1 }}>{item.title}</Typography>
                  <Tooltip title="要求定義へ昇格（左カラムに移動）" arrow>
                    <Button
                      size="small" variant="outlined" startIcon={<UpgradeRoundedIcon />}
                      onClick={() => promote(item)}
                      sx={{ textTransform: 'none', whiteSpace: 'nowrap', py: 0 }}
                    >
                      要求へ昇格
                    </Button>
                  </Tooltip>
                  <IconButton size="small" onClick={() => remove(item)}>
                    <DeleteOutlineRoundedIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            </Box>
            {renderAddForm('idea', 'あったらいい機能を思い付いたら書く…', false)}
          </Paper>
        </>
      )}
    </Box>
  );
};

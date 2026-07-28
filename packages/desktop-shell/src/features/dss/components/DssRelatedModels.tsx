import React, { useMemo, useState } from 'react';
import { Box, Typography, Chip } from '@mui/material';
import { DssModelCard } from '../DssModelCard';

type Tab = 'related' | 'author' | 'list';
const SUGGEST_CAP = 24;
const LIST_CAP = 60;

interface Props {
  model: any;
  allItems?: any[];
  onSelect: (m: any) => void;
  onBackToGrid: () => void;
}

/** 表示件数が候補の全件を切り詰めたものであれば「24+」のように示し、実数と誤認されないようにする。 */
const formatCount = (shown: number, total: number) => (total > shown ? `${shown}+` : `${shown}`);

/**
 * 下スクロールの「他のモデル」。関連 / 同じ作者 / このリスト をチップで切り替える。
 *
 * この詳細画面は矢印キーでのモデル切替時も再マウントされない（`model` prop だけが差し替わる）。
 * そのため既定タブは mount 時の一度きりではなく、モデルが変わるたびに
 * 「関連 > 同じ作者 > このリスト」の優先順で選び直す。ユーザーが手動でチップを選んだ場合は
 * そのモデルを見ている間だけ維持し、次のモデルに移ったらまた既定に戻す。
 */
export const DssRelatedModels: React.FC<Props> = ({ model, allItems, onSelect, onBackToGrid }) => {
  const list = useMemo<any[]>(() => (Array.isArray(allItems) ? allItems : []), [allItems]);
  const ownerId = model?.ownerId || model?.authorId;

  const relatedAll = useMemo(
    () => list.filter((it) => it.id !== model.id && (it.category === model.category || it.ownerId === model.ownerId)),
    [list, model]
  );
  const related = useMemo(() => relatedAll.slice(0, SUGGEST_CAP), [relatedAll]);

  const byAuthorAll = useMemo(
    () => (ownerId ? list.filter((it) => it.id !== model.id && (it.ownerId || it.authorId) === ownerId) : []),
    [list, model, ownerId]
  );
  const byAuthor = useMemo(() => byAuthorAll.slice(0, SUGGEST_CAP), [byAuthorAll]);

  // 表示中モデルを中心に上限件数へ絞る（メイングリッドと違いここは仮想化していないため）
  const windowed = useMemo(() => {
    if (list.length <= LIST_CAP) return list;
    const idx = list.findIndex((m) => m.id === model.id);
    if (idx < 0) return list.slice(0, LIST_CAP);
    const start = Math.max(0, Math.min(idx - Math.floor(LIST_CAP / 2), list.length - LIST_CAP));
    return list.slice(start, start + LIST_CAP);
  }, [list, model]);

  const tabDefs: { key: Tab; label: string; items: any[]; total: number }[] = [
    { key: 'related', label: '関連', items: related, total: relatedAll.length },
    { key: 'author', label: '同じ作者', items: byAuthor, total: byAuthorAll.length },
    { key: 'list', label: 'このリスト', items: windowed, total: list.length },
  ];
  const tabs = tabDefs.filter((t) => t.items.length > 0);

  // モデルが切り替わったら既定タブへ戻す（React の「props 変化に応じて state をリセットする」定石：
  // レンダー中に setState する。useEffect にすると 1 フレームだけ前のモデルのタブが見えてしまう）。
  const [lastModelId, setLastModelId] = useState(model?.id);
  const [manualTab, setManualTab] = useState<Tab | null>(null);
  if (lastModelId !== model?.id) {
    setLastModelId(model?.id);
    setManualTab(null);
  }
  const defaultTab: Tab = tabs[0]?.key ?? 'list';
  const tab = manualTab ?? defaultTab;

  if (tabs.length === 0) return null;
  // tabs は非空のものだけなので、tab が指す候補が今回たまたま消えていてもここで必ず有効なタブへ戻る。
  const current = tabs.find((t) => t.key === tab) || tabs[0];

  return (
    <Box sx={{ p: 2, mt: 2, mb: 4, display: 'flex', flexDirection: 'column' }} data-section="related">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
        <Typography variant="h6" sx={{ color: 'var(--brand-fg)', fontWeight: 700, fontSize: 16, mr: 1 }}>他のモデル</Typography>
        {tabs.map((t) => (
          <Chip
            key={t.key} size="small" label={`${t.label} ${formatCount(t.items.length, t.total)}`}
            onClick={() => setManualTab(t.key)}
            sx={{
              fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
              bgcolor: current.key === t.key ? 'rgba(59,130,246,0.9)' : 'transparent',
              color: current.key === t.key ? '#fff' : 'rgb(var(--brand-fg-rgb) / 0.7)',
              border: `1px solid ${current.key === t.key ? 'rgba(59,130,246,0.9)' : 'rgb(var(--brand-fg-rgb) / 0.15)'}`,
            }}
          />
        ))}
        <Box sx={{ flex: 1 }} />
        {list.length > LIST_CAP && (
          <Typography
            onClick={onBackToGrid}
            sx={{ fontSize: 12, fontWeight: 600, color: 'light-dark(#0352aa, #93c5fd)', cursor: 'pointer', whiteSpace: 'nowrap', '&:hover': { textDecoration: 'underline' } }}
          >
            グリッドで全 {list.length} 件を見る →
          </Typography>
        )}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 1.5 }}>
        {current.items.map((gm) => (
          <Box key={gm.id || gm.entityId}
            sx={{ borderRadius: '10px', outline: gm.id === model.id ? '2px solid #3b82f6' : 'none', outlineOffset: '2px' }}>
            <DssModelCard model={gm} onClick={() => { if (gm.id !== model.id) onSelect(gm); }} />
          </Box>
        ))}
      </Box>
    </Box>
  );
};

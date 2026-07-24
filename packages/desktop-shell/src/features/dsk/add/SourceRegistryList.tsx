// SEKKEIYA 公式ソース・レジストリの一覧（メインエリア）。
// タイプ別セクション（家具/テクスチャ/イメージ・パース/建材）。1件追加 or セクション/全件の一括追加。
// crawlable=true は追加→そのまま索引化、false は参照ブックマーク登録のみ。
// filter プロップで絞り込み・並び替え（右サイドバーから操作）。
// 仕様: docs/16_sekkeiya_search_spec.md

import React, { useRef, useState } from 'react';
import { Box, Typography, Button, Chip, Tooltip, Snackbar, Alert, CircularProgress } from '@mui/material';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import PlaylistAddRoundedIcon from '@mui/icons-material/PlaylistAddRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import {
  SOURCE_SECTIONS, KIND_COLOR, STATUS_LABEL, entryStatus, applyFilter,
  DEFAULT_REGISTRY_FILTER, type SourceRegistryEntry, type RegistryFilter,
} from '../data/sourceRegistry';
import { saveKnowledgeEntry } from '../api/knowledgeApi';
import { useDskStore } from '../store/useDskStore';
import { openExternalUrl } from '../../dss/utils/productImageSearch';

const uuid = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.floor(Math.random() * 1e9)}`);

const normUrl = (u?: string | null) => (u || '').trim().toLowerCase().replace(/\/+$/, '');

const STATUS_CHIP: Record<string, { color: string; bg: string }> = {
  verified: { color: 'light-dark(#149944, #86efac)', bg: 'rgba(34,197,94,0.12)' },
  experimental: { color: 'light-dark(#ab8303, #fcd34d)', bg: 'rgba(245,158,11,0.12)' },
  reference: { color: 'light-dark(#0352aa, #93c5fd)', bg: 'rgba(59,130,246,0.12)' },
};

export const SourceRegistryList: React.FC<{ filter?: RegistryFilter; focus?: 'all' | 'catalog' }> = ({ filter = DEFAULT_REGISTRY_FILTER, focus = 'all' }) => {
  const entries = useDskStore((s) => s.entries);
  const upsert = useDskStore((s) => s.upsert);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [batchActive, setBatchActive] = useState(false);
  const [batchInfo, setBatchInfo] = useState('');
  const [status, setStatus] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ msg: string; sev: 'success' | 'error' } | null>(null);
  const cancelRef = useRef(false);

  const addedUrls = new Set(entries.filter((e) => e.kind === 'url').map((e) => normUrl(e.sourceUrl)));
  const isAdded = (e: SourceRegistryEntry) => addedUrls.has(normUrl(e.url));
  const busy = !!runningId || batchActive;

  const runEntry = async (src: SourceRegistryEntry) => {
    if (isAdded(src)) return;
    setRunningId(src.id);
    setStatus((s) => ({ ...s, [src.id]: 'ライブラリに追加中…' }));
    const entry = await saveKnowledgeEntry({
      localId: uuid(), kind: 'url', title: `${src.site} ${src.genre}`,
      category: src.category, author: src.site, tags: src.tags, sourceUrl: src.url,
    });
    upsert(entry);
    addedUrls.add(normUrl(src.url));
    if (src.crawlable) {
      setStatus((s) => ({ ...s, [src.id]: '索引化を開始…' }));
      const { crawlSiteEntry } = await import('../catalog/crawlSiteToCatalog');
      const { meta } = await crawlSiteEntry(
        // 索引商品には S.Model 正典カテゴリ/タグを付与（無指定時は S.Library カテゴリを流用）。
        { localId: entry.localId, title: entry.title, sourceUrl: entry.sourceUrl, category: src.modelCategory ?? src.category, tags: src.modelTags ?? src.tags },
        {
          maxDepth: src.crossCategories ? 3 : 0,
          onProgress: (p) => setStatus((s) => ({
            ...s,
            [src.id]: p.phase === 'crawl' ? `巡回中 ${p.pagesVisited}p・商品${p.productsFound}` : `索引化 ${p.embedded}/${p.total}`,
          })),
        },
      );
      setStatus((s) => ({ ...s, [src.id]: `索引完了 ${meta.itemCount}件` }));
    } else {
      setStatus((s) => ({ ...s, [src.id]: '参照として追加' }));
    }
    setRunningId(null);
  };

  const handleAddOne = async (src: SourceRegistryEntry) => {
    if (busy) return;
    try { await runEntry(src); setToast({ msg: `「${src.site} ${src.genre}」を追加しました`, sev: 'success' }); }
    catch (e: any) {
      console.error('[SourceRegistry] add failed', e);
      setStatus((s) => ({ ...s, [src.id]: '失敗' })); setRunningId(null);
      setToast({ msg: e?.message || '追加に失敗しました', sev: 'error' });
    }
  };

  const runBatch = async (list: SourceRegistryEntry[], label: string) => {
    if (busy) return;
    const todo = list.filter((s) => !isAdded(s));
    if (!todo.length) { setToast({ msg: 'すべて追加済みです', sev: 'success' }); return; }
    setBatchActive(true); cancelRef.current = false;
    let done = 0;
    for (let i = 0; i < todo.length; i++) {
      if (cancelRef.current) break;
      setBatchInfo(`${label}: ${i + 1}/${todo.length}`);
      try { await runEntry(todo[i]); done++; }
      catch (e) { console.error('[SourceRegistry] batch item failed', todo[i].id, e); setRunningId(null); }
    }
    setBatchActive(false); setBatchInfo('');
    setToast({ msg: cancelRef.current ? `中断しました（${done}件追加）` : `一括追加が完了しました（${done}件）`, sev: 'success' });
  };

  // フィルタ適用済みのセクション（空セクションは非表示）。
  // focus='catalog' のときはメーカー電子カタログ（isCatalog）グループのみに絞る。
  const visibleSections = SOURCE_SECTIONS
    .filter((sec) => !filter.kinds.length || filter.kinds.includes(sec.kind))
    .map((sec) => {
      const baseGroups = focus === 'catalog' ? sec.groups.filter((g) => g.isCatalog) : sec.groups;
      const filteredEntries = applyFilter(baseGroups.flatMap((g) => g.entries), filter, isAdded);
      const ids = new Set(filteredEntries.map((e) => e.id));
      const groups = baseGroups
        .map((g) => ({ ...g, entries: g.entries.filter((e) => ids.has(e.id)) }))
        // 並び替え適用順を維持するため filteredEntries の順序でソート
        .map((g) => ({ ...g, entries: filteredEntries.filter((e) => g.entries.some((x) => x.id === e.id)) }))
        .filter((g) => g.entries.length > 0);
      return { sec, groups, filteredEntries };
    })
    .filter((s) => s.groups.length > 0);

  const allFilteredEntries = visibleSections.flatMap((s) => s.filteredEntries);
  const allRemain = allFilteredEntries.filter((e) => !isAdded(e)).length;
  const totalShown = allFilteredEntries.length;

  return (
    <Box>
      {/* 上部ツールバー */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 2 }}>
        <Button
          variant="contained" size="small" disabled={busy || allRemain === 0}
          startIcon={<PlaylistAddRoundedIcon sx={{ fontSize: 18 }} />}
          onClick={() => runBatch(allFilteredEntries, '表示中すべて')}
          sx={{ bgcolor: '#2563eb', '&:hover': { bgcolor: '#1d4ed8' } }}
        >
          表示中をすべて追加（{allRemain}）
        </Button>
        <Typography sx={{ fontSize: 11.5, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>{totalShown} 件表示</Typography>
        {batchActive && (
          <>
            <Typography sx={{ fontSize: 11.5, color: 'light-dark(#0474a9, #7dd3fc)', ml: 'auto' }}>{batchInfo}</Typography>
            <Button size="small" variant="outlined" startIcon={<StopRoundedIcon sx={{ fontSize: 16 }} />} onClick={() => { cancelRef.current = true; }}
              sx={{ color: 'light-dark(#a80606, #fca5a5)', borderColor: 'rgba(248,113,113,0.5)' }}>中断</Button>
          </>
        )}
      </Box>

      {visibleSections.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 6, opacity: 0.5 }}>
          <Typography sx={{ fontSize: 13 }}>条件に一致するソースがありません</Typography>
        </Box>
      )}

      {visibleSections.map(({ sec, groups, filteredEntries }) => {
        const remain = filteredEntries.filter((e) => !isAdded(e)).length;
        const accent = KIND_COLOR[sec.kind];
        return (
          <Box key={sec.kind} sx={{
            mb: 2.5, borderRadius: 2.5, overflow: 'hidden',
            border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.02)',
          }}>
            {/* セクションヘッダ */}
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 1.25, px: 2, py: 1.25,
              borderLeft: `3px solid ${accent}`, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)',
              borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.06)',
            }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: accent }} />
              <Typography sx={{ fontSize: 14, fontWeight: 800, color: 'var(--brand-fg)' }}>{sec.label}</Typography>
              <Chip label={`${filteredEntries.length}`} size="small" sx={{ height: 18, fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.6)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)' }} />
              <Typography noWrap sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.4)', flex: 1, minWidth: 0 }}>{sec.description}</Typography>
              <Button
                size="small" variant="text" disabled={busy || remain === 0}
                startIcon={<PlaylistAddRoundedIcon sx={{ fontSize: 16 }} />}
                onClick={() => runBatch(filteredEntries, sec.label)}
                sx={{ color: accent, fontSize: 11, flexShrink: 0 }}
              >
                全部追加（{remain}）
              </Button>
            </Box>

            <Box sx={{ p: 1.5 }}>
              {groups.map((group) => (
                <Box key={group.site} sx={{ mb: 1.5, '&:last-child': { mb: 0 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'rgb(var(--brand-fg-rgb) / 0.85)' }}>{group.site}</Typography>
                    <Tooltip title="サイトを開く">
                      <Box component="span" onClick={() => openExternalUrl(group.homeUrl)} sx={{ display: 'inline-flex', cursor: 'pointer', color: accent }}>
                        <OpenInNewRoundedIcon sx={{ fontSize: 13 }} />
                      </Box>
                    </Tooltip>
                  </Box>

                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 1 }}>
                    {group.entries.map((src) => {
                      const added = isAdded(src);
                      const itemBusy = runningId === src.id;
                      const st = status[src.id];
                      const stt = entryStatus(src);
                      const chip = STATUS_CHIP[stt];
                      return (
                        <Box key={src.id} sx={{
                          display: 'flex', alignItems: 'center', gap: 1, p: 1.1, borderRadius: 1.5,
                          bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
                          transition: 'border-color 0.15s, background 0.15s',
                          '&:hover': { borderColor: `${accent}66`, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' },
                        }}>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography noWrap sx={{ fontSize: 12.5, fontWeight: 700 }}>{src.genre}</Typography>
                            <Typography noWrap sx={{ fontSize: 10, color: itemBusy ? accent : 'rgb(var(--brand-fg-rgb) / 0.35)' }}>
                              {itemBusy && st ? st : src.url.replace(/^https?:\/\//, '')}
                            </Typography>
                          </Box>
                          {!itemBusy && (
                            <Chip label={STATUS_LABEL[stt]} size="small" sx={{ height: 16, fontSize: 9, color: chip.color, bgcolor: chip.bg }} />
                          )}
                          {added && !itemBusy ? (
                            <Chip icon={<CheckRoundedIcon sx={{ fontSize: 13, color: 'light-dark(#149944, #86efac) !important' }} />} label="追加済み" size="small"
                              sx={{ height: 24, fontSize: 11, fontWeight: 700, color: 'light-dark(#149944, #86efac)', bgcolor: 'rgba(34,197,94,0.12)' }} />
                          ) : (
                            <Button
                              size="small" variant="outlined" disabled={busy}
                              onClick={() => handleAddOne(src)}
                              startIcon={itemBusy ? <CircularProgress size={12} sx={{ color: accent }} /> : <AddRoundedIcon sx={{ fontSize: 16 }} />}
                              sx={{ flexShrink: 0, color: accent, borderColor: `${accent}80`, '&:hover': { borderColor: accent, bgcolor: `${accent}14` } }}
                            >
                              {itemBusy ? '処理中' : '追加'}
                            </Button>
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        );
      })}

      <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.4)', mt: 1 }}>
        「確認済」=巡回検証済み（FLYMEe）/「実験的」=巡回するが精度はサイト次第 /「参照」=ブックマーク登録のみ。
        家具は追加でそのまま索引化まで進みます（隠しWebView競合回避のため1件ずつ）。
      </Typography>

      <Snackbar open={!!toast} autoHideDuration={3500} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {toast ? <Alert severity={toast.sev} variant="filled" onClose={() => setToast(null)}>{toast.msg}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
};

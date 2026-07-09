/**
 * FeedSourcePicker — ホームに表示するメディア（RSSソース）をユーザー自身が選んで紐づける画面。
 *
 * 立ち位置: SEKKEIYA は「このサイトが良いですよ」というおすすめの提示まで。
 * どのメディアを購読するかはユーザーの明示的な選択で決まる（＝ユーザー主体のフィードリーダー）。
 * - ユーザーのブログカテゴリ（例: インテリア / 建築×AI）と各メディアの興味キーワードを照合し
 *   「カテゴリ向け」バッジで提案。
 * - 「おまかせで紐づける」= カテゴリに合うメディアを自動選択して即紐づけ（1クリック）。
 * - 好きなメディアはURLから自分で追加できる（RSS自動探索→「カスタム」グループ）。
 */
import React, { useMemo, useState } from 'react';
import { Box, Typography, Chip, Button, Checkbox, CircularProgress, Tooltip, InputBase, IconButton } from '@mui/material';
import RssFeedRoundedIcon from '@mui/icons-material/RssFeedRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import TravelExploreRoundedIcon from '@mui/icons-material/TravelExploreRounded';
import { DEFAULT_SOURCE_SITES, recommendSourcesForCategories, type BlogSourceSite } from './types';
import { discoverFeedSource } from './lib/feedDiscovery';

const ACCENT = '#e57373';
const AI_PURPLE = '#ce93d8';
const BASE_GROUPS: BlogSourceSite['group'][] = ['国内・建築/デザイン', '国内・住まい/インテリア', '海外・トレンド'];

interface FeedSourcePickerProps {
  /** ユーザーのブログカテゴリ（おすすめ照合に使用） */
  categories: string[];
  /** 現在の購読（初回 onboarding では null → カテゴリに合うものを初期チェック） */
  current: string[] | null;
  /** ユーザーが自分で追加したカスタムメディア */
  customSources: BlogSourceSite[];
  saving?: boolean;
  onSave: (names: string[]) => void;
  /** カスタムメディアの追加（永続化は親が担当） */
  onAddCustom: (site: BlogSourceSite) => Promise<void> | void;
  /** カスタムメディアの削除 */
  onRemoveCustom: (name: string) => void;
  /** ダイアログ利用時のキャンセル（onboarding では省略） */
  onCancel?: () => void;
}

export const FeedSourcePicker: React.FC<FeedSourcePickerProps> = ({
  categories, current, customSources, saving, onSave, onAddCustom, onRemoveCustom, onCancel,
}) => {
  const allSites = useMemo(() => [...DEFAULT_SOURCE_SITES, ...customSources], [customSources]);
  const recommended = useMemo(() => recommendSourcesForCategories(categories, allSites), [categories, allSites]);
  const groups = useMemo(
    () => (customSources.length > 0 ? [...BASE_GROUPS, 'カスタム' as const] : BASE_GROUPS),
    [customSources.length],
  );

  const [checked, setChecked] = useState<Set<string>>(() => {
    if (current) return new Set(current);
    // 初回: カテゴリに合うおすすめを初期チェック（最終決定はユーザーの保存操作）
    return new Set(recommended.keys());
  });

  // 自分で追加（URL→RSS自動探索）
  const [addUrl, setAddUrl] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState('');

  const toggle = (name: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });

  // おまかせ: カテゴリに合うメディアを自動選択して即紐づけ（カテゴリ未作成なら全おすすめ）
  const handleAuto = () => {
    const names = recommended.size > 0
      ? [...recommended.keys()]
      : DEFAULT_SOURCE_SITES.map((s) => s.name);
    setChecked(new Set(names));
    onSave(names);
  };

  const handleAdd = async () => {
    if (addBusy || !addUrl.trim()) return;
    setAddBusy(true);
    setAddError('');
    try {
      const site = await discoverFeedSource(addUrl);
      if (allSites.some((s) => s.name === site.name || s.feed === site.feed)) {
        throw new Error('このメディアは既に一覧にあります');
      }
      await onAddCustom(site);
      setChecked((prev) => new Set(prev).add(site.name)); // 追加したら自動でチェック
      setAddUrl('');
    } catch (e: any) {
      setAddError(String(e?.message ?? e));
    } finally {
      setAddBusy(false);
    }
  };

  const handleRemoveCustom = (name: string) => {
    onRemoveCustom(name);
    setChecked((prev) => { const n = new Set(prev); n.delete(name); return n; });
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <RssFeedRoundedIcon sx={{ fontSize: 18, color: ACCENT }} />
        <Typography sx={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>
          表示するメディアを選んで紐づける
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Tooltip title={recommended.size > 0
          ? `あなたのカテゴリ（${categories.join('・')}）に合うメディアを自動で選んで紐づけます`
          : 'おすすめメディアをすべて紐づけます（カテゴリを作成すると、より合わせた選択になります）'}>
          <Button size="small" variant="contained" disabled={saving}
            startIcon={<AutoAwesomeRoundedIcon sx={{ fontSize: '14px !important' }} />}
            onClick={handleAuto}
            sx={{ bgcolor: AI_PURPLE, color: '#2a1233', fontWeight: 800, textTransform: 'none', px: 1.5, borderRadius: 1.5,
              '&:hover': { bgcolor: '#ba68c8' } }}>
            AIにおまかせで紐づける
          </Button>
        </Tooltip>
      </Box>
      <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', mb: 0.5, lineHeight: 1.7 }}>
        SEKKEIYA からは建築・インテリアの良質メディアをおすすめとしてご紹介します。
        どのメディアの記事をホームに表示するかは、あなた自身の選択で紐づけられます（RSS公開情報に基づく表示です）。
      </Typography>
      {categories.length > 0 && recommended.size > 0 && (
        <Typography sx={{ fontSize: 11.5, color: AI_PURPLE, mb: 1.5 }}>
          ✨ あなたのカテゴリ（{categories.join('・')}）に合いそうなメディアを事前に選択しています。
        </Typography>
      )}

      {groups.map((g) => (
        <Box key={g} sx={{ mb: 1.75 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.5, color: 'rgba(255,255,255,0.4)', mb: 0.75 }}>
            {g}
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 0.75 }}>
            {allSites.filter((s) => s.group === g).map((s) => {
              const on = checked.has(s.name);
              const rec = recommended.get(s.name);
              const isCustom = s.group === 'カスタム';
              return (
                <Box key={s.name} onClick={() => toggle(s.name)}
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.75, borderRadius: 2, cursor: 'pointer',
                    bgcolor: on ? 'rgba(229,115,115,0.10)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${on ? `${ACCENT}66` : 'rgba(255,255,255,0.09)'}`,
                    transition: 'border-color .12s, background-color .12s',
                    '&:hover': { borderColor: on ? ACCENT : 'rgba(255,255,255,0.25)' },
                    '&:hover .fsp-remove': { opacity: 1 } }}>
                  <Checkbox checked={on} size="small" disableRipple
                    sx={{ p: 0.25, color: 'rgba(255,255,255,0.35)', '&.Mui-checked': { color: ACCENT } }} />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Typography noWrap sx={{ fontSize: 12.5, fontWeight: 700, color: '#fff' }}>{s.name}</Typography>
                      {s.lang === 'en' && (
                        <Typography sx={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.15)', px: 0.5, borderRadius: 0.75, flexShrink: 0 }}>EN</Typography>
                      )}
                      {rec && (
                        <Tooltip title={`カテゴリ「${rec.join('・')}」に関連`}>
                          <Chip icon={<AutoAwesomeRoundedIcon sx={{ fontSize: '11px !important' }} />} label="カテゴリ向け" size="small"
                            sx={{ height: 17, fontSize: 9.5, fontWeight: 800, flexShrink: 0,
                              bgcolor: 'rgba(206,147,216,0.14)', color: AI_PURPLE, border: '1px solid rgba(206,147,216,0.4)',
                              '& .MuiChip-icon': { color: AI_PURPLE } }} />
                        </Tooltip>
                      )}
                    </Box>
                    <Typography noWrap sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.45)' }}>{s.note}</Typography>
                  </Box>
                  {isCustom && (
                    <Tooltip title="このメディアを一覧から削除">
                      <IconButton className="fsp-remove" size="small"
                        onClick={(e) => { e.stopPropagation(); handleRemoveCustom(s.name); }}
                        sx={{ opacity: 0, transition: 'opacity .12s', color: 'rgba(255,255,255,0.45)',
                          '&:hover': { color: '#ef9a9a', bgcolor: 'rgba(229,57,53,0.12)' } }}>
                        <CloseRoundedIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>
      ))}

      {/* 自分で追加（URL→RSS自動探索） */}
      <Box sx={{ mb: 2 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.5, color: 'rgba(255,255,255,0.4)', mb: 0.75 }}>
          メディアを自分で追加
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.25, py: 0.5, borderRadius: 1.5,
            bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', flex: 1, maxWidth: 460 }}>
            <TravelExploreRoundedIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.4)' }} />
            <InputBase
              value={addUrl}
              onChange={(e) => { setAddUrl(e.target.value); setAddError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleAdd(); }}
              placeholder="サイトURL または RSSフィードURL（例: https://example.com）"
              disabled={addBusy}
              sx={{ color: '#fff', fontSize: 12.5, flex: 1 }}
            />
          </Box>
          <Button size="small" variant="outlined" disabled={addBusy || !addUrl.trim()}
            startIcon={addBusy ? <CircularProgress size={12} sx={{ color: ACCENT }} /> : <AddRoundedIcon sx={{ fontSize: '15px !important' }} />}
            onClick={() => void handleAdd()}
            sx={{ color: ACCENT, borderColor: `${ACCENT}55`, textTransform: 'none', fontSize: 12, flexShrink: 0,
              '&:hover': { borderColor: ACCENT, bgcolor: 'rgba(229,115,115,0.08)' } }}>
            {addBusy ? 'フィードを探索中…' : '追加'}
          </Button>
        </Box>
        {addError && (
          <Typography sx={{ fontSize: 11, color: '#ef9a9a', mt: 0.75 }}>{addError}</Typography>
        )}
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
        <Button size="small" onClick={() => setChecked(new Set(allSites.map((s) => s.name)))}
          sx={{ color: 'rgba(255,255,255,0.55)', textTransform: 'none', fontSize: 11.5 }}>
          すべて選択
        </Button>
        <Button size="small" onClick={() => setChecked(new Set())}
          sx={{ color: 'rgba(255,255,255,0.55)', textTransform: 'none', fontSize: 11.5 }}>
          すべて解除
        </Button>
        <Box sx={{ flex: 1 }} />
        {onCancel && (
          <Button size="small" onClick={onCancel} disabled={saving}
            sx={{ color: 'rgba(255,255,255,0.6)', textTransform: 'none' }}>
            キャンセル
          </Button>
        )}
        <Button variant="contained" size="small" disabled={saving || checked.size === 0}
          startIcon={saving ? <CircularProgress size={13} sx={{ color: '#000' }} /> : <RssFeedRoundedIcon sx={{ fontSize: '15px !important' }} />}
          onClick={() => onSave([...checked])}
          sx={{ bgcolor: ACCENT, color: '#000', fontWeight: 800, textTransform: 'none', px: 2, borderRadius: 1.5,
            '&:hover': { bgcolor: '#ef5350' },
            '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.4)' } }}>
          {checked.size > 0 ? `${checked.size} 件のメディアを紐づける` : 'メディアを選んでください'}
        </Button>
      </Box>
      <Typography sx={{ mt: 1.5, fontSize: 10.5, color: 'rgba(255,255,255,0.3)', lineHeight: 1.7 }}>
        表示は各メディアが公開している RSS 配信（タイトル・リンク・サムネイル）に基づきます。本文の転載は行いません。紐づけはいつでも変更できます。
      </Typography>
    </Box>
  );
};

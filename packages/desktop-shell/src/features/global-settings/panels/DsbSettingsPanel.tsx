/**
 * DsbSettingsPanel — Global Settings > S.Blog。
 * S.Blog の横断設定をここに集約する:
 *  1. フィード購読（表示メディアの紐づけ管理。ホームの初回ピッカー/管理ダイアログと同じ FeedSourcePicker を再利用）
 *  2. 通知（投稿予定の期日デスクトップ通知 ON/OFF）
 *  3. 投稿計画の既定値（曜日・時刻。スケジュールの「AIに投稿計画を作ってもらう」の初期値）
 * 保存先はすべて Firestore users/{uid}/blogSettings/main（デバイス間で共有）。
 */
import React, { useEffect, useState } from 'react';
import { Box, Typography, Chip, Switch, TextField, CircularProgress } from '@mui/material';
import RssFeedRoundedIcon from '@mui/icons-material/RssFeedRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded';
import { useAuthStore } from '../../../store/useAuthStore';
import { useDsbStore } from '../../dsb/store/useDsbStore';
import { FeedSourcePicker } from '../../dsb/FeedSourcePicker';
import {
  loadBlogFeedSources, saveBlogFeedSources, loadCustomFeedSources, saveCustomFeedSources,
  loadBlogPrefs, saveBlogPrefs, DEFAULT_BLOG_PREFS, type BlogPrefs,
} from '../../dsb/api/blogApi';
import type { BlogSourceSite } from '../../dsb/types';

const ACCENT = '#e57373';
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

const Section: React.FC<{ icon: React.ReactNode; title: string; desc: string; children: React.ReactNode }> = ({ icon, title, desc, children }) => (
  <Box sx={{ p: 2.5, borderRadius: 2.5, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', mb: 2.5 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
      {icon}
      <Typography sx={{ fontSize: 14.5, fontWeight: 800, color: 'var(--brand-fg)' }}>{title}</Typography>
    </Box>
    <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.5)', mb: 1.75, lineHeight: 1.7 }}>{desc}</Typography>
    {children}
  </Box>
);

export const DsbSettingsPanel: React.FC = () => {
  const uid = useAuthStore((s: any) => s.currentUser?.uid as string | undefined);
  const categories = useDsbStore((s) => s.categories);
  const loadCategories = useDsbStore((s) => s.loadCategories);

  const [loadingAll, setLoadingAll] = useState(true);
  const [sources, setSources] = useState<string[] | null>(null);
  const [customSources, setCustomSources] = useState<BlogSourceSite[]>([]);
  const [sourcesSaving, setSourcesSaving] = useState(false);
  const [prefs, setPrefs] = useState<BlogPrefs>(DEFAULT_BLOG_PREFS);

  useEffect(() => {
    if (!uid) return;
    let alive = true;
    void Promise.all([loadBlogFeedSources(uid), loadCustomFeedSources(uid), loadBlogPrefs(uid), loadCategories(uid)])
      .then(([s, customs, p]) => {
        if (!alive) return;
        setSources(s);
        setCustomSources(customs);
        setPrefs(p);
      })
      .catch((e) => console.error('[DsbSettingsPanel] load failed', e))
      .finally(() => { if (alive) setLoadingAll(false); });
    return () => { alive = false; };
  }, [uid, loadCategories]);

  const patchPrefs = (patch: Partial<BlogPrefs>) => {
    if (!uid) return;
    setPrefs((p) => ({ ...p, ...patch }));
    void saveBlogPrefs(uid, patch).catch((e) => console.error('[DsbSettingsPanel] save prefs failed', e));
  };

  const handleSaveSources = async (names: string[]) => {
    if (!uid) return;
    setSourcesSaving(true);
    try { await saveBlogFeedSources(uid, names); setSources(names); }
    finally { setSourcesSaving(false); }
  };

  if (!uid) {
    return <Box sx={{ p: 4, color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>S.Blog の設定にはログインが必要です。</Box>;
  }

  return (
    <Box sx={{ flex: 1, overflowY: 'auto', p: 4 }}>
      <Typography sx={{ fontSize: 22, fontWeight: 800, color: 'var(--brand-fg)', mb: 0.5 }}>S.Blog 設定</Typography>
      <Typography sx={{ fontSize: 12.5, color: 'rgb(var(--brand-fg-rgb) / 0.5)', mb: 3 }}>
        フィード購読・通知・投稿計画の既定値。設定はアカウントに保存され、どの端末でも共有されます。
      </Typography>

      {loadingAll ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress size={24} sx={{ color: ACCENT }} /></Box>
      ) : (
        <Box sx={{ maxWidth: 920 }}>
          {/* 1. 通知 */}
          <Section icon={<NotificationsActiveRoundedIcon sx={{ fontSize: 18, color: ACCENT }} />} title="通知"
            desc="投稿スケジュールの期日にデスクトップ通知でお知らせします（1日1回・ホームの「今週書くもの」と連動）。">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Switch checked={prefs.notifyDue} onChange={(e) => patchPrefs({ notifyDue: e.target.checked })}
                sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: ACCENT }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: ACCENT } }} />
              <Typography sx={{ fontSize: 13, color: 'rgb(var(--brand-fg-rgb) / 0.8)' }}>
                投稿予定の期日を通知する
              </Typography>
            </Box>
          </Section>

          {/* 2. 投稿計画の既定値 */}
          <Section icon={<EventNoteRoundedIcon sx={{ fontSize: 18, color: ACCENT }} />} title="投稿計画の既定値"
            desc="スケジュールの「AIに投稿計画を作ってもらう」を開いたときの初期値です（実行時にその場で変更もできます）。">
            <Typography sx={{ fontSize: 12, fontWeight: 800, color: 'rgb(var(--brand-fg-rgb) / 0.7)', mb: 0.75 }}>投稿する曜日</Typography>
            <Box sx={{ display: 'flex', gap: 0.75, mb: 2 }}>
              {WEEKDAYS.map((w, i) => {
                const on = prefs.planWeekdays.includes(i);
                return (
                  <Chip key={w} label={w} size="small"
                    onClick={() => patchPrefs({ planWeekdays: on ? prefs.planWeekdays.filter((n) => n !== i) : [...prefs.planWeekdays, i].sort() })}
                    sx={{ cursor: 'pointer', fontWeight: 800, width: 40,
                      bgcolor: on ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.05)', color: on ? '#191815' : 'rgb(var(--brand-fg-rgb) / 0.65)',
                      border: `1px solid ${on ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.15)'}`,
                      '&:hover': { bgcolor: on ? ACCENT : 'rgba(229,115,115,0.15)' } }} />
                );
              })}
            </Box>
            <TextField label="投稿時刻" type="time" size="small" value={prefs.planTime}
              onChange={(e) => patchPrefs({ planTime: e.target.value })}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 160,
                '& .MuiOutlinedInput-root': { color: 'var(--brand-fg)', '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.18)' }, '&.Mui-focused fieldset': { borderColor: ACCENT } },
                '& .MuiInputLabel-root': { color: 'rgb(var(--brand-fg-rgb) / 0.55)' } }} />
          </Section>

          {/* 3. フィード購読 */}
          <Section icon={<RssFeedRoundedIcon sx={{ fontSize: 18, color: ACCENT }} />} title="ホームのフィード購読"
            desc="ホームに表示するメディアの紐づけを管理します（ホームの管理ダイアログと同じ内容）。">
            <FeedSourcePicker
              categories={categories}
              current={sources ?? []}
              customSources={customSources}
              saving={sourcesSaving}
              onSave={(n) => void handleSaveSources(n)}
              onAddCustom={async (site) => {
                const next = [...customSources, site];
                await saveCustomFeedSources(uid, next);
                setCustomSources(next);
              }}
              onRemoveCustom={(name) => {
                const next = customSources.filter((s) => s.name !== name);
                void saveCustomFeedSources(uid, next).then(() => setCustomSources(next));
                if (sources?.includes(name)) void handleSaveSources(sources.filter((n) => n !== name));
              }}
            />
          </Section>
        </Box>
      )}
    </Box>
  );
};

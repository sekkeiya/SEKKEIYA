import React from 'react';
import { Box, Typography, Paper, Select, MenuItem, Chip, Tooltip } from '@mui/material';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import {
  useAiSettingsStore,
  AI_TASKS,
  CHAT_MODEL_OPTIONS,
  IMAGE_PROVIDER_OPTIONS,
} from '../../../store/useAiSettingsStore';
import { useT } from '../../../lib/i18n';

/**
 * Global Settings > AI。
 * 「どの用途にどのモデルを使うか」を用途ごとに設定する。
 *   - 用途別モデル（チャット / S.Blog / 整文 / 要約）
 *   - 画像生成モデル（プロバイダ）
 * チャット下部のモデル切替は一時的な上書き、ここが起動時の既定値。
 */
/** Lv2 サブ項目に対応。未指定なら全セクションを表示（後方互換）。 */
interface AiSettingsPanelProps { section?: 'models' | 'image'; }

export const AiSettingsPanel = ({ section }: AiSettingsPanelProps = {}) => {
  const t = useT();
  const showModels = !section || section === 'models';
  const showImage  = !section || section === 'image';
  const taskModels = useAiSettingsStore(s => s.taskModels);
  const imageProvider = useAiSettingsStore(s => s.imageProvider);
  const setTaskModel = useAiSettingsStore(s => s.setTaskModel);
  const setImageProvider = useAiSettingsStore(s => s.setImageProvider);

  const sectionSx = {
    p: 3,
    borderRadius: 3,
    bgcolor: 'background.paper',
    border: '1px solid',
    borderColor: 'divider',
  } as const;

  const accent = 'light-dark(#0875a6, #4fc3f7)';

  return (
    <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto' }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
        {t({ ja: 'AI設定', en: 'AI' })}
      </Typography>

      {/* ── 用途別モデル ── */}
      {showModels && (
      <Paper elevation={0} sx={sectionSx}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <TuneRoundedIcon sx={{ color: accent }} />
          {t({ ja: '用途別モデル', en: 'Model per purpose' })}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5 }}>
          {t({
            ja: '機能ごとに使うモデルを割り当てます。速さ重視の用途は高速モデル、品質重視の用途は高性能モデル、と使い分けられます。',
            en: 'Assign a model per feature — a fast model where speed matters, a stronger model where quality matters.',
          })}
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {AI_TASKS.map(task => {
            const value = taskModels[task.id] ?? task.defaultModel;
            return (
              <Box
                key={task.id}
                sx={{
                  display: 'flex',
                  alignItems: { xs: 'flex-start', md: 'center' },
                  justifyContent: 'space-between',
                  flexDirection: { xs: 'column', md: 'row' },
                  gap: 1.25,
                  py: 1.5,
                  borderTop: '1px solid',
                  borderColor: 'divider',
                  '&:first-of-type': { borderTop: 'none', pt: 0 },
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <SmartToyRoundedIcon sx={{ fontSize: 18, color: accent }} />
                    <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{t(task.label)}</Typography>
                    {!task.serverHonorsModel && (
                      <Tooltip
                        title={t({
                          ja: 'この用途はサーバー側の反映対応が未了です。設定は保存されますが、現在は固定モデルで動作します。',
                          en: 'Server-side model routing for this purpose is not wired yet. Your choice is saved but the fixed model is used for now.',
                        })}
                      >
                        <Chip
                          label={t({ ja: '配線待ち', en: 'Pending' })}
                          size="small"
                          sx={{ height: 18, fontSize: 10, fontWeight: 700 }}
                        />
                      </Tooltip>
                    )}
                  </Box>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>
                    {t(task.description)}
                  </Typography>
                </Box>
                <Select
                  size="small"
                  value={value}
                  onChange={e => setTaskModel(task.id, e.target.value)}
                  sx={{ minWidth: 260, fontSize: 13, alignSelf: { xs: 'stretch', md: 'center' } }}
                >
                  {CHAT_MODEL_OPTIONS.map(opt => (
                    <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: 13 }}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </Box>
            );
          })}
        </Box>
      </Paper>
      )}

      {/* ── 画像生成モデル ── */}
      {showImage && (
      <Paper elevation={0} sx={sectionSx}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <ImageRoundedIcon sx={{ color: accent }} />
          {t({ ja: '画像生成モデル', en: 'Image generation model' })}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          {t({
            ja: 'リサーチボードのコンセプトイメージ生成（SEKKEIYA OS 経由）に使うモデルです。チャットのモデルとは独立に選べます。',
            en: 'Model used for concept image generation on the research board (via SEKKEIYA OS). Independent from the chat model.',
          })}
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {IMAGE_PROVIDER_OPTIONS.map(opt => {
            const selected = imageProvider === opt.value;
            return (
              <Box
                key={opt.value}
                onClick={() => { if (opt.available) setImageProvider(opt.value); }}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5,
                  p: 1.5, px: 2, borderRadius: 2,
                  border: '1px solid',
                  borderColor: selected ? accent : 'divider',
                  bgcolor: selected ? 'rgba(79, 195, 247, 0.08)' : 'transparent',
                  cursor: opt.available ? 'pointer' : 'not-allowed',
                  opacity: opt.available ? 1 : 0.45,
                  transition: 'border-color .12s, background-color .12s',
                  '&:hover': opt.available ? { borderColor: accent } : {},
                }}
              >
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>{opt.label}</Typography>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{opt.description}</Typography>
                </Box>
                {selected && opt.available && (
                  <Chip label={t({ ja: '使用中', en: 'Active' })} size="small"
                    sx={{ height: 20, fontSize: 10.5, fontWeight: 700, bgcolor: 'rgba(79, 195, 247, 0.18)', color: accent }} />
                )}
                {!opt.available && (
                  <Chip label={t({ ja: '準備中', en: 'Coming soon' })} size="small"
                    sx={{ height: 20, fontSize: 10.5, fontWeight: 700 }} />
                )}
              </Box>
            );
          })}
        </Box>
      </Paper>
      )}
    </Box>
  );
};

/**
 * TtsSettingsDialog — 読み上げ（TTS）の共通設定ダイアログ。
 * S.Blog リーダー / SEKKEIYA Chat など、読み上げ機能のあるどこからでも同じダイアログを開く。
 * 設定は lib/tts の getTtsSettings/setTtsSettings で localStorage に永続化され、全機能で共有される。
 */
import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography, Slider,
  Select, MenuItem, Button, IconButton, FormControl, ToggleButton, ToggleButtonGroup, Collapse,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import PaidRoundedIcon from '@mui/icons-material/PaidRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import {
  getTtsSettings, setTtsSettings, listJaVoices, speak, stopSpeaking, isTtsAvailable,
  type TtsSettings, type AiTtsStyle,
} from '../../lib/tts';
import { AI_VOICES, AiTtsPlayer } from '../../lib/aiTts';

const AI_STYLES: { key: AiTtsStyle; label: string; desc: string }[] = [
  { key: 'anchor',    label: 'アナウンサー', desc: 'ニュース原稿のように明瞭・正確に' },
  { key: 'audiobook', label: '朗読',        desc: '本の朗読のように抑揚と情感を込めて' },
  { key: 'natural',   label: 'ナチュラル',   desc: '自然な話し言葉で' },
];

const ACCENT = '#8ab4f8';

interface TtsSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export const TtsSettingsDialog: React.FC<TtsSettingsDialogProps> = ({ open, onClose }) => {
  const [settings, setSettings] = React.useState<TtsSettings>(getTtsSettings());
  const [voices, setVoices] = React.useState<SpeechSynthesisVoice[]>([]);
  const [costOpen, setCostOpen] = React.useState(false); // 💰 API利用料の目安

  // 開くたびに最新設定＋声一覧を読み込む（声は非同期にロードされることがある）
  React.useEffect(() => {
    if (!open) return;
    setSettings(getTtsSettings());
    const load = () => setVoices(listJaVoices());
    load();
    if (isTtsAvailable()) {
      const prev = window.speechSynthesis.onvoiceschanged;
      window.speechSynthesis.onvoiceschanged = () => { prev?.call(window.speechSynthesis, new Event('voiceschanged')); load(); };
      return () => { window.speechSynthesis.onvoiceschanged = prev; };
    }
  }, [open]);

  // 変更は即座に反映・永続化（次の読み上げから有効）。
  const update = (patch: Partial<TtsSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    setTtsSettings(patch);
  };

  // 試聴（AI音声は合成に数秒かかる）
  const previewPlayerRef = React.useRef<AiTtsPlayer | null>(null);
  const [previewing, setPreviewing] = React.useState(false);
  const stopPreview = () => {
    stopSpeaking();
    previewPlayerRef.current?.stop();
    setPreviewing(false);
  };
  const preview = async () => {
    stopPreview();
    const sample = 'これは読み上げのサンプルです。速度や声、トーンを確認できます。';
    if (settings.engine === 'ai') {
      setPreviewing(true);
      const player = new AiTtsPlayer();
      previewPlayerRef.current = player;
      try {
        await player.play([sample], { voice: settings.aiVoice, style: settings.aiStyle, rate: settings.rate }, { onEnd: () => setPreviewing(false) });
      } catch { setPreviewing(false); }
    } else {
      speak(sample);
    }
  };

  const reset = () => {
    stopPreview();
    update({ rate: 1.05, pitch: 1.0, voiceURI: null, engine: 'standard', aiVoice: 'Kore', aiStyle: 'anchor' });
  };

  React.useEffect(() => () => { stopPreview(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={open} onClose={() => { stopPreview(); onClose(); }} maxWidth="xs" fullWidth
      PaperProps={{ sx: { bgcolor: '#16181d', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 3, color: '#fff' } }}>
      <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        <VolumeUpRoundedIcon sx={{ fontSize: 20, color: ACCENT }} />
        読み上げの設定
        <Box sx={{ flex: 1 }} />
        <IconButton size="small" onClick={() => { stopPreview(); onClose(); }} sx={{ color: 'rgba(255,255,255,0.5)' }}>
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)', mb: 2 }}>
          設定は記事の読み上げ・SEKKEIYA Chat の音声モードなど、すべての読み上げに共通で適用されます。
        </Typography>

        {/* エンジン: 標準（OS音声・無料/即時） / AI音声（高品質・トーン指定可） */}
        <Box sx={{ mb: 2.5 }}>
          <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: 'rgba(255,255,255,0.8)', mb: 0.75 }}>音声エンジン</Typography>
          <ToggleButtonGroup
            fullWidth exclusive size="small" value={settings.engine}
            onChange={(_e, v) => { if (v) { stopPreview(); update({ engine: v }); } }}
            sx={{ '& .MuiToggleButton-root': { color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.15)', textTransform: 'none', fontSize: 12.5, py: 0.75 },
              '& .Mui-selected': { color: '#fff !important', bgcolor: `${ACCENT}33 !important` } }}>
            <ToggleButton value="standard">標準（無料・即時）</ToggleButton>
            <ToggleButton value="ai">
              <AutoAwesomeRoundedIcon sx={{ fontSize: 15, mr: 0.5 }} />AI音声（高品質）
              <Box component="span" sx={{ ml: 0.75, px: 0.6, py: 0.1, borderRadius: 0.75, fontSize: 9, fontWeight: 800,
                bgcolor: 'rgba(255,215,64,0.15)', color: '#ffd740', border: '1px solid rgba(255,215,64,0.4)' }}>
                有料プラン
              </Box>
            </ToggleButton>
          </ToggleButtonGroup>
          {settings.engine === 'ai' && (
            <>
              <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', mt: 0.75, lineHeight: 1.6 }}>
                読み間違いの少ないニューラル音声。段落ごとに生成するため開始まで数秒かかり、通信と少額のAPI利用が発生します。
                まず記事の読み上げに適用されます（Chatの音声モードは標準音声）。
              </Typography>
              {/* 💰 API利用料の目安 */}
              <Button size="small" onClick={() => setCostOpen((v) => !v)}
                startIcon={<PaidRoundedIcon sx={{ fontSize: '14px !important' }} />}
                endIcon={<ExpandMoreRoundedIcon sx={{ fontSize: '15px !important', transform: costOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />}
                sx={{ mt: 0.75, color: '#a5d6a7', textTransform: 'none', fontSize: 11.5, px: 1 }}>
                API利用料の目安
              </Button>
              <Collapse in={costOpen}>
                <Box sx={{ mt: 0.5, p: 1.5, borderRadius: 1.5, bgcolor: 'rgba(129,199,132,0.06)', border: '1px solid rgba(129,199,132,0.25)' }}>
                  {[
                    ['音声1分あたり', '約 2〜3円'],
                    ['記事1本（約5分）', '約 10〜15円'],
                    ['1時間の聴き流し', '約 130〜160円'],
                  ].map(([k, v]) => (
                    <Box key={k} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.3 }}>
                      <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.65)' }}>{k}</Typography>
                      <Typography sx={{ fontSize: 11.5, color: '#a5d6a7', fontWeight: 700 }}>{v}</Typography>
                    </Box>
                  ))}
                  <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', mt: 0.75, lineHeight: 1.6 }}>
                    ※ Gemini TTS の公表価格（音声$10/100万トークン・1分≈1,500トークン）からの概算。為替や価格改定で変動します。
                    一度生成した段落はキャッシュされ、同じ記事の再読・戻り再生には料金がかかりません。標準エンジンは無料です。
                  </Typography>
                </Box>
              </Collapse>
            </>
          )}
        </Box>

        {/* 速度 */}
        <Box sx={{ mb: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>速度</Typography>
            <Typography sx={{ fontSize: 12, color: ACCENT, fontWeight: 700 }}>{settings.rate.toFixed(2)}x</Typography>
          </Box>
          <Slider value={settings.rate} min={0.5} max={2} step={0.05}
            onChange={(_e, v) => update({ rate: v as number })}
            marks={[{ value: 0.5, label: '遅い' }, { value: 1, label: '標準' }, { value: 2, label: '速い' }]}
            sx={{ color: ACCENT, '& .MuiSlider-markLabel': { color: 'rgba(255,255,255,0.4)', fontSize: 10 } }} />
        </Box>

        {settings.engine === 'standard' ? (
          <>
            {/* 声の高さ（標準エンジンのみ） */}
            <Box sx={{ mb: 2.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>声の高さ</Typography>
                <Typography sx={{ fontSize: 12, color: ACCENT, fontWeight: 700 }}>{settings.pitch.toFixed(1)}</Typography>
              </Box>
              <Slider value={settings.pitch} min={0} max={2} step={0.1}
                onChange={(_e, v) => update({ pitch: v as number })}
                marks={[{ value: 0, label: '低い' }, { value: 1, label: '標準' }, { value: 2, label: '高い' }]}
                sx={{ color: ACCENT, '& .MuiSlider-markLabel': { color: 'rgba(255,255,255,0.4)', fontSize: 10 } }} />
            </Box>

            {/* 声（スピーカー） */}
            <Box sx={{ mb: 1 }}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: 'rgba(255,255,255,0.8)', mb: 0.75 }}>声（スピーカー）</Typography>
              <FormControl fullWidth size="small">
                <Select
                  value={voices.some((v) => v.voiceURI === settings.voiceURI) ? settings.voiceURI! : ''}
                  displayEmpty
                  onChange={(e) => update({ voiceURI: e.target.value ? String(e.target.value) : null })}
                  sx={{ color: '#fff', fontSize: 13, bgcolor: 'rgba(255,255,255,0.04)',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.18)' },
                    '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.5)' } }}
                  MenuProps={{ slotProps: { paper: { sx: { bgcolor: '#1a1f2a', color: '#fff', maxHeight: 320 } } } }}>
                  <MenuItem value="">自動（日本語の自然な声を優先）</MenuItem>
                  {voices.map((v) => (
                    <MenuItem key={v.voiceURI} value={v.voiceURI} sx={{ fontSize: 13 }}>
                      {v.name}{v.localService ? '' : '（オンライン）'}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {voices.length === 0 && (
                <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', mt: 0.75 }}>
                  利用可能な日本語の声が見つかりません。OSの音声パックを追加すると声を選べます。
                </Typography>
              )}
            </Box>
          </>
        ) : (
          <>
            {/* トーン（AI音声） */}
            <Box sx={{ mb: 2.5 }}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: 'rgba(255,255,255,0.8)', mb: 0.75 }}>トーン（話し方）</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0.75 }}>
                {AI_STYLES.map((s) => {
                  const on = settings.aiStyle === s.key;
                  return (
                    <Box key={s.key} onClick={() => update({ aiStyle: s.key })}
                      sx={{ p: 1.1, borderRadius: 1.5, cursor: 'pointer', textAlign: 'center',
                        bgcolor: on ? `${ACCENT}22` : 'rgba(255,255,255,0.03)',
                        border: `1.5px solid ${on ? ACCENT : 'rgba(255,255,255,0.12)'}`,
                        '&:hover': { borderColor: ACCENT } }}>
                      <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: 12 }}>{s.label}</Typography>
                      <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, mt: 0.4, lineHeight: 1.5 }}>{s.desc}</Typography>
                    </Box>
                  );
                })}
              </Box>
            </Box>

            {/* AI声 */}
            <Box sx={{ mb: 1 }}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: 'rgba(255,255,255,0.8)', mb: 0.75 }}>声（スピーカー）</Typography>
              <FormControl fullWidth size="small">
                <Select
                  value={settings.aiVoice}
                  onChange={(e) => update({ aiVoice: String(e.target.value) })}
                  sx={{ color: '#fff', fontSize: 13, bgcolor: 'rgba(255,255,255,0.04)',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.18)' },
                    '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.5)' } }}
                  MenuProps={{ slotProps: { paper: { sx: { bgcolor: '#1a1f2a', color: '#fff', maxHeight: 320 } } } }}>
                  {AI_VOICES.map((v) => (
                    <MenuItem key={v.name} value={v.name} sx={{ fontSize: 13 }}>{v.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, justifyContent: 'space-between' }}>
        <Button onClick={reset} startIcon={<RestartAltRoundedIcon />}
          sx={{ color: 'rgba(255,255,255,0.5)', textTransform: 'none', fontSize: 12.5 }}>
          既定に戻す
        </Button>
        <Button onClick={() => void preview()} variant="contained" disabled={previewing} startIcon={<VolumeUpRoundedIcon />}
          sx={{ bgcolor: ACCENT, color: '#001018', fontWeight: 700, textTransform: 'none', borderRadius: 2, '&:hover': { bgcolor: '#a8c7fa' },
            '&.Mui-disabled': { bgcolor: `${ACCENT}44`, color: 'rgba(0,16,24,0.6)' } }}>
          {previewing ? '生成中…' : '試聴'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

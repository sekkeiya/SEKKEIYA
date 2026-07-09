/**
 * VoiceSettingsPanel — Global Settings > 音声。
 * SEKKEIYA 横断の音声設定をここに集約する:
 *  1. 読み上げ（TTS）: S.Blogリーダー・SEKKEIYA Chat・プレゼン等、全読み上げ共通の設定
 *     （フォームは TtsSettingsForm。各機能の読み上げボタン脇のダイアログと同じ設定を編集する）
 *  2. 音声入力: Alt+S で Windows 音声入力（Win+H）を起動するショートカットの ON/OFF
 *  3. AI整文: Alt+Shift+S で入力欄のテキストをAIが整えるショートカットの ON/OFF
 * 読み上げ設定は lib/tts、音声入力は lib/altDictation、整文は lib/textPolish の
 * localStorage に永続化（デバイスごと）。
 */
import React, { useState } from 'react';
import { Box, Typography, Switch } from '@mui/material';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import KeyboardVoiceRoundedIcon from '@mui/icons-material/KeyboardVoiceRounded';
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded';
import { TtsSettingsForm } from '../../../components/tts/TtsSettingsForm';
import { isAltDictationEnabled, setAltDictationEnabled } from '../../../lib/altDictation';
import { isTextPolishEnabled, setTextPolishEnabled } from '../../../lib/textPolish';
import { isTauri } from '../../../lib/platform';

const ACCENT = '#8ab4f8';

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

/** キーボードショートカット表示（Alt+S 等） */
const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box component="span" sx={{ px: 0.75, py: 0.2, borderRadius: 1, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
    bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.22)', color: 'rgb(var(--brand-fg-rgb) / 0.85)' }}>
    {children}
  </Box>
);

/** AI音声の利用枠メーター（Claude式・時間窓リセット）。新規合成分だけが減り、キャッシュ再生は無制限。 */
const TtsUsageMeter: React.FC = () => {
  const [usage, setUsage] = useState<{ used5hSec: number; limit5hSec: number; used7dSec: number; limit7dSec: number } | null>(null);
  const [failed, setFailed] = useState(false);
  React.useEffect(() => {
    let alive = true;
    void import('../../../lib/firebase/client')
      .then(async ({ functions }) => {
        const { httpsCallable } = await import('firebase/functions');
        const r: any = await httpsCallable(functions, 'getTtsUsage')({});
        if (alive && r.data?.success) setUsage(r.data);
        else if (alive) setFailed(true);
      })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);
  if (failed) return null; // 未デプロイ/未ログイン時は静かに非表示
  const rows = usage ? [
    { label: '直近5時間', used: usage.used5hSec, limit: usage.limit5hSec },
    { label: '直近7日間', used: usage.used7dSec, limit: usage.limit7dSec },
  ] : [];
  return (
    <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.08)' }}>
      <Typography sx={{ fontSize: 12, fontWeight: 800, color: 'rgb(var(--brand-fg-rgb) / 0.7)', mb: 1 }}>
        AI音声の利用枠（時間経過で自動回復）
      </Typography>
      {!usage ? (
        <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>読み込み中…</Typography>
      ) : rows.map((r) => {
        const pct = Math.min(100, Math.round((r.used / Math.max(1, r.limit)) * 100));
        return (
          <Box key={r.label} sx={{ mb: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
              <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>{r.label}</Typography>
              <Typography sx={{ fontSize: 11, color: pct >= 100 ? 'light-dark(#961818, #ef9a9a)' : 'rgb(var(--brand-fg-rgb) / 0.5)' }}>
                {Math.round(r.used / 60)} / {Math.round(r.limit / 60)} 分
              </Typography>
            </Box>
            <Box sx={{ height: 6, borderRadius: 3, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)', overflow: 'hidden' }}>
              <Box sx={{ width: `${pct}%`, height: '100%', borderRadius: 3,
                bgcolor: pct >= 100 ? '#ef9a9a' : pct >= 80 ? '#ffb74d' : ACCENT, transition: 'width .3s' }} />
            </Box>
          </Box>
        );
      })}
      <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.35)', lineHeight: 1.6 }}>
        カウントされるのは新しく合成した分だけです。一度聴いた記事の再生や保存済みの音声は無制限。
        枠を使い切っても標準音声（無料）に自動で切り替わり、時間が経つと回復します。
      </Typography>
    </Box>
  );
};

export const VoiceSettingsPanel: React.FC = () => {
  const [dictationOn, setDictationOn] = useState(isAltDictationEnabled());
  const toggleDictation = (on: boolean) => {
    setDictationOn(on);
    setAltDictationEnabled(on);
  };
  const [polishOn, setPolishOn] = useState(isTextPolishEnabled());
  const togglePolish = (on: boolean) => {
    setPolishOn(on);
    setTextPolishEnabled(on);
  };

  return (
    <Box sx={{ flex: 1, overflowY: 'auto', p: 4 }}>
      <Typography sx={{ fontSize: 22, fontWeight: 800, color: 'var(--brand-fg)', mb: 0.5 }}>音声設定</Typography>
      <Typography sx={{ fontSize: 12.5, color: 'rgb(var(--brand-fg-rgb) / 0.5)', mb: 3 }}>
        読み上げと音声入力の設定。SEKKEIYA 全体（記事の読み上げ・SEKKEIYA OS の音声モードなど）に共通で適用され、この端末に保存されます。
      </Typography>

      {/* 左=読み上げ(TTS)、右=ショートカット系(音声入力/AI整文)の2カラム。狭い画面では1カラムに落ちる */}
      <Box sx={{ maxWidth: 1180, display: 'grid', alignItems: 'start', columnGap: 2.5, rowGap: 0,
        gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) minmax(0, 1fr)' } }}>
        {/* 1. 読み上げ（TTS） */}
        <Section icon={<VolumeUpRoundedIcon sx={{ fontSize: 18, color: ACCENT }} />} title="読み上げ（TTS）"
          desc="すべての読み上げに共通の設定です。各機能の読み上げボタン脇の設定ダイアログと同じ内容で、どちらで変更しても即座に反映されます。">
          <TtsSettingsForm />
          <TtsUsageMeter />
        </Section>

        {/* 右カラム: 音声で入力→AIで整える のショートカット2種 */}
        <Box>
          {/* 使い方の流れ（早見せ） */}
          <Box sx={{ p: 2, borderRadius: 2.5, mb: 2.5, bgcolor: `${ACCENT}0d`, border: `1px solid ${ACCENT}33` }}>
            <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: 'var(--brand-fg)', mb: 1 }}>
              おすすめの使い方：話して、整えて、聞いて確認
            </Typography>
            {([
              ['Alt+S', '音声入力で話す（フォーカス中の入力欄に直接入る）'],
              ['Alt+Shift+S', 'AI整文で自然な文章に整える'],
              ['読み上げ', '各画面の読み上げボタンで耳で確認する'],
            ] as const).map(([kbd, text]) => (
              <Box key={kbd} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.4 }}>
                <Kbd>{kbd}</Kbd>
                <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.65)' }}>{text}</Typography>
              </Box>
            ))}
          </Box>

          {/* 2. 音声入力 */}
          <Section icon={<KeyboardVoiceRoundedIcon sx={{ fontSize: 18, color: ACCENT }} />} title="音声入力（Windows専用）"
            desc="Alt+S で Windows 標準の音声入力（Win+H）を起動します。認識テキストはフォーカス中の入力欄へ直接入力されるため、チャット欄に限らずアプリ内のあらゆる入力欄で使えます。話し終えたら Alt で確定し、続けて Space か Enter を押すとそのまま送信できます。もう一度 Alt+S で閉じます。">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Switch checked={dictationOn} onChange={(e) => toggleDictation(e.target.checked)} disabled={!isTauri()}
                sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: ACCENT }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: ACCENT } }} />
              <Typography sx={{ fontSize: 13, color: 'rgb(var(--brand-fg-rgb) / 0.8)' }}>
                Alt+S で音声入力を起動する
              </Typography>
            </Box>
            {!isTauri() && (
              <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.4)', mt: 0.75 }}>
                音声入力はデスクトップアプリ（Windows）でのみ利用できます。
              </Typography>
            )}
          </Section>

          {/* 3. AI整文 */}
          <Section icon={<AutoFixHighRoundedIcon sx={{ fontSize: 18, color: ACCENT }} />} title="AI整文"
            desc="Alt+Shift+S で、フォーカス中の入力欄のテキストをAIが自然な文章に整えます（句読点・改行の補正、「えーと」等の除去。内容は変えません）。音声入力後の清書のほか、手入力の乱雑なメモにも使えます。テキストを選択していればその部分だけを整えます。">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Switch checked={polishOn} onChange={(e) => togglePolish(e.target.checked)}
                sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: ACCENT }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: ACCENT } }} />
              <Typography sx={{ fontSize: 13, color: 'rgb(var(--brand-fg-rgb) / 0.8)' }}>
                Alt+Shift+S でAI整文する
              </Typography>
            </Box>
          </Section>
        </Box>
      </Box>
    </Box>
  );
};

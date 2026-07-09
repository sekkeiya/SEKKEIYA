import React, { useEffect, useRef, useState } from 'react';
import {
  Box, Typography, Chip, Button, TextField, IconButton, CircularProgress, Avatar,
} from '@mui/material';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';

import type { DesktopProject } from '../projects/types';
import { useProjectSiteStore } from '../../store/useProjectSiteStore';
import { useAppStore } from '../../store/useAppStore';
import { renameProject } from '../projects/api/updateProject';
import {
  ONBOARDING_STEPS, ONBOARDING_INTRO, NAME_STEP, UNNAMED_PROJECT, buildAnswers, labelForValue,
  RECOMMENDED, isRecommended, recommendedRaw, detectOmakase, matchOption,
  type OnboardingStep,
} from './onboardingScript';
import { listProjectAssets } from './projectAssetsApi';
import { assembleInitialSite } from './assembleInitialSite';

interface Props {
  project: DesktopProject;
  onSkipToTemplates: () => void;
}

interface Msg { role: 'bot' | 'user'; text: string; }

export const SiteOnboardingChat: React.FC<Props> = ({ project, onSkipToTemplates }) => {
  const applyAssembledSite = useProjectSiteStore(s => s.applyAssembledSite);

  // 仮称（または無名）のプロジェクトのときだけ、先頭に「プロジェクト名」ステップを差し込む。
  // すでに具体的な名前があるプロジェクト（別経路で命名済み）では名前を聞き直さない。
  const needName = !project.name?.trim() || project.name.trim() === UNNAMED_PROJECT;
  const steps: OnboardingStep[] = needName ? [NAME_STEP, ...ONBOARDING_STEPS] : ONBOARDING_STEPS;

  const [raw, setRaw] = useState<Record<string, any>>({});
  const [stepIdx, setStepIdx] = useState(0);
  const [multiSel, setMultiSel] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [assembling, setAssembling] = useState(false);
  const [statusLine, setStatusLine] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const step: OnboardingStep | undefined = steps[stepIdx];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [stepIdx, assembling]);

  // 既出の Q&A を transcript として構築
  const transcript: Msg[] = [{ role: 'bot', text: ONBOARDING_INTRO }];
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (i < stepIdx) {
      transcript.push({ role: 'bot', text: s.prompt });
      const v = raw[s.id];
      let answerText = '（スキップ）';
      if (s.kind === 'multi') {
        const arr: string[] = Array.isArray(v) ? v : [];
        answerText = arr.length ? arr.map(x => labelForValue(s, x)).join('・') : '（指定なし）';
      } else if (s.kind === 'text') {
        answerText = v && v.trim() ? v : '（スキップ）';
      } else {
        answerText = labelForValue(s, v);
      }
      transcript.push({ role: 'user', text: answerText });
    } else if (i === stepIdx) {
      transcript.push({ role: 'bot', text: s.prompt });
    }
  }

  const advance = (nextRaw: Record<string, any>) => {
    const next = stepIdx + 1;
    setRaw(nextRaw);
    setMultiSel([]);
    setText('');
    if (next >= steps.length) {
      finish(nextRaw);
    } else {
      setStepIdx(next);
    }
  };

  const finish = async (finalRaw: Record<string, any>) => {
    setAssembling(true);
    setStepIdx(steps.length);
    try {
      const answers = buildAnswers(finalRaw);
      const chosenName = (finalRaw.name || '').trim();
      const projectName = chosenName && chosenName !== project.name ? chosenName : project.name;

      // 体感のため最低表示時間（約4秒）を確保しつつ、工程テキストを進める。
      const t0 = Date.now();
      const MIN_MS = 4000;
      setStatusLine('既存の素材を読み込み中…');
      const assets = await listProjectAssets(project.id);
      setStatusLine('セクションを組み立て中…');
      const site = assembleInitialSite({ projectId: project.id, projectName, answers, assets });
      setStatusLine('デザインを調整中…');
      const elapsed = Date.now() - t0;
      if (elapsed < MIN_MS) await new Promise(r => setTimeout(r, MIN_MS - elapsed));
      setStatusLine('サイトを保存中…');
      await applyAssembledSite(site);
      // applyAssembledSite で store.site が入ると親が site 表示へ切り替わり、本コンポーネントはアンマウントされる。
      // プロジェクト名の確定（rename）はサイト生成後に行う。
      //   先に rename すると displayName 変化 → 親が site=null のまま再ロードし、
      //   オンボーディングが一瞬作り直されてフラッシュするため（store.load はサイト生成済みなら no-op）。
      if (chosenName && chosenName !== project.name) {
        try {
          await renameProject(project.id, chosenName);
          const appStore = useAppStore.getState();
          appStore.setProjects(appStore.projects.map(p => p.id === project.id ? { ...p, name: chosenName } : p));
        } catch (e) {
          console.error('[onboarding] rename failed', e);
        }
      }
    } catch (e) {
      console.error('[onboarding] assemble failed', e);
      setStatusLine('生成に失敗しました。もう一度お試しください。');
      setAssembling(false);
    }
  };

  const handleSingle = (value: string) => advance({ ...raw, [step!.id]: value });
  const handleMultiConfirm = () => advance({ ...raw, emphasis: multiSel });

  // このステップを推奨で確定（おまかせ）
  const handleOmakaseOne = () => { if (step) advance({ ...raw, [step.id]: RECOMMENDED[step.id] }); };
  // 残り全部を推奨で確定して即生成（全部おまかせ）
  const handleOmakaseAll = () => finish(recommendedRaw(raw));

  // 自由入力の解釈（おまかせ / 選択肢マッチ / タグライン）
  const handleText = (value: string) => {
    const t = value.trim();
    if (!t || !step || assembling) return;
    // 名前ステップは「おまかせ」解釈をせず、入力をそのまま採用（必須）。
    if (step.kind === 'text' && step.id === 'name') { advance({ ...raw, name: t }); return; }
    const scope = detectOmakase(t);
    if (scope === 'all') { finish(recommendedRaw(raw)); return; }
    if (step.kind === 'text') { advance({ ...raw, [step.id]: scope ? '' : t }); return; }
    if (scope === 'one') { advance({ ...raw, [step.id]: RECOMMENDED[step.id] }); return; }
    const matched = matchOption(step, t);
    advance({ ...raw, [step.id]: matched != null ? matched : RECOMMENDED[step.id] });
  };

  const isTextStep = step?.kind === 'text';
  const canType = !!step && !assembling;

  // ── 生成中: プロジェクトサイトを組み立てていることが分かるアニメーションローディング ──
  if (assembling) {
    const buildSteps = ['素材を読み込み', 'セクションを組み立て', 'サイトを保存'];
    return (
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, alignItems: 'center', justifyContent: 'center', bgcolor: '#0a0e16', gap: 3, px: 3 }}>
        {/* グロー付きの回転リング＋鼓動するスパークル */}
        <Box sx={{ position: 'relative', width: 96, height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box sx={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            border: '2px solid rgba(0,191,255,0.15)',
            borderTopColor: '#00BFFF', borderRightColor: 'rgba(0,191,255,0.5)',
            animation: 'siteSpin 1.1s linear infinite',
            '@keyframes siteSpin': { to: { transform: 'rotate(360deg)' } },
          }} />
          <Box sx={{
            position: 'absolute', inset: 10, borderRadius: '50%',
            border: '2px solid rgba(0,191,255,0.08)',
            borderBottomColor: 'rgba(0,191,255,0.6)',
            animation: 'siteSpinRev 1.6s linear infinite',
            '@keyframes siteSpinRev': { to: { transform: 'rotate(-360deg)' } },
          }} />
          <AutoAwesomeRoundedIcon sx={{
            color: '#00BFFF', fontSize: 36,
            filter: 'drop-shadow(0 0 8px rgba(0,191,255,0.7))',
            animation: 'sitePulse 1.4s ease-in-out infinite',
            '@keyframes sitePulse': {
              '0%,100%': { transform: 'scale(0.9)', opacity: 0.75 },
              '50%': { transform: 'scale(1.12)', opacity: 1 },
            },
          }} />
        </Box>

        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.15rem', mb: 0.75 }}>
            プロジェクトサイトを作成しています
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', minHeight: '1.3em' }}>
            {statusLine || '最適な構成を組み立てています…'}
          </Typography>
        </Box>

        {/* 不確定プログレスバー */}
        <Box sx={{ width: '100%', maxWidth: 320, height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
          <Box sx={{
            width: '40%', height: '100%', borderRadius: 2,
            background: 'linear-gradient(90deg, rgba(0,191,255,0) 0%, #00BFFF 50%, rgba(0,191,255,0) 100%)',
            animation: 'siteBar 1.3s ease-in-out infinite',
            '@keyframes siteBar': {
              '0%': { transform: 'translateX(-120%)' },
              '100%': { transform: 'translateX(320%)' },
            },
          }} />
        </Box>

        {/* 工程ドット */}
        <Box sx={{ display: 'flex', gap: 1.5, mt: 0.5 }}>
          {buildSteps.map((label, i) => (
            <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box sx={{
                width: 7, height: 7, borderRadius: '50%', bgcolor: '#00BFFF',
                animation: 'siteDot 1.2s ease-in-out infinite',
                animationDelay: `${i * 0.18}s`,
                '@keyframes siteDot': { '0%,100%': { opacity: 0.25 }, '50%': { opacity: 1 } },
              }} />
              <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem' }}>{label}</Typography>
            </Box>
          ))}
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, alignItems: 'center', bgcolor: '#0a0e16' }}>
      <Box sx={{ width: '100%', maxWidth: 720, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, px: 2 }}>

        {/* ヘッダ */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pt: 4, pb: 2 }}>
          <AutoAwesomeRoundedIcon sx={{ color: '#00BFFF' }} />
          <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.1rem' }}>プロジェクトサイトを作成</Typography>
          <Box sx={{ flex: 1 }} />
          {!assembling && step?.id !== 'name' && (
            <Button onClick={handleOmakaseAll} size="small" variant="outlined"
              startIcon={<AutoAwesomeRoundedIcon sx={{ fontSize: '0.9rem' }} />}
              sx={{ color: '#00BFFF', borderColor: 'rgba(0,191,255,0.5)', textTransform: 'none', fontSize: '0.75rem', fontWeight: 700, mr: 1, '&:hover': { borderColor: '#00BFFF', bgcolor: 'rgba(0,191,255,0.08)' } }}>
              全部おまかせで作成
            </Button>
          )}
          <Button onClick={onSkipToTemplates} size="small" sx={{ color: 'rgba(255,255,255,0.45)', textTransform: 'none', fontSize: '0.75rem', '&:hover': { color: '#fff' } }}>
            テンプレートから作成
          </Button>
        </Box>

        {/* 会話 */}
        <Box ref={scrollRef} sx={{ flex: 1, overflowY: 'auto', py: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {transcript.map((m, i) => (
            <Box key={i} sx={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', gap: 1 }}>
              {m.role === 'bot' && (
                <Avatar sx={{ width: 28, height: 28, bgcolor: 'rgba(0,191,255,0.2)', color: '#00BFFF' }}>
                  <AutoAwesomeRoundedIcon sx={{ fontSize: '1rem' }} />
                </Avatar>
              )}
              <Box sx={{
                maxWidth: '78%', px: 2, py: 1.25, borderRadius: 2.5,
                bgcolor: m.role === 'user' ? 'rgba(0,191,255,0.18)' : 'rgba(255,255,255,0.04)',
                border: m.role === 'user' ? '1px solid rgba(0,191,255,0.35)' : '1px solid rgba(255,255,255,0.07)',
                color: m.role === 'user' ? '#fff' : 'rgba(255,255,255,0.85)',
              }}>
                <Typography sx={{ fontSize: '0.88rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{m.text}</Typography>
              </Box>
            </Box>
          ))}

          {/* 現在ステップの選択肢 */}
          {step && !assembling && (step.kind === 'single' || step.kind === 'multi') && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, pl: 4.5, pt: 0.5 }}>
              {(step.options as { value: string; label: string }[]).map(opt => {
                const selected = step.kind === 'multi' && multiSel.includes(opt.value);
                const rec = isRecommended(step.id, opt.value);
                return (
                  <Chip
                    key={opt.value}
                    label={(
                      <Box component="span">
                        {opt.label}
                        {rec && <Box component="span" sx={{ ml: 0.6, fontSize: '0.62rem', fontWeight: 800, color: selected ? '#fff' : '#00BFFF' }}>推奨</Box>}
                      </Box>
                    )}
                    onClick={() => step.kind === 'single'
                      ? handleSingle(opt.value)
                      : setMultiSel(prev => prev.includes(opt.value) ? prev.filter(x => x !== opt.value) : [...prev, opt.value])}
                    sx={{
                      borderRadius: 2, fontWeight: 700, fontSize: '0.8rem', py: 2, cursor: 'pointer',
                      bgcolor: selected ? 'rgba(0,191,255,0.25)' : rec ? 'rgba(0,191,255,0.08)' : 'rgba(255,255,255,0.05)',
                      color: selected ? '#fff' : 'rgba(255,255,255,0.8)',
                      border: `1px solid ${selected ? 'rgba(0,191,255,0.6)' : rec ? 'rgba(0,191,255,0.35)' : 'rgba(255,255,255,0.12)'}`,
                      '&:hover': { bgcolor: 'rgba(0,191,255,0.15)', borderColor: 'rgba(0,191,255,0.5)' },
                    }}
                  />
                );
              })}
              {step.kind === 'multi' && (
                <Button onClick={handleMultiConfirm} variant="contained" size="small" sx={{ ml: 0.5, bgcolor: '#00BFFF', color: '#000', fontWeight: 800, textTransform: 'none', borderRadius: 2 }}>
                  {multiSel.length ? `決定（${multiSel.length}）` : 'スキップ'}
                </Button>
              )}
              {/* この質問をAIにおまかせ */}
              <Chip
                icon={<AutoAwesomeRoundedIcon sx={{ fontSize: '0.85rem !important', color: '#00BFFF !important' }} />}
                label="おまかせ"
                onClick={handleOmakaseOne}
                sx={{ borderRadius: 2, fontWeight: 800, fontSize: '0.78rem', py: 2, cursor: 'pointer', color: '#00BFFF', bgcolor: 'rgba(0,191,255,0.1)', border: '1px dashed rgba(0,191,255,0.5)', '&:hover': { bgcolor: 'rgba(0,191,255,0.2)' } }}
              />
            </Box>
          )}

          {/* テキストステップ: スキップ / おまかせ（必須の「名前」ステップでは出さない） */}
          {step && !assembling && step.kind === 'text' && step.id !== 'name' && (
            <Box sx={{ display: 'flex', gap: 1, pl: 4.5, pt: 0.5 }}>
              <Button onClick={() => advance({ ...raw, [step.id]: '' })} size="small" sx={{ color: 'rgba(255,255,255,0.5)', textTransform: 'none', '&:hover': { color: '#fff' } }}>
                スキップ
              </Button>
              <Chip
                icon={<AutoAwesomeRoundedIcon sx={{ fontSize: '0.85rem !important', color: '#00BFFF !important' }} />}
                label="おまかせ" size="small" onClick={handleOmakaseOne}
                sx={{ fontWeight: 800, fontSize: '0.72rem', cursor: 'pointer', color: '#00BFFF', bgcolor: 'rgba(0,191,255,0.1)', border: '1px dashed rgba(0,191,255,0.5)' }}
              />
            </Box>
          )}

          {/* 生成中 */}
          {assembling && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pl: 4.5, pt: 1 }}>
              <CircularProgress size={18} sx={{ color: '#00BFFF' }} />
              <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>{statusLine || 'サイトを生成しています…'}</Typography>
            </Box>
          )}
        </Box>

        {/* 入力バー（常時表示） */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
          <TextField
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && canType) handleText(text); }}
            disabled={!canType}
            placeholder={isTextStep ? (step as any).placeholder : '「おまかせ」や、ご希望を自由に入力できます'}
            fullWidth
            size="small"
            InputProps={{ sx: {
              bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 2.5, color: '#fff',
              '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
            } }}
          />
          <IconButton onClick={() => handleText(text)} disabled={!canType} sx={{ bgcolor: '#00BFFF', color: '#000', '&:hover': { bgcolor: '#4facfe' }, '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.25)' } }}>
            <SendRoundedIcon />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
};

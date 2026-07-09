/**
 * BlogCategoryStrategist — ブログ未経験の建築・インテリア職ユーザーのための
 * 「カテゴリ戦略」提案ウィザード。
 *
 * 2つの質問（専門の軸 / 発信の目的）に答えると、建築・インテリア分野向けに設計した
 * コンテンツ戦略テンプレートから最適なカテゴリ構成を提案する。各カテゴリには
 * 「何を書くか」「戦略的なねらい」「更新目安」を添えて、初めての人でも運営の全体像が掴めるようにする。
 * 適用したカテゴリはそのままホームのおすすめメディア最適化（recommendSourcesForCategories）にも効く。
 *
 * 現在はルールベースの即時提案（無料・瞬時）。ユーザーの作品・記事を踏まえた
 * 本格AI提案は blogDialogue CF にモード追加して差し替え予定。
 */
import React, { useMemo, useState } from 'react';
import { Box, Typography, Chip, Button, Checkbox, CircularProgress, Collapse } from '@mui/material';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import RssFeedRoundedIcon from '@mui/icons-material/RssFeedRounded';
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded';
import { useAuthStore } from '../../store/useAuthStore';
import { useDsbStore } from './store/useDsbStore';
import { saveBlogCategories, loadBlogFeedSources, saveBlogFeedSources } from './api/blogApi';
import { recommendSourcesForCategories } from './types';
import { buildPostingPlan } from './lib/postingPlanner';

const AI_PURPLE = '#ce93d8';

/** 専門の軸（複数選択可） */
const FOCUS_OPTIONS = [
  { id: 'house', label: '住宅設計' },
  { id: 'commercial', label: '店舗・商業空間' },
  { id: 'interior', label: 'インテリアコーディネート' },
  { id: 'renovation', label: 'リノベーション' },
  { id: 'product', label: '家具・プロダクト' },
  { id: 'tech', label: '建築×テクノロジー（3D・AI）' },
] as const;

/** 発信の目的（複数選択可） */
const GOAL_OPTIONS = [
  { id: 'client', label: '仕事の依頼につなげたい' },
  { id: 'brand', label: '専門性を発信したい' },
  { id: 'learn', label: '学びを蓄積したい' },
  { id: 'habit', label: 'まず書く習慣をつくりたい' },
] as const;

type FocusId = (typeof FOCUS_OPTIONS)[number]['id'];
type GoalId = (typeof GOAL_OPTIONS)[number]['id'];

interface CategoryProposal {
  name: string;
  desc: string;   // 何を書くか
  role: string;   // 戦略的なねらい
  freq: string;   // 更新目安
}

/** 建築・インテリア分野向けカテゴリ戦略テンプレート。選択に応じて4〜6件に絞って提案する。 */
function buildProposals(focus: Set<FocusId>, goals: Set<GoalId>): CategoryProposal[] {
  const out: CategoryProposal[] = [];
  const has = (f: FocusId) => focus.has(f);
  const wants = (g: GoalId) => goals.has(g);

  // ① 事例（実績）— ほぼ全員の柱。呼び名は軸に合わせる
  out.push(has('interior') && !has('house') && !has('commercial')
    ? { name: 'コーディネート事例', desc: '手がけた空間のビフォーアフター・意図の解説', role: '実績が最大の営業資産。依頼前の不安を解消する', freq: '月1〜2本' }
    : { name: '施工事例', desc: '完成した空間の写真と設計意図・工夫の解説', role: '実績が最大の営業資産。依頼につながる入口', freq: '月1〜2本' });

  // ② 考え方・プロセス — ブランディングの核
  if (wants('brand') || wants('client')) {
    out.push({ name: '設計の考え方', desc: '進行中の検討過程・図面・スケッチ・現場の話', role: '人柄と思考を見せて信頼を作る。他と差がつく部分', freq: '月1本' });
  }

  // ③ 検索流入用のハウツー — 軸に合わせて1つ
  if (has('interior')) {
    out.push({ name: 'インテリアのコツ', desc: '照明・色・家具配置など、すぐ真似できる工夫', role: '検索から新しい読者が来る集客記事', freq: '月2本' });
  } else if (has('renovation')) {
    out.push({ name: 'リノベの基礎知識', desc: '費用感・進め方・注意点をわかりやすく', role: '検討中の施主が検索する定番テーマ', freq: '月1〜2本' });
  } else if (has('house') && wants('client')) {
    out.push({ name: '家づくりの基礎知識', desc: '土地・間取り・依頼の流れを施主目線で解説', role: '未来の施主が検索する。教育コンテンツで信頼獲得', freq: '月1〜2本' });
  }

  // ④ 素材・ディテール — 専門性のニッチSEO
  if (has('product') || has('commercial') || wants('brand')) {
    out.push({ name: '素材とディテール', desc: '素材・建材・納まり・家具の選定理由', role: 'ニッチだが検索に強く、専門性がそのまま伝わる', freq: '月1本' });
  }

  // ⑤ テック軸
  if (has('tech')) {
    out.push({ name: '建築×AI・デジタル', desc: '3D・AI・ツール活用の実践レポート', role: '先進性の発信。まだ書き手が少なく目立てる領域', freq: '月1〜2本' });
  }

  // ⑥ 学びの蓄積 — ホームのニュース×AI議論の受け皿
  if (wants('learn')) {
    out.push({ name: '事例研究', desc: 'ホームの気になる記事をAIと議論して自分の視点でまとめる', role: '読む→議論→書くの流れがそのまま資産になる（S.Library連携）', freq: '週1本もOK' });
  }

  // ⑦ 習慣づくり — 低ハードルの受け皿
  if (wants('habit')) {
    out.push({ name: 'コラム', desc: '日々の気づき・現場での小さな発見を気軽に', role: '完璧を目指さず続けるための受け皿。人柄が伝わる', freq: '自由' });
  }

  // 重複除去・最大6件
  const seen = new Set<string>();
  return out.filter((p) => (seen.has(p.name) ? false : (seen.add(p.name), true))).slice(0, 6);
}

interface BlogCategoryStrategistProps {
  /** 既存カテゴリ（重複作成の抑止と初期展開判定に使用） */
  categories: string[];
}

export const BlogCategoryStrategist: React.FC<BlogCategoryStrategistProps> = ({ categories }) => {
  const uid = useAuthStore((s: any) => s.currentUser?.uid as string | undefined);
  const loadCategories = useDsbStore((s) => s.loadCategories);
  const addSchedule = useDsbStore((s) => s.addSchedule);
  const setView = useDsbStore((s) => s.setView);

  const [open, setOpen] = useState(categories.length === 0); // 未経験ユーザー（カテゴリ0）は最初から展開
  const [step, setStep] = useState<'ask' | 'proposal' | 'done'>('ask');
  const [focus, setFocus] = useState<Set<FocusId>>(new Set());
  const [goals, setGoals] = useState<Set<GoalId>>(new Set());
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [appliedNames, setAppliedNames] = useState<string[]>([]);
  const [homeOptimizing, setHomeOptimizing] = useState(false);
  const [homeOptimized, setHomeOptimized] = useState<string[] | null>(null);
  const [planBusy, setPlanBusy] = useState(false);
  const [planAdded, setPlanAdded] = useState<number | null>(null);

  // 更新目安どおりに4週間分の投稿計画をスケジュール（コンテンツカレンダー）へ初期配置
  const handleAddPlan = async () => {
    if (!uid || planBusy) return;
    setPlanBusy(true);
    try {
      const plan = buildPostingPlan(appliedNames.length > 0 ? appliedNames : categories);
      for (const p of plan) {
        await addSchedule(uid, { date: p.date, time: p.time, title: p.title, category: p.category, note: p.note });
      }
      setPlanAdded(plan.length);
    } catch (e) {
      console.error('[BlogCategoryStrategist] add plan failed', e);
    } finally {
      setPlanBusy(false);
    }
  };

  const proposals = useMemo(() => buildProposals(focus, goals), [focus, goals]);

  const toggleIn = <T,>(set: Set<T>, v: T, setter: (s: Set<T>) => void) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v); else next.add(v);
    setter(next);
  };

  const handlePropose = () => {
    setChecked(new Set(proposals.map((p) => p.name)));
    setStep('proposal');
  };

  // 選択したカテゴリを一括作成（既存は保持したまま末尾に追加。view遷移はしない）
  const handleApply = async () => {
    if (!uid || applying) return;
    setApplying(true);
    try {
      const newOnes = [...checked].filter((n) => !categories.includes(n));
      const next = [...categories, ...newOnes];
      await saveBlogCategories(uid, next);
      await loadCategories(uid);
      setAppliedNames(newOnes);
      setStep('done');
    } catch (e) {
      console.error('[BlogCategoryStrategist] apply failed', e);
    } finally {
      setApplying(false);
    }
  };

  // ホームのおすすめメディアを新カテゴリに合わせて最適化（合うメディアを購読に追加）
  const handleOptimizeHome = async () => {
    if (!uid || homeOptimizing) return;
    setHomeOptimizing(true);
    try {
      const rec = recommendSourcesForCategories([...categories, ...appliedNames]);
      const current = (await loadBlogFeedSources(uid)) ?? [];
      const added = [...rec.keys()].filter((n) => !current.includes(n));
      if (added.length > 0) await saveBlogFeedSources(uid, [...current, ...added]);
      setHomeOptimized(added);
    } catch (e) {
      console.error('[BlogCategoryStrategist] optimize home failed', e);
    } finally {
      setHomeOptimizing(false);
    }
  };

  return (
    <Box sx={{ mb: 2.5, borderRadius: 2.5, border: `1px solid ${open ? 'rgba(206,147,216,0.4)' : 'rgb(var(--brand-fg-rgb) / 0.1)'}`,
      bgcolor: open ? 'rgba(206,147,216,0.05)' : 'rgb(var(--brand-fg-rgb) / 0.02)', overflow: 'hidden', transition: 'border-color .15s' }}>
      {/* ヘッダー（トグル） */}
      <Box onClick={() => setOpen(!open)}
        sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 2, py: 1.5, cursor: 'pointer',
          '&:hover': { bgcolor: 'rgba(206,147,216,0.06)' } }}>
        <AutoAwesomeRoundedIcon sx={{ fontSize: 18, color: AI_PURPLE }} />
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: 'var(--brand-fg)' }}>
            AIとカテゴリ戦略を立てる
          </Typography>
          <Typography sx={{ fontSize: 11.5, color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>
            2つの質問に答えると、あなたに合ったカテゴリ構成を「ねらい」付きで提案します。ホームのおすすめメディアも連動します。
          </Typography>
        </Box>
        <ExpandMoreRoundedIcon sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
      </Box>

      <Collapse in={open}>
        <Box sx={{ px: 2, pb: 2 }}>
          {step === 'ask' && (
            <>
              <Typography sx={{ fontSize: 12, fontWeight: 800, color: 'rgb(var(--brand-fg-rgb) / 0.7)', mb: 0.75 }}>
                ① あなたの専門・軸は？（複数OK）
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 1.75 }}>
                {FOCUS_OPTIONS.map((o) => {
                  const on = focus.has(o.id);
                  return (
                    <Chip key={o.id} label={o.label} size="small" onClick={() => toggleIn(focus, o.id, setFocus)}
                      sx={{ cursor: 'pointer', fontWeight: 700, fontSize: 11.5, height: 26,
                        bgcolor: on ? AI_PURPLE : 'rgb(var(--brand-fg-rgb) / 0.05)', color: on ? '#2a1233' : 'rgb(var(--brand-fg-rgb) / 0.7)',
                        border: `1px solid ${on ? AI_PURPLE : 'rgb(var(--brand-fg-rgb) / 0.15)'}`,
                        '&:hover': { bgcolor: on ? AI_PURPLE : 'rgba(206,147,216,0.15)' } }} />
                  );
                })}
              </Box>
              <Typography sx={{ fontSize: 12, fontWeight: 800, color: 'rgb(var(--brand-fg-rgb) / 0.7)', mb: 0.75 }}>
                ② ブログで実現したいことは？（複数OK）
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 2 }}>
                {GOAL_OPTIONS.map((o) => {
                  const on = goals.has(o.id);
                  return (
                    <Chip key={o.id} label={o.label} size="small" onClick={() => toggleIn(goals, o.id, setGoals)}
                      sx={{ cursor: 'pointer', fontWeight: 700, fontSize: 11.5, height: 26,
                        bgcolor: on ? AI_PURPLE : 'rgb(var(--brand-fg-rgb) / 0.05)', color: on ? '#2a1233' : 'rgb(var(--brand-fg-rgb) / 0.7)',
                        border: `1px solid ${on ? AI_PURPLE : 'rgb(var(--brand-fg-rgb) / 0.15)'}`,
                        '&:hover': { bgcolor: on ? AI_PURPLE : 'rgba(206,147,216,0.15)' } }} />
                  );
                })}
              </Box>
              <Button variant="contained" size="small" disabled={focus.size === 0 || goals.size === 0}
                startIcon={<AutoAwesomeRoundedIcon sx={{ fontSize: '14px !important' }} />}
                onClick={handlePropose}
                sx={{ bgcolor: AI_PURPLE, color: '#2a1233', fontWeight: 800, textTransform: 'none', px: 2, borderRadius: 1.5,
                  '&:hover': { bgcolor: '#ba68c8' },
                  '&.Mui-disabled': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)', color: 'rgb(var(--brand-fg-rgb) / 0.35)' } }}>
                カテゴリ構成を提案してもらう
              </Button>
            </>
          )}

          {step === 'proposal' && (
            <>
              <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.6)', mb: 1.25, lineHeight: 1.7 }}>
                あなたの軸と目的から、この構成をおすすめします。多すぎると続かないので<b>3〜5個</b>が目安です。不要なものは外してください。
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 1, mb: 2 }}>
                {proposals.map((p) => {
                  const on = checked.has(p.name);
                  const exists = categories.includes(p.name);
                  return (
                    <Box key={p.name}
                      onClick={() => !exists && toggleIn(checked, p.name, setChecked)}
                      sx={{ display: 'flex', gap: 0.75, px: 1.25, py: 1, borderRadius: 2, cursor: exists ? 'default' : 'pointer',
                        opacity: exists ? 0.5 : 1,
                        bgcolor: on && !exists ? 'rgba(206,147,216,0.08)' : 'rgb(var(--brand-fg-rgb) / 0.03)',
                        border: `1px solid ${on && !exists ? 'rgba(206,147,216,0.5)' : 'rgb(var(--brand-fg-rgb) / 0.09)'}`,
                        '&:hover': { borderColor: exists ? 'rgb(var(--brand-fg-rgb) / 0.09)' : 'rgba(206,147,216,0.6)' } }}>
                      <Checkbox checked={on && !exists} disabled={exists} size="small" disableRipple
                        sx={{ p: 0.25, alignSelf: 'flex-start', color: 'rgb(var(--brand-fg-rgb) / 0.35)', '&.Mui-checked': { color: AI_PURPLE } }} />
                      <Box sx={{ minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                          <Typography sx={{ fontSize: 13, fontWeight: 800, color: 'var(--brand-fg)' }}>{p.name}</Typography>
                          <Chip label={p.freq} size="small" sx={{ height: 16, fontSize: 9.5, fontWeight: 700, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)', color: 'rgb(var(--brand-fg-rgb) / 0.6)' }} />
                          {exists && <Chip label="作成済み" size="small" sx={{ height: 16, fontSize: 9.5, fontWeight: 700, bgcolor: 'rgba(129,199,132,0.15)', color: 'rgb(var(--brand-fg-rgb) / 0.65)' }} />}
                        </Box>
                        <Typography sx={{ fontSize: 11.5, color: 'rgb(var(--brand-fg-rgb) / 0.65)', mt: 0.25 }}>{p.desc}</Typography>
                        <Typography sx={{ fontSize: 10.5, color: AI_PURPLE, mt: 0.25 }}>ねらい: {p.role}</Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button size="small" onClick={() => setStep('ask')} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.55)', textTransform: 'none' }}>
                  質問に戻る
                </Button>
                <Box sx={{ flex: 1 }} />
                <Button variant="contained" size="small" disabled={applying || [...checked].filter((n) => !categories.includes(n)).length === 0}
                  startIcon={applying ? <CircularProgress size={13} sx={{ color: '#2a1233' }} /> : <CheckCircleRoundedIcon sx={{ fontSize: '15px !important' }} />}
                  onClick={() => void handleApply()}
                  sx={{ bgcolor: AI_PURPLE, color: '#2a1233', fontWeight: 800, textTransform: 'none', px: 2, borderRadius: 1.5,
                    '&:hover': { bgcolor: '#ba68c8' },
                    '&.Mui-disabled': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)', color: 'rgb(var(--brand-fg-rgb) / 0.35)' } }}>
                  {`選択した ${[...checked].filter((n) => !categories.includes(n)).length} 件のカテゴリを作成`}
                </Button>
              </Box>
            </>
          )}

          {step === 'done' && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                <CheckCircleRoundedIcon sx={{ fontSize: 18, color: 'rgb(var(--brand-fg-rgb) / 0.65)' }} />
                <Typography sx={{ fontSize: 13, fontWeight: 800, color: 'var(--brand-fg)' }}>
                  カテゴリを作成しました（{appliedNames.join('・') || 'なし'}）
                </Typography>
              </Box>
              <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.6)', mb: 1.5, lineHeight: 1.7 }}>
                次は、このカテゴリに合わせてホームのおすすめメディアを最適化しましょう。合うメディアの記事が届き、
                「読む → AIと議論 → 記事にする」の流れが回り始めます。
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                {homeOptimized === null ? (
                  <Button variant="contained" size="small" disabled={homeOptimizing}
                    startIcon={homeOptimizing ? <CircularProgress size={13} sx={{ color: '#2a1233' }} /> : <RssFeedRoundedIcon sx={{ fontSize: '15px !important' }} />}
                    onClick={() => void handleOptimizeHome()}
                    sx={{ bgcolor: AI_PURPLE, color: '#2a1233', fontWeight: 800, textTransform: 'none', px: 2, borderRadius: 1.5,
                      '&:hover': { bgcolor: '#ba68c8' } }}>
                    ホームのおすすめメディアを最適化する
                  </Button>
                ) : (
                  <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.65)' }}>
                    ✓ {homeOptimized.length > 0
                      ? `${homeOptimized.join('・')} をホームに紐づけました。`
                      : 'すでにカテゴリに合うメディアが紐づいています。'}
                  </Typography>
                )}
                {planAdded === null ? (
                  <Button variant="outlined" size="small" disabled={planBusy}
                    startIcon={planBusy ? <CircularProgress size={13} sx={{ color: AI_PURPLE }} /> : <EventNoteRoundedIcon sx={{ fontSize: '15px !important' }} />}
                    onClick={() => void handleAddPlan()}
                    sx={{ color: AI_PURPLE, borderColor: 'rgba(206,147,216,0.5)', fontWeight: 700, textTransform: 'none', px: 2, borderRadius: 1.5,
                      '&:hover': { borderColor: AI_PURPLE, bgcolor: 'rgba(206,147,216,0.08)' } }}>
                    4週間の投稿計画をスケジュールに入れる
                  </Button>
                ) : (
                  <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.65)' }}>
                    ✓ {planAdded} 件の投稿予定を作成しました。
                    <Button size="small" onClick={() => setView('schedule')}
                      sx={{ color: AI_PURPLE, textTransform: 'none', fontSize: 11.5, ml: 0.5, p: 0, minWidth: 0 }}>
                      スケジュールを見る
                    </Button>
                  </Typography>
                )}
              </Box>
              <Box sx={{ mt: 1.5 }}>
                <Button size="small" onClick={() => { setStep('ask'); setHomeOptimized(null); }}
                  sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', textTransform: 'none', fontSize: 11.5 }}>
                  もう一度提案してもらう
                </Button>
              </Box>
            </Box>
          )}
        </Box>
      </Collapse>
    </Box>
  );
};

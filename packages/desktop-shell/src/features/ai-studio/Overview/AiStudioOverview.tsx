import React from 'react';
import { Box, Typography, Paper, Chip, ButtonBase, Stack, Button } from '@mui/material';
import { BRAND } from '../../../styles/theme';
import { useAiProfileStore } from '../../../store/useAiProfileStore';
import type { AiProfile } from '../../../store/useAiProfileStore';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';
import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded';
import HubRoundedIcon from '@mui/icons-material/HubRounded';
import PsychologyRoundedIcon from '@mui/icons-material/PsychologyRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import type { AiStudioView } from '../AiStudioShell';

interface OverviewProps {
  onNavigate: (view: AiStudioView) => void;
  onOpenModel: (id: string) => void;
}

const CAT_COLOR: Record<AiProfile['category'], string> = {
  Orchestrator: '#a855f7',
  Assistant: '#3b82f6',
  Specialized: '#22c55e',
};
const CAT_LABEL: Record<AiProfile['category'], string> = {
  Orchestrator: '司令塔',
  Assistant: 'アシスタント',
  Specialized: '専門AI',
};

const KpiCard: React.FC<{ label: string; value: React.ReactNode; sub?: string; accent?: string; onClick?: () => void }> = ({ label, value, sub, accent, onClick }) => (
  <ButtonBase
    onClick={onClick}
    sx={{
      display: 'block', textAlign: 'left', width: '100%', height: '100%',
      p: 2.5, borderRadius: 3,
      bgcolor: accent ? `${accent}14` : BRAND.panel,
      border: `1px solid ${accent ? `${accent}40` : BRAND.line}`,
      transition: 'all .15s',
      '&:hover': onClick ? { bgcolor: accent ? `${accent}22` : 'rgba(255,255,255,0.04)', transform: 'translateY(-2px)' } : {},
    }}
  >
    <Typography sx={{ color: accent || 'rgba(255,255,255,0.5)', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, mb: 1 }}>
      {label}
    </Typography>
    <Typography sx={{ color: '#fff', fontSize: 32, fontWeight: 800, lineHeight: 1.1 }}>{value}</Typography>
    {sub && <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, mt: 1 }}>{sub}</Typography>}
  </ButtonBase>
);

const PipelineStep: React.FC<{ step: number; title: string; desc: string; icon: React.ReactNode; onClick: () => void }> = ({ step, title, desc, icon, onClick }) => (
  <ButtonBase
    onClick={onClick}
    sx={{
      flex: 1, minWidth: 170, alignItems: 'stretch', textAlign: 'left',
      bgcolor: 'rgba(0,0,0,0.25)', p: 2, borderRadius: 2,
      border: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', flexDirection: 'column', gap: 1.25,
      '&:hover': { borderColor: 'rgba(168,85,247,0.5)', bgcolor: 'rgba(168,85,247,0.06)' },
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: '#a855f7', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
        {step}
      </Box>
      <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{title}</Typography>
    </Box>
    <Box sx={{ display: 'flex', gap: 1, color: '#c4a3f7' }}>
      {icon}
      <Typography sx={{ color: 'rgba(255,255,255,0.65)', fontSize: 12.5, lineHeight: 1.5 }}>{desc}</Typography>
    </Box>
  </ButtonBase>
);

const FleetCard: React.FC<{ p: AiProfile; onClick: () => void }> = ({ p, onClick }) => {
  const color = CAT_COLOR[p.category];
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        display: 'block', textAlign: 'left', width: '100%',
        p: 2, borderRadius: 2.5, bgcolor: BRAND.panel,
        border: `1px solid ${p.status === 'Active' ? `${color}66` : BRAND.line}`,
        transition: 'all .15s',
        '&:hover': { borderColor: color, bgcolor: 'rgba(255,255,255,0.03)', transform: 'translateY(-2px)' },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
        <Box sx={{ width: 30, height: 30, borderRadius: 1.5, bgcolor: `${color}22`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <SmartToyRoundedIcon sx={{ fontSize: 18 }} />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ color: '#fff', fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {p.name}
          </Typography>
          <Chip label={CAT_LABEL[p.category]} size="small" sx={{ height: 16, fontSize: 9.5, mt: 0.25, bgcolor: `${color}22`, color }} />
        </Box>
        {p.status === 'Active' ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#4ade80' }}>
            <FiberManualRecordIcon sx={{ fontSize: 9 }} />
            <Typography sx={{ fontSize: 10.5, fontWeight: 600 }}>稼働中</Typography>
          </Box>
        ) : (
          <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.35)' }}>待機</Typography>
        )}
      </Box>
      <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, lineHeight: 1.5, mb: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {p.description}
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        <Chip label={p.baseModelId} size="small" sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace' }} />
      </Box>
    </ButtonBase>
  );
};

const SectionTitle: React.FC<{ icon: React.ReactNode; title: string; action?: React.ReactNode }> = ({ icon, title, action }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
    <Box sx={{ color: '#c4a3f7', display: 'flex', mr: 1 }}>{icon}</Box>
    <Typography sx={{ color: '#fff', fontSize: 16, fontWeight: 700, flex: 1 }}>{title}</Typography>
    {action}
  </Box>
);

export const AiStudioOverview: React.FC<OverviewProps> = ({ onNavigate, onOpenModel }) => {
  const { aiProfiles, knowledgeSources, saveDataMemories, saveDataEvents } = useAiProfileStore();

  const activeCount = aiProfiles.filter((p) => p.status === 'Active').length;
  const ruleSources = knowledgeSources.filter((k) => k.type === 'extracted_rule').length;
  const docSources = knowledgeSources.filter((k) => k.type === 'document').length;

  return (
    <Box sx={{ p: { xs: 3, md: 5 }, color: '#fff', maxWidth: 1240, margin: '0 auto' }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, letterSpacing: -0.5 }}>AI Studio</Typography>
        <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.6)', maxWidth: 720 }}>
          SEKKEIYA を動かす AI 群と、その判断根拠となるナレッジ（RAG）を一元管理します。
          ナレッジを与え、モデルを設定し、各機能での稼働と学習を確認できます。
        </Typography>
      </Box>

      {/* Pipeline */}
      <Paper sx={{ p: { xs: 2.5, md: 3 }, mb: 4, bgcolor: 'rgba(168,85,247,0.06)', borderRadius: 3, border: '1px solid rgba(168,85,247,0.2)' }}>
        <Typography sx={{ color: '#c4a3f7', fontWeight: 800, mb: 2, fontSize: 14 }}>運用フロー</Typography>
        <Box sx={{ display: 'flex', alignItems: 'stretch', gap: { xs: 1, md: 1.5 }, overflowX: 'auto', pb: 0.5, '& > svg': { flexShrink: 0, alignSelf: 'center' } }}>
          <PipelineStep step={1} title="ナレッジ / RAG" desc="資料・知識を投入し、AIの判断根拠にする" icon={<AutoStoriesRoundedIcon fontSize="small" />} onClick={() => onNavigate('documents')} />
          <ArrowForwardRoundedIcon sx={{ color: 'rgba(255,255,255,0.2)', display: { xs: 'none', sm: 'block' } }} />
          <PipelineStep step={2} title="AIモデル設定" desc="推論エンジン・プロンプト・スコープを調整" icon={<SmartToyRoundedIcon fontSize="small" />} onClick={() => onNavigate('aimodels')} />
          <ArrowForwardRoundedIcon sx={{ color: 'rgba(255,255,255,0.2)', display: { xs: 'none', sm: 'block' } }} />
          <PipelineStep step={3} title="各機能で稼働" desc="分類・レコメンド・レイアウト・Chatで利用" icon={<HubRoundedIcon fontSize="small" />} onClick={() => onNavigate('score')} />
          <ArrowForwardRoundedIcon sx={{ color: 'rgba(255,255,255,0.2)', display: { xs: 'none', sm: 'block' } }} />
          <PipelineStep step={4} title="操作から学習" desc="修正・採用履歴を記憶し精度を改善" icon={<PsychologyRoundedIcon fontSize="small" />} onClick={() => onNavigate('save-data')} />
        </Box>
      </Paper>

      {/* KPIs */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2, mb: 4 }}>
        <KpiCard label="AIモデル" value={aiProfiles.length} sub={`稼働中 ${activeCount} 件`} accent="#a855f7" onClick={() => onNavigate('aimodels')} />
        <KpiCard label="ナレッジ (RAG)" value={knowledgeSources.length} sub={`資料 ${docSources} / ルール ${ruleSources}`} accent="#3b82f6" onClick={() => onNavigate('documents')} />
        <KpiCard label="学習メモリ" value={saveDataMemories.length} sub={`未要約イベント ${saveDataEvents.filter((e) => !e.isSummarized).length} 件`} accent="#22c55e" onClick={() => onNavigate('save-data')} />
        <KpiCard label="評価ルール" value={ruleSources} sub="採点に使う判断基準" accent="#f59e0b" onClick={() => onNavigate('training')} />
      </Box>

      {/* AI Fleet */}
      <Box sx={{ mb: 4 }}>
        <SectionTitle
          icon={<SmartToyRoundedIcon />}
          title="AI フリート"
          action={<Button size="small" endIcon={<ArrowForwardRoundedIcon />} onClick={() => onNavigate('aimodels')} sx={{ color: '#c4a3f7', textTransform: 'none' }}>すべて管理</Button>}
        />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(2, 1fr)' }, gap: 2 }}>
          {aiProfiles.map((p) => (
            <FleetCard key={p.id} p={p} onClick={() => onOpenModel(p.id)} />
          ))}
        </Box>
      </Box>

      {/* Knowledge / RAG */}
      <Box>
        <SectionTitle
          icon={<AutoStoriesRoundedIcon />}
          title="ナレッジ & RAG"
          action={<Button size="small" startIcon={<AddRoundedIcon />} onClick={() => onNavigate('documents')} sx={{ color: '#c4a3f7', textTransform: 'none' }}>ナレッジを追加</Button>}
        />
        {/* Always-on library RAG (S.Models categorization) */}
        <Paper sx={{ p: 2.5, mb: 2, bgcolor: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <PsychologyRoundedIcon sx={{ color: '#4ade80', fontSize: 20 }} />
            <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>S.Models 自動分類 RAG（稼働中）</Typography>
            <Chip label="自動" size="small" sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(34,197,94,0.2)', color: '#4ade80' }} />
          </Box>
          <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 1.6 }}>
            アップロード時、あなたのライブラリから「似た既存モデルの確定カテゴリ」を検索して分類の参考にします。
            モデルが増えるほど、あなたの分類傾向に沿って精度が向上します（参照は自分のデータのみ）。
          </Typography>
        </Paper>

        {knowledgeSources.length === 0 ? (
          <Paper sx={{ p: 4, bgcolor: BRAND.panel, border: `1px dashed ${BRAND.line2}`, borderRadius: 3, textAlign: 'center' }}>
            <AutoStoriesRoundedIcon sx={{ color: 'rgba(255,255,255,0.25)', fontSize: 40, mb: 1 }} />
            <Typography sx={{ color: '#fff', fontWeight: 600, mb: 0.5 }}>ナレッジソースはまだありません</Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, mb: 2, maxWidth: 460, mx: 'auto' }}>
              設計資料・PDF・社内ルールを追加すると、AI がそれらを根拠（RAG）に判断・採点します。
              SEKKEIYA Chat の生成にも反映できます。
            </Typography>
            <Button variant="outlined" startIcon={<AddRoundedIcon />} onClick={() => onNavigate('documents')} sx={{ color: '#c4a3f7', borderColor: 'rgba(168,85,247,0.5)', textTransform: 'none', '&:hover': { borderColor: '#a855f7', bgcolor: 'rgba(168,85,247,0.08)' } }}>
              ナレッジ (RAG) を追加する
            </Button>
          </Paper>
        ) : (
          <Stack spacing={1}>
            {knowledgeSources.slice(0, 6).map((k) => (
              <ButtonBase
                key={k.id}
                onClick={() => onNavigate('documents')}
                sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.75, borderRadius: 2, bgcolor: BRAND.panel, border: `1px solid ${BRAND.line}`, justifyContent: 'flex-start', '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' } }}
              >
                <AutoStoriesRoundedIcon sx={{ color: '#60a5fa', fontSize: 18 }} />
                <Box sx={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                  <Typography sx={{ color: '#fff', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.title}</Typography>
                </Box>
                <Chip label={k.type} size="small" sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }} />
              </ButtonBase>
            ))}
          </Stack>
        )}
      </Box>
    </Box>
  );
};

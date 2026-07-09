import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { BRAND } from '../../../styles/theme';
import { useAiStudioStore } from '../store/useAiStudioStore';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import RuleRoundedIcon from '@mui/icons-material/RuleRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';

const StatCard = ({ title, value, subtitle }: { title: string, value: string | number, subtitle?: string }) => (
  <Paper sx={{
    p: 3,
    bgcolor: BRAND.panel,
    borderRadius: 3,
    border: `1px solid ${BRAND.line}`,
    display: 'flex', flexDirection: 'column', height: '100%'
  }}>
    <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, mb: 1 }}>
      {title}
    </Typography>
    <Typography sx={{ color: '#fff', fontSize: 36, fontWeight: 800, lineHeight: 1.2 }}>
      {value}
    </Typography>
    {subtitle && (
      <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, mt: 'auto', pt: 1 }}>
        {subtitle}
      </Typography>
    )}
  </Paper>
);

const StepCard = ({ step, title, desc, icon }: { step: string, title: string, desc: string, icon: React.ReactNode }) => (
  <Box sx={{ flex: 1, minWidth: 160, bgcolor: 'rgba(0,0,0,0.2)', p: 2, borderRadius: 2, border: `1px solid rgba(255,255,255,0.05)`, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: '#90caf9', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
        {step}
      </Box>
      <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{title}</Typography>
    </Box>
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, color: '#90caf9', flexGrow: 1 }}>
      {icon}
      <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 1.5 }}>
        {desc}
      </Typography>
    </Box>
  </Box>
);

export const AiStudioOverview: React.FC = () => {
  const { profiles } = useAiStudioStore();

  // Fake aggregates
  const totalDocs = profiles.reduce((sum, p) => sum + p.documentCount, 0);
  const totalRules = profiles.reduce((sum, p) => sum + p.ruleCount, 0);
  const activeProfile = profiles.find(p => p.isActive);

  return (
    <Box sx={{ p: { xs: 3, md: 5 }, color: '#fff', maxWidth: 1200, margin: '0 auto' }}>
      <Box sx={{ mb: 5 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, letterSpacing: -0.5 }}>
          AI Studio
        </Typography>
        <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.6)', maxWidth: 600 }}>
          現在の育成状況サマリーです。知識をインプットし、評価基準を設定してAIを成長させましょう。
        </Typography>
      </Box>

      {/* Onboarding Banner */}
      <Paper sx={{ p: { xs: 3, md: 4 }, mb: 5, bgcolor: 'rgba(144, 202, 249, 0.08)', borderRadius: 3, border: `1px solid rgba(144, 202, 249, 0.2)` }}>
        <Typography variant="h6" sx={{ color: '#90caf9', fontWeight: 800, mb: 1 }}>
          AI Studio とは？
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, mb: 4, lineHeight: 1.6, maxWidth: 800 }}>
          AI Studioは、あなた自身の「評価AI」を育成し、実務プロジェクトのクオリティチェックを自動化するためのワークスペースです。
          ナレッジのインプットからAIの採点まで、以下の4つのステップで運用します。
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, md: 2 }, overflowX: 'auto', pb: 1, '& > svg': { flexShrink: 0 } }}>
          <StepCard step="1" title="ナレッジ入力" desc="過去の資料やPDFから、設計ノウハウやルールを抽出しAIに入力します。" icon={<DescriptionRoundedIcon fontSize="small" sx={{ mt: '2px' }} />} />
          <ArrowForwardRoundedIcon sx={{ color: 'rgba(255,255,255,0.2)', display: { xs: 'none', sm: 'block' } }} />
          <StepCard step="2" title="ルール設定" desc="抽出した知識を元に、プロジェクトの評価基準とペナルティを設定します。" icon={<RuleRoundedIcon fontSize="small" sx={{ mt: '2px' }} />} />
          <ArrowForwardRoundedIcon sx={{ color: 'rgba(255,255,255,0.2)', display: { xs: 'none', sm: 'block' } }} />
          <StepCard step="3" title="AI育成" desc="作成された知識とルール群を「セーブデータ」として記憶させます。" icon={<SaveRoundedIcon fontSize="small" sx={{ mt: '2px' }} />} />
          <ArrowForwardRoundedIcon sx={{ color: 'rgba(255,255,255,0.2)', display: { xs: 'none', sm: 'block' } }} />
          <StepCard step="4" title="自動採点" desc="使用中のAIプロファイルが、実際のプロジェクトを自動評価します。" icon={<AssessmentRoundedIcon fontSize="small" sx={{ mt: '2px' }} />} />
        </Box>
      </Paper>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 3 }}>
        <Box>
          <StatCard title="プロファイル数" value={profiles.length} subtitle="作成されたセーブデータ" />
        </Box>
        <Box>
          <StatCard title="ナレッジ (PDF文書)" value={totalDocs} subtitle="読み込み済みの知識ソース" />
        </Box>
        <Box>
          <StatCard title="設定済みルール数" value={totalRules} subtitle="評価項目と採点基準" />
        </Box>
        <Box>
          <Paper sx={{ p: 3, bgcolor: `#90caf915`, borderRadius: 3, border: `1px solid #90caf940`, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography sx={{ color: '#90caf9', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, mb: 1 }}>
              使用中のAI
            </Typography>
            {activeProfile ? (
              <>
                <Typography sx={{ color: '#fff', fontSize: 24, fontWeight: 800, mt: 1 }}>
                  {activeProfile.name}
                </Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, mt: 'auto', pt: 1 }}>
                  現在プロジェクトを評価中
                </Typography>
              </>
            ) : (
              <>
                <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 20, fontWeight: 800, mt: 1 }}>
                  未選択
                </Typography>
                <Typography sx={{ color: 'rgba(144,202,249,0.7)', fontSize: 13, mt: 'auto', pt: 1 }}>
                  セーブデータからAIを選択
                </Typography>
              </>
            )}
          </Paper>
        </Box>
      </Box>
    </Box>
  );
};

import React from 'react';
import { Box, Typography, Accordion, AccordionSummary, AccordionDetails, Divider } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PromptInput from './PromptInput';
import ImageUploadCard from './ImageUploadCard';
import DomainSelect from './DomainSelect';
import EngineSelect from './EngineSelect';
import QualitySelect from './QualitySelect';

export default function GenerationInputPanel() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* 1. Prompt */}
      <PromptInput />

      <Divider />

      {/* 2. Reference Image */}
      <Box>
        <Typography variant="subtitle2" sx={{ color: 'text.secondary', opacity: 0.8 }} gutterBottom>
          参照画像
        </Typography>
        <ImageUploadCard />
      </Box>

      <Divider />

      {/* 3. Basic Settings */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Typography variant="subtitle2" sx={{ color: 'text.secondary', opacity: 0.8 }} gutterBottom>
          生成エンジン
        </Typography>
        <DomainSelect />
        <EngineSelect />
        <QualitySelect />
      </Box>

      {/* 4. Advanced Settings */}
      <Accordion disableGutters elevation={0} sx={{ bgcolor: 'transparent', '&:before': { display: 'none' }, mt: 1 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: 'text.secondary' }}/>} sx={{ px: 0, minHeight: 'auto', '& .MuiAccordionSummary-content': { my: 1 } }}>
          <Typography variant="subtitle2" sx={{ color: 'text.secondary', opacity: 0.8 }}>
            詳細設定
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 0, pt: 0, pb: 2 }}>
          <Typography variant="body2" color="text.disabled">
            ネガティブプロンプト、シード値、サンプラーなどの詳細設定項目がここに追加されます。
          </Typography>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}

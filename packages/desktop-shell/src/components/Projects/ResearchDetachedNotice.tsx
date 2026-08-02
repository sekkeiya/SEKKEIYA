// Research & Memo が独立ウィンドウへデタッチされている間、本体タブに出す案内。
//
// R&M は Firestore をリアルタイム購読していないため、本体タブと独立窓で同じボードを
// 開くと後勝ちで丸ごと上書きされる。さらに ResearchBoardWorkspace はマウント中ずっと
// 「見ているボード」を配信するので、二重マウントは AI の書き込み先を揺らす。
// → 窓が開いている間はワークスペースをマウントせず、窓へ誘導する。
import React, { useEffect } from 'react';
import { Box, Button, Typography } from '@mui/material';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import ScienceRoundedIcon from '@mui/icons-material/ScienceRounded';
import { openResearchWindow } from '../../utils/openResearchWindow';

export const ResearchDetachedNotice: React.FC = () => {
  // 案内が出た＝ユーザーは R&M を見に来た、なので窓を前面に出してあげる。
  useEffect(() => { void openResearchWindow(); }, []);

  return (
    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
      <Box sx={{ textAlign: 'center', px: 3 }}>
        <ScienceRoundedIcon sx={{ fontSize: 44, color: 'rgb(var(--brand-fg-rgb) / 0.12)', mb: 1.5 }} />
        <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.55)', fontSize: '0.9rem', fontWeight: 700, mb: 0.5 }}>
          Research & Memo は別ウィンドウで開いています
        </Typography>
        <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.38)', fontSize: '0.78rem', mb: 2 }}>
          編集の取り違えを防ぐため、同時には1箇所だけで開きます。<br />
          ウィンドウを閉じると、ここに戻ります。
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<OpenInNewRoundedIcon sx={{ fontSize: 16 }} />}
          onClick={() => { void openResearchWindow(); }}
          sx={{ textTransform: 'none', fontWeight: 700 }}
        >
          前面に出す
        </Button>
      </Box>
    </Box>
  );
};

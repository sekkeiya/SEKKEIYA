import React from 'react';
import { Box, Tooltip } from '@mui/material';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import AllInclusiveRoundedIcon from '@mui/icons-material/AllInclusiveRounded';
import { useCredits } from './useCredits';

// クレジット残高チップ。アカウントメニュー等に置く小さな残高インジケータ。
// 残高はサーバが正本（docs/18）。本チップは表示のみ。

export const CreditBalanceChip: React.FC<{ onClick?: () => void }> = ({ onClick }) => {
  const { remaining, isUnlimited, monthlyUsed, monthlyAllotment, topupBalance, model3dRemaining, loading } = useCredits();

  if (loading) return null;

  const low = !isUnlimited && remaining <= 20;
  const accent = isUnlimited ? '#a855f7' : low ? '#ff9800' : '#42a5f5';

  const tip = isUnlimited ? (
    'クレジット無制限'
  ) : (
    <Box sx={{ whiteSpace: 'pre-line', fontSize: 12, lineHeight: 1.7 }}>
      {`残り ${remaining.toLocaleString('ja-JP')} クレジット（3D化 約${model3dRemaining}個）\n` +
        `月次 ${Math.max(0, monthlyAllotment - monthlyUsed)} / ${monthlyAllotment} ＋ 追加 ${topupBalance}\n` +
        `クリックでプラン詳細`}
    </Box>
  );

  return (
    <Tooltip title={tip} arrow placement="bottom">
      <Box
        onClick={onClick}
        sx={{
          display: 'inline-flex', alignItems: 'center', gap: 0.5,
          px: 1, py: 0.4, borderRadius: 999,
          cursor: onClick ? 'pointer' : 'default',
          bgcolor: `${accent}1A`, border: `1px solid ${accent}55`,
          color: accent, fontSize: 12, fontWeight: 700, lineHeight: 1,
          userSelect: 'none', transition: 'background-color 0.15s',
          '&:hover': onClick ? { bgcolor: `${accent}29` } : undefined,
        }}
      >
        {isUnlimited ? (
          <AllInclusiveRoundedIcon sx={{ fontSize: 15 }} />
        ) : (
          <BoltRoundedIcon sx={{ fontSize: 15 }} />
        )}
        {isUnlimited ? '無制限' : remaining.toLocaleString('ja-JP')}
      </Box>
    </Tooltip>
  );
};

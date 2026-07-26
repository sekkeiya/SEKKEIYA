// CodeWindow — SEKKEIYA Code の独立ネイティブウィンドウ（/?codeWindow=true）。
// 中身は DevStatusPanel（開発状況：要求/要件バックログ・R&M・公式記事の管理）を全面表示する。
// 管理者専用（isBlogAdmin）。非管理者がこの窓を開いても中身は出さず、案内文のみ表示する。
//
// ポップアウト子窓は本体の MainAppInitGate/MainLayout を通らないため、
// 親レイアウトの `flex: 1` 前提のスタイルを持つ子（DevStatusPanel のルート Box が `flex:1; minHeight:0`）は
// 素の block 親（高さ0）の下だと真っ暗になる既知の罠がある。ここでは host を `height: 100vh` の
// flex column にして、DevStatusPanel の `flex:1` が正しく解決されるようにする。
import React, { useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { DevStatusPanel } from '../features/global-settings/panels/DevStatusPanel';
import { isBlogAdmin } from '../features/dsb/lib/blogAdmin';
import { auth } from '../lib/firebase/client';

export const CodeWindow: React.FC = () => {
  useEffect(() => {
    import('@tauri-apps/api/window')
      .then(({ getCurrentWindow }) => getCurrentWindow().setTitle('SEKKEIYA Code'))
      .catch(() => {});
  }, []);

  const admin = isBlogAdmin(auth.currentUser);

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'var(--brand-bg)' }}>
      {admin
        ? <DevStatusPanel />
        : (
          <Box sx={{ m: 'auto', textAlign: 'center', color: 'text.secondary' }}>
            <Typography>SEKKEIYA Code は管理者専用です。</Typography>
          </Box>
        )}
    </Box>
  );
};

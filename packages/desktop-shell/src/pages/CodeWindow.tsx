// CodeWindow — SEKKEIYA Code の独立ネイティブウィンドウ（/?codeWindow=true）。
// 中身は DevStatusPanel（開発状況：要求/要件バックログ・R&M・公式記事の管理）を全面表示する。
// 要件74: 一般ユーザーにも開く（ローカルプロジェクトのみ。クラウド＝SEKKEIYA 本体の開発バックログは
// 管理者だけ）。ローカルモードは Tauri の fs が要るので、Web で非管理者が開いた場合だけ案内文を出す。
//
// ポップアウト子窓は本体の MainAppInitGate/MainLayout を通らないため、
// 親レイアウトの `flex: 1` 前提のスタイルを持つ子（DevStatusPanel のルート Box が `flex:1; minHeight:0`）は
// 素の block 親（高さ0）の下だと真っ暗になる既知の罠がある。ここでは host を `height: 100vh` の
// flex column にして、DevStatusPanel の `flex:1` が正しく解決されるようにする。
import React, { useEffect } from 'react';
import { Box, Typography, ThemeProvider, CssBaseline } from '@mui/material';
import { DevStatusPanel } from '../features/global-settings/panels/DevStatusPanel';
import { isBlogAdmin } from '../features/dsb/lib/blogAdmin';
import { resolveCodeAccess } from '../features/global-settings/panels/backlog/codeAccess';
import { isTauri } from '../lib/platform';
import { auth } from '../lib/firebase/client';
import { useAppTheme } from '../styles/useAppTheme';

export const CodeWindow: React.FC = () => {
  useEffect(() => {
    import('@tauri-apps/api/window')
      .then(({ getCurrentWindow }) => getCurrentWindow().setTitle('SEKKEIYA Code'))
      .catch(() => {});
  }, []);

  // 子窓は MainLayout を通らないため、ChatWindow と同様に自前で MUI テーマを張る。
  // これが無いと MUI 既定（ライト）の黒文字がダーク背景に載って読めなくなる。
  const appTheme = useAppTheme();
  const admin = isBlogAdmin(auth.currentUser);
  const access = resolveCodeAccess({ isAdmin: admin, isDesktop: isTauri() });

  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'var(--brand-bg)' }}>
        {access.enabled
          ? <DevStatusPanel isAdmin={admin} />
          : (
            <Box sx={{ m: 'auto', textAlign: 'center', color: 'text.secondary' }}>
              <Typography>SEKKEIYA Code はデスクトップアプリでご利用ください。</Typography>
            </Box>
          )}
      </Box>
    </ThemeProvider>
  );
};

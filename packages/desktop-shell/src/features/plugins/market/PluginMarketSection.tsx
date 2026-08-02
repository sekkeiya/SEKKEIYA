// マーケットプレイスの「プラグイン」タブ（要件73）。
// 公開されたプラグインの一覧・検索・導入。導入は権限同意ダイアログ（要件70）を
// 通ってから $HOME/SEKKEIYA/Plugins へ書き込む。source は 'marketplace' として記録され、
// 他サブアプリの readScopes は無効になる（dataScopePolicy の出所ゲート）。
import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Button, Card, CardContent, Chip, CircularProgress, Snackbar, Alert, Tooltip,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import ExtensionIcon from '@mui/icons-material/Extension';
import { isTauri } from '../../../lib/platform';
import { usePluginRegistry } from '../registry/usePluginRegistry';
import { describePermissions } from '../registry/permissionSummary';
import { extractPluginPackage, type PluginPackage } from '../registry/pluginPackage';
import { installPluginPackage } from '../registry/pluginInstaller';
import { PermissionConsentDialog } from '../ui/PermissionConsentDialog';
import {
  listMarketplacePlugins, downloadPluginPackage, type MarketplacePlugin,
} from './pluginMarketRepository';

export interface PluginMarketSectionProps {
  searchQuery: string;
}

export const PluginMarketSection: React.FC<PluginMarketSectionProps> = ({ searchQuery }) => {
  const { plugins: installed, reload } = usePluginRegistry();
  const [items, setItems] = useState<MarketplacePlugin[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [consent, setConsent] = useState<PluginPackage | null>(null);
  const [message, setMessage] = useState<{ text: string; severity: 'success' | 'error' } | null>(null);

  useEffect(() => {
    listMarketplacePlugins()
      .then(setItems)
      .catch(e => setLoadError(e instanceof Error ? e.message : String(e)));
  }, []);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter(p =>
      p.name.toLowerCase().includes(q)
      || p.id.toLowerCase().includes(q)
      || (p.description ?? '').toLowerCase().includes(q)
      || (p.ownerName ?? '').toLowerCase().includes(q));
  }, [items, searchQuery]);

  const installedVersion = (id: string): string | null =>
    installed.find(p => p.manifest.id === id)?.manifest.version ?? null;

  const handleInstallClick = async (item: MarketplacePlugin) => {
    try {
      setBusyId(item.id);
      const bytes = await downloadPluginPackage(item.downloadUrl);
      const result = extractPluginPackage(bytes);
      if (!result.ok) {
        setMessage({ text: result.error, severity: 'error' });
        return;
      }
      setConsent(result.pkg);
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : String(e), severity: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const handleConsentAllow = async () => {
    if (!consent) return;
    try {
      setBusyId(consent.manifest.id);
      await installPluginPackage(consent, 'marketplace');
      setConsent(null);
      reload();
      setMessage({ text: `${consent.manifest.name} を導入しました。タブバーに表示されます。`, severity: 'success' });
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : String(e), severity: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 800, color: 'var(--brand-fg)', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <ExtensionIcon fontSize="small" /> Community Plugins
      </Typography>

      {loadError ? (
        <Typography sx={{ color: 'error.main' }}>読み込めませんでした: {loadError}</Typography>
      ) : items === null ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
          <CircularProgress sx={{ color: 'light-dark(#095fa5, #90caf9)' }} />
        </Box>
      ) : filtered.length === 0 ? (
        <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.65)' }}>
          {items.length === 0
            ? 'まだ公開されたプラグインはありません。設定 → プラグイン から自作プラグインを公開できます。'
            : '検索に一致するプラグインがありません。'}
        </Typography>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(3, 1fr)' }, gap: 3 }}>
          {filtered.map(item => {
            const current = installedVersion(item.id);
            const isInstalled = current !== null;
            const isUpdate = isInstalled && current !== item.version;
            const perms = describePermissions(item.permissions);
            return (
              <Card key={item.id} sx={{ bgcolor: 'var(--brand-surface)', borderRadius: 2, border: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 }, display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--brand-fg)' }} noWrap>
                      {item.name}
                    </Typography>
                    <Chip size="small" label={`v${item.version}`} sx={{ height: 18, fontSize: '0.62rem' }} />
                  </Box>
                  <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontFamily: 'monospace', display: 'block', mb: 1 }} noWrap>
                    {item.id}
                  </Typography>
                  <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.65)', fontSize: '0.8rem', mb: 1, minHeight: 36 }}>
                    {item.description || '（説明なし）'}
                  </Typography>
                  {perms.length > 0 && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                      {perms.map(p => (
                        <Chip key={p} label={p} size="small" variant="outlined" sx={{ height: 20, fontSize: 10, maxWidth: '100%' }} />
                      ))}
                    </Box>
                  )}
                  <Box sx={{ flex: 1 }} />
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
                    <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)' }} noWrap>
                      {item.ownerName}
                    </Typography>
                    {isInstalled && !isUpdate ? (
                      <Chip size="small" label="導入済み" sx={{ bgcolor: 'rgba(100,255,100,0.1)', color: 'light-dark(#00ad00, #80ff80)', height: 24, fontSize: '0.7rem', fontWeight: 800 }} />
                    ) : (
                      <Tooltip title={isTauri() ? '' : '導入はデスクトップ版でのみ可能です'}>
                        <span>
                          <Button size="small" startIcon={busyId === item.id ? <CircularProgress size={14} /> : <DownloadIcon sx={{ fontSize: 16 }} />}
                            disabled={!isTauri() || busyId !== null}
                            onClick={() => handleInstallClick(item)}
                            sx={{ bgcolor: '#fff', color: '#000', fontWeight: 800, px: 2, '&:hover': { bgcolor: '#eee' } }}>
                            {isUpdate ? `更新（v${current} →）` : '導入'}
                          </Button>
                        </span>
                      </Tooltip>
                    )}
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      )}

      <PermissionConsentDialog
        open={consent !== null}
        manifest={consent?.manifest ?? null}
        sourceLabel="マーケットプレイス"
        busy={busyId !== null}
        onCancel={() => setConsent(null)}
        onAllow={handleConsentAllow}
      />

      <Snackbar open={message !== null} autoHideDuration={6000} onClose={() => setMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={message?.severity ?? 'success'} onClose={() => setMessage(null)} sx={{ maxWidth: 560 }}>
          {message?.text}
        </Alert>
      </Snackbar>
    </Box>
  );
};

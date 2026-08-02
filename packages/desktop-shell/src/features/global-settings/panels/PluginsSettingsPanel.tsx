// プラグイン管理画面（要件71/72/73）。
// - インストール済み一覧: 有効/無効トグル・アンインストール（要件71）
// - 読み込めなかったプラグイン: 理由つき表示（要件72。engine 非互換もここに出る）
// - zip からインストール: 権限同意ダイアログを通してから書き込む（要件70）
// - 開発プロジェクト（SEKKEIYA/Dev/*/plugin.json）: パッケージ化・マーケット公開（要件71/73）
import React, { useCallback, useEffect, useState } from 'react';
import {
  Box, Typography, Button, Switch, Chip, Divider, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Snackbar, Alert, Tooltip,
} from '@mui/material';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import PublishRoundedIcon from '@mui/icons-material/PublishRounded';
import ExtensionRoundedIcon from '@mui/icons-material/ExtensionRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { isTauri } from '../../../lib/platform';
import { useAuthStore } from '../../../store/useAuthStore';
import { usePluginRegistry } from '../../plugins/registry/usePluginRegistry';
import type { LoadedPlugin } from '../../plugins/registry/loadPlugins';
import type { PluginSource } from '../../plugins/registry/dataScopePolicy';
import { describePermissions } from '../../plugins/registry/permissionSummary';
import { extractPluginPackage, type PluginPackage } from '../../plugins/registry/pluginPackage';
import {
  installPluginPackage, uninstallPlugin, setPluginDisabled,
  listDevPluginProjects, packDevProject, readBinaryFileAnywhere,
  type DevPluginProject,
} from '../../plugins/registry/pluginInstaller';
import { PermissionConsentDialog } from '../../plugins/ui/PermissionConsentDialog';
import { publishPlugin } from '../../plugins/market/pluginMarketRepository';

const SOURCE_LABEL: Record<PluginSource, string> = {
  self: '手動 / 開発',
  team: 'チーム配布',
  marketplace: 'マーケット',
};

interface Message { text: string; severity: 'success' | 'error' | 'info'; }

export const PluginsSettingsPanel: React.FC = () => {
  const { plugins, rejected, loading, reload } = usePluginRegistry();
  const currentUser = useAuthStore((s: { currentUser: { uid: string; displayName?: string | null; email?: string | null } | null }) => s.currentUser);

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [consent, setConsent] = useState<{ pkg: PluginPackage; source: PluginSource; sourceLabel: string } | null>(null);
  const [devProjects, setDevProjects] = useState<DevPluginProject[] | null>(null);
  const [publishTarget, setPublishTarget] = useState<DevPluginProject | null>(null);
  const [publishDescription, setPublishDescription] = useState('');

  const refreshDevProjects = useCallback(() => {
    if (!isTauri()) return;
    listDevPluginProjects()
      .then(setDevProjects)
      .catch(() => setDevProjects([]));
  }, []);

  useEffect(() => { refreshDevProjects(); }, [refreshDevProjects]);

  if (!isTauri()) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>プラグイン</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          プラグインの管理はデスクトップ版の機能です。Web 版では利用できません。
        </Typography>
      </Box>
    );
  }

  const notify = (text: string, severity: Message['severity'] = 'success') => setMessage({ text, severity });
  const fail = (e: unknown) => notify(e instanceof Error ? e.message : String(e), 'error');

  const handleToggle = async (plugin: LoadedPlugin) => {
    try {
      setBusy(true);
      await setPluginDisabled(plugin.manifest.id, plugin.enabled);
      reload();
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const handleUninstall = async (plugin: LoadedPlugin) => {
    if (!window.confirm(`${plugin.manifest.name} をアンインストールしますか？\nフォルダごと削除されます:\n${plugin.dir}`)) return;
    try {
      setBusy(true);
      await uninstallPlugin(plugin.dir);
      reload();
      notify(`${plugin.manifest.name} をアンインストールしました`);
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const handleInstallFromZip = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        multiple: false,
        filters: [{ name: 'プラグインパッケージ', extensions: ['zip'] }],
      });
      if (typeof selected !== 'string') return;
      setBusy(true);
      const bytes = await readBinaryFileAnywhere(selected);
      const result = extractPluginPackage(bytes);
      if (!result.ok) { notify(result.error, 'error'); return; }
      // インストールは同意ダイアログの「許可してインストール」からのみ進む（要件70）。
      setConsent({ pkg: result.pkg, source: 'self', sourceLabel: 'zip ファイル' });
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const handleConsentAllow = async () => {
    if (!consent) return;
    try {
      setBusy(true);
      const dir = await installPluginPackage(consent.pkg, consent.source);
      setConsent(null);
      reload();
      notify(`${consent.pkg.manifest.name} をインストールしました: ${dir}`);
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const handlePack = async (project: DevPluginProject) => {
    try {
      setBusy(true);
      const result = await packDevProject(project.dir);
      notify(`パッケージを作成しました: ${result.zipPath}`);
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const handlePublish = async () => {
    if (!publishTarget || !currentUser) return;
    try {
      setBusy(true);
      const packed = await packDevProject(publishTarget.dir);
      await publishPlugin({
        manifest: packed.manifest,
        bytes: packed.bytes,
        ownerUid: currentUser.uid,
        ownerName: currentUser.displayName ?? currentUser.email ?? 'unknown',
        description: publishDescription.trim(),
      });
      setPublishTarget(null);
      setPublishDescription('');
      notify(`${packed.manifest.name} v${packed.manifest.version} をマーケットプレイスに公開しました`);
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  return (
    <Box sx={{ flex: 1, overflowY: 'auto', p: 4 }}>
      <Box sx={{ maxWidth: 900 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
          <ExtensionRoundedIcon />
          <Typography variant="h6" sx={{ fontWeight: 800 }}>プラグイン</Typography>
          <Box sx={{ flex: 1 }} />
          <Button size="small" startIcon={<FileDownloadRoundedIcon />} variant="outlined" disabled={busy}
            onClick={handleInstallFromZip} sx={{ textTransform: 'none' }}>
            zip からインストール
          </Button>
          <Button size="small" startIcon={<RefreshRoundedIcon />} disabled={busy}
            onClick={() => { reload(); refreshDevProjects(); }} sx={{ textTransform: 'none' }}>
            再読み込み
          </Button>
        </Box>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
          置き場所は <code>%USERPROFILE%\SEKKEIYA\Plugins\</code>。フォルダを直接置いても、zip からインストールしても読み込まれます。
        </Typography>

        {/* インストール済み */}
        <Typography sx={{ fontWeight: 700, mb: 1 }}>インストール済み（{plugins.length}）</Typography>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
        ) : plugins.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
            プラグインはまだありません。SEKKEIYA Code の「新規プロジェクトを作成」でプラグイン雛形を選ぶと開発を始められます。
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
            {plugins.map(plugin => {
              const perms = describePermissions(plugin.manifest.permissions);
              return (
                <Box key={plugin.manifest.id}
                  sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5, opacity: plugin.enabled ? 1 : 0.6 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: plugin.manifest.color ?? '#90a4ae', flexShrink: 0 }} />
                    <Typography sx={{ fontWeight: 700 }}>{plugin.manifest.name}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
                      {plugin.manifest.id} v{plugin.manifest.version}
                    </Typography>
                    <Chip label={SOURCE_LABEL[plugin.source]} size="small" sx={{ height: 20 }} />
                    <Box sx={{ flex: 1 }} />
                    <Tooltip title={plugin.enabled ? '無効にする（タブから消えます）' : '有効にする'}>
                      <Switch size="small" checked={plugin.enabled} disabled={busy} onChange={() => handleToggle(plugin)} />
                    </Tooltip>
                    <Button size="small" color="error" startIcon={<DeleteOutlineRoundedIcon />} disabled={busy}
                      onClick={() => handleUninstall(plugin)} sx={{ textTransform: 'none' }}>
                      アンインストール
                    </Button>
                  </Box>
                  {perms.length > 0 && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                      {perms.map(p => <Chip key={p} label={p} size="small" variant="outlined" sx={{ height: 22, fontSize: 11 }} />)}
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        )}

        {/* 読み込めなかったプラグイン（要件72） */}
        {rejected.length > 0 && (
          <>
            <Typography sx={{ fontWeight: 700, mb: 1, display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <ErrorOutlineRoundedIcon fontSize="small" color="warning" />
              読み込めなかったプラグイン（{rejected.length}）
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
              {rejected.map(r => (
                <Box key={`${r.dir}:${r.reason}`} sx={{ border: '1px solid', borderColor: 'warning.main', borderRadius: 2, p: 1.5 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace', display: 'block' }}>
                    {r.dir || '(プラグインフォルダ全体)'}
                  </Typography>
                  <Typography variant="body2">{r.reason}</Typography>
                </Box>
              ))}
            </Box>
          </>
        )}

        <Divider sx={{ my: 3 }} />

        {/* 開発プロジェクト（要件71 パッケージ化 / 要件73 公開） */}
        <Typography sx={{ fontWeight: 700, mb: 0.5 }}>開発中のプラグインプロジェクト</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
          <code>%USERPROFILE%\SEKKEIYA\Dev\</code> 直下で <code>plugin.json</code> を持つプロジェクト。
          パッケージ化すると <code>dist/</code> に配布用 zip ができます。
        </Typography>
        {devProjects === null ? (
          <CircularProgress size={20} />
        ) : devProjects.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            プラグインプロジェクトはありません。
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {devProjects.map(project => (
              <Box key={project.dir} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700 }} noWrap>{project.manifest.name}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }} noWrap>
                    {project.folderName} — {project.manifest.id} v{project.manifest.version}
                  </Typography>
                </Box>
                <Box sx={{ flex: 1 }} />
                <Button size="small" startIcon={<Inventory2RoundedIcon />} disabled={busy}
                  onClick={() => handlePack(project)} sx={{ textTransform: 'none' }}>
                  パッケージ化
                </Button>
                <Tooltip title={currentUser ? 'マーケットプレイスに公開' : '公開にはログインが必要です'}>
                  <span>
                    <Button size="small" startIcon={<PublishRoundedIcon />} variant="outlined" disabled={busy || !currentUser}
                      onClick={() => { setPublishTarget(project); setPublishDescription(''); }} sx={{ textTransform: 'none' }}>
                      公開
                    </Button>
                  </span>
                </Tooltip>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* 権限同意（要件70） */}
      <PermissionConsentDialog
        open={consent !== null}
        manifest={consent?.pkg.manifest ?? null}
        sourceLabel={consent?.sourceLabel ?? ''}
        busy={busy}
        onCancel={() => setConsent(null)}
        onAllow={handleConsentAllow}
      />

      {/* 公開確認（要件73） */}
      <Dialog open={publishTarget !== null} onClose={busy ? undefined : () => setPublishTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>マーケットプレイスに公開</DialogTitle>
        <DialogContent>
          {publishTarget && (
            <>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {publishTarget.manifest.name}（{publishTarget.manifest.id} v{publishTarget.manifest.version}）を
                パッケージ化して公開します。すべてのユーザーが検索・導入できるようになります。
              </Typography>
              <TextField
                fullWidth multiline minRows={2} size="small"
                label="説明（任意）"
                placeholder="何をするプラグインか、1〜2 文で"
                value={publishDescription}
                onChange={e => setPublishDescription(e.target.value)}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPublishTarget(null)} disabled={busy} sx={{ textTransform: 'none' }}>キャンセル</Button>
          <Button onClick={handlePublish} disabled={busy} variant="contained" sx={{ textTransform: 'none' }}>
            公開する
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={message !== null} autoHideDuration={6000} onClose={() => setMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={message?.severity ?? 'info'} onClose={() => setMessage(null)} sx={{ maxWidth: 560 }}>
          {message?.text}
        </Alert>
      </Snackbar>
    </Box>
  );
};

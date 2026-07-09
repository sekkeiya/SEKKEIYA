import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Box, Typography, IconButton, CircularProgress, InputAdornment,
} from '@mui/material';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { useAuthStore } from '../../store/useAuthStore';
import { useAppStore } from '../../store/useAppStore';
import { useProjectSiteStore } from '../../store/useProjectSiteStore';
import type { SiteSource } from './siteRepository';
import type { ProjectSite } from '../projects/types';
import {
  PUBLIC_BASE, getUsername, claimUsername, publishSite, unpublishSite, setSitePrivate, slugify, publicUrl,
  isAccountPublished, ACCOUNT_NOT_PUBLISHED,
} from './publishService';
import { resolvePublishSnapshot } from './resolvePublishSnapshot';
import { SiteRepository } from './siteRepository';

interface Props {
  open: boolean;
  onClose: () => void;
  source: SiteSource;
  site: ProjectSite;
  displayName: string; // project名 or ユーザー名
  /** 管理画面から開く時：エディタストアでなく対象サイトのドキュメントへ直接 publish 状態を保存する。 */
  manage?: boolean;
  /** 公開状態が変わった後に呼ぶ（一覧の再読込など）。 */
  onChanged?: () => void;
}

export const PublishDialog: React.FC<Props> = ({ open, onClose, source, site, displayName, manage, onChanged }) => {
  const uid = useAuthStore(s => s.currentUser?.uid) || '';
  const applyPublishState = useProjectSiteStore(s => s.applyPublishState);

  // publish 状態の永続化先：管理画面では対象サイトのドキュメントへ直接、通常はエディタストア経由。
  const persistPublish = async (publish: ProjectSite['publish']) => {
    if (manage) await SiteRepository.save(source, { ...site, publish });
    else await applyPublishState(publish);
    onChanged?.();
  };

  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState<string | null>(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // プロジェクト公開の前提：アカウントサイトが公開済みか。
  const [accountReady, setAccountReady] = useState(true);

  const published = site.publish?.status === 'published';
  const isPrivate = published && site.publish?.visibility === 'private';
  const publishedUrl = published && site.publish?.slug ? publicUrl(site.publish.slug) : null;

  useEffect(() => {
    if (!open || !uid) return;
    setLoading(true); setError(null);
    getUsername(uid).then(async u => {
      setUsername(u); setUsernameInput(u || '');
      if (source.kind === 'project') setAccountReady(await isAccountPublished(u));
      else setAccountReady(true);
      setLoading(false);
    });
  }, [open, uid, source.kind]);

  // 公開予定 URL のプレビュー
  const previewSlug = source.kind === 'account'
    ? `@${username || usernameInput || 'username'}`
    : `@${username || usernameInput || 'username'}/${slugify(displayName, 'project')}`;

  const handlePublish = async () => {
    setBusy(true); setError(null);
    try {
      let u = username;
      if (!u) {
        const res = await claimUsername(uid, usernameInput);
        if (!res.ok) { setError(res.error || '失敗しました'); setBusy(false); return; }
        u = usernameInput.trim().toLowerCase();
        setUsername(u);
      }
      const projects = useAppStore.getState().projects as any;
      const resolved = await resolvePublishSnapshot(site, uid, projects);
      const { publish } = await publishSite({ source, ownerUid: uid, username: u, site: resolved, projectName: displayName, projects });
      await persistPublish(publish);
    } catch (e: any) {
      if (e?.message === ACCOUNT_NOT_PUBLISHED) {
        setAccountReady(false);
        setError('先にアカウントサイト（マイページ）を公開してください。アカウントサイトの公開後にプロジェクトサイトを公開できます。');
      } else {
        setError(`公開に失敗しました: ${e?.message ?? e}`);
      }
    } finally { setBusy(false); }
  };

  const handleUnpublish = async () => {
    if (!username) return;
    setBusy(true);
    try {
      const publish = await unpublishSite(source, username, { ownerUid: uid, projects: useAppStore.getState().projects as any });
      await persistPublish(publish);
    }
    finally { setBusy(false); }
  };

  // 非公開にする：公開コピーを削除し、URL 設定は保持（「公開に戻す」で同じ URL に復帰）。
  const handleSetPrivate = async () => {
    if (!username || !site.publish) return;
    setBusy(true); setError(null);
    try {
      const publish = await setSitePrivate(source, username, {
        ownerUid: uid, current: site.publish, projects: useAppStore.getState().projects as any,
      });
      await persistPublish(publish);
    } catch (e: any) {
      setError(`非公開化に失敗しました: ${e?.message ?? e}`);
    } finally { setBusy(false); }
  };

  const copy = (text: string) => { navigator.clipboard?.writeText(text); };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: '#11151d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3 } }}>
      <DialogTitle sx={{ color: '#fff', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
        <PublicRoundedIcon sx={{ color: '#00BFFF' }} /> サイトを公開
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress sx={{ color: '#00BFFF' }} /></Box>
        ) : published && publishedUrl ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {isPrivate ? (
              <Typography sx={{ color: '#fa9bb4', fontWeight: 700, fontSize: '0.9rem' }}>● 非公開</Typography>
            ) : (
              <Typography sx={{ color: '#43e97b', fontWeight: 700, fontSize: '0.9rem' }}>● 公開中</Typography>
            )}
            <TextField value={publishedUrl} fullWidth variant="filled" InputProps={{
              readOnly: true,
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => copy(publishedUrl)} sx={{ color: '#00BFFF' }}><ContentCopyRoundedIcon /></IconButton>
                  <IconButton onClick={() => window.open(publishedUrl, '_blank')} sx={{ color: 'rgba(255,255,255,0.6)' }} disabled={isPrivate}><OpenInNewRoundedIcon /></IconButton>
                </InputAdornment>
              ),
            }} />
            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>
              {isPrivate
                ? '非公開中は URL にアクセスしても表示されません。「公開に戻す」で同じ URL のまま再公開できます。'
                : 'この URL を共有すると、誰でもサイトを閲覧できます。内容を更新したら「再公開」で反映してください。'}
              {source.kind === 'account' && (isPrivate
                ? ' 公開に戻すと、個別に非公開にしていないプロジェクトサイトも復帰します。'
                : ' 非公開にすると、配下のプロジェクトサイトもすべて閲覧できなくなります。')}
            </Typography>
            {error && <Typography sx={{ color: '#fa709a', fontSize: '0.8rem' }}>{error}</Typography>}
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {source.kind === 'project' && !accountReady && (
              <Box sx={{ p: 1.5, bgcolor: 'rgba(250,112,154,0.1)', border: '1px solid rgba(250,112,154,0.4)', borderRadius: 2 }}>
                <Typography sx={{ color: '#fa9bb4', fontWeight: 700, fontSize: '0.82rem', mb: 0.5 }}>アカウントサイトが未公開です</Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.76rem' }}>
                  プロジェクトサイトを公開する前に、マイページ（アカウントサイト）を公開してください。公開後、このプロジェクトはアカウントサイトの Works に自動で追加されます。
                </Typography>
              </Box>
            )}
            {!username && (
              <Box>
                <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', mb: 1 }}>
                  公開 URL に使うユーザー名を決めてください（変更不可ではありませんが、URL が変わります）。
                </Typography>
                <TextField
                  value={usernameInput}
                  onChange={e => setUsernameInput(e.target.value)}
                  placeholder="yourname"
                  fullWidth variant="filled"
                  InputProps={{ startAdornment: <InputAdornment position="start"><Typography sx={{ color: 'rgba(255,255,255,0.4)' }}>{PUBLIC_BASE}/</Typography></InputAdornment> }}
                />
              </Box>
            )}
            <Box sx={{ p: 1.5, bgcolor: 'rgba(0,191,255,0.08)', border: '1px solid rgba(0,191,255,0.25)', borderRadius: 2 }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', mb: 0.5 }}>公開 URL（予定）</Typography>
              <Typography sx={{ color: '#fff', fontWeight: 700, wordBreak: 'break-all' }}>{PUBLIC_BASE}/{previewSlug}</Typography>
            </Box>
            {error && <Typography sx={{ color: '#fa709a', fontSize: '0.8rem' }}>{error}</Typography>}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: 'rgba(255,255,255,0.6)', textTransform: 'none' }}>閉じる</Button>
        {published ? (
          <>
            <Button onClick={handleUnpublish} disabled={busy} sx={{ color: '#fa709a', textTransform: 'none' }}>公開を停止</Button>
            {isPrivate ? (
              <Button onClick={handlePublish} disabled={busy} variant="contained" sx={{ bgcolor: '#43e97b', color: '#000', fontWeight: 800, textTransform: 'none' }}>{busy ? '…' : '公開に戻す'}</Button>
            ) : (
              <>
                <Button onClick={handleSetPrivate} disabled={busy} sx={{ color: 'rgba(255,255,255,0.7)', textTransform: 'none' }}>非公開にする</Button>
                <Button onClick={handlePublish} disabled={busy} variant="contained" sx={{ bgcolor: '#00BFFF', color: '#000', fontWeight: 800, textTransform: 'none' }}>{busy ? '…' : '再公開'}</Button>
              </>
            )}
          </>
        ) : (
          <Button onClick={handlePublish} disabled={busy || (!username && !usernameInput.trim()) || (source.kind === 'project' && !accountReady)} variant="contained" sx={{ bgcolor: '#00BFFF', color: '#000', fontWeight: 800, textTransform: 'none' }}>
            {busy ? '公開中…' : '公開する'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

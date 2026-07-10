// Global Settings > 管理者 > GitHub更新。
// 開発マシン上のソースリポジトリ（sekkeiya / sekkeiya-desktop）に対して
// 状態確認・コミット&プッシュを UI から実行する。オーナー専用（GlobalSettingsShell で isAdmin ガード）。
// git コマンドは Tauri (src-tauri/src/git.rs) 経由。認証はマシンの git 資格情報を使用する。
// 方式は「全変更を add -A → commit → push」。push がコンフリクト（リモート先行）で失敗したときのみ
// 「プル(rebase)して再試行」を出す。秘匿ファイルは .gitignore で構造的に除外している前提。
import React, { useCallback, useEffect, useState } from 'react';
import {
  Box, Paper, Typography, TextField, Button, Chip, Stack, Collapse, IconButton, Tooltip, Divider, CircularProgress,
} from '@mui/material';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import SyncRoundedIcon from '@mui/icons-material/SyncRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';

interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  changed: string[];
  clean: boolean;
  error: string | null;
}

interface Repo { id: string; label: string; path: string; }

const STORAGE_KEY = 'sekkeiya.admin.gitRepos.v1';
const DEFAULT_REPOS: Repo[] = [
  { id: 'web',     label: 'sekkeiya (Web + Functions)', path: 'C:\\Users\\sekkeiya\\02-WebApp\\040-sekkeiya\\sekkeiya' },
  { id: 'desktop', label: 'sekkeiya-desktop',           path: 'C:\\Users\\sekkeiya\\02-WebApp\\040-sekkeiya\\sekkeiya-desktop' },
];

function loadRepos(): Repo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr) && arr.length) return arr; }
  } catch { /* ignore */ }
  return DEFAULT_REPOS;
}

async function gitInvoke<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
}

// コミットメッセージ未入力時の既定＝その時の日時（例: 2026-07-10 15:32）
function nowStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

type RepoRuntime = {
  status?: GitStatus;
  loadingStatus?: boolean;
  message: string;
  busy?: boolean;
  log?: string;
  pushFailed?: boolean;
  showFiles?: boolean;
};

export const GitHubSyncPanel: React.FC = () => {
  const [repos, setRepos] = useState<Repo[]>(loadRepos);
  const [rt, setRt] = useState<Record<string, RepoRuntime>>({});
  const [editRepos, setEditRepos] = useState(false);

  const patchRt = useCallback((id: string, p: Partial<RepoRuntime>) => {
    setRt(prev => ({ ...prev, [id]: { message: '', ...prev[id], ...p } }));
  }, []);

  const refreshStatus = useCallback(async (repo: Repo) => {
    patchRt(repo.id, { loadingStatus: true });
    try {
      const status = await gitInvoke<GitStatus>('git_status', { repo: repo.path });
      patchRt(repo.id, { status, loadingStatus: false });
    } catch (e: any) {
      patchRt(repo.id, { status: { branch: '', ahead: 0, behind: 0, changed: [], clean: false, error: String(e?.message || e) }, loadingStatus: false });
    }
  }, [patchRt]);

  // 初回・repo変更時に全リポジトリの状態を取得
  useEffect(() => { repos.forEach(r => { void refreshStatus(r); }); /* eslint-disable-next-line */ }, [repos]);

  const commitPush = useCallback(async (repo: Repo) => {
    // 空欄ならその時の日時を自動採用
    const message = (rt[repo.id]?.message || '').trim() || nowStamp();
    patchRt(repo.id, { busy: true, log: '実行中…', pushFailed: false });
    try {
      const log = await gitInvoke<string>('git_commit_push', { repo: repo.path, message });
      patchRt(repo.id, { busy: false, log, pushFailed: false, message: '' });
      void refreshStatus(repo);
    } catch (e: any) {
      patchRt(repo.id, { busy: false, log: String(e?.message || e), pushFailed: true });
      void refreshStatus(repo);
    }
  }, [rt, patchRt, refreshStatus]);

  const pullRebase = useCallback(async (repo: Repo) => {
    patchRt(repo.id, { busy: true, log: 'git pull --rebase 実行中…' });
    try {
      const log = await gitInvoke<string>('git_pull_rebase', { repo: repo.path });
      patchRt(repo.id, { busy: false, log, pushFailed: false });
      void refreshStatus(repo);
    } catch (e: any) {
      patchRt(repo.id, { busy: false, log: String(e?.message || e) });
      void refreshStatus(repo);
    }
  }, [patchRt, refreshStatus]);

  const saveRepos = (next: Repo[]) => {
    setRepos(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };
  const updateRepoField = (id: string, field: 'label' | 'path', value: string) =>
    saveRepos(repos.map(r => r.id === id ? { ...r, [field]: value } : r));
  const removeRepo = (id: string) => saveRepos(repos.filter(r => r.id !== id));
  const addRepo = () => saveRepos([...repos, { id: `repo_${Date.now()}`, label: '新しいリポジトリ', path: '' }]);

  const sectionSx = { p: 3, borderRadius: 3, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' } as const;

  return (
    <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto' }}>
      <Box>
        <Stack direction="row" alignItems="center" spacing={1}>
          <CloudUploadRoundedIcon color="primary" />
          <Typography variant="h5" sx={{ fontWeight: 700 }}>GitHub更新</Typography>
        </Stack>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
          各リポジトリの変更をここからコミット＆プッシュできます。開発の区切りにこの画面から更新すると、
          複数チャットの並行 push の競合（リモート先行）が起きても<b>「プル(rebase)して再試行」</b>で解決できます。
          <br />認証はこのマシンの git 資格情報を使用します（オーナー専用）。
        </Typography>
      </Box>

      {repos.map(repo => {
        const st = rt[repo.id];
        const status = st?.status;
        const changedCount = status?.changed?.length ?? 0;
        return (
          <Paper key={repo.id} elevation={0} sx={sectionSx}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap">
                <Typography variant="h6" sx={{ fontWeight: 600 }}>{repo.label}</Typography>
                {status?.branch && <Chip size="small" label={status.branch} variant="outlined" />}
                {status && !status.error && (status.ahead > 0 || status.behind > 0) && (
                  <Chip size="small" color={status.behind > 0 ? 'warning' : 'default'}
                    label={`↑${status.ahead} ↓${status.behind}`} />
                )}
                {status && !status.error && (
                  status.clean
                    ? <Chip size="small" color="success" variant="outlined" label="変更なし" />
                    : <Chip size="small" color="primary" label={`変更 ${changedCount} 件`} />
                )}
              </Stack>
              <Tooltip title="状態を更新">
                <span>
                  <IconButton size="small" onClick={() => refreshStatus(repo)} disabled={st?.loadingStatus}>
                    {st?.loadingStatus ? <CircularProgress size={16} /> : <RefreshRoundedIcon fontSize="small" />}
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>

            <Typography variant="caption" sx={{ color: 'text.secondary', wordBreak: 'break-all' }}>{repo.path}</Typography>

            {status?.error && (
              <Typography variant="body2" color="error" sx={{ mt: 1 }}>{status.error}</Typography>
            )}

            {!status?.error && changedCount > 0 && (
              <Box sx={{ mt: 1 }}>
                <Button size="small" onClick={() => patchRt(repo.id, { showFiles: !st?.showFiles })}
                  endIcon={<ExpandMoreRoundedIcon sx={{ transform: st?.showFiles ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />}
                  sx={{ textTransform: 'none' }}>
                  変更ファイルを{st?.showFiles ? '隠す' : '表示'}（{changedCount} 件）
                </Button>
                <Collapse in={st?.showFiles}>
                  <Box component="pre" sx={{ m: 0, mt: 0.5, p: 1.5, borderRadius: 2, bgcolor: 'action.hover', fontSize: 12, fontFamily: 'monospace', maxHeight: 200, overflow: 'auto' }}>
                    {status!.changed.join('\n')}
                  </Box>
                </Collapse>
              </Box>
            )}

            <Divider sx={{ my: 2 }} />

            <TextField
              fullWidth size="small" multiline maxRows={4}
              label="コミットメッセージ（空欄で送ると日時が入ります）"
              placeholder="空欄のまま「コミット&プッシュ」→ 例: 2026-07-10 15:32 が自動で入ります"
              value={st?.message ?? ''}
              onChange={e => patchRt(repo.id, { message: e.target.value })}
              disabled={st?.busy}
            />

            <Stack direction="row" spacing={1.5} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
              <Button
                variant="contained" startIcon={st?.busy ? <CircularProgress size={16} color="inherit" /> : <CloudUploadRoundedIcon />}
                onClick={() => commitPush(repo)} disabled={st?.busy || !!status?.error}
              >
                コミット&プッシュ
              </Button>
              {st?.pushFailed && (
                <Button
                  variant="outlined" color="warning" startIcon={<SyncRoundedIcon />}
                  onClick={() => pullRebase(repo)} disabled={st?.busy}
                >
                  プル(rebase)して再試行
                </Button>
              )}
            </Stack>

            {st?.log && (
              <Box component="pre" sx={{ mt: 2, mb: 0, p: 1.5, borderRadius: 2, bgcolor: 'action.hover', fontSize: 12, fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: 240, overflow: 'auto' }}>
                {st.log}
              </Box>
            )}
          </Paper>
        );
      })}

      {/* リポジトリ設定（パスの編集・追加・削除） */}
      <Paper elevation={0} sx={sectionSx}>
        <Button size="small" onClick={() => setEditRepos(o => !o)}
          endIcon={<ExpandMoreRoundedIcon sx={{ transform: editRepos ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />}
          sx={{ textTransform: 'none' }}>
          リポジトリ設定（パスの編集・追加）
        </Button>
        <Collapse in={editRepos}>
          <Stack spacing={2} sx={{ mt: 2 }}>
            {repos.map(repo => (
              <Stack key={repo.id} direction="row" spacing={1} alignItems="center">
                <TextField size="small" label="表示名" value={repo.label} sx={{ width: 220 }}
                  onChange={e => updateRepoField(repo.id, 'label', e.target.value)} />
                <TextField size="small" label="リポジトリのパス" value={repo.path} fullWidth
                  onChange={e => updateRepoField(repo.id, 'path', e.target.value)} />
                <Tooltip title="削除">
                  <IconButton size="small" onClick={() => removeRepo(repo.id)}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton>
                </Tooltip>
              </Stack>
            ))}
            <Box>
              <Button size="small" startIcon={<AddRoundedIcon />} onClick={addRepo} sx={{ textTransform: 'none' }}>
                リポジトリを追加
              </Button>
            </Box>
          </Stack>
        </Collapse>
      </Paper>
    </Box>
  );
};

// サイト公開（Phase C）。URL 階層 = {username}（アカウントサイト）/ {username}/{project}（プロジェクトサイト）。
//
// デスクトップ側の責務:
//   - ユーザー名（username）の確保＝一意性（usernames/{username} → uid）
//   - 公開ドキュメントの書き出し（publishedSites/{docId}）＝Web アプリが認証なしで読む公開コピー
//   - サイトの publish 状態更新（呼び出し側でストア経由保存）
// Web 側（別リポ, sekkeiya-web-deploy）の責務:
//   - ルート /{username} と /{username}/{slug} で publishedSites を読み、本サイトレンダラで描画。

import { collection, doc, getDoc, getDocs, query, setDoc, deleteDoc, where } from 'firebase/firestore';
import { db } from '../../lib/firebase/client';
import type { ProjectSite, SitePublishState } from '../projects/types';
import type { SiteSource } from './siteRepository';
import { SiteRepository } from './siteRepository';
import { resolvePublishSnapshot } from './resolvePublishSnapshot';
import { normalizeSite } from './siteTemplates';

/** プロジェクト公開時にアカウント未公開だと投げるエラー（呼び出し側で識別表示）。 */
export const ACCOUNT_NOT_PUBLISHED = 'ACCOUNT_NOT_PUBLISHED';

export const PUBLIC_BASE = 'https://sekkeiya.web.app';

export const USERNAME_RE = /^[a-z0-9][a-z0-9-]{2,29}$/;

export function slugify(name: string, fallback: string): string {
  const base = (name || '').trim().toLowerCase().replace(/[^a-z0-9ぁ-んァ-ヶ一-龠]+/g, '-').replace(/^-+|-+$/g, '');
  return base || fallback;
}

export function publicUrl(slug: string): string {
  return `${PUBLIC_BASE}/${slug}`;
}

/** ユーザー名を取得（未設定なら null）。 */
export async function getUsername(uid: string): Promise<string | null> {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? ((snap.data() as any).username ?? null) : null;
  } catch { return null; }
}

/** ユーザー名を確保（形式・重複チェック）。 */
export async function claimUsername(uid: string, username: string): Promise<{ ok: boolean; error?: string }> {
  const u = username.trim().toLowerCase();
  if (!USERNAME_RE.test(u)) return { ok: false, error: '3〜30文字の半角英数字・ハイフン（先頭は英数字）で入力してください。' };
  try {
    const ref = doc(db, 'usernames', u);
    const snap = await getDoc(ref);
    if (snap.exists() && (snap.data() as any).uid !== uid) return { ok: false, error: 'このユーザー名はすでに使われています。' };
    await setDoc(ref, { uid, claimedAt: new Date().toISOString() });
    await setDoc(doc(db, 'users', uid), { username: u }, { merge: true });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: `確保に失敗しました: ${e?.message ?? e}` };
  }
}

/** プロジェクトサイトの URL スラッグ（ユーザー内で一意）。 */
async function ensureProjectSlug(ownerUid: string, projectId: string, projectName: string): Promise<string> {
  const base = slugify(projectName, projectId.slice(0, 6));
  try {
    const snap = await getDocs(query(collection(db, 'publishedSites'), where('ownerUid', '==', ownerUid), where('kind', '==', 'project')));
    const taken = new Set<string>();
    snap.docs.forEach(d => { const x = d.data() as any; if (x.projectId !== projectId && x.projectSlug) taken.add(x.projectSlug); });
    if (!taken.has(base)) return base;
    for (let i = 2; i < 100; i++) { const c = `${base}-${i}`; if (!taken.has(c)) return c; }
  } catch { /* fall through */ }
  return base;
}

const accountDocId = (username: string) => `u__${username}`;
const projectDocId = (username: string, projectId: string) => `p__${username}__${projectId}`;

/** アカウントサイトが公開済みか（publishedSites/u__{username} の有無）。 */
export async function isAccountPublished(username: string | null | undefined): Promise<boolean> {
  if (!username) return false;
  try { return (await getDoc(doc(db, 'publishedSites', accountDocId(username)))).exists(); }
  catch { return false; }
}

/** アカウントサイト本体（users/{uid}/site/main）を読み込む。 */
async function loadAccountSite(ownerUid: string): Promise<ProjectSite | null> {
  try {
    const s = await getDoc(doc(db, 'users', ownerUid, 'site', 'main'));
    return s.exists() ? normalizeSite(s.data() as ProjectSite) : null;
  } catch { return null; }
}

/**
 * 公開済みアカウントサイトのスナップショットを最新状態で再生成して書き直す。
 * プロジェクトの公開/公開停止後に呼び、Works 一覧（resolvedWorks）と公開数を反映する。
 */
async function refreshPublishedAccount(ownerUid: string, username: string, projects: any[]): Promise<void> {
  // アカウントサイトが非公開/未公開（公開コピーなし）の時は再生成しない（勝手に復活させない）。
  if (!(await isAccountPublished(username))) return;
  const acc = await loadAccountSite(ownerUid);
  if (!acc) return;
  const resolved = await resolvePublishSnapshot(acc, ownerUid, projects);
  const now = new Date().toISOString();
  const publish: SitePublishState = {
    status: 'published', slug: `@${username}`, visibility: 'public',
    publishedAt: acc.publish?.publishedAt ?? now, lastDeployId: now,
  };
  await setDoc(doc(db, 'publishedSites', accountDocId(username)), {
    kind: 'account', ownerUid, username, projectId: null, projectSlug: null, slug: `@${username}`,
    site: { ...resolved, publish }, publishedAt: publish.publishedAt, updatedAt: now,
  }, { merge: true });
}

/**
 * サイトを公開。publishedSites に公開コピーを書き、新しい publish 状態を返す。
 * 返した publish はストア（applyPublishState）で元サイトに保存する。
 */
export async function publishSite(args: {
  source: SiteSource;
  ownerUid: string;
  username: string;
  site: ProjectSite;
  projectName?: string;
  projects?: any[]; // アカウント再生成用（プロジェクト公開時に Works を更新するため）
}): Promise<{ slug: string; url: string; publish: SitePublishState }> {
  const { source, ownerUid, username, site, projectName, projects } = args;
  const now = new Date().toISOString();

  let slug: string;
  let docId: string;
  let projectSlug: string | undefined;
  if (source.kind === 'account') {
    slug = `@${username}`;
    docId = accountDocId(username);
  } else {
    // 前提条件：アカウントサイトが公開済みでなければプロジェクトサイトは公開できない。
    if (!(await isAccountPublished(username))) throw new Error(ACCOUNT_NOT_PUBLISHED);
    projectSlug = await ensureProjectSlug(ownerUid, source.id, projectName || source.id);
    slug = `@${username}/${projectSlug}`;
    docId = projectDocId(username, source.id);
  }

  const publish: SitePublishState = { status: 'published', slug, visibility: 'public', publishedAt: now, lastDeployId: now };

  await setDoc(doc(db, 'publishedSites', docId), {
    kind: source.kind,
    ownerUid,
    username,
    projectId: source.kind === 'project' ? source.id : null,
    projectSlug: projectSlug ?? null,
    slug,
    site: { ...site, publish },
    publishedAt: now,
    updatedAt: now,
  }, { merge: true });

  // プロジェクト公開後は、公開済みアカウントサイトの Works 一覧を最新化（再公開不要で反映）。
  if (source.kind === 'project') {
    await refreshPublishedAccount(ownerUid, username, projects ?? []);
  }

  // アカウント公開（復帰）時は、非公開カスケードで隠れていたプロジェクトサイトを復元し、
  // 復元があれば Works のリンクを最新スラッグで再生成する。
  if (source.kind === 'account') {
    const restored = await restoreProjectSites(ownerUid, username, projects ?? []);
    if (restored) await refreshPublishedAccount(ownerUid, username, projects ?? []);
  }

  return { slug, url: publicUrl(slug), publish };
}

/**
 * このユーザーの全プロジェクトサイトの公開コピーを削除する（アカウント非公開/停止時のカスケード）。
 * 各プロジェクトのローカル publish 状態は変更しない＝アカウント公開復帰時に restoreProjectSites で自動復元できる。
 */
async function hideAllProjectSites(username: string): Promise<void> {
  try {
    const snap = await getDocs(query(
      collection(db, 'publishedSites'),
      where('username', '==', username),
      where('kind', '==', 'project'),
    ));
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref).catch(() => { /* noop */ })));
  } catch { /* noop */ }
}

/**
 * 公開コピーが消えているが、ローカル publish 状態が「公開（public）」のままのプロジェクトサイトを再公開する。
 * アカウントサイトの公開復帰時に呼ぶ。個別に非公開へ切り替えたプロジェクト（visibility: 'private'）は復元しない。
 * 1 件以上復元したら true（呼び出し側でアカウントの Works を最新化する）。
 */
async function restoreProjectSites(ownerUid: string, username: string, projects: any[]): Promise<boolean> {
  let existing: Set<string>;
  try {
    const snap = await getDocs(query(
      collection(db, 'publishedSites'),
      where('ownerUid', '==', ownerUid),
      where('kind', '==', 'project'),
    ));
    existing = new Set(snap.docs.map(d => (d.data() as any).projectId).filter(Boolean));
  } catch { return false; }

  let restored = false;
  for (const p of projects) {
    if (!p?.id || existing.has(p.id)) continue;
    let site: ProjectSite | null = null;
    try { site = await SiteRepository.get({ kind: 'project', id: p.id }); } catch { continue; }
    if (!site || site.publish?.status !== 'published' || site.publish?.visibility !== 'public') continue;

    // 以前の URL を優先して維持（'@user/xxx' の末尾）。無ければ名前から再計算。
    const savedSlug = (site.publish.slug || '').split('/')[1];
    const projectSlug = savedSlug || await ensureProjectSlug(ownerUid, p.id, p.name || p.id);
    const slug = `@${username}/${projectSlug}`;
    const now = new Date().toISOString();
    const publish: SitePublishState = {
      status: 'published', slug, visibility: 'public',
      publishedAt: site.publish.publishedAt ?? now, lastDeployId: now,
    };
    const resolved = await resolvePublishSnapshot(site, ownerUid, projects);
    await setDoc(doc(db, 'publishedSites', projectDocId(username, p.id)), {
      kind: 'project', ownerUid, username, projectId: p.id, projectSlug, slug,
      site: { ...resolved, publish }, publishedAt: publish.publishedAt, updatedAt: now,
    }, { merge: true });
    restored = true;
  }
  return restored;
}

/**
 * 公開中サイトを非公開にする（公開コピーを削除、URL 設定は保持）。
 * 「公開を停止」と違い slug / publishedAt を保持するため、「公開に戻す」（publishSite）で同じ URL に復帰できる。
 * 公開に戻す時は通常の publishSite を呼べばよい（slug は projectName から決定的に再計算される）。
 */
export async function setSitePrivate(
  source: SiteSource,
  username: string,
  opts: { ownerUid: string; current: SitePublishState; projects?: any[] },
): Promise<SitePublishState> {
  const docId = source.kind === 'account' ? accountDocId(username) : projectDocId(username, source.id);
  try { await deleteDoc(doc(db, 'publishedSites', docId)); } catch { /* noop */ }
  if (source.kind === 'project') {
    // プロジェクトを非公開にしたら、公開済みアカウントサイトの Works からリンクを外す。
    await refreshPublishedAccount(opts.ownerUid, username, opts.projects ?? []);
  } else {
    // アカウントを非公開にしたら、配下のプロジェクトサイトも閲覧不可にする（カスケード）。
    // 各プロジェクトのローカル設定は保持され、アカウントの公開復帰時に自動で復元される。
    await hideAllProjectSites(username);
  }
  return { ...opts.current, visibility: 'private' };
}

/** 公開を停止（公開コピーを削除）。プロジェクト停止時はアカウントの Works も最新化。 */
export async function unpublishSite(
  source: SiteSource,
  username: string,
  opts?: { ownerUid?: string; projects?: any[] },
): Promise<SitePublishState> {
  const docId = source.kind === 'account' ? accountDocId(username) : projectDocId(username, source.id);
  try { await deleteDoc(doc(db, 'publishedSites', docId)); } catch { /* noop */ }
  // プロジェクト公開停止後、公開済みアカウントサイトの Works からリンクを外す。
  if (source.kind === 'project' && opts?.ownerUid) {
    await refreshPublishedAccount(opts.ownerUid, username, opts.projects ?? []);
  }
  // アカウント公開停止時は、配下のプロジェクトサイトも閲覧不可にする（カスケード）。
  if (source.kind === 'account') {
    await hideAllProjectSites(username);
  }
  return { status: 'draft', slug: '', visibility: 'private', publishedAt: null, lastDeployId: null };
}

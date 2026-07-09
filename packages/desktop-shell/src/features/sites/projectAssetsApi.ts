// そのプロジェクト「自身」の成果物を子アプリ横断で集約する（公開・非公開を問わない）。
// 横断 Gallery（public のみ・全プロジェクト）とは別物。SEKKEIYA Chat の自動アセットマッピング源。
// ※ 全ユーザー公開フィード（Gallery）は参照しない（他ユーザーの成果物を自動挿入しないため）。
// 仕様: docs/10_sekkeiya_chat_spec.md §4.4 GALLERY_QUERY

import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase/client';
import { WorkFileRepository } from '../projects/workFileRepository';
import type {
  SiteAssetKind, SiteAssetRef, SiteAssetSourceApp, SiteSectionType,
} from '../projects/types';

export interface ProjectAssetItem {
  ref: SiteAssetRef;
  sectionType: SiteSectionType;
}

function mkRef(
  sourceApp: SiteAssetSourceApp, docId: string, kind: SiteAssetKind,
  title?: string, thumbnailUrl?: string | null,
): SiteAssetRef {
  return { id: `${sourceApp}:${docId}`, sourceApp, assetId: docId, kind, title, thumbnailUrl: thumbnailUrl ?? null };
}

// appScope → 既定のセクション割り当て（S.Image は中で動画/静止画を分岐）
const WORKFILE_ROUTING: Record<string, { sectionType: SiteSectionType; kind: SiteAssetKind }> = {
  '3dsp': { sectionType: 'presentation', kind: 'slidedeck' },
  '3dsd': { sectionType: 'diagram', kind: 'image' },
  '3dsr': { sectionType: 'drawing', kind: 'image' },
  '3dsf': { sectionType: 'portfolio', kind: 'pdf' },
  '3dsc': { sectionType: 'gallery', kind: 'image' },
};

/**
 * プロジェクト配下の素材を集約する。
 * - workFiles（appScope 別）: presentation / diagram / drawing / portfolio / furniture / image
 * - layouts（各 workspace の plan サムネ）: layout レンダー代表画像
 */
export async function listProjectAssets(projectId: string): Promise<ProjectAssetItem[]> {
  const out: ProjectAssetItem[] = [];

  // 1) workFiles
  try {
    const files = await WorkFileRepository.getWorkFiles(projectId);
    for (const f of files) {
      const x = f as any;
      if (x.status === 'archived' || x.isArchived) continue;
      const scope = (f.appScope || '').toLowerCase();

      if (scope === '3dsi') {
        if (f.type && f.type !== 'image-file') continue; // image-set（フォルダ）は除外
        const isVideo = x.mediaType === 'video';
        const thumb = f.thumbnailUrl ?? x.downloadUrl ?? null;
        out.push({
          ref: mkRef('3dsi', f.id, isVideo ? 'video' : 'image', f.name, thumb),
          sectionType: isVideo ? 'walkthrough' : 'gallery',
        });
      } else if (WORKFILE_ROUTING[scope]) {
        const r = WORKFILE_ROUTING[scope];
        out.push({
          ref: mkRef(scope as SiteAssetSourceApp, f.id, r.kind, f.name, f.thumbnailUrl ?? null),
          sectionType: r.sectionType,
        });
      }
    }
  } catch (e) {
    console.warn('[projectAssets] workFiles failed', e);
  }

  // 2) layouts（plan の代表サムネ）
  try {
    const wsSnap = await getDocs(collection(db, 'projects', projectId, 'workspaces'));
    for (const ws of wsSnap.docs) {
      let plansSnap;
      try {
        plansSnap = await getDocs(collection(db, 'projects', projectId, 'workspaces', ws.id, 'layouts'));
      } catch { continue; }
      plansSnap.docs.forEach(p => {
        const x = p.data() as any;
        if (!x.thumbnailUrl) return;
        out.push({
          ref: mkRef('3dsl', p.id, 'render', x.name || 'レイアウト', x.thumbnailUrl),
          sectionType: 'layout',
        });
      });
    }
  } catch (e) {
    console.warn('[projectAssets] layouts failed', e);
  }

  // 3) AI Drive プロジェクトアセット（projects/{id}/assets）。
  //    AI Drive でこのプロジェクトに紐付けて保存した画像・動画・ファイル。
  //    ※ /assets グローバルコレクション（全ユーザー公開フィード）は参照しない。
  try {
    const driveSnap = await getDocs(collection(db, 'projects', projectId, 'assets'));
    driveSnap.docs.forEach(d => {
      const x = d.data() as any;
      if (x.isDeleted) return;
      const thumb = x.thumbnailUrl ?? x.storageUrl ?? x.imageUrl ?? null;
      if (!thumb) return; // サムネ無しは除外（表示できない）
      const isVideo = x.type === 'video' || x.mediaType === 'video';
      out.push({
        ref: mkRef('3dsi', d.id, isVideo ? 'video' : 'image', x.name || 'AI Drive', thumb),
        sectionType: isVideo ? 'walkthrough' : 'gallery',
      });
    });
  } catch (e) {
    console.warn('[projectAssets] AI Drive assets failed', e);
  }

  return out;
}

/**
 * プロジェクトの S.Layout（3DSL）レンダー代表画像 URL 一覧を取得する。
 * 各 workspace の layouts プランの thumbnailUrl（＝hero レンダー）を集める軽量クエリ。
 * ヒーローの「レイアウト没入」演出で使用。
 */
export async function getProjectLayoutRenders(projectId: string): Promise<string[]> {
  const urls: string[] = [];
  try {
    const wsSnap = await getDocs(collection(db, 'projects', projectId, 'workspaces'));
    for (const ws of wsSnap.docs) {
      let plansSnap;
      try {
        plansSnap = await getDocs(collection(db, 'projects', projectId, 'workspaces', ws.id, 'layouts'));
      } catch { continue; }
      plansSnap.docs.forEach(p => {
        const x = p.data() as any;
        if (x.thumbnailUrl) urls.push(x.thumbnailUrl as string);
      });
    }
  } catch (e) {
    console.warn('[layoutRenders] failed', e);
  }
  return urls;
}

import { create } from 'zustand';
import { useAuthStore } from './useAuthStore';
import { useAppStore } from './useAppStore';
import { createProject } from '../features/projects/api/createProject';
import { fetchUserProjects } from '../features/projects/api/fetchProjects';
import { useProjectSiteStore } from './useProjectSiteStore';
import { buildSiteSnapshot } from '../features/sites/siteSnapshot';
import type { SiteSection, SiteSectionType } from '../features/projects/types';

export type ActionType =
  | 'CREATE_PROJECT' | 'OPEN_WORKSPACE' | 'OPEN_CHAT_PANEL' | 'TRIGGER_CANVAS' | 'RESPOND_CHAT' | 'SEARCH_DSS'
  // --- SEKKEIYA Chat: サイト編集ブリッジ（docs/10 Phase A）---
  | 'SECTION_ADD' | 'SECTION_UPDATE' | 'SITE_SNAPSHOT'
  // --- S.Movie v0: 自動編集エンジン（docs/14 Step 2）---
  | 'MOVIE_ADD_CUT' | 'MOVIE_REORDER' | 'MOVIE_SET_TRANSITION' | 'MOVIE_SET_BGM' | 'MOVIE_EXPORT'
  | 'NONE';

export interface ActionPayloadMap {
  CREATE_PROJECT: { projectName: string };
  OPEN_WORKSPACE: { target: '3dss' | '3dsl' | '3dsp' | 'canvas', projectId?: string, workspaceId?: string };
  OPEN_CHAT_PANEL: {};
  TRIGGER_CANVAS: { prompt: string };
  RESPOND_CHAT: { message: string };
  SEARCH_DSS: { query?: string, category?: string, subCategory?: string, tags?: string };
  // アクティブページに section を追加（任意で title/body/variant も同時設定）
  SECTION_ADD: { type: SiteSectionType, title?: string, body?: string, variant?: SiteSection['variant'] };
  // section を更新。sectionId 明示 > targetType の最後の section > 選択中 section の順で対象解決
  SECTION_UPDATE: { sectionId?: string, targetType?: SiteSectionType, patch: Partial<SiteSection> };
  // 現在のサイト構成を返す read-only ツール（戻り値はループ未対応の Phase A では log のみ）
  SITE_SNAPSHOT: {};
  // S.Movie: ローカル mp4 をシーケンスに追加（v0。Step 3 で cameraPathId 参照に拡張）
  MOVIE_ADD_CUT: { path: string, label?: string, position?: number, trimInSec?: number, trimOutSec?: number };
  // クリップ id の並び順を指定（部分指定可。指定外は末尾に残る）
  MOVIE_REORDER: { order: string[] };
  MOVIE_SET_TRANSITION: { clipId: string, type: 'cut' | 'xfade' | 'fade', durationSec?: number };
  MOVIE_SET_BGM: { path: string | null, volume?: number };
  // シーケンスを mp4 へ書き出し（outputPath 省略時は LocalAssets/Movies/）
  MOVIE_EXPORT: { outputPath?: string, aspect?: '16:9' | '9:16', titleText?: string };
  NONE: {};
}

/** SECTION_UPDATE の対象 section id を解決する（明示 > 種別の末尾 > 選択中）。 */
function resolveTargetSectionId(payload: ActionPayloadMap['SECTION_UPDATE']): string | null {
  const { site, activePageId, selectedSectionId } = useProjectSiteStore.getState();
  if (payload.sectionId) return payload.sectionId;
  const page = site?.pages.find(p => p.id === activePageId) ?? site?.pages[0];
  if (payload.targetType && page) {
    const matches = page.sections.filter(s => s.type === payload.targetType);
    if (matches.length) return matches[matches.length - 1].id;
  }
  return selectedSectionId;
}

interface ActionRegistryState {
  dispatch: <T extends ActionType>(actionType: T, payload: ActionPayloadMap[T]) => Promise<void>;
}

export const useActionRegistry = create<ActionRegistryState>(() => ({
  dispatch: async (actionType, payload) => {
    switch (actionType) {
      case 'CREATE_PROJECT': {
        const { projectName } = payload as ActionPayloadMap['CREATE_PROJECT'];
        const { currentUser } = useAuthStore.getState();
        if (!currentUser) break;

        try {
          const newProject = await createProject({
            userId: currentUser.uid,
            ownerName: currentUser.email || 'User',
            projectName,
          });

          // Update global state
          const { projects, setProjects, setActiveProjectId } = useAppStore.getState();
          setProjects([newProject as any, ...projects]);
          setActiveProjectId(newProject.id);

          // Re-fetch in background
          const fetchedProjects = await fetchUserProjects(currentUser.uid);
          setProjects(fetchedProjects);
        } catch (error) {
          console.error('[ActionRegistry] Failed to create project:', error);
        }
        break;
      }
      
      case 'OPEN_WORKSPACE': {
        const { target, projectId, workspaceId } = payload as ActionPayloadMap['OPEN_WORKSPACE'];
        const appStore = useAppStore.getState();
        
        let targetId = workspaceId;
        if (!targetId) {
           const scopeToId: Record<string, string> = { '3dss': 'models', '3dsl': 'layout', '3dsp': 'presents', 'canvas': 'canvas' };
           targetId = scopeToId[target] || target;
        }

        if (projectId) {
           appStore.setActiveProjectId(projectId);
        }
        
        if (appStore.currentMainView !== 'workspace') {
           appStore.setCurrentMainView('workspace');
        }

        appStore.setActiveWorkspaceId(targetId);
        break;
      }
      
      case 'OPEN_CHAT_PANEL': {
        useAppStore.getState().setAIChatOpen(true);
        break;
      }
      
      case 'TRIGGER_CANVAS': {
        const { prompt } = payload as ActionPayloadMap['TRIGGER_CANVAS'];
        useAppStore.getState().triggerCanvasAiPrompt(prompt);
        break;
      }
      
      case 'RESPOND_CHAT': {
        // Simple chat response Action. 
        // We're mostly using the state history in the Orchestrator, but we could hook TTS or UI focus here.
        break;
      }
      
      case 'SEARCH_DSS': {
        const { query, category, subCategory, tags } = payload as ActionPayloadMap['SEARCH_DSS'];
        const appStore = useAppStore.getState();
        
        if (appStore.activeWorkspaceId !== 'models') {
          appStore.setCurrentMainView('workspace');
          appStore.setActiveWorkspaceId('models');
        }

        appStore.setDssSearchFilters({
           query: query || '',
           category: category || 'ALL',
           subCategory: subCategory || 'ALL',
           tags: tags || ''
        });
        break;
      }
      
      case 'SECTION_ADD': {
        const { type, title, body, variant } = payload as ActionPayloadMap['SECTION_ADD'];
        const siteStore = useProjectSiteStore.getState();
        if (!siteStore.site) {
          console.warn('[ActionRegistry] SECTION_ADD: ProjectSite が未作成のため追加できません。');
          break;
        }
        siteStore.addSection(type);
        // addSection は新 section を selectedSectionId に設定する。続けて初期内容を流し込む。
        const newId = useProjectSiteStore.getState().selectedSectionId;
        const patch: Partial<SiteSection> = {};
        if (title) patch.title = title;
        if (body) patch.body = body;
        if (variant) patch.variant = variant;
        if (newId && Object.keys(patch).length) {
          useProjectSiteStore.getState().updateSection(newId, patch);
        }
        await useProjectSiteStore.getState().save();
        break;
      }

      case 'SECTION_UPDATE': {
        const p = payload as ActionPayloadMap['SECTION_UPDATE'];
        const siteStore = useProjectSiteStore.getState();
        if (!siteStore.site) {
          console.warn('[ActionRegistry] SECTION_UPDATE: ProjectSite が未作成です。');
          break;
        }
        const targetId = resolveTargetSectionId(p);
        if (!targetId) {
          console.warn('[ActionRegistry] SECTION_UPDATE: 対象 section を特定できませんでした。');
          break;
        }
        siteStore.updateSection(targetId, p.patch);
        siteStore.selectSection(targetId);
        await useProjectSiteStore.getState().save();
        break;
      }

      case 'SITE_SNAPSHOT': {
        // Phase A: ループ未対応のため read 結果は log のみ（context 注入は useCoreOrchestrator 側で実施）。
        const snapshot = buildSiteSnapshot();
        console.log('[ActionRegistry] SITE_SNAPSHOT', snapshot);
        break;
      }

      case 'MOVIE_ADD_CUT': {
        const { path, label, position, trimInSec, trimOutSec } = payload as ActionPayloadMap['MOVIE_ADD_CUT'];
        const { useDsmStore } = await import('../features/dsm/store/useDsmStore');
        const trim = trimInSec != null && trimOutSec != null
          ? { inSec: trimInSec, outSec: trimOutSec }
          : undefined;
        useDsmStore.getState().addClip({ path, label, trim }, position);
        break;
      }

      case 'MOVIE_REORDER': {
        const { order } = payload as ActionPayloadMap['MOVIE_REORDER'];
        const { useDsmStore } = await import('../features/dsm/store/useDsmStore');
        useDsmStore.getState().reorderClips(order);
        break;
      }

      case 'MOVIE_SET_TRANSITION': {
        const { clipId, type, durationSec } = payload as ActionPayloadMap['MOVIE_SET_TRANSITION'];
        const { useDsmStore } = await import('../features/dsm/store/useDsmStore');
        useDsmStore.getState().setTransition(clipId, { type, durationSec: durationSec ?? 1.0 });
        break;
      }

      case 'MOVIE_SET_BGM': {
        const { path, volume } = payload as ActionPayloadMap['MOVIE_SET_BGM'];
        const { useDsmStore } = await import('../features/dsm/store/useDsmStore');
        useDsmStore.getState().setBgm(path ? { path, volume } : null);
        break;
      }

      case 'MOVIE_EXPORT': {
        const { outputPath, aspect, titleText } = payload as ActionPayloadMap['MOVIE_EXPORT'];
        const { useDsmStore } = await import('../features/dsm/store/useDsmStore');
        const dsm = useDsmStore.getState();
        if (aspect) dsm.setAspect(aspect);
        if (titleText) dsm.addOverlay({ type: 'title', text: titleText, atSec: 0, durationSec: 3 });
        try {
          const out = await useDsmStore.getState().exportDraft(outputPath);
          console.log('[ActionRegistry] MOVIE_EXPORT 完了:', out);
        } catch (error) {
          console.error('[ActionRegistry] MOVIE_EXPORT 失敗:', error);
        }
        break;
      }

      case 'NONE':
      default:
        break;
    }
  }
}));

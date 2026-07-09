import { create } from 'zustand';
import { useAuthStore } from './useAuthStore';
import { useAppStore } from './useAppStore';
import { createProject } from '../features/projects/api/createProject';
import { fetchUserProjects } from '../features/projects/api/fetchProjects';

export type ActionType = 'CREATE_PROJECT' | 'OPEN_WORKSPACE' | 'OPEN_CHAT_PANEL' | 'TRIGGER_CANVAS' | 'RESPOND_CHAT' | 'SEARCH_DSS' | 'NONE';

export interface ActionPayloadMap {
  CREATE_PROJECT: { projectName: string };
  OPEN_WORKSPACE: { target: '3dss' | '3dsl' | '3dsp' | 'canvas', projectId?: string, workspaceId?: string };
  OPEN_CHAT_PANEL: {};
  TRIGGER_CANVAS: { prompt: string };
  RESPOND_CHAT: { message: string };
  SEARCH_DSS: { query?: string, category?: string, subCategory?: string, tags?: string };
  NONE: {};
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
      
      case 'NONE':
      default:
        break;
    }
  }
}));

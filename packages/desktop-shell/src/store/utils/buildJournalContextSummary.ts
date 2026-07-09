import { useJournalAiStore } from '../useJournalAiStore';
import { useAppStore } from '../useAppStore';
import { useWorkFileStore } from '../useWorkFileStore';
import { useJournalStore } from '../useJournalStore';
import { getLocalKnowledge } from '../../features/dsk/api/knowledgeApi';

let summaryCache: { key: string; summary: string; timestamp: number } | null = null;
const CACHE_TTL_MS = 30000; // 30 seconds

/**
 * Builds a token-efficient markdown summary of the current project context based on AI settings.
 * Uses a "Light-to-Deep" strategy to limit context length.
 * Caches the result for 30 seconds per project & scope configuration.
 */
export async function buildJournalContextSummary(forceRefresh = false): Promise<string> {
  try {
    const { contextLevel, watchedScopes } = useJournalAiStore.getState();
    
    if (contextLevel === 'off') return '';

    const { getActiveProject } = useAppStore.getState();
    const activeProject = getActiveProject();

    if (!activeProject) return '';

    const appStore = useAppStore.getState();
    const activeWorkspaceId = appStore.activeWorkspaceId || 'none';
    const selection = activeWorkspaceId !== 'none' ? appStore.panelSelections[activeWorkspaceId] : null;
    const selectionId = selection ? (selection.id || selection.name || 'selected') : 'none';

    const journalStore = useJournalStore.getState();
    const selectedEntryId = journalStore.selectedEntryId;
    const selectedEntry = selectedEntryId ? journalStore.entries.find(e => e.id === selectedEntryId) : null;

    const cacheKey = `${activeProject.id}_${contextLevel}_${[...watchedScopes].sort().join(',')}_${activeWorkspaceId}_${selectionId}_${selectedEntryId || 'none'}`;

    if (!forceRefresh && summaryCache && summaryCache.key === cacheKey && (Date.now() - summaryCache.timestamp < CACHE_TTL_MS)) {
      return summaryCache.summary;
    }

    const sections: string[] = [];
    sections.push(`### [Project & Workspace Context]`);
    sections.push(`Project Name: ${activeProject.name}`);

    const activeWorkspace = appStore.getActiveWorkspace();

    if (activeWorkspace) {
      sections.push(`Current Active Workspace: ${activeWorkspace.name} (${activeWorkspace.workspaceType})`);
      
      const selection = appStore.panelSelections[activeWorkspace.workspaceId];
      if (selection) {
        sections.push(`Currently Selected Item: ${selection.name || selection.title || JSON.stringify(selection)}`);
      }
    } else {
      sections.push(`Current Main View: ${appStore.currentMainView}`);
    }

    if (selectedEntry) {
      sections.push(`\n[Currently Opened Journal Entry (User is viewing/editing this)]\nTitle: ${selectedEntry.title || 'Untitled'}\nContent:\n${selectedEntry.content}`);
    }

    // 1. Requirements
    if (watchedScopes.includes('requirements')) {
      sections.push(`\n[Scope: requirements]`);
      sections.push(`- ${activeProject.requirements || 'No specific requirements documented yet.'}`);
    }

    // 2. WorkFiles
    if (watchedScopes.includes('workfiles')) {
      sections.push(`\n[Scope: workfiles]`);
      
      const bindings = useWorkFileStore.getState().bindings;
      // Extract bound files since they represent what the user is actively working with locally.
      // In the future, this can be expanded to fetch WorkFile metadata from WorkFileRepository.
      const boundFiles = Object.values(bindings);
      
      if (boundFiles.length > 0) {
        boundFiles.forEach(b => {
          // We only have the workFileId and localPath in bindings. 
          // We can extract a pseudo-filename from the localPath.
          const fileName = b.localPath ? b.localPath.split(/[\\/]/).pop() : b.workFileId;
          const status = b.existsLocally ? 'LocalReady: true' : 'LocalReady: false';
          sections.push(`- ${fileName} - ${status}`);
        });
      } else {
        sections.push(`- No local work files currently bound or active.`);
      }
    }

    // 3. Journal
    if (watchedScopes.includes('journal')) {
      sections.push(`\n[Scope: journal]`);
      const recentEntries = useJournalStore.getState().entries
        .filter(e => !e.isDeleted && e.content.trim() !== '')
        .slice(0, 5);
      if (recentEntries.length > 0) {
        recentEntries.forEach(entry => {
          const date = new Date(entry.createdAt).toLocaleDateString();
          // Provide a concise snippet of the markdown body (e.g. up to 100 chars)
          const contentSnippet = entry.content.length > 100 ? entry.content.substring(0, 100) + '...' : entry.content;
          sections.push(`- [${date}] ${contentSnippet.replace(/\n/g, ' ')}`);
        });
      } else {
        sections.push(`- No recent journal entries found.`);
      }
    }

    // 4. Models
    if (watchedScopes.includes('models')) {
      sections.push(`\n[Scope: models]`);
      sections.push(`- Currently loaded models metadata is limited. Expand this scope if user asks specifically about 3D assets.`);
    }

    // 5. Layout
    if (watchedScopes.includes('layout')) {
      sections.push(`\n[Scope: layout]`);
      sections.push(`- Layout context: Active layouts exist in the 3DSL workspace. Ask user for layout details if needed.`);
    }

    // 6. Presents
    if (watchedScopes.includes('presents')) {
      sections.push(`\n[Scope: presents]`);
      sections.push(`- Presentation context active.`);
    }

    // 7. Library (S.Library / 3DSK) — このプロジェクトに紐付いた知識資源の要約のみを注入する。
    //    実体（PDF / HTML）は渡さず summary + keyPoints だけ折り込むことでトークン効率と著作権配慮を両立する。
    if (watchedScopes.includes('library')) {
      sections.push(`\n[Scope: library (S.Library / 知識資源)]`);
      try {
        const all = await getLocalKnowledge();
        const linked = all.filter(e => Array.isArray(e.linkedProjectIds) && e.linkedProjectIds.includes(activeProject.id));
        if (linked.length > 0) {
          linked.slice(0, 20).forEach(e => {
            const head = e.summary
              ? (e.summary.length > 180 ? e.summary.substring(0, 180) + '...' : e.summary)
              : '(未要約)';
            sections.push(`- [${e.category}] ${e.title}: ${head.replace(/\n/g, ' ')}`);
            (e.keyPoints || []).slice(0, 3).forEach(kp => sections.push(`    • ${kp.replace(/\n/g, ' ')}`));
          });
        } else {
          sections.push(`- このプロジェクトに紐付いた知識資源はまだありません。`);
        }
      } catch (e) {
        sections.push(`- 知識資源の読み込みに失敗しました（ローカル専用のため Desktop でのみ参照可能）。`);
      }
    }

    const result = sections.join('\n');
    
    summaryCache = {
      key: cacheKey,
      summary: result,
      timestamp: Date.now()
    };

    return result;
  } catch (err) {
    console.warn("[Journal Context] Failed to build context summary:", err);
    return '';
  }
}

export function clearJournalContextCache() {
  summaryCache = null;
}

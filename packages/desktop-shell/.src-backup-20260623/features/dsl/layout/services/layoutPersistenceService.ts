import { join } from '@tauri-apps/api/path';
import { readTextFile, writeTextFile, mkdir, exists, stat } from '@tauri-apps/plugin-fs';
import { getDefaultBaseDirPath } from '@desktop/features/projects/utils/workFileFsHelpers';

export const layoutPersistenceService = {
  /**
   * Constructs the base directory for a specific 3DSL option
   */
  async getOptionDirPath(projectId: string, workspaceId: string, planId: string, optionId: string): Promise<string> {
    const baseDir = await getDefaultBaseDirPath(projectId);
    // e.g. Documents/SEKKEIYA/[projectId]/WorkFiles/3dsl_[workspaceId]/[planId]/[optionId]
    return await join(baseDir, `3dsl_${workspaceId}`, planId, optionId);
  },

  /**
   * Save layout draft locally
   */
  async saveLocalDraft(projectId: string, workspaceId: string, planId: string, optionId: string, content: any): Promise<void> {
    try {
      const dirPath = await this.getOptionDirPath(projectId, workspaceId, planId, optionId);
      
      if (!(await exists(dirPath))) {
        await mkdir(dirPath, { recursive: true });
      }
      
      const filePath = await join(dirPath, 'layout_draft.json');
      const jsonStr = JSON.stringify(content, null, 2);
      
      await writeTextFile(filePath, jsonStr);
    } catch (e) {
      console.error("[3DSL] Failed to save local draft", e);
    }
  },
  
  /**
   * Load layout draft locally
   */
  async loadLocalDraft(projectId: string, workspaceId: string, planId: string, optionId: string): Promise<{content: any, mtime: number} | null> {
    try {
      const dirPath = await this.getOptionDirPath(projectId, workspaceId, planId, optionId);
      const filePath = await join(dirPath, 'layout_draft.json');
      
      if (await exists(filePath)) {
        const metadata = await stat(filePath);
        const jsonStr = await readTextFile(filePath);
        // Fallback depending on Tauri stat format
        const mtime = metadata.mtime 
          ? (typeof metadata.mtime === 'number' ? metadata.mtime : (metadata.mtime as any).getTime() || Date.now()) 
          : Date.now();
          
        return { content: JSON.parse(jsonStr), mtime };
      }
    } catch (e) {
      console.error("[3DSL] Failed to parse local draft", e);
    }
    return null;
  }
};

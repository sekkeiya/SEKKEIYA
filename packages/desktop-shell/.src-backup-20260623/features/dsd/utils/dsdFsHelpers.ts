import { join } from '@tauri-apps/api/path';
import { readTextFile, writeTextFile, mkdir, exists, stat, remove } from '@tauri-apps/plugin-fs';
import { getDefaultBaseDirPath, sanitizeFileName } from '../../projects/utils/workFileFsHelpers';

/** S.Diagram のローカル下書き内容（useDsdStore.loadState 対象フィールドの集合）。 */
export type DsdDraftContent = Record<string, any>;

/** `{AI Drive}/Projects/{projectName}/WorkFiles/3DSD/{name}_{id8}.json` のパスを返す。 */
async function getDsdFilePath(
  projectId: string,
  projectName: string,
  diagramId: string,
  diagramName: string,
): Promise<string> {
  const baseDir = await getDefaultBaseDirPath(projectId, projectName);
  const dirPath = await join(baseDir, '3DSD');
  if (!(await exists(dirPath))) {
    await mkdir(dirPath, { recursive: true });
  }
  const safeName = sanitizeFileName(diagramName || 'untitled');
  return await join(dirPath, `${safeName}_${diagramId.slice(0, 8)}.json`);
}

export const dsdFsHelpers = {
  async saveLocalDraft(
    projectId: string,
    projectName: string,
    diagramId: string,
    diagramName: string,
    content: DsdDraftContent,
  ): Promise<void> {
    const filePath = await getDsdFilePath(projectId, projectName, diagramId, diagramName);
    await writeTextFile(filePath, JSON.stringify(content, null, 2));
  },

  async loadLocalDraft(
    projectId: string,
    projectName: string,
    diagramId: string,
    diagramName: string,
  ): Promise<{ content: DsdDraftContent; mtime: number } | null> {
    try {
      const filePath = await getDsdFilePath(projectId, projectName, diagramId, diagramName);
      if (!(await exists(filePath))) return null;
      const metadata = await stat(filePath);
      const jsonStr = await readTextFile(filePath);
      const mtime = metadata.mtime
        ? (typeof metadata.mtime === 'number' ? metadata.mtime : (metadata.mtime as Date).getTime() || Date.now())
        : Date.now();
      return { content: JSON.parse(jsonStr) as DsdDraftContent, mtime };
    } catch (e) {
      console.error('[DSD] Failed to load local draft', e);
      return null;
    }
  },

  async removeLocalDraft(
    projectId: string,
    projectName: string,
    diagramId: string,
    diagramName: string,
  ): Promise<void> {
    try {
      const filePath = await getDsdFilePath(projectId, projectName, diagramId, diagramName);
      if (await exists(filePath)) await remove(filePath);
    } catch (e) {
      console.warn('[DSD] Failed to remove local draft', e);
    }
  },
};

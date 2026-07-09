import { join } from '@tauri-apps/api/path';
import { readTextFile, writeTextFile, mkdir, exists, stat, remove } from '@tauri-apps/plugin-fs';
import { getDefaultBaseDirPath, sanitizeFileName } from '../../projects/utils/workFileFsHelpers';
import type { FurnitureComponent } from '../store/useDscStore';

/** S.Create のローカル下書き内容（造作家具）。 */
export interface DscDraftContent {
  furnitureName: string;
  components: FurnitureComponent[];
}

/** `{AI Drive}/Projects/{projectName}/WorkFiles/3DSC/{name}_{id8}.json` のパスを返す。 */
async function getDscFilePath(
  projectId: string,
  projectName: string,
  workFileId: string,
  workFileName: string,
): Promise<string> {
  const baseDir = await getDefaultBaseDirPath(projectId, projectName);
  const dirPath = await join(baseDir, '3DSC');
  if (!(await exists(dirPath))) {
    await mkdir(dirPath, { recursive: true });
  }
  const safeName = sanitizeFileName(workFileName || 'untitled');
  return await join(dirPath, `${safeName}_${workFileId.slice(0, 8)}.json`);
}

export const dscFsHelpers = {
  async saveLocalDraft(
    projectId: string,
    projectName: string,
    workFileId: string,
    workFileName: string,
    content: DscDraftContent,
  ): Promise<void> {
    const filePath = await getDscFilePath(projectId, projectName, workFileId, workFileName);
    await writeTextFile(filePath, JSON.stringify(content, null, 2));
  },

  async loadLocalDraft(
    projectId: string,
    projectName: string,
    workFileId: string,
    workFileName: string,
  ): Promise<{ content: DscDraftContent; mtime: number } | null> {
    try {
      const filePath = await getDscFilePath(projectId, projectName, workFileId, workFileName);
      if (!(await exists(filePath))) return null;
      const metadata = await stat(filePath);
      const jsonStr = await readTextFile(filePath);
      const mtime = metadata.mtime
        ? (typeof metadata.mtime === 'number' ? metadata.mtime : (metadata.mtime as Date).getTime() || Date.now())
        : Date.now();
      return { content: JSON.parse(jsonStr) as DscDraftContent, mtime };
    } catch (e) {
      console.error('[DSC] Failed to load local draft', e);
      return null;
    }
  },

  async removeLocalDraft(
    projectId: string,
    projectName: string,
    workFileId: string,
    workFileName: string,
  ): Promise<void> {
    try {
      const filePath = await getDscFilePath(projectId, projectName, workFileId, workFileName);
      if (await exists(filePath)) await remove(filePath);
    } catch (e) {
      console.warn('[DSC] Failed to remove local draft', e);
    }
  },
};

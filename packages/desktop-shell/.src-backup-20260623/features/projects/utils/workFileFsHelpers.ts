import { join, documentDir, basename } from '@tauri-apps/api/path';
import { writeFile, mkdir, readDir, copyFile, stat, rename, remove } from '@tauri-apps/plugin-fs';
import { invoke } from '@tauri-apps/api/core';

export interface LocalVersionInfo {
  name: string;
  path: string;
  createdAt: Date;
  size?: number; // file size in bytes
}

/**
 * Sanitizes a filename to ensure it is valid on Windows (and other OSes).
 * Replaces illegal characters with underscores.
 */
export function sanitizeFileName(name: string): string {
  // Strip invalid file characters: \ / : * ? " < > |
  return name.replace(/[\\/:*?"<>|]/g, '_').substring(0, 100);
}

/**
 * Returns the tool-type-specific subdirectory segment(s) within WorkFiles/.
 * e.g. toolType 'rhino' → ['BaseModels', 'Rhino']
 * Unknown / undefined → [] (directly in WorkFiles/)
 */
function getToolSubDirs(toolType?: string): string[] {
  switch (toolType) {
    case 'rhino': return ['BaseModels', 'Rhino'];
    default: return [];
  }
}

/**
 * Constructs the deterministic local directory path for a WorkFile's history.
 * Pattern: Documents/SEKKEIYA/[projectId]/WorkFiles/[subDirs/][workFileName]/
 * For Rhino files (toolType='rhino'): .../WorkFiles/BaseModels/Rhino/[workFileName]/
 */
export async function constructLocalDirPath(
  projectId: string,
  workFileId: string,
  projectName: string = 'UnnamedProject',
  workFileName: string = 'UnnamedWorkFile',
  toolType?: string
): Promise<string> {
  const safeWorkFileName = sanitizeFileName(workFileName);
  const subDirs = getToolSubDirs(toolType);

  if (typeof localStorage !== 'undefined') {
    const custom = localStorage.getItem(`sekkeiya_project_${projectId}_workfiles_dir`);
    if (custom) {
      return subDirs.length > 0
        ? await join(custom, ...subDirs, safeWorkFileName)
        : await join(custom, safeWorkFileName);
    }
  }

  const baseDir = await getDefaultBaseDirPath(projectId, projectName);
  return subDirs.length > 0
    ? await join(baseDir, ...subDirs, safeWorkFileName)
    : await join(baseDir, safeWorkFileName);
}

/**
 * Returns the default base directory path for a project's Work Files.
 */
export async function getDefaultBaseDirPath(projectId: string, projectName: string = 'UnnamedProject'): Promise<string> {
  const safeProjectName = sanitizeFileName(projectName);
  try {
    const aiDrivePath = await invoke<string>('setup_ai_drive');
    return await join(aiDrivePath, 'Projects', safeProjectName, 'WorkFiles');
  } catch (err) {
    console.warn("setup_ai_drive failed, falling back to Documents", err);
    return await getFallbackBaseDirPath(projectId);
  }
}

/**
 * Returns the legacy fallback directory in Documents.
 */
export async function getFallbackBaseDirPath(projectId: string): Promise<string> {
  const docsDir = await documentDir();
  return await join(docsDir, 'SEKKEIYA', projectId, 'WorkFiles');
}

export async function constructFallbackLocalDirPath(
  projectId: string,
  workFileId: string
): Promise<string> {
  const baseDir = await getFallbackBaseDirPath(projectId);
  return await join(baseDir, workFileId);
}

/**
 * Scans the local directory and returns a history of .3dm files sorted by creation time (descending - newest first).
 */
export async function getLocalVersions(dirPath: string): Promise<LocalVersionInfo[]> {
  try {
    const entries = await readDir(dirPath);
    const versions: LocalVersionInfo[] = [];

    for (const entry of entries) {
      if (entry.isFile && entry.name.toLowerCase().endsWith('.3dm')) {
        const fullPath = await join(dirPath, entry.name);
        const metadata = await stat(fullPath);
        
        versions.push({
          name: entry.name,
          path: fullPath,
          createdAt: metadata.mtime || metadata.atime || metadata.birthtime || new Date(),
          size: typeof metadata.size === 'number' ? metadata.size : undefined
        });
      }
    }

    // Sort descending (newest first)
    return versions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (err) {
    // Return empty array if directory doesn't exist yet
    return [];
  }
}

/**
 * Scans the local directory and returns a history of .3dm files.
 * Checks the primary directory, and if empty, falls back to the fallback directory.
 */
export async function getAllLocalVersions(
  projectId: string,
  workFileId: string,
  projectName: string = 'UnnamedProject',
  workFileName: string = 'UnnamedWorkFile',
  toolType?: string
): Promise<LocalVersionInfo[]> {
  const primaryDirPath = await constructLocalDirPath(projectId, workFileId, projectName, workFileName, toolType);
  let versions = await getLocalVersions(primaryDirPath);

  if (versions.length === 0) {
    const fallbackDirPath = await constructFallbackLocalDirPath(projectId, workFileId);
    versions = await getLocalVersions(fallbackDirPath);
  }

  return versions;
}

function formatDateForFilename(date: Date): string {
  const yyyy = date.getFullYear();
  const MM = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const HH = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${yyyy}${MM}${dd}_${HH}${mm}${ss}`;
}

/**
 * Duplicates the latest .3dm file into a new timestamped version.
 * Call this before launching Rhino to ensure a non-destructive history.
 */
export async function createNextLocalVersion(
  dirPath: string, 
  baseFileName: string = 'design',
  fallbackDirPath?: string
): Promise<string> {
  const safeBaseName = sanitizeFileName(baseFileName).replace(/\.3dm$/i, '');
  const now = new Date();
  const newFileName = `${formatDateForFilename(now)}_${safeBaseName}.3dm`;
  const newFilePath = await join(dirPath, newFileName);

  // Ensure directory exists
  try {
    await mkdir(dirPath, { recursive: true });
  } catch (err) {
    // Ignore if already exists
  }

  // Find the current latest file
  let versions = await getLocalVersions(dirPath);
  
  if (versions.length === 0 && fallbackDirPath) {
    versions = await getLocalVersions(fallbackDirPath);
  }
  
  if (versions.length > 0) {
    // Copy the latest version to the new timestamped file
    const latestPath = versions[0].path;
    console.log(`Duplicating ${latestPath} -> ${newFilePath}`);
    await copyFile(latestPath, newFilePath);
  }

  return newFilePath;
}

/**
 * Downloads a file from a public or signed URL to the specified local path via Tauri Fs.
 */
export async function downloadFileToLocal(url: string, localPath: string): Promise<void> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    await writeFile(localPath, new Uint8Array(arrayBuffer));
  } catch (err) {
    console.error("Failed downloading file to local FS:", err);
    throw err;
  }
}

/**
 * Renames a local directory.
 */
export async function renameLocalDirectory(oldPath: string, newPath: string): Promise<void> {
  try {
    await rename(oldPath, newPath);
  } catch (err) {
    console.error(`Failed to rename directory from ${oldPath} to ${newPath}:`, err);
    throw err;
  }
}

/**
 * Deletes a local directory recursively.
 */
export async function deleteLocalDirectory(dirPath: string): Promise<void> {
  try {
    await remove(dirPath, { recursive: true });
  } catch (err) {
    console.warn(`Failed to delete directory ${dirPath} (it might not exist):`, err);
  }
}

/**
 * Deletes a specific local file.
 */
export async function deleteLocalFile(filePath: string): Promise<void> {
  try {
    await remove(filePath);
  } catch (err) {
    console.warn(`Failed to delete file ${filePath} (it might not exist):`, err);
  }
}
/**
 * Renames a specific local file.
 */
export async function renameLocalFile(oldPath: string, newPath: string): Promise<void> {
  try {
    await rename(oldPath, newPath);
  } catch (err) {
    console.error(`Failed to rename file from ${oldPath} to ${newPath}:`, err);
    throw err;
  }
}


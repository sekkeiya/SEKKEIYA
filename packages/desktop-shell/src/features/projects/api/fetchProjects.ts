import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../../../lib/firebase/client';
import type { DesktopProject, FirestoreProjectDoc } from '../types';
import { convertFirestoreProjectToDesktopProject } from './projectAdapters';
// Note: Currently returns mock data safely until full integration
import { fetchWorkspaceItemsSummary } from './fetchWorkspaceItemsSummary';
import { resolveProjectWorkspaces } from './workspaceResolver';
import { WorkFileRepository } from '../workFileRepository';

export const fetchUserProjects = async (userId: string): Promise<DesktopProject[]> => {
  try {
    const q = query(
      collection(db, 'projects'),
      where('ownerId', '==', userId),
      limit(20)
    );
    
    const snapshot = await getDocs(q);
    const projects: DesktopProject[] = [];
    
    // Process sequentially for clarity; Promise.all could be used for parallelization later
    for (const doc of snapshot.docs) {
      const data = doc.data() as FirestoreProjectDoc;
      const project = convertFirestoreProjectToDesktopProject(doc.id, data);
      
      // Phase 2.3: Dynamically resolve workspaces based on items meta
      const summary = await fetchWorkspaceItemsSummary(doc.id);
      project.workspaces = resolveProjectWorkspaces(doc.id, data, summary);
      
      // Phase 26: Load real activities
      const activitiesResp = await WorkFileRepository.getActivities(doc.id);
      project.recentActivities = activitiesResp.map(act => ({
        id: act.id,
        type: 'editor',
        title: act.type === 'work_file_created' ? 'Rhino Started (WorkFile created)' : 'Work File Action',
        description: act.meta?.fileName ? `File: ${act.meta.fileName}` : 'Activity logged.',
        timestamp: new Date(act.createdAt).toLocaleString(),
        workFileId: act.targetType === 'workFile' ? act.targetId : undefined
      }));
      
      projects.push(project);
    }

    if (projects.length === 0) {
      console.warn("No projects found for user.");
      return [];
    }

    return projects;
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    return [];
  }
};

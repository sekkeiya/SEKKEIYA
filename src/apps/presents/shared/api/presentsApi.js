import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    serverTimestamp,
    writeBatch
} from 'firebase/firestore';
import { db } from '../../lib/firebase';

// Helper for root collection paths
export const getPresentsColRef = (projectId) => 
    collection(db, 'projects', projectId, 'workspaces', 'presents', 'items');

export const getPresentDocRef = (projectId, itemId) => 
    doc(db, 'projects', projectId, 'workspaces', 'presents', 'items', itemId);

/**
 * Fetch all presentations for a project
 */
export const fetchPresentations = async (projectId) => {
    if (!projectId) return [];
    try {
        const q = query(
            getPresentsColRef(projectId),
            where('type', '==', 'presentation'),
            // Note: orderBy requires an index if mixed with where. 
            // If it fails, remove orderBy and sort on client.
            orderBy('updatedAt', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
        console.error('Error fetching presentations:', error);
        // Fallback if index is missing
        if (error.code === 'failed-precondition') {
             const fallbackQ = query(getPresentsColRef(projectId), where('type', '==', 'presentation'));
             const snapshot = await getDocs(fallbackQ);
             const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
             return items.sort((a,b) => {
                const ta = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : 0;
                const tb = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : 0;
                return tb - ta;
             });
        }
        throw error;
    }
};

/**
 * Fetch a single presentation
 */
export const fetchPresentation = async (projectId, itemId) => {
    if (!projectId || !itemId) return null;
    const docRef = getPresentDocRef(projectId, itemId);
    const snapshot = await getDoc(docRef);
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
};

/**
 * Create a new presentation
 */
export const createPresentation = async (projectId, data, userId = 'system') => {
    if (!projectId) throw new Error('projectId is required');

    const colRef = getPresentsColRef(projectId);
    const newRef = doc(colRef);
    const itemId = newRef.id;
    const timestamp = serverTimestamp();

    const payload = {
        id: itemId,
        projectId,
        workspaceId: 'presents',
        type: 'presentation',
        title: data.title || 'Untitled Presentation',
        description: data.description || '',
        thumbnailUrl: data.thumbnailUrl || null,
        pages: data.pages || [
            { 
               id: `pg-${Date.now()}-1`, 
               name: 'First Page', 
               elements: [] 
            }
        ],
        visibility: data.visibility || 'public',
        presentationType: data.presentationType || 'proposal', // avoid clashing with core 'type'
        createdAt: timestamp,
        updatedAt: timestamp,
        createdBy: userId,
        updatedBy: userId,
        version: 1
    };

    await setDoc(newRef, payload);
    return { id: itemId, ...payload };
};

/**
 * Update an existing presentation
 */
export const updatePresentation = async (projectId, itemId, patch, userId = 'system') => {
    if (!projectId || !itemId) throw new Error('projectId and itemId are required');
    
    const docRef = getPresentDocRef(projectId, itemId);
    await updateDoc(docRef, {
        ...patch,
        updatedBy: userId,
        updatedAt: serverTimestamp()
    });
};

/**
 * Delete a presentation
 */
export const deletePresentation = async (projectId, itemId) => {
    if (!projectId || !itemId) return;
    const docRef = getPresentDocRef(projectId, itemId);
    await deleteDoc(docRef);
};

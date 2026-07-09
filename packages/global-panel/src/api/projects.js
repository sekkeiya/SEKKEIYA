import { collection, doc, getDoc, setDoc, updateDoc, serverTimestamp, query, where, getDocs, deleteDoc, writeBatch, limit as fsLimit } from "firebase/firestore";
import { getGlobalDb } from "./firebaseDb";

/**
 * プロジェクトを新規作成
 */
export const createProject = async ({ name, description, ownerId, memberIds = [], coverImage = null }) => {
    if (!ownerId) throw new Error("createProject: ownerId が必要です");
    
    // オーナー名解決
    let handle = "";
    try {
        const userRef = doc(getGlobalDb(), "users", ownerId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const u = userSnap.data();
            handle = u.handle || u.handleLower || u.ownerHandle || u.username || u.displayName || "";
        }
    } catch { /* ignore */ }

    const timestamp = serverTimestamp();
    const projectsColRef = collection(getGlobalDb(), "projects");
    const projectRef = doc(projectsColRef);
    
    const projectData = {
        name: name || "Untitled Project",
        description: description || "",
        requirements: "",
        ownerId,
        ownerName: handle,
        memberIds: Array.isArray(memberIds) && memberIds.length ? memberIds : [ownerId],
        coverImage,
        createdAt: timestamp,
        updatedAt: timestamp,
    };

    console.log(`[Web API] createProject Sequential Write 1 -> projects/${projectRef.id}`);
    await setDoc(projectRef, projectData);
    
    // Create single main workspace instead of multiple sections
    const mainWorkspaceRef = doc(getGlobalDb(), "projects", projectRef.id, "workspaces", "main");
    console.log(`[Web API] createProject Sequential Write 2 -> projects/${projectRef.id}/workspaces/main`);
    await setDoc(mainWorkspaceRef, {
        id: "main",
        name: "Main Workspace",
        description: "Default Workspace",
        type: "main",
        ownerId,
        memberIds: Array.isArray(memberIds) && memberIds.length ? memberIds : [ownerId],
        visibility: "public",
        itemCount: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
    });
    return { id: projectRef.id, ...projectData };
};

export const getProject = async (projectId) => {
    if (!projectId) return null;
    const snap = await getDoc(doc(getGlobalDb(), "projects", projectId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const updateProject = async (projectId, updatedFields) => {
    if (!projectId) return;
    const projectRef = doc(getGlobalDb(), "projects", projectId);
    await updateDoc(projectRef, { ...updatedFields, updatedAt: serverTimestamp() });
};

export const getBoardsInsideProject = async (projectId) => {
    if (!projectId) return [];
    // fetching workspaces instead of sections
    const q = collection(getGlobalDb(), "projects", projectId, "workspaces");
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

/**
 * デフォルトボードを解決するフォールバック
 */
export const resolveDefaultBoard = async (projectId, preferredType = "main") => {
    if (!projectId) return null;
    
    // Attempt fast specific doc retrieval
    try {
        const directSnap = await getDoc(doc(getGlobalDb(), "projects", projectId, "workspaces", preferredType));
        if (directSnap.exists()) {
            return { id: directSnap.id, ...directSnap.data() };
        }
    } catch { /* ignore fallback */ }
    
    // Fallback to fetch all
    const boards = await getBoardsInsideProject(projectId);
    if (!boards || boards.length === 0) return null;

    const matched = boards.find(b => b.type === preferredType || b.id === preferredType);
    if (matched) return matched;
    
    const fallback = boards.find(b => b.id === "main");
    return fallback || boards[0];
};

export const updateBoardInsideProject = async (projectId, boardId, updatedFields) => {
    const boardRef = doc(getGlobalDb(), "projects", projectId, "workspaces", boardId);
    await updateDoc(boardRef, { ...updatedFields, updatedAt: serverTimestamp() });
};

async function deleteCollectionByChunks(collRef, perBatch = 450) {
    const db = getGlobalDb();
    while (true) {
        const snap = await getDocs(query(collRef, fsLimit(perBatch)));
        if (snap.empty) break;

        const batch = writeBatch(db);
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();

        if (snap.size < perBatch) break;
    }
}

export const deleteBoardInsideProject = async (projectId, boardId) => {
    const db = getGlobalDb();
    const boardRef = doc(db, "projects", projectId, "workspaces", boardId);
    // Delete items subcollection first
    await deleteCollectionByChunks(collection(db, "projects", projectId, "workspaces", boardId, "items"), 450);
    // Delete board
    await deleteDoc(boardRef);
};

/**
 * プロジェクト削除 (Soft Delete)
 * @param {string} projectId 
 */
export const deleteProject = async (projectId) => {
    if (!projectId) {
        throw new Error("projectId is required");
    }

    try {
        const projectRef = doc(getGlobalDb(), "projects", projectId);
        await updateDoc(projectRef, {
            isDeleted: true,
            deletedAt: serverTimestamp()
        });
        console.log("Project soft deleted:", projectId);
    } catch (error) {
        console.error("Failed to delete project:", error);
        throw error;
    }
};

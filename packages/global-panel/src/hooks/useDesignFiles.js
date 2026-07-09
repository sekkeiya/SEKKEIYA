import { useState, useEffect } from "react";
import { getGlobalDb, getGlobalStorage } from "../api/firebaseDb";
import { 
  collection, query, where, orderBy, onSnapshot, 
  doc, writeBatch, getDocs, limit, runTransaction
} from "firebase/firestore";
import { 
  ref, uploadBytesResumable, getDownloadURL, deleteObject 
} from "firebase/storage";

export default function useDesignFiles(projectId, toolType) {
  const [workFiles, setWorkFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 1. Fetch parent WorkFiles in real-time
  useEffect(() => {
    if (!projectId) {
      setWorkFiles([]);
      setLoading(false);
      return;
    }

    const db = getGlobalDb();
    let q = collection(db, "projects", projectId, "workFiles");
    
    // Optional filter by toolType if provided (e.g. "rhino")
    if (toolType) {
      q = query(q, where("toolType", "==", toolType));
    } else {
      q = query(q, orderBy("updatedAt", "desc"));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const results = [];
      snapshot.forEach((docSnap) => {
        results.push({ id: docSnap.id, ...docSnap.data() });
      });
      
      // Sort in memory by updatedAt desc to avoid complex index requirements if filtering by toolType
      results.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

      // Mark the first one as latest updated for UI convenience
      if (results.length > 0) {
        results[0].isRecentlyUpdated = true;
      }
      setWorkFiles(results);
      setLoading(false);
    }, (err) => {
      console.error("[useDesignFiles] Fetch error:", err);
      setError(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [projectId, toolType]);

  // 2. Commit a Brand New WorkFile (and its v1)
  const commitNewWorkFile = async ({ file, name, createdBy, userId }, onProgress) => {
    if (!file || !projectId) {
      throw new Error("Missing required arguments for commitNewWorkFile");
    }

    const db = getGlobalDb();
    const storage = getGlobalStorage();

    const parentRef = collection(db, "projects", projectId, "workFiles");
    const newDocRef = doc(parentRef);
    const workFileId = newDocRef.id;

    const extension = file.name.split('.').pop() || "bin";
    const storagePath = `workFiles/${projectId}/${workFileId}/v1_${Date.now()}.${extension}`;
    const storageRef = ref(storage, storagePath);

    const uploadTask = uploadBytesResumable(storageRef, file);

    return new Promise((resolve, reject) => {
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (onProgress) onProgress(progress);
        },
        (error) => reject(error),
        async () => {
          try {
            const versionsRef = collection(db, "projects", projectId, "workFiles", workFileId, "versions");
            const newVersionRef = doc(versionsRef);
            const versionId = newVersionRef.id;
            
            const now = new Date().toISOString();

            const finalDoc = {
              id: workFileId,
              projectId,
              name: name || file.name,
              toolType: toolType || "other",
              currentVersionId: versionId,
              latestVersionNumber: 1,
              updatedAt: now,
              updatedBy: createdBy,
              status: 'active',
              thumbnailUrl: null,
              storagePath: storagePath,
              lastOpenedAt: null,
              createdAt: now,
              createdBy: createdBy
            };

            const initialVersion = {
              id: versionId,
              workFileId: workFileId,
              versionNumber: 1,
              comment: "Initial creation",
              storagePath: storagePath,
              createdAt: now,
              createdBy: createdBy
            };

            const activitiesRef = collection(db, "projects", projectId, "activities");
            const newActivityRef = doc(activitiesRef);
            const initialActivity = {
              id: newActivityRef.id,
              projectId,
              type: "work_file_created",
              targetType: "workFile",
              targetId: workFileId,
              userId: userId || createdBy || "system",
              meta: { toolType: toolType || "other", fileName: name || file.name },
              createdAt: now
            };

            const batch = writeBatch(db);
            batch.set(newDocRef, finalDoc);
            batch.set(newVersionRef, initialVersion);
            batch.set(newActivityRef, initialActivity);
            await batch.commit();

            resolve({ id: workFileId, storagePath, versionNumber: 1 });
          } catch (err) {
            await deleteObject(storageRef).catch(() => {});
            reject(err);
          }
        }
      );
    });
  };

  // 3. Commit a New Version to an existing WorkFile
  const commitNewVersion = async ({ workFileId, file, comment, createdBy, userId }, onProgress) => {
    if (!file || !projectId || !workFileId) {
      throw new Error("Missing required arguments for commitNewVersion");
    }

    const db = getGlobalDb();
    const storage = getGlobalStorage();
    const workFileRef = doc(db, "projects", projectId, "workFiles", workFileId);
    
    // Check if it exists and fetch current version number
    let currentVersionNum = 0;
    try {
      await runTransaction(db, async (t) => {
        const docSnap = await t.get(workFileRef);
        if (!docSnap.exists()) throw new Error("WorkFile not found");
        currentVersionNum = docSnap.data().latestVersionNumber || 0;
      });
    } catch (e) {
      throw new Error("Could not fetch WorkFile metadata");
    }

    const nextVersionNumber = currentVersionNum + 1;
    const extension = file.name.split('.').pop() || "bin";
    const storagePath = `workFiles/${projectId}/${workFileId}/v${nextVersionNumber}_${Date.now()}.${extension}`;
    const storageRef = ref(storage, storagePath);

    const uploadTask = uploadBytesResumable(storageRef, file);

    return new Promise((resolve, reject) => {
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (onProgress) onProgress(progress);
        },
        (error) => reject(error),
        async () => {
          try {
            const versionsRef = collection(db, "projects", projectId, "workFiles", workFileId, "versions");
            const newVersionRef = doc(versionsRef);
            const versionId = newVersionRef.id;
            const now = new Date().toISOString();

            const newVersion = {
              id: versionId,
              workFileId: workFileId,
              versionNumber: nextVersionNumber,
              comment: comment,
              storagePath: storagePath,
              createdAt: now,
              createdBy: createdBy
            };

            const activitiesRef = collection(db, "projects", projectId, "activities");
            const newActivityRef = doc(activitiesRef);
            const newActivity = {
              id: newActivityRef.id,
              projectId,
              type: "work_file_version_created",
              targetType: "workFile",
              targetId: workFileId,
              userId: userId || createdBy || "system",
              meta: { fileName: file.name, versionNumber: nextVersionNumber },
              createdAt: now
            };

            const batch = writeBatch(db);
            batch.set(newVersionRef, newVersion);
            batch.update(workFileRef, {
              currentVersionId: versionId,
              latestVersionNumber: nextVersionNumber,
              updatedAt: now,
              updatedBy: createdBy,
              storagePath: storagePath
            });
            batch.set(newActivityRef, newActivity);
            await batch.commit();

            resolve({ id: workFileId, versionId, storagePath, versionNumber: nextVersionNumber });
          } catch (err) {
            await deleteObject(storageRef).catch(() => {});
            reject(err);
          }
        }
      );
    });
  };

  // 4. Fetch versions for a specific workFile
  const fetchVersions = async (workFileId) => {
    const db = getGlobalDb();
    const q = query(
      collection(db, "projects", projectId, "workFiles", workFileId, "versions"),
      orderBy("versionNumber", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  };

  // 5. Checkout logic
  const getDownloadUrl = async (storagePath) => {
    if (!storagePath) throw new Error("storagePath is required to checkout.");
    const storage = getGlobalStorage();
    const r = ref(storage, storagePath);
    return await getDownloadURL(r);
  };

  return {
    workFiles,
    loading,
    error,
    commitNewWorkFile,
    commitNewVersion,
    fetchVersions,
    getDownloadUrl
  };
}

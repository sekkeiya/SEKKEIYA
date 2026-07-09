import { collection, doc, addDoc, updateDoc, deleteDoc, getDocs, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { getGlobalDb } from "./firebaseDb";

/**
 * プロジェクトの特定セクションへのFirestoreパスを取得します。
 * @param {string} projectId 
 * @param {string} section 
 * @returns {string} 
 */
export const getSectionPath = (projectId, section) => {
    return `projects/${projectId}/sections/${section}`;
};

/**
 * 特定セクションのドキュメント（Items）を取得します。
 * フォールバックとして、旧Board構成からの読み取りも試みます。
 * @param {string} projectId 
 * @param {string} section 
 * @returns {Promise<Array>}
 */
export const getSectionItems = async (projectId, section) => {
    const db = getGlobalDb();
    if (!db) throw new Error("Firebase DB is not initialized inside global-panel.");
    if (!projectId || !section) return [];

    try {
        // 1. 新Sectionを読む (projects/{projectId}/sections/{section}/items)
        const sectionItemsRef = collection(db, `projects/${projectId}/sections/${section}/items`);
        const qSnap = await getDocs(sectionItemsRef);
        
        let items = [];
        qSnap.forEach(doc => {
            items.push({ id: doc.id, ...doc.data() });
        });

        // データがあれば返す
        if (items.length > 0) {
            return items;
        }

        // 2. データがなければ旧Boardをfallbackとして探す
        // レガシー構造: projects/{projectId}/boards/{sectionType}/items
        console.log(`[sectionUtils] No items in new section '${section}'. Falling back to legacy boards...`);
        const legacyItemsRef = collection(db, `projects/${projectId}/boards/${section}/items`);
        const legacySnap = await getDocs(legacyItemsRef);
        
        legacySnap.forEach(doc => {
            items.push({ id: doc.id, ...doc.data() });
        });

        return items;
    } catch (err) {
        console.error(`Error fetching section items for ${projectId}/${section}:`, err);
        return [];
    }
};

/**
 * 特定セクションに新しくデータを保存します。
 * @param {string} projectId 
 * @param {string} section 
 * @param {Object} data 
 */
export const saveToSection = async (projectId, section, data) => {
    const db = getGlobalDb();
    if (!db) throw new Error("Firebase DB is not initialized inside global-panel.");
    if (!projectId || !section) throw new Error("Missing projectId or section");

    try {
        // Option A: 新Sectionのみに書き込み
        const sectionItemsRef = collection(db, `projects/${projectId}/sections/${section}/items`);
        const docRef = await addDoc(sectionItemsRef, {
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
            sectionId: section, // 念のため所属を明記
            projectId: projectId
        });
        
        return docRef.id;
    } catch (err) {
        console.error(`Error saving to section ${projectId}/${section}:`, err);
        throw err;
    }
};

/**
 * 現在の Section の完全な状態 (meta + items) のスナップショットを取得し、History として保存します。
 * @param {string} projectId 
 * @param {string} section 
 * @param {string} summary - 例: "ペルソナのKPI目標を上方修正"
 * @param {string} reason - (オプショナル)
 * @param {string} source - "manual" | "ai-generated" | "ai-edited-by-human"
 * @param {string} changedBy - 実行ユーザーIDまたは "AI-Agent"
 * @param {boolean} isRestored - 復元による作成かどうか
 * @param {number} restoredFromVersion - 復元元のVersion (該当する場合)
 */
export const createHistorySnapshot = async (projectId, section, summary, reason = "", source = "manual", changedBy = "system", isRestored = false, restoredFromVersion = null) => {
    const db = getGlobalDb();
    if (!db || !projectId || !section) throw new Error("Missing dependencies for createHistorySnapshot");

    try {
        const metaRef = doc(db, `projects/${projectId}/sections/${section}`);
        const itemsRef = collection(db, `projects/${projectId}/sections/${section}/items`);
        const historyRef = collection(db, `projects/${projectId}/sections/${section}/history`);

        // 1. Fetch Current State
        const [metaSnap, itemsSnap] = await Promise.all([
            getDoc(metaRef),
            getDocs(itemsRef)
        ]);

        const snapshot = {
            meta: metaSnap.exists() ? metaSnap.data() : {},
            items: itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        };

        // 2. Fetch Latest Version Number to Increment
        const historySnap = await getDocs(historyRef);
        let maxVersion = 0;
        historySnap.forEach(d => {
            const v = d.data().version || 0;
            if (v > maxVersion) maxVersion = v;
        });
        const newVersion = maxVersion + 1;

        // 3. Save to History
        const payload = {
            version: newVersion,
            changedBy,
            changedAt: serverTimestamp(),
            source,
            summary,
            reason,
            isRestored,
            restoredFromVersion,
            snapshot
        };

        const newDocRef = await addDoc(historyRef, payload);
        return { historyId: newDocRef.id, version: newVersion };
    } catch (err) {
        console.error(`Error creating history snapshot for ${projectId}/${section}:`, err);
        throw err;
    }
};

/**
 * 過去のスナップショットを元に、現在の Section (meta + items) を完全に上書き復元します。
 * 復元後、新しく「復元したよ」というHistoryが自動生成されます。
 * @param {string} projectId 
 * @param {string} section 
 * @param {string} historyId - 復元したい過去のID
 * @param {string} changedBy
 */
export const restoreFromSnapshot = async (projectId, section, historyId, changedBy = "system") => {
    const db = getGlobalDb();
    if (!db || !projectId || !section || !historyId) throw new Error("Missing dependencies for restoreFromSnapshot");

    try {
        const historyDocRef = doc(db, `projects/${projectId}/sections/${section}/history/${historyId}`);
        const historySnap = await getDoc(historyDocRef);
        
        if (!historySnap.exists()) {
            throw new Error(`History ${historyId} does not exist`);
        }

        const historyData = historySnap.data();
        const { snapshot, version } = historyData;
        if (!snapshot || !snapshot.items || !snapshot.meta) {
            throw new Error("Invalid snapshot structure in history record");
        }

        const batch = writeBatch(db);

        // 1. Delete all current items
        const currentItemsRef = collection(db, `projects/${projectId}/sections/${section}/items`);
        const currentItemsSnap = await getDocs(currentItemsRef);
        currentItemsSnap.forEach(d => {
            batch.delete(d.ref);
        });

        // 2. Recreate snapshot items explicitly
        snapshot.items.forEach(item => {
            const { id, ...itemDataWithoutId } = item;
            const newItemRef = doc(currentItemsRef, id || crypto.randomUUID());
            batch.set(newItemRef, {
                ...itemDataWithoutId,
                updatedAt: serverTimestamp() // mark as recently touched
            });
        });

        // 3. Overwrite Meta
        const metaRef = doc(db, `projects/${projectId}/sections/${section}`);
        batch.set(metaRef, {
            ...snapshot.meta,
            updatedAt: serverTimestamp()
        });

        // Execute batch overwrite
        await batch.commit();

        // 4. Create new history recording the restoration
        const summaryMsg = `Version ${version} の状態へ復元しました`;
        await createHistorySnapshot(projectId, section, summaryMsg, "", "system", changedBy, true, version);

        return true;
    } catch (err) {
        console.error(`Error restoring from snapshot for ${projectId}/${section}:`, err);
        throw err;
    }
};

/**
 * 新しい Draft (AI提案など) を作成します。
 * @param {string} projectId 
 * @param {string} section 
 * @param {Object} draftData - 提案のペイロード
 * @param {string} source - ドラフト元 (例: "ai-generated")
 */
export const saveAsDraft = async (projectId, section, draftData, source = "ai-generated") => {
    const db = getGlobalDb();
    if (!db || !projectId || !section) throw new Error("Missing dependencies for saveAsDraft");

    try {
        const draftRef = collection(db, `projects/${projectId}/sections/${section}/drafts`);
        const payload = {
            data: draftData,
            status: "pending", // pending, accepted, rejected
            source,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        const newDoc = await addDoc(draftRef, payload);
        return newDoc.id;
    } catch (err) {
        console.error(`Error saving draft for ${projectId}/${section}:`, err);
        throw err;
    }
};

/**
 * Draftのステータスを更新 (Accept または Reject) します。
 * Acceptした場合、呼び出し側で連携して Current データの更新と createHistorySnapshot を実行してください。
 * @param {string} projectId 
 * @param {string} section 
 * @param {string} draftId 
 * @param {string} status - "accepted" | "rejected"
 */
export const resolveDraftStatus = async (projectId, section, draftId, status) => {
    const db = getGlobalDb();
    if (!db || !projectId || !section || !draftId) throw new Error("Missing dependencies for resolveDraftStatus");

    try {
        const draftDocRef = doc(db, `projects/${projectId}/sections/${section}/drafts/${draftId}`);
        await updateDoc(draftDocRef, {
            status,
            resolvedAt: serverTimestamp()
        });
        return true;
    } catch (err) {
        console.error(`Error resolving draft status for ${projectId}/${section}:`, err);
        throw err;
    }
};

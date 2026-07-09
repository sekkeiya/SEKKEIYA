const fs = require('fs');

const fetchJsPath = 'C:\\Users\\sekkeiya\\02-WebApp\\028-R3DM-ver2\\r3dm-share\\src\\shared\\api\\models\\crud\\fetch.js';
let codeFetch = fs.readFileSync(fetchJsPath, 'utf-8');

// The objective is to replace the collectionGroup("models") queries with a function that tries "models" first, and if not found, tries "assets".
const replacement = `    // ownerId/projectId不明、または直接取得に失敗した場合はcollectionGroup検索
    // まず "models" (レガシー) を検索し、なければ "assets" (新システム) を検索するヘルパー
    const searchCollectionGroups = async (field, value) => {
        for (const colName of ["models", "assets"]) {
            const q = query(
                collectionGroup(db, colName),
                where(field, "==", value),
                where("isCanonical", "==", true),
                limit(1)
            );
            const snap = await getDocs(q);
            if (!snap.empty) {
                const docSnap = snap.docs[0];
                return { id: docSnap.id, ...docSnap.data(), refPath: docSnap.ref.path };
            }
        }
        return null;
    };

    // (migration済みのcanonical modelは 'id' または 'doc.id' として同一かつ 'isCanonical: true' を持つ)
    let found = await searchCollectionGroups("id", modelId);
    if (found) return found;

    // fetchModelDetail に誤って Board ItemのID (entityIdが本体) を渡したケースへの救済
    found = await searchCollectionGroups("entityId", modelId);
    if (found) return found;`;

const targetStart = `    // ownerId不明、または直接取得に失敗した場合はcollectionGroup検索`;
const targetEnd = `    if (!snapEntity.empty) {
        const docSnap = snapEntity.docs[0];
        return { id: docSnap.id, ...docSnap.data(), refPath: docSnap.ref.path };
    }`;

const startIndex = codeFetch.indexOf(targetStart);
const endIndex = codeFetch.indexOf(targetEnd) + targetEnd.length;

if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
    codeFetch = codeFetch.substring(0, startIndex) + replacement + codeFetch.substring(endIndex);
    fs.writeFileSync(fetchJsPath, codeFetch, 'utf-8');
    console.log("fetch.js patched successfully.");
} else {
    console.error("Could not find target block in fetch.js");
}

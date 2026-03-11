// src/utils/downloads.js
import JSZip from "jszip";
import { saveAs } from "file-saver";
import {
    db
} from "@/shared/config/firebase";
import {
    doc, getDoc, getDocs, collection
} from "firebase/firestore";

/* ---------------- helpers ---------------- */
const splitPath = (p) => String(p || "").split("/").filter(Boolean);
const safe = (s) => String(s || "").replace(/[\\/:*?"<>|]+/g, "_").trim();
const uniqBy = (arr, key) => {
    const m = new Map();
    for (const x of arr) m.set(x[key], x);
    return [...m.values()];
};

const fileKeys = ["glb", "GLB", "3dm", "3DM"];

const pickFileEntries = (model) => {
    const files = model?.files || {};
    const out = [];
    for (const k of Object.keys(files)) {
        if (!fileKeys.includes(k)) continue;
        const f = files[k];
        const url = f?.url || f?.downloadURL || "";
        if (!url) continue;

        // 拡張子（URL or key から推定）
        let ext = (url.split("?")[0].split(".").pop() || "").toLowerCase();
        if (!ext || ext.length > 5) {
            ext = k.toLowerCase(); // glb / 3dm のキー名を使う
        }

        const title = model?.title || model?.name || model?.id || "model";
        const filename = `${safe(title)}.${ext}`;
        out.push({ url, filename });
    }
    return out;
};

const getDocByPath = async (p) => {
    if (!p) return null;
    const snap = await getDoc(doc(db, ...splitPath(p)));
    return snap.exists() ? { id: snap.id, ...snap.data(), __refPath: p } : null;
};

/** boardsPublic / teamBoards / myBoards それぞれの “サブコレ models” を読む */
const fetchBoardModelsPreview = async (board) => {
    const candParents = [];

    // boardsPublic 優先（Public Boards 画面）
    if (board?.publicId) candParents.push(["boardsPublic", board.publicId]);

    // teamBoards
    if (board?.boardType === "teamBoards" || board?.boardType === "teamBoard") {
        const id = board.id || board.boardId;
        if (id) candParents.push(["teamBoards", id]);
    }

    // users/{uid}/myBoards/{id}
    if (board?.boardType === "myBoards" || board?.boardType === "myBoard") {
        const id = board.id || board.boardId;
        const uid = board.createdBy || board.ownerId || board.userId;
        if (uid && id) candParents.push(["users", uid, "myBoards", id]);
    }

    const previews = [];
    for (const parent of candParents) {
        try {
            const snap = await getDocs(collection(db, ...parent, "models"));
            snap.forEach((d) => {
                const data = d.data() || {};
                const modelRef = data.modelRef || data.model || {};
                previews.push({
                    id: modelRef.id || data.id || d.id,
                    path: modelRef.path || data.modelRefPath || "",
                    createdBy: data.createdBy || board?.createdBy || "",
                });
            });
            if (snap.size > 0) break; // どれか1つで取れたら十分
        } catch (_) { }
    }
    return previews;
};

const collectModelRefsFromBoard = (board) => {
    const out = [];
    if (Array.isArray(board?.modelRefs)) {
        for (const r of board.modelRefs) {
            if (!r) continue;
            const id = r.id || (r.path ? r.path.split("/").pop() : "");
            const path = r.path || r.refPath || r.modelRefPath || "";
            out.push({ id, path, createdBy: r.createdBy || board?.createdBy || "" });
        }
    }
    return out;
};

/** 可能な参照すべてからモデル doc を取得（最初に見つかったものを採用） */
const resolveModelDoc = async (ref) => {
    // 1) 参照 path があれば最優先
    if (ref.path) {
        const d = await getDocByPath(ref.path);
        if (d) return d;
    }
    // 2) /models/{id}
    if (ref.id) {
        const g = await getDocByPath(`models/${ref.id}`);
        if (g) return g;
    }
    // 3) /users/{uid}/models/{id}
    if (ref.createdBy && ref.id) {
        const u = await getDocByPath(`users/${ref.createdBy}/models/${ref.id}`);
        if (u) return u;
    }
    return null;
};
/* ----------------------------------------- */

/**
 * 指定ボード配下のモデルファイル（.glb / .3dm）を ZIP にまとめて保存
 * @param {object} board - ボードオブジェクト（boardsPublic / teamBoards / myBoards いずれでも可）
 */
export async function downloadBoardAsZip(board) {
    const boardName = safe(board?.name || "board");
    const modelRefsA = await fetchBoardModelsPreview(board);   // サブコレから
    const modelRefsB = collectModelRefsFromBoard(board);       // キャッシュから
    const modelRefs = uniqBy([...modelRefsA, ...modelRefsB].filter(x => x?.id), "id");

    // 参照が取れない場合は即終了
    if (modelRefs.length === 0) {
        throw new Error("ダウンロード可能なモデル参照が見つかりませんでした。");
    }

    // モデル doc → ファイル URL を収集
    const fileEntries = [];
    for (const r of modelRefs) {
        const m = await resolveModelDoc(r);
        if (!m) continue;
        const entries = pickFileEntries(m);
        entries.forEach((e, idx) => {
            // 同名衝突回避
            const numbered = modelRefs.length > 1 ? `${String(idx + 1).padStart(2, "0")}_${e.filename}` : e.filename;
            fileEntries.push({ url: e.url, filename: numbered });
        });
    }

    // 重複URL除去
    const files = uniqBy(fileEntries, "url");

    if (files.length === 0) {
        throw new Error("ダウンロード可能なファイルURLが見つかりませんでした。");
    }

    // ZIP 作成
    const zip = new JSZip();
    const folder = zip.folder(boardName);

    for (const f of files) {
        const res = await fetch(f.url, { mode: "cors" });
        if (!res.ok) continue;
        const blob = await res.blob();
        folder.file(f.filename, blob);
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    saveAs(zipBlob, `${boardName}.zip`);
}

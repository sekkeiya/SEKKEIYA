// src/utils/services/boards/boards.js
import {
    doc,
    getDoc,
    getDocs,
    collection,
    setDoc,
    deleteDoc,
    serverTimestamp,
    updateDoc,
    query,
    where,
    writeBatch,
} from "firebase/firestore";
import { db } from "@/shared/config/firebase";
import { fetchPlanInfo } from "@/shared/utils/planUtils";   // プラン取得（失敗時はローカルにフォールバック）
import { planLimits } from "@/shared/constants/planLimits";
import {
    canMakeMorePrivateMyBoards,
    canOwnMorePrivateTeamBoards,
} from "@/shared/utils/planLimitCheckers";

/* --------------------------------------------------------------- */
/* helpers                                                         */
/* --------------------------------------------------------------- */

const now = () => serverTimestamp();

const toVisibilityFields = (src = {}) => {
    // src.visibility があれば最優先。それ以外は isPublic / isPrivate から推定。
    const vis =
        src.visibility ??
        (src.isPublic === true ? "public" : src.isPrivate === true ? "private" : undefined);
    if (!vis) return {};
    return {
        visibility: vis,
        isPublic: vis === "public",
        isPrivate: vis === "private",
    };
};

/** 0 未満にならない “手元計算” 用（実カウントは別で担保） */
const safeInc = (current = 0, delta = 0) => {
    const next = Number(current || 0) + Number(delta || 0);
    return next < 0 ? 0 : next;
};

/* --------------------------------------------------------------- */
/* ボードのマイ⇄チーム切り替え                                     */
/* --------------------------------------------------------------- */
/**
 * ボードのマイ⇄チーム切り替え（プラン制限チェック付き）
 * - users/{uid}/(myBoards|teamBoards) の “リンク” を移動
 * - 必要に応じて /teamBoards/{id}（グローバル実体）とその /models を同期
 * 手順:
 *   1) 事前チェック＆読み込み
 *   2) （必要なら）切替先の “非公開上限” を検査
 *   3) users 配下リンクの「作成→削除」
 *   4) 詳細＆models の同期
 *   5) グローバル /teamBoards の生成/削除
 *   6) カウンタ更新（下振れ防止）
 */
export const changeBoardTypeFirestore = async (userId, board) => {
    if (!userId || !board?.id || !board?.boardType) {
        throw new Error("Invalid params: userId / board.id / board.boardType は必須です");
    }

    const isMyBoard = board.boardType === "myBoards";
    const toType = isMyBoard ? "teamBoards" : "myBoards";
    const fromType = board.boardType;
    const boardId = board.id;
    const ts = now();

    /* ---------- 1) 事前取得 & プラン制限（作成枠） ---------- */
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.exists() ? userSnap.data() : {};
    const planId = (userData.plan || "free").toLowerCase();

    const planInfoFromServer = await fetchPlanInfo(planId).catch(() => null);
    const planInfo = planInfoFromServer || planLimits[planId] || planLimits["free"] || {};

    const myCreate = userData.myBoardCreateCount || 0;
    const teamCreate = userData.teamBoardCreateCount || 0;

    const myLimit = planInfo.myBoardCreateLimit ?? Infinity;
    const teamLimit = planInfo.teamBoardCreateLimit ?? Infinity;

    // 切替「後」の作成枠を見る
    if (!isMyBoard && myCreate >= myLimit) {
        throw new Error(`マイボードはプラン上限（${myLimit}件）に達しています。`);
    }
    if (isMyBoard && teamCreate >= teamLimit) {
        throw new Error(`チームボードはプラン上限（${teamLimit}件）に達しています。`);
    }

    const membersArray =
        Array.isArray(board.members) && board.members.length > 0
            ? [...board.members]
            : [userId];

    const fromLinkRef = doc(db, "users", userId, fromType, boardId);
    const toLinkRef = doc(db, "users", userId, toType, boardId);

    const fromLinkSnap = await getDoc(fromLinkRef);
    if (!fromLinkSnap.exists()) {
        throw new Error(`source link not found: users/${userId}/${fromType}/${boardId}`);
    }
    const fromLinkData = fromLinkSnap.data() || {};

    // 可視性（リンク→詳細の順でできるだけ正確に把握）
    let visFields =
        Object.keys(toVisibilityFields(fromLinkData)).length
            ? toVisibilityFields(fromLinkData)
            : {};

    try {
        const detailSrcRef = isMyBoard
            ? doc(db, "users", userId, "myBoards", boardId)
            : doc(db, "teamBoards", boardId);
        const dSnap = await getDoc(detailSrcRef);
        if (dSnap.exists()) {
            const d = dSnap.data() || {};
            const f = toVisibilityFields(d);
            if (Object.keys(f).length) visFields = f;
        }
    } catch (_) { }

    if (!Object.keys(visFields).length) {
        // 値がつかめない古いデータは “public” に寄せる
        visFields = { visibility: "public", isPublic: true, isPrivate: false };
    }

    /* ---------- 2) 切替先が “非公開” になる場合の上限検査（抜け穴封じ） ---------- */
    if (visFields.visibility === "private") {
        if (toType === "teamBoards") {
            const ok = await canOwnMorePrivateTeamBoards(userId, planId);
            if (!ok) {
                throw new Error("チームボードの非公開上限に達しています。プランを確認してください。");
            }
        } else {
            const ok = await canMakeMorePrivateMyBoards(userId, planId);
            if (!ok) {
                throw new Error("マイボードの非公開上限に達しています。プランを確認してください。");
            }
        }
    }

    /* ---------- 3) users 配下リンクの移動（作成→削除） ---------- */
    {
        const linkPayload = {
            id: boardId,
            name: board.name ?? fromLinkData.name ?? "",
            boardType: toType,
            owner: board.owner || fromLinkData.owner || userId,
            members: membersArray,
            showInSidebar: false,
            createdAt: fromLinkData.createdAt || board.createdAt || ts,
            updatedAt: ts,
            ...visFields,
        };

        const batch = writeBatch(db);
        batch.set(toLinkRef, linkPayload, { merge: true });
        batch.delete(fromLinkRef);

        // デバッグ
        console.log("[WRITE PATH] set link ->", toLinkRef.path);
        console.log("[WRITE PATH] del link ->", fromLinkRef.path);

        await batch.commit();
    }

    /* ---------- 4) 詳細＆models の同期 ---------- */
    // 詳細のソースとデスティネーション
    const detailSourceRef = isMyBoard
        ? doc(db, "users", userId, "myBoards", boardId)
        : doc(db, "teamBoards", boardId);

    const detailDestRef =
        toType === "teamBoards"
            ? doc(db, "teamBoards", boardId)
            : doc(db, "users", userId, "myBoards", boardId);

    // 詳細（存在時のみマージ）
    {
        const srcSnap = await getDoc(detailSourceRef);
        if (srcSnap.exists()) {
            const src = srcSnap.data() || {};
            const {
                id, boardType, owner, members, showInSidebar, createdAt, updatedAt,
                ...detailFields
            } = src;

            const existSnap = await getDoc(detailDestRef);
            const exist = existSnap.exists() ? existSnap.data() : {};

            const base =
                toType === "teamBoards"
                    ? {
                        id: boardId,
                        name: board.name ?? exist.name ?? src.name ?? "",
                        boardType: "teamBoards",
                        owner: board.owner || userId,
                        members: membersArray,
                    }
                    : {};

            // 可視性はリンク側の visFields を優先（ズレ防止）
            await setDoc(
                detailDestRef,
                {
                    ...base,
                    ...exist,
                    ...detailFields,
                    ...visFields,
                    updatedAt: ts,
                },
                { merge: true }
            );
            console.log("[WRITE PATH] set detail ->", detailDestRef.path);
        }
    }

    // models 同期
    {
        const sourceModelsCol = isMyBoard
            ? collection(db, "users", userId, "myBoards", boardId, "models")
            : collection(db, "teamBoards", boardId, "models");
        const modelsSnap = await getDocs(sourceModelsCol);

        for (const m of modelsSnap.docs) {
            const modelId = m.id;
            const modelData = m.data() || {};

            // 先リンク側
            const toLinkModelRef = doc(
                db,
                "users",
                userId,
                toType,
                boardId,
                "models",
                modelId
            );
            await setDoc(
                toLinkModelRef,
                { ...modelData, updatedAt: ts },
                { merge: true }
            );
            console.log("[WRITE PATH] set model(link) ->", toLinkModelRef.path);

            // teamBoards 側のグローバル models も同期（toType が teamBoards のとき）
            if (toType === "teamBoards") {
                const globalModelRef = doc(db, "teamBoards", boardId, "models", modelId);
                await setDoc(
                    globalModelRef,
                    { ...modelData, updatedAt: ts },
                    { merge: true }
                );
                console.log("[WRITE PATH] set model(global) ->", globalModelRef.path);
            }
        }

        // 旧リンク側 models の削除
        const oldModelsCol = collection(
            db,
            "users",
            userId,
            fromType,
            boardId,
            "models"
        );
        const oldModelsSnap = await getDocs(oldModelsCol);
        if (!oldModelsSnap.empty) {
            const batch = writeBatch(db);
            oldModelsSnap.forEach((d) => batch.delete(d.ref));
            console.log("[WRITE PATH] del models(link) ->", oldModelsCol.path);
            await batch.commit();
        }

        // 切替元が teamBoards → myBoards のとき、グローバル models も削除
        if (fromType === "teamBoards") {
            const globalModelsCol = collection(db, "teamBoards", boardId, "models");
            const gSnap = await getDocs(globalModelsCol);
            if (!gSnap.empty) {
                const batch = writeBatch(db);
                gSnap.forEach((d) => batch.delete(d.ref));
                console.log("[WRITE PATH] del models(global) ->", globalModelsCol.path);
                await batch.commit();
            }
        }
    }

    /* ---------- 5) グローバル /teamBoards の生成/削除 ---------- */
    if (toType === "teamBoards") {
        // 生成（存在すればマージ）
        const globalTeamRef = doc(db, "teamBoards", boardId);
        await setDoc(
            globalTeamRef,
            {
                id: boardId,
                name: board.name ?? fromLinkData.name ?? "",
                boardType: "teamBoards",
                owner: board.owner || fromLinkData.owner || userId,
                members: membersArray,
                createdAt: fromLinkData.createdAt || board.createdAt || ts,
                updatedAt: ts,
                ...visFields,
            },
            { merge: true }
        );
        console.log("[WRITE PATH] set global team ->", globalTeamRef.path);

        // 念のためリンク最小情報を追記
        const userTeamLinkRef = doc(db, "users", userId, "teamBoards", boardId);
        await setDoc(
            userTeamLinkRef,
            { id: boardId, updatedAt: ts, showInSidebar: false, ...visFields },
            { merge: true }
        );
        console.log("[WRITE PATH] set link(team) ->", userTeamLinkRef.path);
    } else {
        // teamBoards → myBoards：グローバルはオーナーのみ削除（権限NGはスキップ）
        const globalTeamRef = doc(db, "teamBoards", boardId);
        const gSnap = await getDoc(globalTeamRef);
        if (gSnap.exists()) {
            const g = gSnap.data() || {};
            if (g.owner === userId) {
                await deleteDoc(globalTeamRef).catch((e) => {
                    console.warn("[DELETE FAILED] global team ->", globalTeamRef.path, e?.message);
                });
                console.log("[WRITE PATH] del global team ->", globalTeamRef.path);
            } else {
                console.warn("[DELETE SKIPPED] not owner of teamBoards/", boardId);
            }
        }
    }

    /* ---------- 6) カウント更新（0 未満を避ける） ---------- */
    const nextMy = safeInc(myCreate, toType === "myBoards" ? 1 : -1);
    const nextTeam = safeInc(teamCreate, toType === "teamBoards" ? 1 : -1);
    await updateDoc(userRef, {
        myBoardCreateCount: nextMy,
        teamBoardCreateCount: nextTeam,
    });
};

/* --------------------------------------------------------------- */
/* サイドバー表示トグル                                             */
/* --------------------------------------------------------------- */
/**
 * サイドバー表示トグル（上限内に“必ず収める”）
 * - nextChecked=true: 対象をONにし、超過分は“古い順”から自動でOFF
 * - nextChecked=false: 対象だけOFF
 */
export const toggleShowInSidebar = async ({
    userId,
    boardId,
    boardType,     // "myBoards" | "teamBoards"
    nextChecked,
    sidebarLimit,  // 数値 or Infinity
}) => {
    if (!userId || !boardId || !boardType) return;

    const colRef = collection(db, "users", userId, boardType);
    const targetRef = doc(db, "users", userId, boardType, boardId);

    // OFF → 対象だけOFF
    if (!nextChecked) {
        await updateDoc(targetRef, { showInSidebar: false, updatedAt: now() });
        return;
    }

    // ON：現在 ON 一覧を取得
    const onSnap = await getDocs(query(colRef, where("showInSidebar", "==", true)));

    // 既にONなら何もしない（必要なら updatedAt を更新してもよい）
    if (onSnap.docs.find((d) => d.id === boardId)) {
        return;
    }

    // 新しい順へ（updatedAt / createdAt の seconds を使用）
    const onDocsSorted = [...onSnap.docs].sort((a, b) => {
        const ad = a.data(), bd = b.data();
        const at = ad.updatedAt?.seconds || ad.createdAt?.seconds || 0;
        const bt = bd.updatedAt?.seconds || bd.createdAt?.seconds || 0;
        return bt - at; // 新→古
    });

    const batch = writeBatch(db);

    // 対象を必ず ON
    batch.set(targetRef, { showInSidebar: true, updatedAt: now() }, { merge: true });

    // 上限が有限なら、古い順でOFF
    if (Number.isFinite(sidebarLimit)) {
        const others = onDocsSorted.filter((d) => d.id !== boardId);
        // いまONにする1件 + 既存 others の中から sidebarLimit に収める
        const keepOthers = Math.max(0, sidebarLimit - 1);
        const toDisable = others.slice(keepOthers); // 末尾＝古い方からOFF
        toDisable.forEach((d) => {
            batch.update(d.ref, { showInSidebar: false, updatedAt: now() });
        });
    }

    await batch.commit();
};

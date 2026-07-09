// src/shared/utils/planLimitCheckers.js
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/shared/config/firebase";

/**
 * ユーザーがさらに非公開プロジェクトを作成可能か判定する
 */
export const canMakeMorePrivateProjects = async (userId, planId) => {
    // TODO: 実際のカウントと上限の比較を実装する
    return true; 
};

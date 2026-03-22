// src/shared/utils/planLimitCheckers.js
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/shared/config/firebase";

/**
 * ユーザーがさらにマイボード（非公開）を作成可能か判定する
 */
export const canMakeMorePrivateMyBoards = async (userId, planId) => {
    // TODO: 実際のカウントと上限の比較を実装する
    return true; 
};

/**
 * ユーザーがさらにチームボード（非公開）を作成・所有可能か判定する
 */
export const canOwnMorePrivateTeamBoards = async (userId, planId) => {
    // TODO: 実際のカウントと上限の比較を実装する
    return true;
};

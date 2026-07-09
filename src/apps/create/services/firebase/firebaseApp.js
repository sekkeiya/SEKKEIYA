// 統合後: メインsekkeiyaアプリのFirebaseインスタンスを再利用する
// 自前の initializeApp / connectFirestoreEmulator は廃止（重複初期化を回避）
export { db } from "@/shared/config/firebase";

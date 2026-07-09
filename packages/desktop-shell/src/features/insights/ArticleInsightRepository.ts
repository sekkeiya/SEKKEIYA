// 記事インサイトの永続化（横断の分析ライブラリ）。
// 正本: users/{uid}/articleInsights/{id}
// 記事docと別コレクションにする理由: 分析は「記事そのもの」ではなく記事から採掘した根拠資産で、
// 外部Web記事（S.Blog記事ではない）も分析対象になりうるため。1記事1分析を基本とし、
// findByArticleId で既存分析を引いて再分析（上書き）する。

import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc,
  query, where, orderBy, limit as fbLimit, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase/client';
import { compactInsight, type ArticleInsight } from './articleInsightTypes';

export class ArticleInsightRepository {
  private static colRef(uid: string) {
    return collection(db, 'users', uid, 'articleInsights');
  }
  private static docRef(uid: string, id: string) {
    return doc(db, 'users', uid, 'articleInsights', id);
  }

  /** 分析ライブラリ一覧（新しい順）。横断ビューで使う。 */
  static async list(uid: string): Promise<ArticleInsight[]> {
    const snap = await getDocs(query(this.colRef(uid), orderBy('generatedAt', 'desc')));
    return snap.docs.map((d) => d.data() as ArticleInsight);
  }

  static async get(uid: string, id: string): Promise<ArticleInsight | null> {
    const snap = await getDoc(this.docRef(uid, id));
    return snap.exists() ? (snap.data() as ArticleInsight) : null;
  }

  /** S.Blog 記事IDから既存の分析を1件引く（再分析・パネル再表示用）。 */
  static async findByArticleId(uid: string, articleId: string): Promise<ArticleInsight | null> {
    const snap = await getDocs(
      query(this.colRef(uid), where('articleId', '==', articleId), fbLimit(1)),
    );
    return snap.empty ? null : (snap.docs[0].data() as ArticleInsight);
  }

  static async save(uid: string, insight: ArticleInsight): Promise<void> {
    const payload = compactInsight({ ...insight, authorUid: uid });
    await setDoc(
      this.docRef(uid, insight.id),
      { ...payload, updatedAt: serverTimestamp() as unknown as string },
      { merge: true },
    );
  }

  static async remove(uid: string, id: string): Promise<void> {
    await deleteDoc(this.docRef(uid, id));
  }
}

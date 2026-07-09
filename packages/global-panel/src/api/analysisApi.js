import { useState, useEffect, useMemo } from "react";
import { collection, doc, getDoc, getDocs, onSnapshot, setDoc, updateDoc, deleteDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { getGlobalDb } from "./firebaseDb";

/**
 * AnalysisWorkspace 全体を購読するカスタムフック
 * @param {string} projectId 
 */
export function useAnalysisWorkspace(projectId) {
  const [meta, setMeta] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!projectId) {
      setMeta(null);
      setItems([]);
      setLoading(false);
      return;
    }

    const db = getGlobalDb();
    const metaRef = doc(db, "projects", projectId, "sections", "analysis");
    const itemsRef = collection(db, "projects", projectId, "sections", "analysis", "items");

    setLoading(true);

    // Subscribe to Meta
    const unsubMeta = onSnapshot(
      metaRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setMeta({ id: docSnap.id, ...docSnap.data() });
        } else {
          // Initialize empty state structurally matching user requirements
          setMeta({
            type: "analysis",
            name: "分析・採点",
            totalScore: 0,
            summary: "まだ分析されていません。右上の「Run AI Analysis」を押して戦略の評価を実行してください。",
            metrics: {
              conceptAlignment: 0,
              personaFit: 0,
              issueCoverage: 0
            },
            metricExplanations: {
              conceptAlignment: "",
              personaFit: "",
              issueCoverage: ""
            },
            suggestions: [],
            source: "none",
            runCount: 0,
            lastUpdated: null,
            createdAt: null,
            updatedAt: null,
          });
        }
      },
      (err) => {
        console.error("useAnalysisWorkspace meta error:", err);
        setError(err);
      }
    );

    // Subscribe to Items
    const unsubItems = onSnapshot(
      itemsRef,
      (snap) => {
        const fetchedItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // 並び順：新しいアクションほど上に来る（タイムライン形式）と想定し、createdAtの降順に
        fetchedItems.sort((a, b) => {
            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return timeB - timeA;
        });
        setItems(fetchedItems);
        setLoading(false);
      },
      (err) => {
        console.error("useAnalysisWorkspace items error:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => {
      unsubMeta();
      unsubItems();
    };
  }, [projectId]);

  // Project Home Summary (Selector)
  // Landing preview 用に導出
  const summary = useMemo(() => {
    if (loading) return null;
    
    return {
      totalScore: meta?.totalScore || 0,
      textSummary: meta?.summary || "未評価",
      metrics: {
        conceptAlignment: meta?.metrics?.conceptAlignment || 0,
        personaFit: meta?.metrics?.personaFit || 0,
        issueCoverage: meta?.metrics?.issueCoverage || 0
      },
      // items から最新の Decision / Insight プレビューなどに将来拡張可能
      latestItemsCount: items.length
    };
  }, [meta, items, loading]);

  return { meta, items, summary, loading, error };
}

/**
 * Analysis メタデータの更新
 */
export const updateAnalysisMeta = async (projectId, data) => {
  if (!projectId) return;
  const db = getGlobalDb();
  const metaRef = doc(db, "projects", projectId, "sections", "analysis");
  
  await setDoc(metaRef, { 
    ...data, 
    type: "analysis",
    updatedAt: serverTimestamp() 
  }, { merge: true });
};

/**
 * Analysis アイテム（Decision Log等）の追加
 */
export const addAnalysisItem = async (projectId, itemData) => {
  if (!projectId) return null;
  const db = getGlobalDb();
  const itemRef = doc(collection(db, "projects", projectId, "sections", "analysis", "items"));
  
  const payload = {
    ...itemData,
    id: itemRef.id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(itemRef, payload);
  return itemRef.id;
};

/**
 * Analysis アイテムの更新
 */
export const updateAnalysisItem = async (projectId, itemId, data) => {
  if (!projectId || !itemId) return;
  const db = getGlobalDb();
  const itemRef = doc(db, "projects", projectId, "sections", "analysis", "items", itemId);
  
  await updateDoc(itemRef, {
    ...data,
    updatedAt: serverTimestamp()
  });
};

/**
 * Analysis アイテムの削除
 */
export const deleteAnalysisItem = async (projectId, itemId) => {
  if (!projectId || !itemId) return;
  const db = getGlobalDb();
  const itemRef = doc(db, "projects", projectId, "sections", "analysis", "items", itemId);
  await deleteDoc(itemRef);
};

/**
 * Strategyデータを参照してAnalysisの最小限のスコアとサマリーを生成する（MVP用）
 * @param {boolean} returnOnly - true の場合はDBに保存せず、生成されたデータを返す
 */
export const runAnalysisForProject = async (projectId, returnOnly = false) => {
  if (!projectId) return null;
  const db = getGlobalDb();
  
  // 1. 設定情報の取得
  const strategyMetaRef = doc(db, "projects", projectId, "sections", "strategy");
  const strategyMetaSnap = await getDoc(strategyMetaRef);
  const strategyMeta = strategyMetaSnap.exists() ? strategyMetaSnap.data() : {};

  // 2. アイテム情報の取得
  const strategyItemsRef = collection(db, "projects", projectId, "sections", "strategy", "items");
  const strategyItemsSnap = await getDocs(strategyItemsRef);
  const strategyItems = strategyItemsSnap.docs.map(d => d.data());

  // 3. MVP ロジックでのスコア計算 (0 - 100)
  
  // Concept Alignment: タイトルと詳細が入力されているか
  const hasTitle = strategyMeta.conceptTitle?.trim().length > 0;
  const hasDesc = strategyMeta.conceptDescription?.trim().length > 0;
  let conceptAlignment = 0;
  let conceptExp = "";
  if (hasTitle && hasDesc) {
    conceptAlignment = 100;
    conceptExp = "コンセプトのタイトルと詳細が定義されており、方向性が明確です。";
  } else if (hasTitle || hasDesc) {
    conceptAlignment = 50;
    conceptExp = "コンセプトの一部が定義されていますが、全体像が不足しています。";
  } else {
    conceptAlignment = 0;
    conceptExp = "コンセプトが未定義です。プロジェクトの中核となるアイデアを設定してください。";
  }

  // Persona Fit: ペルソナが登録されているか、内容があるか
  const personas = strategyItems.filter(i => i.type === "persona");
  let personaFit = 0;
  let personaExp = "";
  if (personas.length > 0) {
    const hasDetailedPersona = personas.some(p => (p.name || p.title) && (p.needs || p.traits));
    if (hasDetailedPersona) {
      personaFit = 100;
      personaExp = "ターゲットペルソナが詳細に定義されており、ユーザー像が明確です。";
    } else {
      personaFit = 50;
      personaExp = "ペルソナは存在しますが、ニーズや特徴(traits)が不足しています。";
    }
  } else {
    personaFit = 0;
    personaExp = "ターゲットペルソナが未定義です。誰のためのプロジェクトかを明確にしてください。";
  }

  // Issue Coverage: 課題が登録されているか
  const issues = strategyItems.filter(i => i.type === "issue");
  let issueCoverage = 0;
  let issueExp = "";
  if (issues.length > 0) {
    const hasSpecificIssue = issues.some(i => i.title?.trim().length > 0);
    if (hasSpecificIssue) {
      issueCoverage = 100;
      issueExp = "解決すべき課題が明確に言語化されています。";
    } else {
      issueCoverage = 50;
      issueExp = "課題アイテムは存在しますが、具体的なタイトルが未入力です。";
    }
  } else {
    issueCoverage = 0;
    issueExp = "解決すべき課題が定義されていません。取り組む問題を設定してください。";
  }

  // Total Score (平均)
  const totalScore = Math.round((conceptAlignment + personaFit + issueCoverage) / 3);

  // Suggestions build
  const suggestions = [];
  if (conceptAlignment < 100) suggestions.push("コンセプトの詳細を記述し、プロジェクトの「なぜやるか」を具体化してください。");
  if (personaFit < 100) suggestions.push("ターゲットペルソナの needs や特徴(traits)を追加し、ユーザー像の解像度を上げてください。");
  if (issueCoverage < 100) suggestions.push("ユーザーや市場が抱える具体的な「課題」タイトルを入力し、解決すべき問題を設定してください。");
  if (suggestions.length === 0) suggestions.push("現在の戦略定義は十分です。次は Layout や Models との接続評価に進んでください。");

  // 4. サマリー文の生成
  let summaryText = "";
  if (totalScore >= 80) {
    summaryText = "戦略の基礎が十分に構造化されており、実装に進める状態です。";
  } else if (totalScore >= 50) {
    summaryText = "コンセプトやペルソナの一部が定義されています。さらに詳細を詰めることで精度が上がります。";
  } else {
    summaryText = "戦略の定義が不足しています。コンセプト、ペルソナ、課題を明確にすることから始めましょう。";
  }

  // Get current run count
  const analysisMetaRef = doc(db, "projects", projectId, "sections", "analysis");
  const analysisMetaSnap = await getDoc(analysisMetaRef);
  const currentRunCount = analysisMetaSnap.exists() ? (analysisMetaSnap.data().runCount || 0) : 0;

  const analysisMetaPayload = {
    totalScore,
    summary: summaryText,
    metricExplanations: {
      conceptAlignment: conceptExp,
      personaFit: personaExp,
      issueCoverage: issueExp
    },
    suggestions,
    metrics: {
      conceptAlignment,
      personaFit,
      issueCoverage
    },
    source: "rule-based-v1",
    runCount: currentRunCount + 1,
  };

  const analysisItemPayload = {
    type: "decision",
    action: "MVP 構造分析の実行",
    reason: summaryText,
  };

  if (returnOnly) {
    return {
      meta: analysisMetaPayload,
      items: [analysisItemPayload]
    };
  }

  // 5. Analysis Meta を更新
  await updateAnalysisMeta(projectId, {
    ...analysisMetaPayload,
    lastUpdated: serverTimestamp()
  });

  // 6. Decision Log に記録を追加 (将来AI Scoring実装時に拡張可能)
  await addAnalysisItem(projectId, analysisItemPayload);

  return { totalScore, summary: summaryText };
};

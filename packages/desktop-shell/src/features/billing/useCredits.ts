import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase/client';
import { useAuth } from '../dsl/layout/hooks/useAuthProxy';
import { CREDIT_COST, getPlan, type PlanId } from './creditModel';
import { OFFICIAL_EMAILS } from '../ai-studio/constants/ai-model-plans';

// クレジット残高のクライアント購読。
// 正本はサーバ（docs/18）。本フックは表示用で、`credits` がまだ書かれていない（移行前）場合は
// plan ＋ 旧 `aiUsage.tripo3d.monthlyCount` から残高を導出してギャップを埋める。

export interface CreditsState {
  planId: PlanId | 'official';
  /** 月次付与クレジット。無制限は Infinity。 */
  monthlyAllotment: number;
  /** 当期に配布分から消費した量。 */
  monthlyUsed: number;
  /** 繰越される購入済みクレジット。 */
  topupBalance: number;
  /** 利用可能残高。無制限は Infinity。 */
  remaining: number;
  isUnlimited: boolean;
  /** 残高で可能な 3D 化の個数（floor(remaining / 10)）。無制限は Infinity。 */
  model3dRemaining: number;
  loading: boolean;
}

/** JST の 'YYYY-MM'（サーバの月次リセット境界に一致）。 */
function currentPeriodJst(): string {
  const jst = new Date(Date.now() + 9 * 3600_000);
  return `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, '0')}`;
}

const EMPTY: CreditsState = {
  planId: 'free', monthlyAllotment: 30, monthlyUsed: 0, topupBalance: 0,
  remaining: 30, isUnlimited: false, model3dRemaining: 3, loading: true,
};

export const useCredits = (): CreditsState => {
  const { user } = useAuth();
  const [state, setState] = useState<CreditsState>(EMPTY);

  useEffect(() => {
    if (!user) {
      setState({ ...EMPTY, loading: false });
      return;
    }
    const period = currentPeriodJst();
    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (snap) => {
      const data = snap.exists() ? snap.data() : {};
      const isOfficial = OFFICIAL_EMAILS.has(user.email || '');
      const planId: PlanId | 'official' = isOfficial ? 'official' : ((data.plan as PlanId) || 'free');

      // 無制限（official / enterprise）
      const planDef = getPlan(isOfficial ? 'free' : planId);
      const unlimited = isOfficial || planDef.monthlyCredits == null;

      const c = data.credits;
      let monthlyAllotment: number;
      let monthlyUsed: number;
      let topupBalance: number;

      if (c && typeof c === 'object') {
        // サーバが書いた正規データ。期が変わっていれば配布分は 0 とみなす。
        monthlyAllotment = unlimited ? Infinity : (c.monthlyAllotment ?? planDef.monthlyCredits ?? 0);
        monthlyUsed = c.period === period ? (c.monthlyUsed ?? 0) : 0;
        topupBalance = c.topupBalance ?? 0;
      } else {
        // 移行前フォールバック：plan ＋ 旧 aiUsage から導出。
        monthlyAllotment = unlimited ? Infinity : (planDef.monthlyCredits ?? 0);
        const usage = data.aiUsage?.tripo3d || {};
        const legacyCount = usage.lastMonthlyResetAt === period ? (usage.monthlyCount || 0) : 0;
        monthlyUsed = legacyCount * CREDIT_COST.model3d;
        topupBalance = 0;
      }

      const remaining = unlimited
        ? Infinity
        : Math.max(0, monthlyAllotment - monthlyUsed) + topupBalance;
      const model3dRemaining = unlimited ? Infinity : Math.floor(remaining / CREDIT_COST.model3d);

      setState({
        planId, monthlyAllotment, monthlyUsed, topupBalance,
        remaining, isUnlimited: unlimited, model3dRemaining, loading: false,
      });
    });
    return () => unsubscribe();
  }, [user]);

  return state;
};

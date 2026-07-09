import { useState, useEffect } from 'react';
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../../lib/firebase/client";
import { useAuth } from "@desktop/features/dsl/layout/hooks/useAuthProxy";
import { MODEL_3D_PLAN_REQUIRED, AI_3D_LIMITS, type UserPlan } from '../constants/ai-model-plans';

export const useAiModelLimits = () => {
  const { user } = useAuth();
  const [userPlan, setUserPlan] = useState<UserPlan>('free');
  const [userAiUsage, setUserAiUsage] = useState<any>({});

  useEffect(() => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserPlan(data.plan || 'free');
        setUserAiUsage(data.aiUsage || {});
      }
    });
    return () => unsubscribe();
  }, [user]);

  const getRemainingText = (modelId: string) => {
    const planLimits = (AI_3D_LIMITS as any)[userPlan]?.[modelId];
    if (!planLimits) return '';
    
    if (userPlan === 'enterprise' && modelId === 'tripo3d') {
      return ' (要相談)';
    }

    const usage = userAiUsage[modelId] || {};
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentDayStr = `${currentMonthStr}-${String(now.getDate()).padStart(2, '0')}`;
    
    let dailyCount = usage.lastDailyResetAt === currentDayStr ? (usage.dailyCount || 0) : 0;
    let monthlyCount = usage.lastMonthlyResetAt === currentMonthStr ? (usage.monthlyCount || 0) : 0;

    if (planLimits.daily !== Infinity) {
      const remain = Math.max(0, planLimits.daily - dailyCount);
      return ` (今日あと${remain}回)`;
    } else if (planLimits.monthly !== Infinity) {
      const remain = Math.max(0, planLimits.monthly - monthlyCount);
      return ` (今月あと${remain}回)`;
    }
    
    return ' (無制限)';
  };

  const isModelLocked = (modelId: string) => {
    const requiredPlan = MODEL_3D_PLAN_REQUIRED[modelId];
    if (requiredPlan === 'pro' && userPlan === 'free') return true;
    if (requiredPlan === 'enterprise' && userPlan !== 'enterprise') return true;
    
    const planLimits = (AI_3D_LIMITS as any)[userPlan]?.[modelId];
    if (!planLimits) return true;
    
    const usage = userAiUsage[modelId] || {};
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentDayStr = `${currentMonthStr}-${String(now.getDate()).padStart(2, '0')}`;
    
    let dailyCount = usage.lastDailyResetAt === currentDayStr ? (usage.dailyCount || 0) : 0;
    let monthlyCount = usage.lastMonthlyResetAt === currentMonthStr ? (usage.monthlyCount || 0) : 0;
    
    if (dailyCount >= planLimits.daily) return true;
    if (monthlyCount >= planLimits.monthly) return true;
    
    return false;
  };

  return { userPlan, userAiUsage, getRemainingText, isModelLocked };
};

import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '@desktop/lib/firebase/client';
import type { BuildingType, LayoutRuleSet, ZonePurpose, LayoutRuleSetVersion } from '../types/layoutRules';
import { DEFAULT_LAYOUT_RULES } from '../constants/defaultLayoutRules';

const COLLECTION_RULES = 'layout_rules';
const COLLECTION_VERSIONS = 'layout_rules_versions';

export const layoutRulesApi = {
  /**
   * ルールセットを優先順位に従って取得します
   * 1. プロジェクト固有 (projects/{projectId}/layout_rules/{buildingType}:{zonePurpose})
   * 2. ユーザー固有 (users/{userId}/layout_rules/{buildingType}:{zonePurpose})
   * 3. ユーザー固有 (users/{userId}/layout_rules/{buildingType})
   * 4. デフォルト (layout_rules/{buildingType}:{zonePurpose})
   * 5. デフォルト (layout_rules/{buildingType})
   * 6. コードベースのフォールバック
   */
  getLayoutRuleSet: async (
    buildingType: BuildingType,
    zonePurpose: ZonePurpose = 'general',
    projectId?: string,
    userId?: string
  ): Promise<LayoutRuleSet | null> => {
    const keyWithZone = `${buildingType}:${zonePurpose}`;
    const keyBuildingOnly = buildingType;

    const fetchDoc = async (path: string): Promise<LayoutRuleSet | null> => {
      try {
        const snap = await getDoc(doc(db, path));
        if (snap.exists()) return snap.data() as LayoutRuleSet;
      } catch (e) {
        console.error(`Failed to fetch rule from ${path}:`, e);
      }
      return null;
    };

    if (projectId) {
      const pRules = await fetchDoc(`projects/${projectId}/layout_rules/${keyWithZone}`);
      if (pRules) return pRules;
    }

    if (userId) {
      const uRulesZone = await fetchDoc(`users/${userId}/layout_rules/${keyWithZone}`);
      if (uRulesZone) return uRulesZone;
      
      const uRulesBuilding = await fetchDoc(`users/${userId}/layout_rules/${keyBuildingOnly}`);
      if (uRulesBuilding) return uRulesBuilding;
    }

    const dRulesZone = await fetchDoc(`${COLLECTION_RULES}/${keyWithZone}`);
    if (dRulesZone) return dRulesZone;

    const dRulesBuilding = await fetchDoc(`${COLLECTION_RULES}/${keyBuildingOnly}`);
    if (dRulesBuilding) return dRulesBuilding;

    return DEFAULT_LAYOUT_RULES[keyWithZone] || DEFAULT_LAYOUT_RULES[keyBuildingOnly] || null;
  },

  /**
   * 配置ルールセットを保存します (デフォルトコレクション)
   */
  saveLayoutRuleSet: async (ruleKey: string, ruleSet: LayoutRuleSet): Promise<void> => {
    try {
      const docRef = doc(db, COLLECTION_RULES, ruleKey);
      await setDoc(docRef, {
        ...ruleSet,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.error(`Failed to save layout rules for ${ruleKey}:`, e);
      throw e;
    }
  },

  /**
   * ユーザー固有の配置ルールセットを保存します
   */
  saveUserLayoutRuleSet: async (userId: string, ruleKey: string, ruleSet: LayoutRuleSet): Promise<void> => {
    try {
      const docRef = doc(db, `users/${userId}/layout_rules`, ruleKey);
      await setDoc(docRef, {
        ...ruleSet,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.error(`Failed to save user layout rules for ${ruleKey}:`, e);
      throw e;
    }
  },

  /**
   * 新しいバージョンを作成します
   */
  createVersion: async (ruleKey: string, ruleSet: LayoutRuleSet, userId: string): Promise<LayoutRuleSetVersion> => {
    const sequenceNumber = (await layoutRulesApi.getVersions(ruleKey)).length + 1;
    const versionId = `v_${Date.now()}`;
    const label = `v${sequenceNumber}`;
    
    const versionData: LayoutRuleSetVersion = {
      versionId,
      label,
      createdAt: serverTimestamp(),
      createdBy: userId,
      rules: {
        ...ruleSet,
        versionId
      }
    };

    try {
      const versionRef = doc(db, `${COLLECTION_VERSIONS}/${ruleKey}/versions`, versionId);
      await setDoc(versionRef, versionData);
      
      const docRef = doc(db, COLLECTION_RULES, ruleKey);
      await setDoc(docRef, { currentVersion: versionId }, { merge: true });
      
      return versionData;
    } catch (e) {
      console.error(`Failed to create version for ${ruleKey}:`, e);
      throw e;
    }
  },

  /**
   * 指定したルールキーの全バージョンを取得します
   */
  getVersions: async (ruleKey: string): Promise<LayoutRuleSetVersion[]> => {
    try {
      const q = query(collection(db, `${COLLECTION_VERSIONS}/${ruleKey}/versions`), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data() as LayoutRuleSetVersion);
    } catch (e) {
      console.error(`Failed to fetch versions for ${ruleKey}:`, e);
      return [];
    }
  },

  /**
   * バージョンを削除します
   */
  deleteVersion: async (ruleKey: string, versionId: string): Promise<void> => {
    try {
      const versionRef = doc(db, `${COLLECTION_VERSIONS}/${ruleKey}/versions`, versionId);
      await deleteDoc(versionRef);
    } catch (e) {
      console.error(`Failed to delete version ${versionId}:`, e);
      throw e;
    }
  },

  /**
   * デフォルトの配置ルールセットで上書きします
   */
  resetToDefault: async (ruleKey: string): Promise<LayoutRuleSet | null> => {
    const defaultRules = DEFAULT_LAYOUT_RULES[ruleKey];
    if (!defaultRules) return null;
    
    await layoutRulesApi.saveLayoutRuleSet(ruleKey, defaultRules);
    return defaultRules;
  }
};

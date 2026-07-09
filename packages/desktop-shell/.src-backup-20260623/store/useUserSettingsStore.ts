import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const MACRO_CATEGORY_ORDER = [
  '家具 (既製品)',
  '家具 (造作)',
  '設備・備品',
  'インテリア小物',
  'グリーン',
  '建築・空間'
];

export const DEFAULT_CATEGORY_MAP: Record<string, Record<string, string[]>> = {
  '家具 (既製品)': {
    'ソファ': ['1人掛けソファ', '2人掛けソファ', '3人掛けソファ', 'カウチソファ', 'モジュールソファ', 'オットマン'],
    'チェア': ['ダイニングチェア', 'ラウンジチェア', 'オフィスチェア', 'スツール', 'ベンチ', '座椅子', 'ゲーミングチェア'],
    'テーブル': ['ダイニングテーブル', 'ローテーブル', 'コーヒーテーブル', 'サイドテーブル', 'デスク', 'コンソールテーブル', '会議テーブル'],
    '収納・ボード': ['テレビボード', 'キャビネット', 'シェルフ・ラック', 'チェスト', '本棚', 'ワードローブ'],
    'ベッド': ['シングル', 'セミダブル', 'ダブル', 'クイーン', 'キング', '2段ベッド・ロフト'],
    '什器・業務用家具': ['陳列棚', 'ワゴン', 'レジカウンター', 'ディスプレイケース', 'ホワイトボード', 'マネキン・トルソー', '案内板・サイン', 'パーテーション', 'ロッカー', 'その他業務用'],
    'キッズ・ベビー': ['ベビーベッド', 'キッズチェア', '学習机', 'おもちゃ・遊具']
  },
  '家具 (造作)': {
    '造作収納': ['壁面収納', 'テレビボード一体型', '吊り戸棚', '床下収納', 'クローゼット内部'],
    '造作カウンター・デスク': ['キッチンカウンター', 'スタディデスク', 'バーカウンター', '受付カウンター'],
    '造作ベンチ・座席': ['窓際ベンチ（ヌック）', 'ダイニングベンチ', '待合ベンチ', 'ファミレス席'],
    '水回り造作': ['造作洗面台', 'トイレ手洗い'],
    '造作什器': ['オリジナル陳列棚', '店舗用造作カウンター', '展示台', 'ショーケース']
  },
  '建築・空間': {
    '建物モデル（全体）': ['戸建て住宅', '集合住宅', '店舗・レストラン', 'オフィスビル', '公共施設', '工場・倉庫', 'パビリオン'],
    '構造・躯体': ['柱', '梁', '壁', '床', '階段', '吹き抜け', '屋根', '天井', 'ルーバー・格子'],
    '建具（内装・外装）': ['片開きドア', '親子ドア', '引き戸', '折れ戸', '掃き出し窓', '腰窓', 'スリット窓', '天窓', 'ふすま', '障子', '室内窓'],
    '外構（エクステリア）': ['フェンス・柵', 'カーポート・ガレージ', '門扉・アプローチ', 'ウッドデッキ', 'テラス・バルコニー', '植栽・庭石', '舗装（ペイビング）', '屋外照明']
  },
  '設備・備品': {
    '水回り・住宅設備': ['システムキッチン', 'システムバス', 'トイレ', '洗面ボウル', '水栓金具', 'レンジフード'],
    '照明器具': ['ペンダントライト', 'シーリングライト', 'ダウンライト', 'スポットライト', 'フロアスタンド', 'ブラケットライト', 'シャンデリア', 'ダクトレール', '間接照明'],
    '家電・デバイス': ['テレビ', '冷蔵庫', '洗濯機', 'エアコン', 'PC・モニター', 'スピーカー', 'キッチン家電']
  },
  'インテリア小物': {
    '装飾・アート・趣味': ['アートフレーム・絵画', 'オブジェ・彫像', '時計', '本・雑誌・ファイル', '楽器', 'スポーツ・トレーニング器具', '自転車・モビリティ'],
    'ファブリック・窓周り': ['カーテン', 'ブラインド', 'ロールスクリーン', 'ラグ・カーペット', 'クッション・ブランケット'],
    '日用品・水周り小物': ['キッチン小物・調理器具', 'テーブルウェア（食器・グラス・カトラリー）', 'サニタリー小物', 'ゴミ箱（ダストボックス）']
  },
  'グリーン': {
    'インテリアグリーン': ['観葉植物（大型）', '観葉植物（小型）', 'プランター・鉢', 'ハンギング・壁面緑化', 'フェイクグリーン・造花']
  }
};

export const DEFAULT_OPTIONS = {
  buildingTypes: ['住宅', 'レストラン', 'ホテル', 'オフィス', '商業施設', '学校', '病院', '屋外'],
  rooms: ['リビング', 'ダイニング', 'キッチン', '寝室', '書斎', '子供部屋', '玄関', '廊下', '浴室', 'トイレ', 'バルコニー', 'エントランス', '会議室', '客席'],
  zones: ['リラックス', '食事', '作業', '収納', 'コミュニケーション', '通路', '水回り'],
  companionClasses: ['ダイニングセット', 'ソファセット', 'デスクセット', 'ベッドセット', 'アウトドアセット'],
  materials: ['木製', 'オーク', 'ウォルナット', 'スチール', 'アイアン', 'ガラス', 'レザー', 'ファブリック']
};

export type OptionField = 'buildingTypes' | 'rooms' | 'zones' | 'companionClasses' | 'materials';

export interface CustomCategory {
  id: string; // unique ID
  name: string; // The user-defined name
  baseMainCategory: string; // e.g. "家具"
  baseSubCategory: string; // e.g. "ソファ"
  timestamp: number;
}

export interface UserSettingsState {
  hiddenSystemDetailedCategories: string[]; // keys like "家具::ソファ::1人掛けソファ"

  // 自動保存設定（ローカル下書きのみ。クラウド書き込みは増やさない）
  autosaveEnabled: boolean;
  autosaveDebounceMs: number; // 編集停止後この時間で保存
  setAutosave: (patch: { enabled?: boolean; debounceMs?: number }) => void;

  customCategories: CustomCategory[];
  customTags: string[];

  toggleSystemCategoryVisibility: (main: string, sub: string, detail: string) => void;
  
  addCustomCategory: (cat: Omit<CustomCategory, 'id' | 'timestamp'>) => void;
  removeCustomCategory: (id: string) => void;

  addCustomTag: (tag: string) => void;
  removeCustomTag: (tag: string) => void;

  customOptions: Record<OptionField, string[]>;
  addCustomOption: (field: OptionField, value: string) => void;
  removeCustomOption: (field: OptionField, value: string) => void;
  getMergedOptions: (field: OptionField) => string[];

  getMergedCategoryMap: () => Record<string, Record<string, string[]>>;
  
  systemCategories: Record<string, Record<string, string[]>>;
  setSystemCategories: (categories: Record<string, Record<string, string[]>>) => void;
  syncUnsubscribe: (() => void) | null;
  startSystemCategoriesSync: () => void;
  addSystemCategory: (macroCategory: string, mainCategory: string, subCategory: string) => Promise<void>;
}

export const useUserSettingsStore = create<UserSettingsState>()(
  persist(
    (set, get) => ({
      hiddenSystemDetailedCategories: [],
      autosaveEnabled: true,
      autosaveDebounceMs: 2000,
      setAutosave: (patch) => set((state) => ({
        autosaveEnabled: patch.enabled ?? state.autosaveEnabled,
        autosaveDebounceMs: typeof patch.debounceMs === 'number'
          ? Math.max(500, patch.debounceMs)
          : state.autosaveDebounceMs,
      })),
      customCategories: [],
      customTags: [],
      customOptions: {
        buildingTypes: [],
        rooms: [],
        zones: [],
        companionClasses: [],
        materials: []
      },
      systemCategories: DEFAULT_CATEGORY_MAP,
      syncUnsubscribe: null,
      setSystemCategories: (categories) => set({ systemCategories: categories }),

      toggleSystemCategoryVisibility: (main, sub, detail) => {
        const key = `${main}::${sub}::${detail}`;
        set((state) => {
          if (state.hiddenSystemDetailedCategories.includes(key)) {
            return { hiddenSystemDetailedCategories: state.hiddenSystemDetailedCategories.filter(k => k !== key) };
          } else {
            return { hiddenSystemDetailedCategories: [...state.hiddenSystemDetailedCategories, key] };
          }
        });
      },

      addCustomCategory: (cat) => {
        set((state) => ({
          customCategories: [
            ...state.customCategories, 
            { ...cat, id: `custom_cat_${Date.now()}`, timestamp: Date.now() }
          ]
        }));
      },

      removeCustomCategory: (id) => {
        set((state) => ({
          customCategories: state.customCategories.filter(c => c.id !== id)
        }));
      },

      addCustomTag: (tag) => {
        set((state) => ({
          customTags: state.customTags.includes(tag) ? state.customTags : [...state.customTags, tag]
        }));
      },

      removeCustomTag: (tag) => {
        set((state) => ({
          customTags: state.customTags.filter(t => t !== tag)
        }));
      },

      addCustomOption: (field, value) => {
        set((state) => {
          const current = state.customOptions[field] || [];
          if (current.includes(value)) return {}; // no change
          return {
            customOptions: {
              ...state.customOptions,
              [field]: [...current, value]
            }
          };
        });
      },

      removeCustomOption: (field, value) => {
        set((state) => {
          const current = state.customOptions[field] || [];
          return {
            customOptions: {
              ...state.customOptions,
              [field]: current.filter(v => v !== value)
            }
          };
        });
      },

      getMergedOptions: (field) => {
        const state = get();
        const base = DEFAULT_OPTIONS[field] || [];
        const custom = state.customOptions[field] || [];
        // merge and filter duplicates just in case
        return Array.from(new Set([...base, ...custom]));
      },

      getMergedCategoryMap: () => {
        const state = get();
        // Deep clone from synchronized system categories
        const baseMap = state.systemCategories && Object.keys(state.systemCategories).length > 0 
          ? state.systemCategories 
          : DEFAULT_CATEGORY_MAP;
        
        const merged: Record<string, Record<string, string[]>> = JSON.parse(JSON.stringify(baseMap));

        // Legacy migration for old category names
        if (merged['家具 (既製品)'] && merged['家具 (既製品)']['店舗・オフィス什器']) {
            if (!merged['家具 (既製品)']['什器・業務用家具']) {
                merged['家具 (既製品)']['什器・業務用家具'] = [];
            }
            merged['家具 (既製品)']['店舗・オフィス什器'].forEach(detail => {
                if (!merged['家具 (既製品)']['什器・業務用家具'].includes(detail)) {
                    merged['家具 (既製品)']['什器・業務用家具'].push(detail);
                }
            });
            delete merged['家具 (既製品)']['店舗・オフィス什器'];
        }

        // Ensure ALL structure from DEFAULT_CATEGORY_MAP is present in merged map
        Object.keys(DEFAULT_CATEGORY_MAP).forEach(macro => {
          if (!merged[macro]) merged[macro] = {};
          Object.keys(DEFAULT_CATEGORY_MAP[macro as keyof typeof DEFAULT_CATEGORY_MAP]).forEach(sub => {
            if (!merged[macro][sub]) {
              merged[macro][sub] = [...(DEFAULT_CATEGORY_MAP as any)[macro][sub]];
            } else {
              (DEFAULT_CATEGORY_MAP as any)[macro][sub].forEach((detail: string) => {
                if (!merged[macro][sub].includes(detail)) merged[macro][sub].push(detail);
              });
            }
          });
        });

        // 1. Remove hidden system categories
        state.hiddenSystemDetailedCategories.forEach(key => {
          const [main, sub, detail] = key.split('::');
          if (merged[main] && merged[main][sub]) {
            merged[main][sub] = merged[main][sub].filter(d => d !== detail);
          }
        });

        // 2. Append custom categories into their respective base subcategories
        state.customCategories.forEach(custom => {
          const { baseMainCategory, baseSubCategory, name } = custom;
          if (!merged[baseMainCategory]) {
             merged[baseMainCategory] = {};
          }
          if (baseSubCategory) {
             if (!merged[baseMainCategory][baseSubCategory]) {
               merged[baseMainCategory][baseSubCategory] = [];
             }
             if (name && !merged[baseMainCategory][baseSubCategory].includes(name)) {
               merged[baseMainCategory][baseSubCategory].push(name);
             }
          }
        });

        // 3. Sort keys to maintain desired application-wide order
        const sortedMerged: Record<string, Record<string, string[]>> = {};
        MACRO_CATEGORY_ORDER.forEach(key => {
          if (merged[key]) {
            sortedMerged[key] = merged[key];
          }
        });
        
        // Append any categories that weren't in MACRO_CATEGORY_ORDER
        Object.keys(merged).forEach(key => {
          if (!sortedMerged[key]) {
             sortedMerged[key] = merged[key];
          }
        });

        return sortedMerged;
      },

      addSystemCategory: async (macroCategory, mainCategory, subCategory) => {
        const { db } = await import('../lib/firebase/client');
        const { doc, getDoc, setDoc } = await import('firebase/firestore');
        const docRef = doc(db, 'appGlobalConfig', 'systemCategories');
        const d = await getDoc(docRef);
        
        let cats = JSON.parse(JSON.stringify(DEFAULT_CATEGORY_MAP)); // fallback
        if (d.exists() && d.data().categories) {
          cats = d.data().categories; // firestore data is safe to mutate
        }

        if (!cats[macroCategory]) cats[macroCategory] = {};
        if (mainCategory) {
           if (!cats[macroCategory][mainCategory]) cats[macroCategory][mainCategory] = [];
           if (subCategory && !cats[macroCategory][mainCategory].includes(subCategory)) {
              cats[macroCategory][mainCategory].push(subCategory);
           }
        }

        await setDoc(docRef, { categories: cats, updatedAt: new Date().toISOString() }, { merge: true });
      },

      startSystemCategoriesSync: () => {
        const state = get();
        if (state.syncUnsubscribe) return; // Already syncing
        
        import('../lib/firebase/client').then(({ db }) => {
          import('firebase/firestore').then(({ doc, onSnapshot, getDoc, setDoc }) => {
            const docRef = doc(db, 'appGlobalConfig', 'systemCategories');
            const unsubscribe = onSnapshot(docRef, async (snap) => {
              if (snap.exists()) {
                const data = snap.data();
                if (data.categories) {
                  get().setSystemCategories(data.categories);
                }
              } else {
                // Initialize default logic if config doesn't exist
                try {
                   await setDoc(docRef, { categories: DEFAULT_CATEGORY_MAP, updatedAt: new Date().toISOString() }, { merge: true });
                } catch (e) {
                   console.error("Failed to initialize system categories in Firestore", e);
                }
              }
            }, (error) => {
              console.error("Failed to sync system categories", error);
            });
            set({ syncUnsubscribe: unsubscribe });
          });
        });
      }
    }),
    {
      name: 'sekkeiya-user-settings-storage',
      version: 1,
    }
  )
);

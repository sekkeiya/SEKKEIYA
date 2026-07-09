import { create } from 'zustand';

export interface AiDocument {
  id: string;
  title: string;
  category: string;
  tags: string[];
  uploadedAt: string;
  summary: string;
  extractedCriteria: Array<{ id: string; label: string; description: string; type: 'rule' | 'context' }>;
}

export interface AiProfile {
  id: string;
  name: string;
  description: string;
  avatarColor: string;
  documentCount: number;
  itemCount: number;
  ruleCount: number;
  lastUpdated: string;
  isActive: boolean;
}

interface AiStudioState {
  profiles: AiProfile[];
  documents: AiDocument[];
  selectedDocumentId: string | null;
  activateProfile: (id: string) => void;
  selectDocument: (id: string | null) => void;
}

const MOCK_PROFILES: AiProfile[] = [
  {
    id: 'ai_3dss_classifier',
    name: 'S.Models アセット自動分類 AI',
    description: '3Dモデル（GLB）のファイル名やタグから、カテゴリとサイズを自動で推論・分類するAI。',
    avatarColor: 'hsl(210, 70%, 50%)',
    documentCount: 0,
    itemCount: 0,
    ruleCount: 0,
    lastUpdated: new Date().toISOString(),
    isActive: true,
  },
  {
    id: 'ai_3dss_recommender',
    name: 'S.Models 家具レコメンド AI (Gemini)',
    description: '指定されたゾーンの用途・面積・目標人数に基づいて、最適な家具と数量を自動選定するAI。',
    avatarColor: 'hsl(350, 70%, 50%)',
    documentCount: 0,
    itemCount: 0,
    ruleCount: 0,
    lastUpdated: new Date().toISOString(),
    isActive: false,
  },
  {
    id: 'ai_3dsl_layout',
    name: 'S.Layout レイアウト指示 AI (Gemini)',
    description: '選定された家具リストとゾーン寸法から、セマンティックな配置ルールを計算するレイアウト特化AI。',
    avatarColor: 'hsl(120, 60%, 45%)',
    documentCount: 0,
    itemCount: 0,
    ruleCount: 0,
    lastUpdated: new Date().toISOString(),
    isActive: false,
  }
];

const MOCK_DOCUMENTS: AiDocument[] = [];

export const useAiStudioStore = create<AiStudioState>((set) => ({
  profiles: MOCK_PROFILES,
  documents: MOCK_DOCUMENTS,
  selectedDocumentId: null,
  activateProfile: (id: string) => set((state) => ({
    profiles: state.profiles.map(p => ({
      ...p,
      isActive: p.id === id
    }))
  })),
  selectDocument: (id) => set({ selectedDocumentId: id })
}));

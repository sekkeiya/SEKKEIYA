import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { buildJournalContextSummary } from './utils/buildJournalContextSummary';
import { db, functions } from '../lib/firebase/client';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

export interface BaseModel {
  id: string; 
  type: 'local' | 'cloud';
  provider: 'google' | 'openai' | 'ollama';
  contextWindow: number;
}

export interface LoraAdapter {
  id: string; 
  name: string;
  targetBaseModelId: string; 
  description: string;
  filePath: string; 
}

export interface KnowledgeSource {
  id: string;
  type: 'document' | 'extracted_rule' | 'note' | 'project_context';
  title: string;
  content?: string;
  vectorStoreId?: string;
  // RAG ingestion 由来のフィールド (Firestore: users/{uid}/knowledgeSources)
  status?: 'ingesting' | 'ready' | 'error';
  summary?: string;
  chunkCount?: number;
  textLength?: number;
  usedOcr?: boolean;
  sourceFile?: string;
  createdAt?: number;
  errorMessage?: string;
  metadata?: {
    sourceFile?: string;
  };
}

export type SaveDataActionType = 
  | 'PROPOSAL_ACCEPTED' 
  | 'PROPOSAL_REJECTED' 
  | 'MODEL_ATTACHED' 
  | 'MODEL_REMOVED' 
  | 'LAYOUT_ITEM_MOVED' 
  | 'LAYOUT_ITEM_REPLACED' 
  | 'MATERIAL_CHANGED' 
  | 'METADATA_CORRECTED'
  | 'UNDO_PERFORMED';

export interface SaveDataEvent {
  id: string;
  userId: string;
  actionType: SaveDataActionType | string;
  context: {
    projectId?: string;
    workspaceId?: string;
    targetType?: string;
    targetId?: string;
    source?: 'user' | 'ai';
    payload?: any;
  }; 
  timestamp: number;
  isSummarized?: boolean;
  summarizedAt?: number;
  memoryId?: string;
}

export interface SaveDataMemory {
  id: string;
  userId: string;
  topic: string; 
  summary: string; 
  confidenceScore: number;
  lastUpdated: number;
  sourceEventIds: string[];
  profileId?: string;
  projectId?: string;
}

export type AiProfileRole = 'core_orchestrator' | 'critic' | 'assistant' | 'specialized';
export type AiUsageScope = 'dashboard_chat' | 'sidebar_chat' | 'evaluation' | 'layout' | 'presentation';

export interface AiProfile {
  id: string; 
  category: 'Orchestrator' | 'Assistant' | 'Specialized';
  role: AiProfileRole;
  usageScopes: AiUsageScope[];
  name: string;
  description: string;
  status: 'Active' | 'Standby';

  baseModelId: string;           
  systemPrompt: string;          
  temperature: number;           
  
  equippedLoras: string[];       
  equippedKnowledge: string[];   
  
  useSaveDataMemories: boolean;  
}

interface AiProfileState {
  baseModels: BaseModel[];
  loraAdapters: LoraAdapter[];
  knowledgeSources: KnowledgeSource[];
  aiProfiles: AiProfile[];
  saveDataEvents: SaveDataEvent[];
  saveDataMemories: SaveDataMemory[];
  
  knowledgeLoaded: boolean;
  knowledgeBusy: boolean;

  updateAiProfile: (id: string, updates: Partial<AiProfile>) => void;
  /** チャット等から重要情報を手動でメモリに保存する（以降の推論コンテキストへ注入）。 */
  addManualMemory: (summary: string, topic?: string) => void;
  logSaveDataEvent: (eventPayload: Omit<SaveDataEvent, 'id' | 'timestamp'>) => void;
  synthesizeEventsToMemory: (options?: { targetEventIds?: string[], profileId?: string, projectId?: string }) => void;
  buildCompleteSystemPrompt: (profileId: string) => Promise<string>;

  // Knowledge / RAG (Firestore-backed)
  loadKnowledgeSources: (uid: string) => Promise<void>;
  ingestKnowledgeSource: (params: { uid: string; title: string; text: string; sourceFile?: string; images?: { data: string; mimeType: string }[] }) => Promise<string>;
  removeKnowledgeSource: (uid: string, id: string) => Promise<void>;
  toggleKnowledgeOnProfile: (profileId: string, knowledgeId: string) => void;
}

// ------------------------------------------------------------------
// Mock LLM Synthesizer (Abstracted entry point for pipeline testing)
// ------------------------------------------------------------------
function mockMemorySynthesizer(events: SaveDataEvent[]): Partial<SaveDataMemory> {
  const materials = events.filter(e => e.actionType === 'MATERIAL_CHANGED').map(e => String(e.context.payload?.materialName || e.context.payload?.id || '')).filter(Boolean);
  const accepted = events.filter(e => e.actionType === 'PROPOSAL_ACCEPTED').map(e => String(e.context.payload?.prompt || e.context.targetId || '')).filter(Boolean);
  const rejected = events.filter(e => e.actionType === 'PROPOSAL_REJECTED').map(e => String(e.context.payload?.prompt || e.context.targetId || '')).filter(Boolean);

  let summary = "様々な操作ログから、ユーザーの一定の作業リズムが推測されます。";
  let topic = "General Workflow";
  
  if (materials.length > 0) {
    const hasWood = materials.some(m => m.toLowerCase().includes('wood') || m.toLowerCase().includes('木') || m.toLowerCase().includes('oak'));
    if (hasWood) {
      summary = "木質感を好む傾向が見られます。温かみのある素材を提案すると反応が良さそうです。";
      topic = "Material Preference (Wood)";
    } else {
       summary = `${materials[0]} 等の特定の素材を意図的に選択している傾向があります。`;
       topic = "Material Selection";
    }
  } else if (accepted.length > 0) {
    const isMinimal = accepted.some(a => a.toLowerCase().includes('minimal') || a.toLowerCase().includes('clean'));
    if (isMinimal) {
      summary = "ミニマルでクリーンなデザインの提案を好んで採用しています。";
      topic = "Style Preference (Minimalist)";
    } else {
      summary = `「${accepted[0]}」のようなテイストの提案を受け入れる傾向があります。`;
      topic = "Style Preference";
    }
  } else if (rejected.length > 0) {
    const isMetal = rejected.some(a => a.toLowerCase().includes('metal') || a.toLowerCase().includes('金属'));
    if (isMetal) {
      summary = "金属などの冷たい質感やインダストリアル系の提案は避ける傾向があります。";
      topic = "Avoidance Preference (Industrial/Metal)";
    } else {
      summary = `「${rejected[0]}」を含む提案は棄却される傾向があります。`;
      topic = "Avoidance Preference";
    }
  }

  return {
    topic,
    summary,
    confidenceScore: Math.min(0.5 + (events.length * 0.1), 0.95)
  };
}

const SEED_BASE_MODELS: BaseModel[] = [
  { id: 'gpt-4o', type: 'cloud', provider: 'openai', contextWindow: 128000 },
  { id: 'gemma-2b-it', type: 'local', provider: 'ollama', contextWindow: 8192 },
  { id: 'gemini-1.5-pro', type: 'cloud', provider: 'google', contextWindow: 2000000 },
  { id: 'hybrid-rule-engine', type: 'local', provider: 'sekkeiya', contextWindow: 0 },
];

const SEED_KNOWLEDGE_SOURCES: KnowledgeSource[] = [];

const SEED_AI_PROFILES: AiProfile[] = [
  {
    id: 'sekkeiya-core:latest',
    name: 'SEKKEIYA Core Orchestrator',
    category: 'Orchestrator',
    role: 'core_orchestrator',
    usageScopes: ['dashboard_chat', 'sidebar_chat'],
    description: '設計フロー全体を管理し、適切なツールやサブAIへルーティングを行う司令塔AI',
    status: 'Active',
    baseModelId: 'gpt-4o',
    systemPrompt: 'あなたはSEKKEIYAのメインプロセッサであり、ユーザーの意図を汲み取り、提供されたAction（Tool）を組み合わせて目的を達成するルーティングエージェントです。',
    temperature: 0.2,
    equippedLoras: [],
    equippedKnowledge: [],
    useSaveDataMemories: true
  },
  {
    id: 'ai-3dss-classifier:latest',
    name: 'S.Model アセット自動分類 AI',
    category: 'Specialized',
    role: 'specialized',
    usageScopes: ['evaluation'],
    description: '3Dモデル（GLB）のファイル名やタグから、カテゴリとサイズを自動で推論・分類するAI。',
    status: 'Standby',
    baseModelId: 'hybrid-rule-engine',
    systemPrompt: '【ハイブリッド・パイプライン】\n1. GLBのBounding Box解析から XYZ 寸法を抽出\n2. ファイル名・既存メタデータからルールベースでカテゴリを初期割り当て\n3. ユーザーの修正履歴（フィードバック）を教師データとして継続的ファインチューニングを実施',
    temperature: 0.1,
    equippedLoras: [],
    equippedKnowledge: [],
    useSaveDataMemories: false
  },
  {
    id: 'ai-3dss-recommender:gemini',
    name: 'S.Model 家具レコメンド AI (Gemini)',
    category: 'Assistant',
    role: 'assistant',
    usageScopes: ['presentation', 'layout'],
    description: '指定されたゾーンの用途・面積・目標人数に基づいて、最適な家具と数量を自動選定するAI。FirebaseのGemini APIを経由して稼働します。',
    status: 'Standby',
    baseModelId: 'gemini-2.5-flash',
    systemPrompt: 'あなたは空間デザインコンテキストから適切な家具アセットを推薦するレコメンデーションエンジンです。ゾーン情報と利用可能なアセットを受け取り、最適な組み合わせをJSONで出力してください。',
    temperature: 0.1,
    equippedLoras: [],
    equippedKnowledge: [],
    useSaveDataMemories: false
  },
  {
    id: 'ai-layout-coordinator:gemini',
    name: 'S.Layout レイアウト指示 AI (Gemini)',
    category: 'Specialized',
    role: 'specialized',
    usageScopes: ['layout'],
    description: '選定された家具リストとゾーン寸法から、「center」「around」「wall」などのセマンティックな配置ルールを計算するレイアウト特化AI。',
    status: 'Standby',
    baseModelId: 'gemini-2.5-flash',
    systemPrompt: 'あなたは2D/3D空間での配置ルール生成に特化したレイアウトエージェントです。物理的な配置の制約を考慮し、他の家具との関係性をJSONで出力してください。',
    temperature: 0.1,
    equippedLoras: [],
    equippedKnowledge: [],
    useSaveDataMemories: false
  }
];

export const useAiProfileStore = create<AiProfileState>()(
  persist(
    (set, get) => ({
      baseModels: SEED_BASE_MODELS,
      loraAdapters: [],
      knowledgeSources: SEED_KNOWLEDGE_SOURCES,
      aiProfiles: SEED_AI_PROFILES,
      saveDataEvents: [],
      saveDataMemories: [],
      knowledgeLoaded: false,
      knowledgeBusy: false,

      loadKnowledgeSources: async (uid) => {
        if (!uid) return;
        try {
          const q = query(collection(db, 'users', uid, 'knowledgeSources'), orderBy('createdAt', 'desc'));
          const snap = await getDocs(q);
          const sources: KnowledgeSource[] = snap.docs.map((d) => {
            const data = d.data() as any;
            return {
              id: d.id,
              type: (data.type || 'document') as KnowledgeSource['type'],
              title: data.title || 'Untitled',
              summary: data.summary || '',
              chunkCount: data.chunkCount || 0,
              textLength: data.textLength || 0,
              usedOcr: !!data.usedOcr,
              sourceFile: data.sourceFile || '',
              status: (data.status || 'ready') as KnowledgeSource['status'],
              createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
            };
          });
          set({ knowledgeSources: sources, knowledgeLoaded: true });
        } catch (err) {
          console.error('[AI Profile Store] loadKnowledgeSources failed:', err);
          set({ knowledgeLoaded: true });
        }
      },

      ingestKnowledgeSource: async ({ uid, title, text, sourceFile, images }) => {
        const tempId = `tmp-${Date.now()}`;
        set((state) => ({
          knowledgeBusy: true,
          knowledgeSources: [
            { id: tempId, type: 'document', title, status: 'ingesting', sourceFile: sourceFile || '', chunkCount: 0, createdAt: Date.now() },
            ...state.knowledgeSources,
          ],
        }));
        try {
          const fn = httpsCallable(functions, 'ingestKnowledge', { timeout: 290000 });
          await fn({ title, text, sourceFile: sourceFile || '', images: images || null });
          // Firestore から正規データを再読込してテンポラリを置換
          await get().loadKnowledgeSources(uid);
          set({ knowledgeBusy: false });
          return tempId;
        } catch (err: any) {
          console.error('[AI Profile Store] ingestKnowledge failed:', err);
          set((state) => ({
            knowledgeBusy: false,
            knowledgeSources: state.knowledgeSources.map((k) =>
              k.id === tempId ? { ...k, status: 'error', errorMessage: err?.message || '取り込みに失敗しました' } : k
            ),
          }));
          throw err;
        }
      },

      removeKnowledgeSource: async (uid, id) => {
        // テンポラリ/失敗ソースはローカル削除のみ
        if (id.startsWith('tmp-')) {
          set((state) => ({ knowledgeSources: state.knowledgeSources.filter((k) => k.id !== id) }));
          return;
        }
        try {
          const fn = httpsCallable(functions, 'deleteKnowledgeSource');
          await fn({ sourceId: id });
        } catch (err) {
          console.error('[AI Profile Store] deleteKnowledgeSource failed:', err);
        }
        set((state) => ({
          knowledgeSources: state.knowledgeSources.filter((k) => k.id !== id),
          aiProfiles: state.aiProfiles.map((p) => ({
            ...p,
            equippedKnowledge: (p.equippedKnowledge || []).filter((kid) => kid !== id),
          })),
        }));
      },

      toggleKnowledgeOnProfile: (profileId, knowledgeId) =>
        set((state) => ({
          aiProfiles: state.aiProfiles.map((p) => {
            if (p.id !== profileId) return p;
            const has = (p.equippedKnowledge || []).includes(knowledgeId);
            return {
              ...p,
              equippedKnowledge: has
                ? p.equippedKnowledge.filter((k) => k !== knowledgeId)
                : [...(p.equippedKnowledge || []), knowledgeId],
            };
          }),
        })),

      updateAiProfile: (id, updates) =>
        set((state) => ({
          aiProfiles: state.aiProfiles.map((profile) =>
            profile.id === id ? { ...profile, ...updates } : profile
          )
        })),

      addManualMemory: (summary, topic) =>
        set((state) => {
          const text = String(summary || '').trim();
          if (!text) return state;
          const mem: SaveDataMemory = {
            id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            userId: 'local',
            topic: topic || 'チャットメモ',
            summary: text.length > 500 ? text.slice(0, 500) + '…' : text,
            confidenceScore: 0.9,
            lastUpdated: Date.now(),
            sourceEventIds: [],
          };
          return { saveDataMemories: [mem, ...state.saveDataMemories] };
        }),
        
      logSaveDataEvent: (eventPayload) =>
        set((state) => {
          const newEvent: SaveDataEvent = {
            id: `ev-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            ...eventPayload,
          };
          // Keep a reasonable limit on local storage events to prevent unlimited growth (e.g., last 1000)
          const newEvents = [...state.saveDataEvents, newEvent].slice(-1000);
          console.log('[AI Profile Store] Logged Event:', newEvent);
          return { saveDataEvents: newEvents };
        }),

      synthesizeEventsToMemory: (options) => 
        set((state) => {
          let targetEvents = state.saveDataEvents.filter(e => !e.isSummarized);
          
          if (options?.targetEventIds && options.targetEventIds.length > 0) {
            targetEvents = targetEvents.filter(e => options.targetEventIds!.includes(e.id));
          }

          if (targetEvents.length === 0) return state; // Nothing to do

          const partialMem = mockMemorySynthesizer(targetEvents);
          
          const now = Date.now();
          const targetEventIds = targetEvents.map(e => e.id);
          const eventIdsSet = new Set(targetEventIds);

          let updatedMemories = [...state.saveDataMemories];
          let updatedMemoryId = '';

          // Find if there's an existing memory with the same topic
          const existingMemoryIndex = updatedMemories.findIndex(m => m.topic === partialMem.topic);

          if (existingMemoryIndex >= 0) {
            // Update existing memory
            const existing = updatedMemories[existingMemoryIndex];
            
            // Prevent exact duplicate event processing
            const hasNewEvents = targetEventIds.some(id => !existing.sourceEventIds.includes(id));
            if (!hasNewEvents) return state; // Already processed these events

            updatedMemoryId = existing.id;
            const mergedEvents = Array.from(new Set([...existing.sourceEventIds, ...targetEventIds]));

            updatedMemories[existingMemoryIndex] = {
              ...existing,
              summary: partialMem.summary || existing.summary,
              confidenceScore: Math.min(existing.confidenceScore + 0.1, 0.95), // Increase confidence on recurring topic
              lastUpdated: now,
              sourceEventIds: mergedEvents,
            };
          } else {
            // Create new memory
            updatedMemoryId = `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            updatedMemories.push({
              id: updatedMemoryId,
              userId: targetEvents[0].userId,
              topic: partialMem.topic || 'Untitled Memory',
              summary: partialMem.summary || 'Summary could not be generated.',
              confidenceScore: partialMem.confidenceScore || 0.5,
              lastUpdated: now,
              sourceEventIds: targetEventIds,
              profileId: options?.profileId, // Link to AI if passed
              projectId: options?.projectId || targetEvents.find(e => e.context.projectId)?.context.projectId
            });
          }

          const updatedEvents = state.saveDataEvents.map(e => {
            if (eventIdsSet.has(e.id)) {
              return { ...e, isSummarized: true, summarizedAt: now, memoryId: updatedMemoryId };
            }
            return e;
          });

          return {
            saveDataMemories: updatedMemories,
            saveDataEvents: updatedEvents
          };
        }),

      buildCompleteSystemPrompt: async (profileId: string) => {
        const state = get();
        const profile = state.aiProfiles.find((p: AiProfile) => p.id === profileId);
        
        if (!profile) return "Profile not found.";

        const promptSections = [];

        // 1. Base Role / System Prompt
        promptSections.push(`### [Base Role & System Prompt]\n${profile.systemPrompt}`);

        // 2. Active Profile Metadata (Role, Scopes, Model)
        promptSections.push(`### [Active Profile Context]\nRole: ${profile.role}\nCategory: ${profile.category}\nIntended Scopes: ${profile.usageScopes.join(', ')}`);

        // 3. Dynamic Project & Workspace Context (Journal Aggregation Layer)
        const contextSummary = await buildJournalContextSummary();
        if (contextSummary) {
          promptSections.push(contextSummary);
        }

        // 4. User Design Tendencies (SaveDataMemory)
        if (profile.useSaveDataMemories && state.saveDataMemories.length > 0) {
          // In a real system, you might filter memories by projectId or semantic similarity (RAG).
          // For now, we inject recently updated memories to inform the AI.
          const memoryList = state.saveDataMemories
             .sort((a: SaveDataMemory, b: SaveDataMemory) => b.lastUpdated - a.lastUpdated)
             .map((m: SaveDataMemory) => `- [${m.topic}] (Confidence: ${m.confidenceScore.toFixed(2)}): ${m.summary}`)
             .join('\n');
             
          promptSections.push(`### [User Design Tendencies]\nThe following facts represent the user's recent behaviors, design preferences, and workflow states:\n${memoryList}`);
        }

        // 5. Connected Knowledge Summary
        if (profile.equippedKnowledge.length > 0) {
          const knowledgeList = profile.equippedKnowledge
            .map((kid: string) => state.knowledgeSources.find((k: KnowledgeSource) => k.id === kid))
            .filter(Boolean)
            .map((k: KnowledgeSource | undefined) => `- ${k!.title} (${k!.type})`)
            .join('\n');
            
          if (knowledgeList) {
             promptSections.push(`### [Connected Knowledge Context]\nThe following knowledge bases are available or have been retrieved for this session:\n${knowledgeList}`);
          }
        }

        // 6. Build final prompt
        return promptSections.join('\n\n');
      }
    }),
    {
      name: 'sekkeiya-ai-profile-storage',
      version: 2,
      // 旧名(3DSS/3DSL...)で永続化されたプロファイルの表示名・説明をシード(S.*)で更新する。
      // ユーザー調整値(temperature/systemPrompt/baseModelId/scopes/equippedKnowledge等)は保持。
      migrate: (persisted: any) => {
        if (!persisted || typeof persisted !== 'object') return persisted;
        try {
          const seedById = Object.fromEntries(SEED_AI_PROFILES.map((p) => [p.id, p]));
          const existing = Array.isArray(persisted.aiProfiles) ? persisted.aiProfiles : [];
          const existingIds = new Set(existing.map((p: any) => p.id));
          const merged = existing.map((p: any) => {
            const seed = seedById[p.id];
            return seed
              ? { ...p, name: seed.name, description: seed.description, category: seed.category, role: seed.role }
              : p;
          });
          for (const seed of SEED_AI_PROFILES) {
            if (!existingIds.has(seed.id)) merged.push(seed);
          }
          persisted.aiProfiles = merged;
        } catch (e) {
          console.warn('[AI Profile Store] migrate failed:', e);
        }
        return persisted;
      },
    }
  )
);

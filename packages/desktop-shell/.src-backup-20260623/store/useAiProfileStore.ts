import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { buildJournalContextSummary } from './utils/buildJournalContextSummary';

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
  content: string; 
  vectorStoreId?: string; 
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
  
  updateAiProfile: (id: string, updates: Partial<AiProfile>) => void;
  logSaveDataEvent: (eventPayload: Omit<SaveDataEvent, 'id' | 'timestamp'>) => void;
  synthesizeEventsToMemory: (options?: { targetEventIds?: string[], profileId?: string, projectId?: string }) => void;
  buildCompleteSystemPrompt: (profileId: string) => Promise<string>;
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
    name: 'S.Models アセット自動分類 AI',
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
    name: 'S.Models 家具レコメンド AI (Gemini)',
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
      
      updateAiProfile: (id, updates) => 
        set((state) => ({
          aiProfiles: state.aiProfiles.map((profile) => 
            profile.id === id ? { ...profile, ...updates } : profile
          )
        })),
        
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
      name: 'sekkeiya-ai-profile-storage'
    }
  )
);

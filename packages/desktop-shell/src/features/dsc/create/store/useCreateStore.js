import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useCreateStore = create(
  persist(
    (set) => ({
  sourceContext: {
    from: null,
    projectId: null,
    boardId: null,
    autoInsertToBoard: false,
  },
  setSourceContext: (context) => set({ sourceContext: { ...context } }),

  generationInput: {
    prompt: '',
    imageFile: null,
    imagePreviewUrl: null,
    domain: 'furniture',
    engine: 'self-furniture-v1',
    quality: 'standard',
  },
  updateGenerationInput: (updates) => set((state) => ({
    generationInput: { ...state.generationInput, ...updates }
  })),

  generationJob: {
    id: null,
    ownerId: null,
    sourceApp: '3dshapecreate',
    sourceContext: { from: null, projectId: null, boardId: null, autoInsertToBoard: false },
    engine: null,
    domain: null,
    quality: null,
    status: 'idle', // idle, queued, running, postprocessing, done, error
    progress: 0,
    inputImagePath: null,
    resultGlbPath: null,
    resultPreviewImagePath: null,
    resultModelId: null,
    savedAssetId: null,
    savedAt: null,
    errorMessage: null,
    createdAt: null,
    updatedAt: null,
  },
  resetGenerationJob: () => set({
    generationJob: {
      id: null, ownerId: null, sourceApp: '3dshapecreate',
      sourceContext: { from: null, projectId: null, boardId: null, autoInsertToBoard: false },
      engine: null, domain: null, quality: null,
      status: 'idle', progress: 0, inputImagePath: null,
      resultGlbPath: null, resultPreviewImagePath: null, resultModelId: null,
      savedAssetId: null, savedAt: null, errorMessage: null, createdAt: null, updatedAt: null,
    },
    uiState: {
      isSubmitting: false, isSaving: false, canGenerate: false,
      canSave: false, canInsertToLayout: false,
    }
  }),
  updateGenerationJob: (updates) => set((state) => ({
    generationJob: { ...state.generationJob, ...updates }
  })),

  recentJobs: [],
  addRecentJob: (jobStr) => set((state) => {
    // Check if it exists to avoid duplicates if API fires multiple updates
    const exists = state.recentJobs.find(j => j.id === jobStr.id);
    if (exists) return state;
    return { recentJobs: [jobStr, ...state.recentJobs] };
  }),
  restoreJob: (jobStr) => set({ generationJob: jobStr }),


  uiState: {
    isSubmitting: false,
    isSaving: false,
    canGenerate: false, // Wait until image selected
    canSave: false,
    canInsertToLayout: false,
  },
  updateUiState: (updates) => set((state) => ({
    uiState: { ...state.uiState, ...updates }
  })),
  }),
  {
    name: '3dsc-store',
    partialize: (state) => ({ recentJobs: state.recentJobs }),
  }
));

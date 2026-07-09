import { useCallback, useRef } from 'react';
import { useCreateStore } from '../../../store/useCreateStore';
import { createGenerationJob, subscribeGenerationJob, updateGenerationJobStatus, finalizeGenerationJob } from '../api/generationJobApi';
import { uploadGenerationSourceImage } from '../api/uploadApi';
import { mockGenerate } from '../api/mockGenerateApi';

export function useDummyGeneration() {
  const { sourceContext, generationInput } = useCreateStore();
  const updateGenerationJob = useCreateStore((state) => state.updateGenerationJob);
  const updateUiState = useCreateStore((state) => state.updateUiState);
  
  const timerRef = useRef(null);
  const unsubscribeRef = useRef(null);

  const startDummyGeneration = useCallback(async () => {
    updateUiState({ isSubmitting: true, canSave: false, canInsertToLayout: false });
    
    // Simulate Image Upload
    const { path: inputImagePath } = await uploadGenerationSourceImage(generationInput.imageFile, 'temp-job-id');

    // Create Job Payload (matches future Firestore shape)
    const payload = {
      ownerId: 'dummy-user-123',
      sourceApp: '3dshapecreate',
      sourceContext: sourceContext,
      domain: generationInput.domain,
      engine: generationInput.engine,
      quality: generationInput.quality,
      inputImagePath,
      status: 'queued',
      progress: 0,
    };
    
    const { id: jobId } = await createGenerationJob(payload);

    // Subscribe to Firestore-like mock
    unsubscribeRef.current = subscribeGenerationJob(jobId, (updatedJob) => {
      updateGenerationJob(updatedJob);
      if (updatedJob.status === 'done' || updatedJob.status === 'error') {
        updateUiState({ 
          isSubmitting: false, 
          canSave: updatedJob.status === 'done', 
          canInsertToLayout: updatedJob.status === 'done' 
        });
        if (updatedJob.status === 'done') {
          useCreateStore.getState().addRecentJob(updatedJob);
        }
        if (unsubscribeRef.current) unsubscribeRef.current();
      }
    });

    // Simulate backend worker updating the job
    const steps = [
      { status: 'queued', progress: 5, delay: 1000 },
      { status: 'running', progress: 20, delay: 1000 },
      { status: 'running', progress: 50, delay: 2000 },
      { status: 'postprocessing', progress: 80, delay: 2000 },
    ];

    let currentStepIndex = 0;

    const runStep = async () => {
      if (currentStepIndex >= steps.length) {
        // Call the mock generate API with engine and domain choices
        const result = await mockGenerate({
          domain: generationInput.domain,
          engine: generationInput.engine,
          quality: generationInput.quality,
          prompt: generationInput.prompt,
        });

        // Finalize
        await finalizeGenerationJob(jobId, {
          resultPreviewImagePath: result.data.resultPreviewImagePath,
          resultGlbPath: result.data.resultGlbPath,
          resultModelId: result.data.modelId,
        });
        return;
      }

      const step = steps[currentStepIndex];
      await updateGenerationJobStatus(jobId, step.status, step.progress);
      
      timerRef.current = setTimeout(() => {
        currentStepIndex++;
        runStep();
      }, step.delay);
    };

    runStep();

  }, [sourceContext, generationInput, updateGenerationJob, updateUiState]);

  const cancelDummyGeneration = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }
    updateGenerationJob({ status: 'idle', progress: 0 });
    updateUiState({ isSubmitting: false });
  }, [updateGenerationJob, updateUiState]);

  return {
    startDummyGeneration,
    cancelDummyGeneration,
  };
}

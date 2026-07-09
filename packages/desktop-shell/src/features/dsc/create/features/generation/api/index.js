import * as mockGenerationApi from './generationJobApi.mock';
import * as firebaseGenerationApi from './generationJobApi.firebase';

import * as mockUploadApi from './uploadApi.mock';
import * as firebaseUploadApi from './uploadApi.firebase';

// Switch this via .env flag. Default to mock if not explicitly set to 'true'.
const useFirebase = import.meta.env.VITE_USE_FIREBASE_API === 'true';

// Export Generation Job APIs
export const createGenerationJob = useFirebase ? firebaseGenerationApi.createGenerationJob : mockGenerationApi.createGenerationJob;
export const subscribeGenerationJob = useFirebase ? firebaseGenerationApi.subscribeGenerationJob : mockGenerationApi.subscribeGenerationJob;
export const updateGenerationJobStatus = useFirebase ? firebaseGenerationApi.updateGenerationJobStatus : mockGenerationApi.updateGenerationJobStatus;
export const finalizeGenerationJob = useFirebase ? firebaseGenerationApi.finalizeGenerationJob : mockGenerationApi.finalizeGenerationJob;
export const failGenerationJob = useFirebase ? firebaseGenerationApi.failGenerationJob : mockGenerationApi.failGenerationJob;

// Export Upload APIs
export const uploadGenerationSourceImage = useFirebase ? firebaseUploadApi.uploadGenerationSourceImage : mockUploadApi.uploadGenerationSourceImage;

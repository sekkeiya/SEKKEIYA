// useUploadFormState.js
import { useState } from 'react';

// To keep the API surface similar for now, we remove useModelMetaContext 
// and handle all item-specific metadata inside the queue.
// We also remove the global modelIdRef, as each queue item will get its own ID inside useUploadHandlers.

export const useUploadFormState = () => {
  // Array of queue items
  // Item structure:
  // {
  //   id: string (uuid),
  //   file: File,
  //   filename: string,
  //   title: string,
  //   type: string, ('家具' | '建築')
  //   category: string,
  //   visibility: string, ('public' | 'private')
  //   thumbnailPreviewUrl: string,
  //   thumbnailBlob: Blob | null,
  //   status: 'queued' | 'thumbnailing' | 'ready' | 'uploading_model' | 'uploading_thumbnail' | 'saving_doc' | 'done' | 'error',
  //   progress: number,
  //   errorMsg: string,
  //   // Advanced/Optional fields
  //   ai: { generated: boolean, source: string, prompt: string },
  //   tags: string[],
  //   similarProducts: array,
  //   companion3dmFile: File | null,
  //   companionGlbFile: File | null,
  //   thumbnailFile: File | null, // Manual thumbnail override
  // }
  const [uploadQueue, setUploadQueue] = useState([]);

  // Add items to the queue
  const appendFilesToQueue = (newItems) => {
    setUploadQueue((prev) => [...prev, ...newItems]);
  };

  // Update a specific item in the queue
  const updateQueueItem = (id, updates) => {
    setUploadQueue((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newUpdates = typeof updates === 'function' ? updates(item) : updates;
          return { ...item, ...newUpdates };
        }
        return item;
      })
    );
  };

  // Update a specific item's metadata (e.g., nested fields like 'title' or 'type')
  const updateQueueItemField = (id, field, value) => {
    setUploadQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  // Remove an item from the queue
  const removeQueueItem = (id) => {
    setUploadQueue((prev) => prev.filter((item) => item.id !== id));
    // Implementation Note: In a robust app, we should also URL.revokeObjectURL(thumbnailPreviewUrl) here to prevent memory leaks.
  };

  const clearQueue = () => {
    // Revoke object URLs before clearing
    uploadQueue.forEach(item => {
        if (item.thumbnailPreviewUrl) {
            URL.revokeObjectURL(item.thumbnailPreviewUrl);
        }
    });
    setUploadQueue([]);
  };

  return {
    state: {
      uploadQueue,
    },
    setters: {
      setUploadQueue,
      appendFilesToQueue,
      updateQueueItem,
      updateQueueItemField,
      removeQueueItem,
      clearQueue,
    },
  };
};

import { useUploadFormState } from './useUploadFormState';
import { useUploadHandlers } from './useUploadHandlers';
import { useState } from 'react';

export const useUploadModal = ({ user, onClose, projectId, workspaceId, mergedCategoryMap }) => {
  const {
    state,
    setters,
    resetForm,
  } = useUploadFormState();

  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingCurrent, setLoadingCurrent] = useState(0);
  const [loadingTotal, setLoadingTotal] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadedFileUrl, setUploadedFileUrl] = useState(null);
  const [uploadedModelId, setUploadedModelId] = useState(null);

  const {
    handleFilesDrop,
    handleProcessQueue,
    handleProcessLocal,
    handleRunAI,
    attachRhinoToGhItem,
  } = useUploadHandlers({
    user,
    uploadQueue: state.uploadQueue,
    setters,
    onClose,
    setUploading,
    setIsLoadingFiles,
    setLoadingProgress,
    setLoadingCurrent,
    setLoadingTotal,
    setLoadingMessage,
    projectId,
    workspaceId,
    mergedCategoryMap,
  });

  return {
    state,
    setters,
    resetForm,
    uploadProgress,
    setUploadProgress,
    uploading,
    setUploading,
    isLoadingFiles,
    setIsLoadingFiles,
    loadingProgress,
    loadingCurrent,
    loadingTotal,
    loadingMessage,
    previewUrl,
    setPreviewUrl,
    uploadedFileUrl,
    setUploadedFileUrl,
    uploadedModelId,
    setUploadedModelId,
    handleFilesDrop,
    handleProcessQueue,
    handleProcessLocal,
    handleRunAI,
    attachRhinoToGhItem,
  };
};

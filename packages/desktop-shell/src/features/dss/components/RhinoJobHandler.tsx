import React, { useEffect } from 'react';
import { useDccStore } from '../../../store/useDccStore';
import { LocalSaveDialog } from './LocalSaveDialog';

interface Props {
  /**
   * Called when Rhino sends a cloud-upload job (target === "cloud").
   * The parent (DssDashboard) should open the upload modal in response.
   */
  onTriggerCloudUpload?: () => void;
}

/**
 * Headless component that watches the pending Rhino job from useDccStore
 * and renders the appropriate UI:
 *   - target === "local"  → <LocalSaveDialog>
 *   - target === "cloud"  → triggers parent upload modal via callback
 *
 * Mount once inside DssDashboard (or any top-level DSS component).
 */
export const RhinoJobHandler: React.FC<Props> = ({ onTriggerCloudUpload }) => {
  const pendingRhinoJob = useDccStore(s => s.pendingRhinoJob);
  const clearPendingRhinoJob = useDccStore(s => s.clearPendingRhinoJob);

  // Cloud-upload: delegate to parent modal, then clear so it doesn't fire again
  useEffect(() => {
    if (pendingRhinoJob?.target === 'cloud') {
      onTriggerCloudUpload?.();
      clearPendingRhinoJob();
    }
  }, [pendingRhinoJob, onTriggerCloudUpload, clearPendingRhinoJob]);

  // Local save: render the dialog (it closes itself via clearPendingRhinoJob)
  if (pendingRhinoJob?.target === 'local') {
    return <LocalSaveDialog job={pendingRhinoJob} />;
  }

  return null;
};

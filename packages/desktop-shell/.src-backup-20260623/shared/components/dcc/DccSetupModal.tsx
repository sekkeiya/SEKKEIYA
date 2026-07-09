import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Typography,
  Box,
  CircularProgress,
  Alert,
} from '@mui/material';
import { open } from '@tauri-apps/plugin-shell';
import { useDccStore } from '../../../store/useDccStore';
import type { DccToolId } from '../../../store/useDccStore';

interface DccSetupModalProps {
  toolId: DccToolId;
  open: boolean;
  onClose: () => void;
}

// Config registry for DCC tools. Makes it easy to add Blender/Revit later.
const DCC_REGISTRY: Record<string, any> = {
  rhino: {
    name: 'Rhinoceros',
    downloadUrl: 'https://github.com/YumaTano/3dshapeshare-plugin-rhino/releases/latest', // Change this to actual URL if needed / or local asset path
    steps: [
      {
        label: 'プラグインをダウンロード',
        description: '下のボタンから ThreeDSSRhinoImporter プラグイン（.rhi または .yak）をダウンロードしてください。',
        actionLabel: 'ダウンロードページへ',
        action: (url: string) => open(url),
      },
      {
        label: 'インストール',
        description: 'ダウンロードしたファイルをダブルクリック、またはRhinoの画面にドラッグ＆ドロップしてインストールしてください。',
      },
      {
        label: 'Rhinoを起動',
        description: 'Rhinocerosを起動し、必要であれば空のドキュメントを開いてください。',
      },
      {
        label: '接続を確認',
        description: 'プラグインが正常に動作しているかテストします。',
      }
    ]
  }
};

export const DccSetupModal: React.FC<DccSetupModalProps> = ({ toolId, open, onClose }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [localCheckFailed, setLocalCheckFailed] = useState(false);
  const config = DCC_REGISTRY[toolId];

  const status = useDccStore((s) => s.rhinoStatus);
  const message = useDccStore((s) => s.rhinoMessage);
  const isChecking = useDccStore((s) => s.isChecking);
  const checkConnection = useDccStore((s) => s.checkRhinoConnection);

  useEffect(() => {
    // Reset step when opened
    if (open) {
      setActiveStep(0);
      setLocalCheckFailed(false);
    }
  }, [open]);

  // If connected successfully in the background while modal is open, auto-forward to end
  useEffect(() => {
    if (open && status === 'connected' && activeStep < config.steps.length) {
      setActiveStep(config.steps.length);
    }
  }, [status, open, activeStep, config.steps.length]);

  const handleNext = async () => {
    if (activeStep === config.steps.length - 1) {
      // It's the final connection check step
      await checkConnection();
      useDccStore.subscribe((state) => {
         if (!state.isChecking) {
             if (state.rhinoStatus === 'connected') {
                 setActiveStep((prev) => prev + 1);
                 setLocalCheckFailed(false);
             } else {
                 setLocalCheckFailed(true);
             }
         }
      });
      // Wait actually Zustand subscribe is tricky like this, it's better to just check the result after await since checkConnection sets the state.
      // Zustand actions usually update synchronous state after await.
      const currentStatus = useDccStore.getState().rhinoStatus;
      if (currentStatus === 'connected') {
        setActiveStep((prev) => prev + 1);
        setLocalCheckFailed(false);
      } else {
        setLocalCheckFailed(true);
      }
    } else {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
    setLocalCheckFailed(false);
  };

  if (!config) return null;

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#1a1f2b',
          backgroundImage: 'none',
          border: '1px solid rgba(255,255,255,0.1)'
        }
      }}
    >
      <DialogTitle>{config.name} 連携セットアップ</DialogTitle>
      <DialogContent>
        <Stepper activeStep={activeStep} orientation="vertical">
          {config.steps.map((step: any, index: number) => (
            <Step key={step.label}>
              <StepLabel>{step.label}</StepLabel>
              <StepContent>
                <Typography mb={2}>{step.description}</Typography>
                
                {step.actionLabel && (
                  <Button 
                    variant="outlined" 
                    onClick={() => step.action?.(config.downloadUrl)}
                    sx={{ mb: 2 }}
                  >
                    {step.actionLabel}
                  </Button>
                )}

                {index === config.steps.length - 1 && localCheckFailed && (
                   <Alert severity="error" sx={{ mb: 2 }}>
                     接続に失敗しました。Rhinoが起動していること、プラグインが有効化されていることを確認してください。
                     {message && ` (詳細: ${message})`}
                   </Alert>
                )}

                <Box sx={{ mb: 2 }}>
                  <div>
                    <Button
                      variant="contained"
                      onClick={handleNext}
                      sx={{ mt: 1, mr: 1 }}
                      disabled={isChecking}
                    >
                      {index === config.steps.length - 1 ? (isChecking ? <CircularProgress size={24} /> : '接続をテストする') : '次へ'}
                    </Button>
                    <Button
                      disabled={index === 0 || isChecking}
                      onClick={handleBack}
                      sx={{ mt: 1, mr: 1 }}
                    >
                      戻る
                    </Button>
                  </div>
                </Box>
              </StepContent>
            </Step>
          ))}
        </Stepper>
        {activeStep === config.steps.length && (
          <Box sx={{ mt: 2 }}>
            <Alert severity="success">
              {config.name} との連携が完了しました！プラグインを利用してモデルを直接インポートできます。
            </Alert>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        {activeStep === config.steps.length ? (
          <Button onClick={onClose} variant="contained">完了</Button>
        ) : (
          <Button onClick={onClose}>キャンセル</Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

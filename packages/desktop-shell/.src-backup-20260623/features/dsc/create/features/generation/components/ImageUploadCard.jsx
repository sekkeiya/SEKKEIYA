import React, { useRef } from 'react';
import { Card, CardContent, Typography, Box, Button } from '@mui/material';
import UploadIcon from '@mui/icons-material/Upload';
import { useCreateStore } from '../../../store/useCreateStore';

export default function ImageUploadCard() {
  const fileInputRef = useRef(null);
  const generationInput = useCreateStore((state) => state.generationInput);
  const updateGenerationInput = useCreateStore((state) => state.updateGenerationInput);
  const updateUiState = useCreateStore((state) => state.updateUiState);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const previewUrl = URL.createObjectURL(file);
      updateGenerationInput({ imageFile: file, imagePreviewUrl: previewUrl });
      updateUiState({ canGenerate: true });
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const previewUrl = URL.createObjectURL(file);
      updateGenerationInput({ imageFile: file, imagePreviewUrl: previewUrl });
      updateUiState({ canGenerate: true });
    }
  };

  return (
    <Card 
      variant="outlined" 
      sx={{ 
        borderStyle: 'dashed', 
        borderColor: 'divider', 
        bgcolor: 'background.default',
        transition: 'background-color 0.2s',
        '&:hover': {
          bgcolor: 'action.hover',
        }
      }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <CardContent sx={{ textAlign: 'center', py: 4 }}>
        <input
          type="file"
          accept="image/*"
          hidden
          ref={fileInputRef}
          onChange={handleFileChange}
        />
        
        {generationInput.imagePreviewUrl ? (
          <Box 
            component="img" 
            src={generationInput.imagePreviewUrl} 
            alt="Preview" 
            sx={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain', mb: 2, borderRadius: 1 }} 
          />
        ) : (
          <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
        )}

        <Typography variant="body1" color="text.secondary" gutterBottom>
          {generationInput.imagePreviewUrl ? '画像が選択されました' : '画像をドラッグ＆ドロップ'}
        </Typography>
        
        <Button 
          variant="outlined" 
          onClick={() => fileInputRef.current?.click()}
          sx={{ mt: 1 }}
        >
          {generationInput.imagePreviewUrl ? '画像を変更' : 'ファイルを選択'}
        </Button>
      </CardContent>
    </Card>
  );
}

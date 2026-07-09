import React, { useState, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Box, Typography, LinearProgress, Chip, Autocomplete
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { dssUploadService } from './dssUploadService';

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  workspaceId: string;
}

const COMMON_TAGS = ['Architecture', 'Urban', 'Furniture', 'Interior', 'Parametric', 'Organic', 'Industrial'];
const CATEGORIES = ['Uncategorized', 'Architecture', 'Products', 'Furniture', 'Vehicles', 'Characters', 'Abstract'];
const TYPES = ['Furniture', 'Architecture', 'Object', 'Cityscape', 'Other'];

export const DssUploadDialog: React.FC<Props> = ({ open, onClose, projectId, workspaceId }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  
  const [title, setTitle] = useState('');
  const [type, setType] = useState('Object');
  const [category, setCategory] = useState('Uncategorized');
  const [tags, setTags] = useState<string[]>([]);
  
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setFile(null);
    setTitle('');
    setType('Object');
    setCategory('Uncategorized');
    setTags([]);
    setProgress(0);
    setError(null);
  };

  const handleClose = () => {
    if (isUploading) return;
    resetForm();
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedInfo = e.target.files[0];
      setFile(selectedInfo);
      if (!title) {
        setTitle(selectedInfo.name.split('.').slice(0, -1).join('.'));
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selectedInfo = e.dataTransfer.files[0];
      setFile(selectedInfo);
      if (!title) {
        setTitle(selectedInfo.name.split('.').slice(0, -1).join('.'));
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setError(null);
    try {
      await dssUploadService.processDesktopUpload(
        file,
        { title, type, category, tags },
        projectId,
        workspaceId,
        (p) => setProgress(p)
      );
      // Upload Complete
      setIsUploading(false);
      handleClose();
    } catch (err) {
      console.error(err);
      setError(String(err));
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Upload 3D Model</DialogTitle>
      <DialogContent>
        {error && (
          <Typography color="error" variant="body2" sx={{ mb: 2 }}>{error}</Typography>
        )}

        {/* Drag & Drop Zone */}
        <Box 
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          sx={{
            border: '2px dashed #444', 
            borderRadius: 2, 
            p: 4, 
            mb: 3, 
            mt: 1,
            textAlign: 'center',
            cursor: 'pointer',
            bgcolor: file ? 'rgba(41, 182, 246, 0.1)' : 'transparent',
            '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' }
          }}
        >
          <CloudUploadIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
          <Typography variant="body1">
            {file ? file.name : "Click or drag file here (.3dm, .glb, .skp, etc.)"}
          </Typography>
          <input 
            type="file" 
            hidden 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept=".3dm,.glb,.gltf,.blend,.skp,.obj,.fbx"
          />
        </Box>

        <TextField
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          fullWidth
          margin="dense"
          disabled={isUploading}
        />
        
        <FormControl fullWidth margin="normal">
          <InputLabel>Type</InputLabel>
          <Select
            value={type}
            onChange={(e) => setType(e.target.value)}
            label="Type"
            disabled={isUploading}
          >
            {TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </Select>
        </FormControl>

        <FormControl fullWidth margin="normal">
          <InputLabel>Category</InputLabel>
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            label="Category"
            disabled={isUploading}
          >
            {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </Select>
        </FormControl>

        <Autocomplete
          multiple
          freeSolo
          options={COMMON_TAGS}
          value={tags}
          onChange={(_, newVal) => setTags(newVal)}
          disabled={isUploading}
          renderTags={(value: readonly string[], getTagProps) =>
            value.map((option: string, index: number) => (
              <Chip variant="outlined" label={option} {...getTagProps({ index })} />
            ))
          }
          renderInput={(params) => (
            <TextField {...params} label="Tags" placeholder="Add tag..." margin="normal" />
          )}
        />

        {isUploading && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Uploading... {Math.round(progress)}%
            </Typography>
            <LinearProgress variant="determinate" value={progress} />
          </Box>
        )}

      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={isUploading}>Cancel</Button>
        <Button 
          variant="contained" 
          onClick={handleUpload} 
          disabled={!file || !title || isUploading}
        >
          {isUploading ? 'Uploading...' : 'Upload'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

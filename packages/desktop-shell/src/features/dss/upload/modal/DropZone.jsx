import React, { useRef, useState } from 'react';
import { Box, Typography, Button, Stack } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';

const DropZone = ({ label, onDrop, isCompact }) => {
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    const types = Array.from(e.dataTransfer.types);
    const text = e.dataTransfer.getData("text/plain");

    const isInternalDrag = types.includes("text/plain") && text === "internal-drag";
    if (isInternalDrag) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onDrop?.(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onDrop?.(e.target.files);
    }
  };

  const handleZoneClick = (e) => {
    // prevent default just in case
    e.preventDefault();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleFolderClick = (e) => {
    e.preventDefault();
    e.stopPropagation(); // prevent triggering zone click
    if (folderInputRef.current) {
      folderInputRef.current.value = "";
      folderInputRef.current.click();
    }
  };
  
  const handleFileBtnClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  return (
    <Box
      onClick={handleZoneClick}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      sx={{
        border: isDragActive ? '2px dashed #4dabf5' : '2px dashed rgb(var(--brand-fg-rgb) / 0.2)',
        bgcolor: isDragActive ? 'rgba(30,144,255,0.1)' : 'light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))',
        textAlign: 'center',
        p: isCompact ? 1.5 : { xs: 3, sm: 4 },
        borderRadius: isCompact ? 2 : 3,
        minHeight: isCompact ? 60 : 200,
        display: 'flex',
        flexDirection: isCompact ? 'row' : 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          border: '2px dashed #1e90ff',
          bgcolor: 'rgba(30,144,255,0.08)'
        }
      }}
    >
      <input
        type="file"
        multiple
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
        accept=".3dm,.glb,.skp,.blend,.gh,.obj"
        onClick={(e) => e.stopPropagation()}
      />
      <input
        type="file"
        multiple
        webkitdirectory="true"
        directory="true"
        ref={folderInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
        onClick={(e) => e.stopPropagation()}
      />

      {isCompact ? (
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ width: '100%', justifyContent: 'center' }}>
          <CloudUploadIcon sx={{ fontSize: 24, color: isDragActive ? 'light-dark(#0960a4, #4dabf5)' : 'rgb(var(--brand-fg-rgb) / 0.5)' }} />
          <Typography variant="body2" sx={{ color: 'var(--brand-fg)', fontWeight: 600 }}>
            {label}
          </Typography>
        </Stack>
      ) : (
        <>
          <CloudUploadIcon sx={{ fontSize: 48, color: isDragActive ? 'light-dark(#0960a4, #4dabf5)' : 'rgb(var(--brand-fg-rgb) / 0.5)', mb: 1.5 }} />
          <Typography variant="h6" sx={{ color: 'var(--brand-fg)', mb: 0.5, fontWeight: 600 }}>
            {label}
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.58)', mb: 3 }}>
            GLB / 3DM / OBJ など複数ファイル対応
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} onClick={(e) => e.stopPropagation()}>
            <Button 
                variant="outlined" 
                startIcon={<InsertDriveFileIcon />}
                onClick={handleFileBtnClick} 
                sx={{ 
                    color: 'var(--brand-fg)', 
                    borderColor: 'rgb(var(--brand-fg-rgb) / 0.3)',
                    px: 3, py: 1, borderRadius: 2,
                    '&:hover': { borderColor: 'white', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' }
                }}
            >
                ファイルを選択
            </Button>
            <Button 
                variant="outlined" 
                startIcon={<CreateNewFolderIcon />}
                onClick={handleFolderClick} 
                sx={{ 
                    color: 'var(--brand-fg)', 
                    borderColor: 'rgb(var(--brand-fg-rgb) / 0.3)',
                    px: 3, py: 1, borderRadius: 2,
                    '&:hover': { borderColor: 'white', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' }
                }}
            >
                フォルダを選択
            </Button>
          </Stack>
        </>
      )}
    </Box>
  );
};

export default DropZone;

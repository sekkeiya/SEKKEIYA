import React, { useState } from "react";
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, 
  Button, TextField, Box, Typography, MenuItem,
  LinearProgress, IconButton
} from "@mui/material";
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';

export default function CommitModal({ open, onClose, onCommit, isSubmitting, progress, appType, mode = "newVersion" }) {
  const [file, setFile] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("working");

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      if (!displayName) {
        setDisplayName(e.target.files[0].name.replace(/\.[^/.]+$/, "")); // Strip extension for default name
      }
    }
  };

  const handleSubmit = async () => {
    if (!file) return;
    try {
      await onCommit({
        file,
        displayName,
        note,
        status
      });
      // Reset form on success
      setFile(null);
      setDisplayName("");
      setNote("");
      setStatus("working");
    } catch (err) {
      console.error("Modal commit failed:", err);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return; // Prevent closing while uploading
    setFile(null);
    setDisplayName("");
    setNote("");
    setStatus("working");
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { 
          bgcolor: "#121b2b", 
          color: "#fff",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 3
        }
      }}
    >
      <DialogTitle sx={{ m: 0, p: 3, pb: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h6" component="div" sx={{ fontWeight: 800 }}>
          {mode === "newFile" ? "Upload New File" : "Upload New Version"}
        </Typography>
        <IconButton onClick={handleClose} disabled={isSubmitting} sx={{ color: "rgba(255,255,255,0.5)" }}>
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 3, pb: 3, pt: "8px !important" }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          
          {/* File Drop Area */}
          <Box 
            component="label"
            sx={{ 
              border: "2px dashed",
              borderColor: file ? "rgba(0,191,255,0.5)" : "rgba(255,255,255,0.2)",
              bgcolor: file ? "rgba(0,191,255,0.05)" : "rgba(255,255,255,0.02)",
              borderRadius: 3,
              p: 4,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              cursor: isSubmitting ? "default" : "pointer",
              transition: "all 0.2s",
              "&:hover": {
                bgcolor: isSubmitting ? undefined : "rgba(255,255,255,0.05)",
                borderColor: isSubmitting ? undefined : "rgba(255,255,255,0.3)"
              }
            }}
          >
            <input 
              type="file" 
              hidden 
              disabled={isSubmitting}
              accept={appType === "rhino" ? ".3dm" : undefined}
              onChange={handleFileChange}
            />
            <CloudUploadRoundedIcon sx={{ fontSize: 48, color: file ? "#00BFFF" : "rgba(255,255,255,0.5)", mb: 2 }} />
            {file ? (
              <Typography sx={{ fontWeight: 700, color: "#fff", textAlign: "center" }}>
                {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </Typography>
            ) : (
              <Typography sx={{ color: "rgba(255,255,255,0.6)", textAlign: "center" }}>
                クリックまたはドラッグ＆ドロップでファイルを選択<br/>
                <Typography component="span" variant="caption">
                  {appType === "rhino" ? "サポート形式: .3dm" : "すべてのファイル形式をサポート"}
                </Typography>
              </Typography>
            )}
          </Box>

          <TextField 
            label={mode === "newFile" ? "File Name" : "Commit Title"}
            variant="outlined"
            fullWidth
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            disabled={isSubmitting}
            placeholder={mode === "newFile" ? "e.g., 01_BaseModel" : "e.g., Fix roof angle"}
            InputProps={{ sx: { color: "#fff", bgcolor: "rgba(255,255,255,0.05)" } }}
            InputLabelProps={{ sx: { color: "rgba(255,255,255,0.5)" } }}
          />

          <TextField 
            label="Commit Note (Optional)"
            variant="outlined"
            fullWidth
            multiline
            rows={3}
            value={note}
            onChange={e => setNote(e.target.value)}
            disabled={isSubmitting}
            placeholder="Describe what changed in this version..."
            InputProps={{ sx: { color: "#fff", bgcolor: "rgba(255,255,255,0.05)" } }}
            InputLabelProps={{ sx: { color: "rgba(255,255,255,0.5)" } }}
          />

          <TextField 
            select
            label="Status"
            variant="outlined"
            fullWidth
            value={status}
            onChange={e => setStatus(e.target.value)}
            disabled={isSubmitting}
            InputProps={{ sx: { color: "#fff", bgcolor: "rgba(255,255,255,0.05)" } }}
            InputLabelProps={{ sx: { color: "rgba(255,255,255,0.5)" } }}
          >
            <MenuItem value="working">Working (作業中)</MenuItem>
            <MenuItem value="review">Review (レビュー待ち)</MenuItem>
            <MenuItem value="milestone">Milestone (マイルストーン)</MenuItem>
          </TextField>

          {isSubmitting && (
            <Box sx={{ width: '100%' }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.7)" }}>Uploading...</Typography>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.7)" }}>{Math.round(progress)}%</Typography>
              </Box>
              <LinearProgress variant="determinate" value={progress} sx={{ height: 6, borderRadius: 3, bgcolor: "rgba(255,255,255,0.1)", "& .MuiLinearProgress-bar": { bgcolor: "#00BFFF" } }} />
            </Box>
          )}

        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button 
          onClick={handleClose} 
          disabled={isSubmitting}
          sx={{ color: "rgba(255,255,255,0.6)", textTransform: "none" }}
        >
          Cancel
        </Button>
        <Button 
          variant="contained" 
          onClick={handleSubmit}
          disabled={!file || !displayName || isSubmitting}
          sx={{ bgcolor: "#00BFFF", color: "#000", fontWeight: 700, textTransform: "none", px: 3, "&:hover": { bgcolor: "#0099cc" } }}
        >
          {isSubmitting ? "Committing..." : "Upload & Commit"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

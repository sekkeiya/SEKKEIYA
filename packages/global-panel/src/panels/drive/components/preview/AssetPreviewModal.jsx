import React from "react";
import { Box, Typography, IconButton, Modal, Stack, Divider, Button } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import { useDriveStore } from "../../store/useDriveStore";
import { formatBytes, formatDate } from "../../utils/formatters";
import { usePanelTheme } from "../../../theme/ThemeContext";

// Reusing icon logic visually
import ViewInArRoundedIcon from "@mui/icons-material/ViewInArRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import SlideshowRoundedIcon from "@mui/icons-material/SlideshowRounded";
import InsertDriveFileRoundedIcon from "@mui/icons-material/InsertDriveFileRounded";

const getAssetIcon = (assetKind) => {
  switch (assetKind) {
    case "model": return <ViewInArRoundedIcon sx={{ fontSize: 80, color: "#2ecc71" }} />;
    case "image": return <ImageRoundedIcon sx={{ fontSize: 80, color: "#f1c40f" }} />;
    case "slide": return <SlideshowRoundedIcon sx={{ fontSize: 80, color: "#e74c3c" }} />;
    case "video": return <SlideshowRoundedIcon sx={{ fontSize: 80, color: "#9b59b6" }} />;
    default: return <InsertDriveFileRoundedIcon sx={{ fontSize: 80, color: "#95a5a6" }} />;
  }
};

export default function AssetPreviewModal() {
  const { selectedAsset, closePreview } = useDriveStore();
  const BRAND = usePanelTheme();

  if (!selectedAsset) return null;

  return (
    <Modal
      open={!!selectedAsset}
      onClose={closePreview}
      sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <Box
        sx={{
          bgcolor: BRAND.bg,
          width: { xs: "90%", md: "70%", lg: 800 },
          maxHeight: "90vh",
          borderRadius: 3,
          boxShadow: 24,
          display: "flex",
          flexDirection: "column",
          outline: "none",
          overflow: "hidden",
          border: `1px solid ${BRAND.line}`,
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 2, borderBottom: `1px solid ${BRAND.line}`, bgcolor: BRAND.panel }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>{selectedAsset.name}</Typography>
          <IconButton onClick={closePreview} sx={{ color: "rgba(255,255,255,0.7)" }}>
            <CloseRoundedIcon />
          </IconButton>
        </Box>

        <Box sx={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* Left Preview Area */}
          <Box sx={{ flex: 1, bgcolor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", p: 4 }}>
            {/* If it was an image we could render <img src={selectedAsset.url} /> here */}
            {getAssetIcon(selectedAsset.assetKind)}
          </Box>

          {/* Right Info Area */}
          <Box sx={{ width: 300, bgcolor: BRAND.panel, p: 3, overflowY: "auto", borderLeft: `1px solid ${BRAND.line}` }}>
            <Typography variant="overline" sx={{ color: "rgba(255,255,255,0.4)", fontWeight: 700 }}>詳細情報</Typography>
            
            <Stack spacing={2} sx={{ mt: 2 }}>
              <Box>
                <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>種類</Typography>
                <Typography sx={{ fontSize: 14 }}>{selectedAsset.type}</Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>サイズ</Typography>
                <Typography sx={{ fontSize: 14 }}>{formatBytes(selectedAsset.size)}</Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>作成日</Typography>
                <Typography sx={{ fontSize: 14 }}>{formatDate(selectedAsset.createdAt)}</Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>生成アプリ</Typography>
                <Typography sx={{ fontSize: 14 }}>{selectedAsset.sourceApp}</Typography>
              </Box>
            </Stack>

            <Divider sx={{ my: 3, opacity: 0.2 }} />
            
            <Button
              variant="contained"
              fullWidth
              startIcon={<DownloadRoundedIcon />}
              sx={{ bgcolor: "#3498db", color: "#fff", "&:hover": { bgcolor: "#2980b9" } }}
              onClick={() => alert("ダウンロードを開始します (モック)")}
            >
              ダウンロード
            </Button>
          </Box>
        </Box>
      </Box>
    </Modal>
  );
}

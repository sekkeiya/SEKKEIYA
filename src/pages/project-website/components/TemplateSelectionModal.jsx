import React, { useState, useEffect } from "react";
import { 
  Dialog, DialogContent, Typography, Box, IconButton, Button, 
  Tabs, Tab, Grid, Card, CardMedia, CardContent, CardActionArea, 
  Chip, Fade, CircularProgress, Alert
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import RocketLaunchRoundedIcon from "@mui/icons-material/RocketLaunchRounded";
import { useTemplates } from "@sekkeiya/global-panel";
import { useAuth } from "@/features/auth/context/AuthContext";

export default function TemplateSelectionModal({ open, onClose, appType = "rhino", project, onTemplateSelected }) {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [launchStatus, setLaunchStatus] = useState("idle");

  const { user } = useAuth();
  const { templates, loading, error, launchTemplate } = useTemplates(open ? appType : null, user?.uid);

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setActiveTab(0);
      setSelectedTemplateId(null);
      setLaunchStatus("idle");
    }
  }, [open]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    setSelectedTemplateId(null);
  };

  const currentCategory = activeTab === 0 ? "official" : activeTab === 1 ? "team" : "personal";
  
  // Create an explicit mock template for "Open Empty"
  const emptyTemplate = {
    id: 'empty_native',
    name: '空のファイルから開始',
    creatorName: 'SEKKEIYA',
    category: 'official',
    appType,
    description: 'テンプレートを使用せず、新規ファイルを作成して作業を開始します。',
    thumbnailUrl: 'https://images.unsplash.com/photo-1510074377623-8cf13fb86c08?q=80&w=400&auto=format&fit=crop',
    storageFullPath: `templates/${appType}/empty.${appType === 'rhino' ? '3dm' : 'blend'}` 
  };

  const fetchedTemplates = templates.filter(t => t.category === currentCategory);
  const displayedTemplates = activeTab === 0 ? [emptyTemplate, ...fetchedTemplates] : fetchedTemplates;

  const handleSelect = (template) => {
    if (launchStatus !== "idle") return;
    setSelectedTemplateId(template.id);
  };

  const handleDoubleClick = (template) => {
    if (launchStatus !== "idle") return;
    setSelectedTemplateId(template.id);
    handleStartLaunch(template);
  };

  const handleStartLaunch = async (templateOverride = null) => {
    const targetId = templateOverride?.id || selectedTemplateId;
    if (!targetId) return;

    setLaunchStatus("starting");
    
    try {
      const targetTemplate = templateOverride || displayedTemplates.find(t => t.id === targetId);
      
      // Perform genuine DB/Storage launch
      await launchTemplate(targetTemplate, project?.name || "NewProject");

      setLaunchStatus("ready");
      if (onTemplateSelected) {
        onTemplateSelected(targetTemplate);
      }
    } catch (err) {
      console.error("Launch template failed:", err);
      // Fallback UI reset or alert
      alert(`ファイルの起動に失敗しました: ${err.message}`);
      setLaunchStatus("idle");
    }
  };

  const appName = appType === "rhino" ? "Rhino" : "Blender";

  return (
    <Dialog 
      open={open} 
      onClose={launchStatus === "idle" ? onClose : undefined} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: "#0b101a",
          backgroundImage: "linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0))",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 4,
          boxShadow: "0 24px 48px -12px rgba(0,0,0,0.5)",
          overflow: "hidden"
        }
      }}
    >
      {/* Launch Overlay: Absolute coverage when starting */}
      <Fade in={launchStatus !== "idle"} unmountOnExit>
        <Box sx={{ 
          position: "absolute", inset: 0, zIndex: 10, 
          bgcolor: "rgba(11, 16, 26, 0.95)", backdropFilter: "blur(10px)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          textAlign: "center"
        }}>
          {launchStatus === "starting" ? (
            <>
              <CircularProgress size={60} thickness={4} sx={{ color: "#00BFFF", mb: 3 }} />
              <Typography variant="h5" sx={{ color: "#fff", fontWeight: 800, mb: 1 }}>
                {appName} を開いています...
              </Typography>
              <Typography variant="body1" sx={{ color: "rgba(255,255,255,0.6)" }}>
                プロジェクトファイルの準備と展開を行っています
              </Typography>
            </>
          ) : launchStatus === "ready" ? (
            <>
              <RocketLaunchRoundedIcon sx={{ fontSize: 80, color: "#00BFFF", mb: 3 }} />
              <Typography variant="h5" sx={{ color: "#fff", fontWeight: 800, mb: 1 }}>
                {appName} を開く準備ができました
              </Typography>
              <Typography variant="body1" sx={{ color: "rgba(255,255,255,0.8)", mb: 4, fontWeight: 700 }}>
                ダウンロードされたファイルを開いて、{appName} で作業を開始してください
              </Typography>
              <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.4)", mb: 4, display: "block" }}>
                ※ 将来のアップデート（SEKKEIYA Desktop）により、このステップは自動でスキップされる予定です。<br/>
                作業終了後、Work Files から「Upload New Version」として結果をコミットできます。
              </Typography>
              <Button 
                variant="contained" 
                onClick={onClose}
                sx={{ 
                  bgcolor: "rgba(255,255,255,0.1)", color: "#fff", 
                  borderRadius: 8, px: 4, py: 1.5, fontWeight: 700,
                  "&:hover": { bgcolor: "rgba(255,255,255,0.2)" }
                }}
              >
                ウィンドウを閉じる
              </Button>
            </>
          ) : null}
        </Box>
      </Fade>

      {/* Main Dialog Content */}
      <Box sx={{ position: "relative", p: 3, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <Box>
          <Typography variant="h5" sx={{ color: "#fff", fontWeight: 800, mb: 0.5 }}>
            {appName} で開く
          </Typography>
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.5)" }}>
            作業のベースとなるテンプレートを選択してください
          </Typography>
        </Box>
        <IconButton onClick={onClose} sx={{ color: "rgba(255,255,255,0.5)" }}>
          <CloseRoundedIcon />
        </IconButton>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'rgba(255,255,255,0.05)', px: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange} TabIndicatorProps={{ style: { backgroundColor: '#00BFFF' } }}>
          <Tab label="SEKKEIYA公式" sx={{ color: 'rgba(255,255,255,0.5)', '&.Mui-selected': { color: '#00BFFF', fontWeight: 700 }, textTransform: 'none' }} />
          <Tab label="公開 / チーム" sx={{ color: 'rgba(255,255,255,0.5)', '&.Mui-selected': { color: '#00BFFF', fontWeight: 700 }, textTransform: 'none' }} />
          <Tab label="自分用" sx={{ color: 'rgba(255,255,255,0.5)', '&.Mui-selected': { color: '#00BFFF', fontWeight: 700 }, textTransform: 'none' }} />
        </Tabs>
      </Box>

      <DialogContent sx={{ p: 4, bgcolor: "rgba(0,0,0,0.2)", minHeight: 400 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>テンプレートの読み込み中にエラーが発生しました。</Alert>
        )}
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress sx={{ color: "#00BFFF" }} />
          </Box>
        ) : displayedTemplates.length > 0 ? (
          <Grid container spacing={3}>
            {displayedTemplates.map((template) => {
              const isSelected = selectedTemplateId === template.id;
              return (
                <Grid item xs={12} sm={6} md={4} key={template.id}>
                  <Card 
                    sx={{ 
                      bgcolor: isSelected ? "rgba(0,191,255,0.05)" : "rgba(255,255,255,0.02)",
                      border: isSelected ? "2px solid #00BFFF" : "2px solid rgba(255,255,255,0.05)",
                      borderRadius: 3,
                      transition: "all 0.2s ease",
                      transform: isSelected ? "translateY(-4px)" : "none",
                      boxShadow: isSelected ? "0 8px 16px rgba(0,191,255,0.15)" : "none"
                    }}
                  >
                    <CardActionArea 
                      onClick={() => handleSelect(template)}
                      onDoubleClick={() => handleDoubleClick(template)}
                      sx={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "flex-start" }}
                    >
                      <CardMedia
                        component="img"
                        height="120"
                        image={template.thumbnailUrl}
                        alt={template.name}
                        sx={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                      />
                      <CardContent sx={{ p: 2, flexGrow: 1, width: "100%" }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                          <Typography variant="caption" sx={{ color: "#00BFFF", fontWeight: 700 }}>
                            {template.creatorName}
                          </Typography>
                          {template.category === 'official' && (
                            <Chip label="公式" size="small" sx={{ height: 16, fontSize: '0.6rem', bgcolor: "rgba(0,191,255,0.2)", color: "#00BFFF" }} />
                          )}
                        </Box>
                        <Typography variant="subtitle2" sx={{ color: "#fff", fontWeight: 700, mb: 1, lineHeight: 1.3 }}>
                          {template.name}
                        </Typography>
                        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.4)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {template.description}
                        </Typography>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300 }}>
            <Typography variant="body1" sx={{ color: "rgba(255,255,255,0.4)" }}>
              このカテゴリーにテンプレートはありません。
            </Typography>
          </Box>
        )}
      </DialogContent>

      <Box sx={{ p: 3, borderTop: "1px solid rgba(255,255,255,0.1)", display: "flex", justifyContent: "flex-end", gap: 2 }}>
        <Button 
          onClick={onClose} 
          sx={{ color: "rgba(255,255,255,0.6)", textTransform: "none", fontWeight: 700 }}
        >
          キャンセル
        </Button>
        <Button 
          variant="contained" 
          disabled={!selectedTemplateId}
          onClick={() => handleStartLaunch()}
          startIcon={<RocketLaunchRoundedIcon />}
          sx={{ 
            bgcolor: "#00BFFF", 
            color: "#000", 
            fontWeight: 800, 
            textTransform: "none", 
            borderRadius: 8, 
            px: 4, 
            boxShadow: "0 4px 14px 0 rgba(0,191,255,0.39)",
            "&:hover": { bgcolor: "#4facfe" },
            "&.Mui-disabled": { bgcolor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.3)" }
          }}
        >
          {appName} で開く
        </Button>
      </Box>
    </Dialog>
  );
}

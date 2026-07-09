import { useState, useMemo, useEffect } from "react";
import { Box, Typography, Button, Card, CardContent, Chip, List, ListItem, ListItemButton, ListItemText, TextField, InputAdornment, CircularProgress } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import AppsIcon from "@mui/icons-material/Apps";
import LibraryBooksIcon from "@mui/icons-material/LibraryBooks";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import StarIcon from "@mui/icons-material/Star";
import ExtensionIcon from "@mui/icons-material/Extension";
import PushPinIcon from "@mui/icons-material/PushPin";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import ArchitectureRoundedIcon from "@mui/icons-material/ArchitectureRounded";
import StraightenRoundedIcon from "@mui/icons-material/StraightenRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DownloadIcon from "@mui/icons-material/Download";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { ECOSYSTEM_SERVICES, SERVICE_CATEGORIES } from "../shared/data/marketplaceData";
import { useAppStore } from "../store/useAppStore";
import { useAuthStore } from "../store/useAuthStore";
import { BRAND } from "../styles/theme";
import type { AppScope } from "../shared/layout/workspace/types";
import { TemplateRepository } from "../features/projects/templateRepository";
import type { RhinoTemplate } from "../features/projects/types";
import { PreviewDialog } from "../components/Projects/PreviewDialog";

// ステータスごとの表示メタ（バッジ色・ラベル）
const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  ACTIVE: { label: "提供中", color: "light-dark(#00ad00, #80ff80)", bg: "rgba(100,255,100,0.12)" },
  BETA: { label: "ベータ", color: "light-dark(#095fa5, #90caf9)", bg: "rgba(144,202,249,0.14)" },
  "IN DEVELOPMENT": { label: "開発中", color: "#f5a623", bg: "rgba(245,166,35,0.14)" },
};

export default function DesktopMarketplace() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("my_library"); // "my_library", "all", "templates", or category
  const { currentUser } = useAuthStore();
  const { setCurrentMainView, setLastActiveAppScope, setActiveWorkspaceId, pinnedTabIds, togglePinnedTab } = useAppStore();

  const [templates, setTemplates] = useState<RhinoTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<RhinoTemplate | null>(null);

  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [itemType, setItemType] = useState<"app" | "template" | null>(null);

  useEffect(() => {
    if (activeTab === "templates" && templates.length === 0) {
      setIsLoadingTemplates(true);
      TemplateRepository.getTemplates(currentUser?.uid).then(data => {
        setTemplates(data);
        setIsLoadingTemplates(false);
      });
    }
  }, [activeTab, currentUser, templates.length]);

  // Mock checking dummy user licenses（提供中の子アプリを所有済みとして扱う）
  const purchasedItemIds = ["3dss", "3dsl", "3dsc", "3dsd", "3dsr", "3dsi"];

  const libraryItems = useMemo(() => {
    return ECOSYSTEM_SERVICES.filter(service => purchasedItemIds.includes(service.id));
  }, [purchasedItemIds]);

  const filteredStoreItems = useMemo(() => {
    if (activeTab === "templates") return [];
    return ECOSYSTEM_SERVICES.filter(service => {
      if (activeTab === "my_library") return false; 
      
      const q = searchQuery.toLowerCase();
      const matchesSearch = service.title.toLowerCase().includes(q) || service.tagline.toLowerCase().includes(q) || service.desc.toLowerCase().includes(q);
      const matchesCat = activeTab === "all" || service.category === activeTab;
      return matchesSearch && matchesCat;
    });
  }, [searchQuery, activeTab]);

  const filteredTemplates = useMemo(() => {
    if (activeTab !== "templates") return [];
    if (!searchQuery.trim()) return templates;
    const q = searchQuery.toLowerCase();
    return templates.filter(tmpl => {
      const inName = tmpl.name.toLowerCase().includes(q);
      const inDesc = tmpl.description?.toLowerCase().includes(q) || false;
      const inTags = tmpl.tags?.some(t => t.toLowerCase().includes(q)) || false;
      return inName || inDesc || inTags;
    });
  }, [templates, activeTab, searchQuery]);

  const handleLaunchApp = (service: any) => {
    if (service.scope && service.workspaceId) {
       setCurrentMainView('workspace');
       setLastActiveAppScope(service.scope as AppScope);
       setActiveWorkspaceId(service.workspaceId);
    }
  };

  return (
    <Box sx={{ display: "flex", height: "100%", overflow: "hidden" }}>
      
      {/* Left Sidebar */}
      <Box sx={{ 
        width: 240, 
        flexShrink: 0, 
        bgcolor: BRAND.panel, 
        borderRight: `1px solid ${BRAND.line}`,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        py: 2
      }}>
        <Box sx={{ px: 2, mb: 1.5 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, color: "rgb(var(--brand-fg-rgb) / 0.45)", textTransform: "uppercase" }}>Workspace</Typography>
        </Box>
        <List sx={{ p: 0, mb: 2, px: 1 }}>
          <ListItem disablePadding>
            <ListItemButton 
              onClick={() => { setActiveTab("my_library"); setSelectedItem(null); setItemType(null); }}
              sx={{ 
                borderRadius: 2, 
                bgcolor: activeTab === "my_library" ? "rgb(var(--brand-fg-rgb) / 0.08)" : "transparent",
                "&:hover": { bgcolor: "rgb(var(--brand-fg-rgb) / 0.06)" }
              }}
            >
              <LibraryBooksIcon sx={{ color: activeTab === "my_library" ? "var(--brand-fg)" : "rgb(var(--brand-fg-rgb) / 0.7)", mr: 1.5, fontSize: 16 }} />
              <ListItemText primary="My Library" primaryTypographyProps={{ fontSize: 13, fontWeight: activeTab === "my_library" ? 600 : 500, color: activeTab === "my_library" ? "var(--brand-fg)" : "rgb(var(--brand-fg-rgb) / 0.7)" }} />
              <Typography sx={{ fontSize: 11, color: "rgb(var(--brand-fg-rgb) / 0.5)", fontWeight: 700 }}>{libraryItems.length}</Typography>
            </ListItemButton>
          </ListItem>
        </List>

        <Box sx={{ px: 2, mb: 1.5, mt: 1 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, color: "rgb(var(--brand-fg-rgb) / 0.45)", textTransform: "uppercase" }}>Store</Typography>
        </Box>
        <List sx={{ p: 0, px: 1 }}>
          <ListItem disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton 
              onClick={() => { setActiveTab("all"); setSelectedItem(null); setItemType(null); }}
              sx={{ 
                borderRadius: 2, 
                bgcolor: activeTab === "all" ? "rgb(var(--brand-fg-rgb) / 0.08)" : "transparent",
                "&:hover": { bgcolor: "rgb(var(--brand-fg-rgb) / 0.06)" }
              }}
            >
              <AppsIcon sx={{ color: activeTab === "all" ? "var(--brand-fg)" : "rgb(var(--brand-fg-rgb) / 0.7)", mr: 1.5, fontSize: 16 }} />
              <ListItemText primary="All products" primaryTypographyProps={{ fontSize: 13, fontWeight: activeTab === "all" ? 600 : 500, color: activeTab === "all" ? "var(--brand-fg)" : "rgb(var(--brand-fg-rgb) / 0.7)" }} />
              <Typography sx={{ fontSize: 11, color: "rgb(var(--brand-fg-rgb) / 0.5)", fontWeight: 700 }}>{ECOSYSTEM_SERVICES.length}</Typography>
            </ListItemButton>
          </ListItem>
          {SERVICE_CATEGORIES.map(cat => {
            const count = ECOSYSTEM_SERVICES.filter(s => s.category === cat.id).length;
            const isActive = activeTab === cat.id;
            return (
              <ListItem disablePadding key={cat.id} sx={{ mb: 0.5 }}>
                <ListItemButton 
                  onClick={() => { setActiveTab(cat.id); setSelectedItem(null); setItemType(null); }}
                  sx={{ borderRadius: 2, bgcolor: isActive ? "rgb(var(--brand-fg-rgb) / 0.08)" : "transparent", "&:hover": { bgcolor: "rgb(var(--brand-fg-rgb) / 0.06)" }, pl: 4 }}
                >
                  <ListItemText primary={cat.label} primaryTypographyProps={{ fontSize: 13, fontWeight: isActive ? 600 : 500, color: isActive ? "var(--brand-fg)" : "rgb(var(--brand-fg-rgb) / 0.7)" }} />
                  <Typography sx={{ fontSize: 11, color: "rgb(var(--brand-fg-rgb) / 0.5)", fontWeight: 700 }}>{count}</Typography>
                </ListItemButton>
              </ListItem>
            );
          })}
          <ListItem disablePadding sx={{ mb: 0.5, mt: 2 }}>
            <ListItemButton 
              onClick={() => { setActiveTab("templates"); setSelectedItem(null); setItemType(null); }}
              sx={{ borderRadius: 2, bgcolor: activeTab === "templates" ? "rgb(var(--brand-fg-rgb) / 0.08)" : "transparent", "&:hover": { bgcolor: "rgb(var(--brand-fg-rgb) / 0.06)" } }}
            >
              <ExtensionIcon sx={{ color: activeTab === "templates" ? "var(--brand-fg)" : "rgb(var(--brand-fg-rgb) / 0.7)", mr: 1.5, fontSize: 16 }} />
              <ListItemText primary="Templates" primaryTypographyProps={{ fontSize: 13, fontWeight: activeTab === "templates" ? 600 : 500, color: activeTab === "templates" ? "var(--brand-fg)" : "rgb(var(--brand-fg-rgb) / 0.7)" }} />
            </ListItemButton>
          </ListItem>
        </List>
      </Box>

      {/* Main Content Area */}
      <Box sx={{ flexGrow: 1, minWidth: 0, height: "100%", overflowY: "auto", overflowX: "hidden", "&::-webkit-scrollbar": { display: "none" }, p: { xs: 2, md: 4 } }}>
        
        {/* Search Bar at the top of In-OS area */}
        <Box sx={{ mb: 4, display: "flex", alignItems: "center" }}>
        <TextField
          placeholder="Search Marketplace..."
          variant="outlined"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: "rgb(var(--brand-fg-rgb) / 0.65)" }} /></InputAdornment>,
          }}
          sx={{
            width: "100%",
            maxWidth: 600,
            "& .MuiOutlinedInput-root": {
              bgcolor: "var(--brand-surface2)", color: "var(--brand-fg)", borderRadius: "24px", height: 44,
              "& fieldset": { border: "1px solid #333" },
              "&:hover fieldset": { borderColor: "#555" },
              "&.Mui-focused fieldset": { borderColor: "#888" }
            }
          }}
        />
      </Box>

        <Box sx={{ pb: 10 }}>
          
          {selectedItem !== null && itemType !== null ? (
            <Box>
              <Button startIcon={<ArrowBackIcon />} onClick={() => setSelectedItem(null)} sx={{ mb: 4, color: "var(--brand-fg)", textTransform: 'none', fontWeight: 600 }}>
                {itemType === "app" ? "Back to Store" : "Back to Templates"}
              </Button>
              
              <Box sx={{ display: 'flex', gap: 4, flexDirection: { xs: 'column', lg: 'row' }, mb: 6 }}>
                {/* Visual Header depending on type */}
                <Box sx={{ flexShrink: 0, width: { xs: '100%', lg: 400 }, height: 260, borderRadius: 3, overflow: 'hidden', position: 'relative', bgcolor: 'light-dark(rgba(15,23,42,0.1), rgba(0,0,0,0.3))', border: '1px solid #333' }}>
                  {itemType === "app" ? (
                    <Box sx={{ width: '100%', height: '100%', background: `radial-gradient(circle at 50% 40%, color-mix(in srgb, ${selectedItem.color} 40%, transparent) 0%, color-mix(in srgb, ${selectedItem.color} 13%, transparent) 50%, #111 100%)`, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Box sx={{ width: 180, height: 180, borderRadius: "40px", bgcolor: "rgb(var(--brand-fg-rgb) / 0.96)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 16px 48px color-mix(in srgb, ${selectedItem.color} 40%, transparent), 0 0 0 1px color-mix(in srgb, ${selectedItem.color} 33%, transparent)` }}>
                        <img src={selectedItem.icon} alt={selectedItem.title} style={{ width: 150, height: 150, objectFit: "contain" }} />
                      </Box>
                    </Box>
                  ) : (
                    selectedItem.thumbnailUrl ? (
                      <img src={selectedItem.thumbnailUrl} alt={selectedItem.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
                        {selectedItem.category === 'Architecture' ? <ArchitectureRoundedIcon sx={{ fontSize: 80, color: "var(--brand-fg)" }} /> : <StraightenRoundedIcon sx={{ fontSize: 80, color: "var(--brand-fg)" }} />}
                      </Box>
                    )
                  )}
                </Box>
                
                {/* Details info */}
                <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="h3" sx={{ fontWeight: 900, color: "var(--brand-fg)", mb: 0.5, letterSpacing: '-0.03em' }}>
                      {itemType === "app" ? selectedItem.title : selectedItem.name}
                    </Typography>
                    {itemType === "app" && (
                      <Typography sx={{ color: selectedItem.color, fontWeight: 700, fontSize: "0.95rem", letterSpacing: 0.5, mb: 1 }}>
                        {selectedItem.tagline}
                      </Typography>
                    )}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography sx={{ color: "rgb(var(--brand-fg-rgb) / 0.65)", fontWeight: 600 }}>
                        {itemType === "app" ? "SEKKEIYA Official" : (selectedItem.sourceType === "official" ? "SEKKEIYA" : selectedItem.ownerName)}
                      </Typography>
                      <Box sx={{ display: "flex", alignItems: "center", bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)', px: 1, py: 0.5, borderRadius: 1 }}>
                        <StarIcon sx={{ color: "#f5a623", fontSize: 16, mr: 0.5 }} />
                        <Typography sx={{ color: "var(--brand-fg)", fontSize: "0.85rem", fontWeight: 700 }}>5.0</Typography>
                      </Box>
                    </Box>
                  </Box>
                  
                  <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
                    {itemType === "app" ? (
                      <>
                        <Chip label={selectedItem.category.toUpperCase()} size="small" sx={{ bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)', color: 'var(--brand-fg)', fontWeight: 600 }} />
                        {STATUS_META[selectedItem.status] && (
                          <Chip label={STATUS_META[selectedItem.status].label} size="small" sx={{ bgcolor: STATUS_META[selectedItem.status].bg, color: STATUS_META[selectedItem.status].color, fontWeight: 700 }} />
                        )}
                      </>
                    ) : (
                      selectedItem.tags?.map((tag: string) => (
                        <Chip key={tag} label={tag} size="small" sx={{ bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)', color: 'var(--brand-fg)', fontWeight: 600 }} />
                      ))
                    )}
                  </Box>
                  
                  <Typography sx={{ color: "rgb(var(--brand-fg-rgb) / 0.8)", mb: 4, fontSize: '1rem', lineHeight: 1.6, flexGrow: 1 }}>
                    {itemType === "app" ? selectedItem.desc : selectedItem.description}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    {itemType === "app" ? (
                      purchasedItemIds.includes(selectedItem.id) ? (
                        <>
                          <Button 
                            variant="contained" 
                            startIcon={<OpenInNewIcon />}
                            onClick={() => handleLaunchApp(selectedItem)}
                            sx={{ bgcolor: '#fff', color: '#000', fontWeight: 800, px: 4, '&:hover': { bgcolor: '#ddd' } }}
                          >
                            Launch App
                          </Button>
                          <Typography sx={{ color: "light-dark(#00ad00, #80ff80)", fontWeight: 700, fontSize: "0.9rem", display: 'flex', alignItems: 'center', ml: 2 }}>
                            <CheckCircleOutlineIcon sx={{ mr: 0.5, fontSize: 18 }} /> インストール済み
                          </Typography>
                        </>
                      ) : selectedItem.scope && selectedItem.workspaceId ? (
                        <Button
                          variant="contained"
                          startIcon={<OpenInNewIcon />}
                          onClick={() => handleLaunchApp(selectedItem)}
                          sx={{ bgcolor: '#fff', color: '#000', fontWeight: 800, px: 4, '&:hover': { bgcolor: '#ddd' } }}
                        >
                          試してみる
                        </Button>
                      ) : (
                        <Button variant="contained" disabled sx={{ bgcolor: 'rgb(var(--brand-fg-rgb) / 0.15)', color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontWeight: 800, px: 4 }}>
                          準備中
                        </Button>
                      )
                    ) : (
                      <>
                        <Button 
                          variant="contained" 
                          startIcon={<VisibilityRoundedIcon />}
                          onClick={() => setPreviewTemplate(selectedItem)}
                          sx={{ bgcolor: '#fff', color: '#000', fontWeight: 800, px: 4, '&:hover': { bgcolor: '#ddd' } }}
                        >
                          プレビューを見る
                        </Button>
                        <Button 
                          variant="outlined" 
                          startIcon={<DownloadIcon />}
                          sx={{ color: 'var(--brand-fg)', borderColor: 'rgb(var(--brand-fg-rgb) / 0.3)', fontWeight: 800, px: 4, '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)' } }}
                        >
                          ダウンロード
                        </Button>
                      </>
                    )}
                  </Box>
                </Box>
              </Box>

              <Box sx={{ borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.05)', pt: 4 }}>
                <Typography variant="h6" sx={{ color: 'var(--brand-fg)', fontWeight: 800, mb: 2 }}>{itemType === "app" ? "このアプリについて" : "About this Template"}</Typography>
                <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.65)', lineHeight: 1.7 }}>
                  {itemType === "app"
                    ? `${selectedItem.desc} SEKKEIYA エコシステムの一員として、他の子アプリやギャラリー、プロジェクト管理とシームレスに連携します。`
                    : "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."}
                </Typography>
              </Box>
            </Box>
          ) : (
            <>
          {/* Hero Card */}
          <Box sx={{ 
            bgcolor: "var(--brand-surface2)", borderRadius: 3, border: "1px solid #333",
            p: { xs: 3, md: 4 }, mb: 4, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden"
          }}>
            <Box sx={{ position: "absolute", top: 0, right: 0, width: "50%", height: "100%", background: "radial-gradient(ellipse at top right, rgb(var(--brand-fg-rgb) / 0.05), transparent 70%)" }} />
            
            <Box sx={{ display: "flex", flexDirection: { xs: "column", lg: "row" }, gap: 4, alignItems: { xs: "flex-start", lg: "center" }, zIndex: 1 }}>
              <Box sx={{ display: "flex", gap: 3, alignItems: "center", flexGrow: 1 }}>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 900, mb: 1, letterSpacing: "-0.03em", color: "var(--brand-fg)" }}>
                    {activeTab === "my_library" ? "My Workspace Library" : activeTab === "templates" ? "Template Library" : "In-OS Marketplace"}
                  </Typography>
                  <Typography sx={{ color: "rgb(var(--brand-fg-rgb) / 0.65)", fontSize: "0.95rem" }}>
                    {activeTab === "my_library" 
                      ? "Manage your installed apps, plugins, and licenses." 
                      : activeTab === "templates"
                      ? "Discover high-quality 3D templates to jumpstart your design process."
                      : "Discover and install new tools to extend your SEKKEIYA OS workflow."}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>

          {/* MY LIBRARY CONTENT */}
          {activeTab === "my_library" && (
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 3, color: "var(--brand-fg)", display: "flex", alignItems: "center" }}>
                Installed Apps <CheckCircleOutlineIcon sx={{ ml: 1, fontSize: 18, color: "light-dark(#00ad00, #80ff80)" }} />
              </Typography>
              {libraryItems.length === 0 ? (
                <Typography sx={{ color: "rgb(var(--brand-fg-rgb) / 0.65)" }}>No licenses found.</Typography>
              ) : (
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(3, 1fr)" }, gap: 3 }}>
                  {libraryItems.map(service => (
                    <Card key={service.id} sx={{ bgcolor: "var(--brand-surface)", border: `1px solid #333`, borderRadius: 2, display: "flex", flexDirection: "column", p: 2, "&:hover": { borderColor: `color-mix(in srgb, ${service.color} 50%, transparent)`, bgcolor: "var(--brand-surface2)" } }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <Box sx={{ width: 64, height: 64, borderRadius: "16px", bgcolor: "rgb(var(--brand-fg-rgb) / 0.96)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 16px color-mix(in srgb, ${service.color} 33%, transparent), 0 0 0 1px color-mix(in srgb, ${service.color} 25%, transparent)`, flexShrink: 0 }}>
                          <img src={service.icon} alt={service.title} style={{ width: 52, height: 52, objectFit: "contain" }} />
                        </Box>
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 800, color: "var(--brand-fg)", mb: 0.5, fontSize: "0.95rem" }} noWrap>{service.title}</Typography>
                          <Chip size="small" label={STATUS_META[service.status]?.label ?? "Installed"} sx={{ bgcolor: STATUS_META[service.status]?.bg ?? "rgba(100, 255, 100, 0.1)", color: STATUS_META[service.status]?.color ?? "light-dark(#00ad00, #80ff80)", height: 20, "& .MuiChip-label": { px: 1, fontSize: "0.65rem", fontWeight: 800 } }} />
                        </Box>
                      </Box>
                      <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 1 }}>
                        <Button
                          fullWidth
                          variant="contained"
                          onClick={() => handleLaunchApp(service)}
                          sx={{ bgcolor: "rgb(var(--brand-fg-rgb) / 0.1)", color: "var(--brand-fg)", fontWeight: 700, "&:hover": { bgcolor: "rgb(var(--brand-fg-rgb) / 0.2)" }, boxShadow: "none" }}
                        >
                          Launch App
                        </Button>
                        {service.workspaceId && (
                          <Button
                            fullWidth
                            variant="outlined"
                            size="small"
                            startIcon={pinnedTabIds.includes(service.id) ? <PushPinIcon sx={{ fontSize: 14 }} /> : <PushPinOutlinedIcon sx={{ fontSize: 14 }} />}
                            onClick={() => togglePinnedTab(service.id)}
                            sx={{
                              borderColor: pinnedTabIds.includes(service.id) ? "rgba(144,202,249,0.5)" : "rgb(var(--brand-fg-rgb) / 0.15)",
                              color: pinnedTabIds.includes(service.id) ? "light-dark(#095fa5, #90caf9)" : "rgb(var(--brand-fg-rgb) / 0.5)",
                              fontWeight: 600,
                              fontSize: "0.72rem",
                              "&:hover": { borderColor: "#90caf9", color: "light-dark(#095fa5, #90caf9)", bgcolor: "rgba(144,202,249,0.05)" }
                            }}
                          >
                            {pinnedTabIds.includes(service.id) ? "タブバーに表示中" : "タブバーに追加"}
                          </Button>
                        )}
                      </Box>
                    </Card>
                  ))}
                </Box>
              )}
            </Box>
          )}

          {/* STORE CONTENT */}
          {activeTab !== "my_library" && activeTab !== "templates" && (
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 800, color: "var(--brand-fg)" }}>
                  Available to Install
                </Typography>
              </Box>
              
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(3, 1fr)" }, gap: 3 }}>
                {filteredStoreItems.map(service => {
                  const isInstalled = purchasedItemIds.includes(service.id);

                  return (
                    <Card 
                      key={service.id} 
                      onClick={() => { setSelectedItem(service); setItemType("app"); }}
                      sx={{ bgcolor: "var(--brand-surface)", borderRadius: 2, border: "1px solid #333", cursor: "pointer", "&:hover": { bgcolor: "var(--brand-surface2)" } }}
                    >
                      {/* Thumbnail */}
                      <Box sx={{ height: 170, background: `radial-gradient(circle at 50% 38%, color-mix(in srgb, ${service.color} 33%, transparent) 0%, color-mix(in srgb, ${service.color} 13%, transparent) 45%, #111 100%)`, position: "relative", borderBottom: "1px solid #333", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Box sx={{ width: 112, height: 112, borderRadius: "26px", bgcolor: "rgb(var(--brand-fg-rgb) / 0.96)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 8px 28px color-mix(in srgb, ${service.color} 40%, transparent), 0 0 0 1px color-mix(in srgb, ${service.color} 33%, transparent)` }}>
                          <img src={service.icon} alt={service.title} style={{ width: 92, height: 92, objectFit: "contain" }} />
                        </Box>
                        {STATUS_META[service.status] && service.status !== "ACTIVE" && (
                          <Chip size="small" label={STATUS_META[service.status].label} sx={{ position: "absolute", top: 10, right: 10, height: 20, bgcolor: STATUS_META[service.status].bg, color: STATUS_META[service.status].color, fontWeight: 800, "& .MuiChip-label": { px: 1, fontSize: "0.62rem" } }} />
                        )}
                      </Box>
                      <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 0.5 }}>
                          <Typography sx={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--brand-fg)", lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{service.title}</Typography>
                          <Box sx={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                            <StarIcon sx={{ color: "#f5a623", fontSize: 14, mr: 0.5 }} />
                            <Typography sx={{ color: "rgb(var(--brand-fg-rgb) / 0.65)", fontSize: "0.8rem", fontWeight: 600 }}>5.0</Typography>
                          </Box>
                        </Box>
                        <Typography sx={{ color: "rgb(var(--brand-fg-rgb) / 0.65)", fontSize: "0.8rem", mb: 1, height: 36, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                          {service.desc}
                        </Typography>
                        
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: 2 }}>
                          <Typography sx={{ color: "var(--brand-fg)", fontWeight: 800, fontSize: "0.9rem" }}>Free</Typography>
                          {isInstalled ? (
                            <Chip size="small" label="インストール済み" sx={{ bgcolor: "rgba(100, 255, 100, 0.1)", color: "light-dark(#00ad00, #80ff80)", height: 24, fontSize: "0.7rem", fontWeight: 800 }} />
                          ) : service.scope && service.workspaceId ? (
                            <Button size="small" onClick={(e) => { e.stopPropagation(); handleLaunchApp(service); }} sx={{ bgcolor: "#fff", color: "#000", fontWeight: 800, "&:hover": { bgcolor: "#eee" } }}>
                              試す
                            </Button>
                          ) : (
                            <Chip size="small" label="準備中" sx={{ bgcolor: "rgb(var(--brand-fg-rgb) / 0.08)", color: "rgb(var(--brand-fg-rgb) / 0.5)", height: 24, fontSize: "0.7rem", fontWeight: 800 }} />
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                  );
                })}
              </Box>
            </Box>
          )}

          {/* TEMPLATES CONTENT */}
          {activeTab === "templates" && (
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 800, color: "var(--brand-fg)" }}>
                  Official & Community Templates
                </Typography>
              </Box>
              
              {isLoadingTemplates ? (
                <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}>
                  <CircularProgress sx={{ color: 'light-dark(#095fa5, #90caf9)' }} />
                </Box>
              ) : filteredTemplates.length === 0 ? (
                <Typography sx={{ color: "rgb(var(--brand-fg-rgb) / 0.65)" }}>No templates found matching your search.</Typography>
              ) : (
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(3, 1fr)" }, gap: 3 }}>
                  {filteredTemplates.map(tmpl => {
                    return (
                      <Card 
                        key={tmpl.id} 
                        onClick={() => { setSelectedItem(tmpl); setItemType("template"); }}
                        sx={{ bgcolor: "var(--brand-surface)", borderRadius: 2, border: "1px solid #333", cursor: "pointer", "&:hover": { bgcolor: "var(--brand-surface2)" }, position: "relative" }}
                      >
                        <Box 
                          className="template-actions"
                          sx={{ 
                            position: 'absolute', top: 16, right: 16, zIndex: 10,
                            display: 'flex', gap: 0.5, opacity: 0, transition: 'opacity 0.2s',
                            bgcolor: 'rgba(0,0,0,0.6)', borderRadius: 2, backdropFilter: 'blur(4px)'
                          }}
                        >
                          <Button 
                            size="small" 
                            onClick={(e) => { e.stopPropagation(); setPreviewTemplate(tmpl); }} 
                            startIcon={<VisibilityRoundedIcon sx={{ fontSize: '14px !important' }} />}
                            sx={{ color: 'var(--brand-fg)', textTransform: 'none', fontWeight: 600, fontSize: '0.7rem', p: '2px 8px', '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.2)' } }}
                          >
                            プレビュー
                          </Button>
                        </Box>
                        
                        <Box sx={{ height: 160, bgcolor: 'light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))', position: 'relative', overflow: 'hidden', borderBottom: '1px solid #333' }}>
                          {tmpl.thumbnailUrl ? (
                            <img src={tmpl.thumbnailUrl} alt={tmpl.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
                              {tmpl.category === 'Architecture' ? <ArchitectureRoundedIcon sx={{ fontSize: 48, color: "var(--brand-fg)" }} /> : <StraightenRoundedIcon sx={{ fontSize: 48, color: "var(--brand-fg)" }} />}
                            </Box>
                          )}
                        </Box>
                        <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 0.5 }}>
                            <Typography sx={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--brand-fg)", lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{tmpl.name}</Typography>
                            <Chip label={tmpl.sourceType === "official" ? "Official" : "User"} size="small" sx={{ height: 18, fontSize: "0.6rem", bgcolor: tmpl.sourceType === "official" ? "rgb(var(--brand-fg-rgb) / 0.1)" : "rgba(0, 191, 255, 0.1)", color: tmpl.sourceType === "official" ? "rgb(var(--brand-fg-rgb) / 0.65)" : "#00bfff", ml: 1 }} />
                          </Box>
                          <Typography sx={{ color: "rgb(var(--brand-fg-rgb) / 0.65)", fontSize: "0.8rem", mb: 1.5, height: 36, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                            {tmpl.description}
                          </Typography>
                          
                          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <Typography sx={{ color: "var(--brand-fg)", fontWeight: 800, fontSize: "0.9rem" }}>Free</Typography>
                            <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontSize: '0.65rem' }}>
                              {tmpl.toolType === 'blender' ? 'Blender' : `Rhino ${tmpl.rhinoVersion || 8}`} {tmpl.unitSystem ? `• ${tmpl.unitSystem}` : ''}
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    );
                  })}
                </Box>
              )}
            </Box>
          )}

            </>
          )}
        </Box>
      </Box>

      <PreviewDialog 
        open={previewTemplate !== null}
        onClose={() => setPreviewTemplate(null)}
        fileName={previewTemplate?.name || ''}
        toolType={previewTemplate?.toolType === 'blender' ? 'Blender' : `Rhino ${previewTemplate?.rhinoVersion || 8}`}
        templatePath={previewTemplate?.templatePath}
        templateId={previewTemplate?.id || 'temp-preview'}
      />
    </Box>
  );
}

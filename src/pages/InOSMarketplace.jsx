import React, { useState, useMemo } from "react";
import { Box, Typography, Button, Card, CardContent, Chip, List, ListItem, ListItemButton, ListItemText, TextField, InputAdornment, IconButton, Stack } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import AppsIcon from "@mui/icons-material/Apps";
import LibraryBooksIcon from "@mui/icons-material/LibraryBooks";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import StarIcon from "@mui/icons-material/Star";
import { BRAND } from "@/shared/ui/theme";
import { ECOSYSTEM_SERVICES, SERVICE_CATEGORIES } from "@/shared/data/marketplaceData";

// ステータスごとの表示メタ（バッジ色・ラベル）
const STATUS_META = {
  ACTIVE: { label: "提供中", color: "#80ff80", bg: "rgba(100,255,100,0.12)" },
  BETA: { label: "ベータ", color: "#90caf9", bg: "rgba(144,202,249,0.14)" },
  "IN DEVELOPMENT": { label: "開発中", color: "#f5a623", bg: "rgba(245,166,35,0.14)" },
};

export default function InOSMarketplace() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("my_library"); // "my_library", "all", or "app", "plugin", etc.

  // Mock checking dummy user licenses（提供中の子アプリを所有済みとして扱う）
  const purchasedItemIds = ["3dss", "3dsl", "3dsc", "3dsd", "3dsr", "3dsi"];

  const libraryItems = useMemo(() => {
    return ECOSYSTEM_SERVICES.filter(service => purchasedItemIds.includes(service.id));
  }, []);

  const filteredStoreItems = useMemo(() => {
    return ECOSYSTEM_SERVICES.filter(service => {
      // Exclude already installed for store? Or show them as "Installed"
      if (activeTab === "my_library") return false; // Handled separately

      const q = searchQuery.toLowerCase();
      const matchesSearch = service.title.toLowerCase().includes(q) || service.desc.toLowerCase().includes(q);
      const matchesCat = activeTab === "all" || service.category === activeTab;
      return matchesSearch && matchesCat;
    });
  }, [searchQuery, activeTab]);

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, height: "100%", overflowY: "auto", overflowX: "hidden", "&::-webkit-scrollbar": { display: "none" } }}>
      
      {/* Search Bar at the top of In-OS area */}
      <Box sx={{ mb: 4, display: "flex", alignItems: "center" }}>
        <TextField
          placeholder="Search Marketplace..."
          variant="outlined"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: "#888" }} /></InputAdornment>,
          }}
          sx={{
            width: "100%",
            maxWidth: 600,
            "& .MuiOutlinedInput-root": {
              bgcolor: "#202024", color: "#fff", borderRadius: "24px", height: 44,
              "& fieldset": { border: "1px solid #333" },
              "&:hover fieldset": { borderColor: "#555" },
              "&.Mui-focused fieldset": { borderColor: "#888" }
            }
          }}
        />
      </Box>

      <Box sx={{ display: "flex", gap: 4, flexDirection: { xs: "column", md: "row" } }}>
          
        {/* Left Sidebar */}
        <Box sx={{ width: { xs: "100%", md: 220 }, flexShrink: 0 }}>
          <Typography sx={{ fontWeight: 800, mb: 1.5, fontSize: "0.85rem", color: "#ccc", textTransform: "uppercase", letterSpacing: 1 }}>Workspace</Typography>
          <List sx={{ p: 0, mb: 3 }}>
            <ListItem disablePadding>
              <ListItemButton 
                onClick={() => setActiveTab("my_library")}
                sx={{ 
                  borderRadius: 2, 
                  bgcolor: activeTab === "my_library" ? "rgba(255,255,255,0.1)" : "transparent",
                  "&:hover": { bgcolor: "rgba(255,255,255,0.05)" }
                }}
              >
                <LibraryBooksIcon sx={{ color: activeTab === "my_library" ? "#fff" : "#888", mr: 1.5, fontSize: 18 }} />
                <ListItemText primary="My Library" primaryTypographyProps={{ fontSize: "0.85rem", fontWeight: activeTab === "my_library" ? 700 : 500, color: activeTab === "my_library" ? "#fff" : "#aaa" }} />
                <Typography sx={{ fontSize: "0.75rem", color: "#666", fontWeight: 700 }}>{libraryItems.length}</Typography>
              </ListItemButton>
            </ListItem>
          </List>

          <Typography sx={{ fontWeight: 800, mb: 1.5, fontSize: "0.85rem", color: "#ccc", textTransform: "uppercase", letterSpacing: 1 }}>Store</Typography>
          <List sx={{ p: 0 }}>
            <ListItem disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton 
                onClick={() => setActiveTab("all")}
                sx={{ 
                  borderRadius: 2, 
                  bgcolor: activeTab === "all" ? "rgba(255,255,255,0.1)" : "transparent",
                  "&:hover": { bgcolor: "rgba(255,255,255,0.05)" }
                }}
              >
                <AppsIcon sx={{ color: activeTab === "all" ? "#fff" : "#888", mr: 1.5, fontSize: 18 }} />
                <ListItemText primary="All products" primaryTypographyProps={{ fontSize: "0.85rem", fontWeight: activeTab === "all" ? 700 : 500, color: activeTab === "all" ? "#fff" : "#aaa" }} />
                <Typography sx={{ fontSize: "0.75rem", color: "#666", fontWeight: 700 }}>{ECOSYSTEM_SERVICES.length}</Typography>
              </ListItemButton>
            </ListItem>
            {SERVICE_CATEGORIES.map(cat => {
              const count = ECOSYSTEM_SERVICES.filter(s => s.category === cat.id).length;
              const isActive = activeTab === cat.id;
              return (
                <ListItem disablePadding key={cat.id} sx={{ mb: 0.5 }}>
                  <ListItemButton 
                    onClick={() => setActiveTab(cat.id)}
                    sx={{ borderRadius: 2, bgcolor: isActive ? "rgba(255,255,255,0.1)" : "transparent", "&:hover": { bgcolor: "rgba(255,255,255,0.05)" }, pl: 4 }}
                  >
                    <ListItemText primary={cat.label} primaryTypographyProps={{ fontSize: "0.85rem", fontWeight: isActive ? 700 : 500, color: isActive ? "#fff" : "#aaa" }} />
                    <Typography sx={{ fontSize: "0.75rem", color: "#666", fontWeight: 700 }}>{count}</Typography>
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </Box>

        {/* Main Content Area */}
        <Box sx={{ flexGrow: 1, minWidth: 0, pb: 10 }}>
          
          {/* Hero Card */}
          <Box sx={{ 
            bgcolor: "#1e1e22", borderRadius: 3, border: "1px solid #333",
            p: { xs: 3, md: 4 }, mb: 4, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden"
          }}>
            <Box sx={{ position: "absolute", top: 0, right: 0, width: "50%", height: "100%", background: "radial-gradient(ellipse at top right, rgba(255,255,255,0.05), transparent 70%)" }} />
            
            <Box sx={{ display: "flex", flexDirection: { xs: "column", lg: "row" }, gap: 4, alignItems: { xs: "flex-start", lg: "center" }, zIndex: 1 }}>
              <Box sx={{ display: "flex", gap: 3, alignItems: "center", flexGrow: 1 }}>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 900, mb: 1, letterSpacing: "-0.03em", color: "#fff" }}>
                    {activeTab === "my_library" ? "My Workspace Library" : "In-OS Marketplace"}
                  </Typography>
                  <Typography sx={{ color: "#aaa", fontSize: "0.95rem" }}>
                    {activeTab === "my_library" ? "Manage your installed apps, plugins, and licenses." : "Discover and install new tools to extend your SEKKEIYA OS workflow."}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>

          {/* MY LIBRARY CONTENT */}
          {activeTab === "my_library" && (
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 3, color: "#fff", display: "flex", alignItems: "center" }}>
                Installed Apps <CheckCircleOutlineIcon sx={{ ml: 1, fontSize: 18, color: "#80ff80" }} />
              </Typography>
              {libraryItems.length === 0 ? (
                <Typography sx={{ color: "#888" }}>No licenses found.</Typography>
              ) : (
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(3, 1fr)" }, gap: 3 }}>
                  {libraryItems.map(service => (
                    <Card key={service.id} sx={{ bgcolor: "#1a1a1c", border: `1px solid #333`, borderRadius: 2, display: "flex", flexDirection: "column", p: 2, "&:hover": { borderColor: `${service.color}80`, bgcolor: "#222" } }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <Box sx={{ width: 64, height: 64, borderRadius: "16px", bgcolor: "rgba(255,255,255,0.96)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 16px ${service.color}55, 0 0 0 1px ${service.color}40`, flexShrink: 0 }}>
                          <img src={service.icon} alt={service.title} style={{ width: 52, height: 52, objectFit: "contain" }} />
                        </Box>
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 800, color: "#fff", mb: 0.5, fontSize: "0.95rem" }} noWrap>{service.title}</Typography>
                          <Chip size="small" label={STATUS_META[service.status]?.label ?? "Installed"} sx={{ bgcolor: STATUS_META[service.status]?.bg ?? "rgba(100, 255, 100, 0.1)", color: STATUS_META[service.status]?.color ?? "#80ff80", height: 20, "& .MuiChip-label": { px: 1, fontSize: "0.65rem", fontWeight: 800 } }} />
                        </Box>
                      </Box>
                      <Box sx={{ mt: 2, display: "flex", gap: 1 }}>
                        <Button fullWidth variant="contained" onClick={() => { window.location.href = service.path; }} sx={{ bgcolor: "rgba(255,255,255,0.1)", color: "#fff", fontWeight: 700, "&:hover": { bgcolor: "rgba(255,255,255,0.2)" }, boxShadow: "none" }}>
                          Launch App
                        </Button>
                      </Box>
                    </Card>
                  ))}
                </Box>
              )}
            </Box>
          )}

          {/* STORE CONTENT */}
          {activeTab !== "my_library" && (
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 800, color: "#fff" }}>
                  Available to Install
                </Typography>
              </Box>
              
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(3, 1fr)" }, gap: 3 }}>
                {filteredStoreItems.map(service => {
                  const isInstalled = purchasedItemIds.includes(service.id);

                  return (
                    <Card key={service.id} sx={{ bgcolor: "#1a1a1c", borderRadius: 2, border: "1px solid #333", cursor: "pointer", "&:hover": { bgcolor: "#222" } }}>
                      {/* Thumbnail */}
                      <Box sx={{ height: 170, background: `radial-gradient(circle at 50% 38%, ${service.color}55 0%, ${service.color}22 45%, #111 100%)`, position: "relative", borderBottom: "1px solid #333", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Box sx={{ width: 112, height: 112, borderRadius: "26px", bgcolor: "rgba(255,255,255,0.96)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 8px 28px ${service.color}66, 0 0 0 1px ${service.color}55` }}>
                          <img src={service.icon} alt={service.title} style={{ width: 92, height: 92, objectFit: "contain" }} />
                        </Box>
                        {STATUS_META[service.status] && service.status !== "ACTIVE" && (
                          <Chip size="small" label={STATUS_META[service.status].label} sx={{ position: "absolute", top: 10, right: 10, height: 20, bgcolor: STATUS_META[service.status].bg, color: STATUS_META[service.status].color, fontWeight: 800, "& .MuiChip-label": { px: 1, fontSize: "0.62rem" } }} />
                        )}
                      </Box>
                      <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 0.5 }}>
                          <Typography sx={{ fontWeight: 800, fontSize: "0.95rem", color: "#fff", lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{service.title}</Typography>
                          <Box sx={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                            <StarIcon sx={{ color: "#f5a623", fontSize: 14, mr: 0.5 }} />
                            <Typography sx={{ color: "#aaa", fontSize: "0.8rem", fontWeight: 600 }}>5.0</Typography>
                          </Box>
                        </Box>
                        <Typography sx={{ color: "#888", fontSize: "0.8rem", mb: 1, height: 36, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                          {service.desc}
                        </Typography>
                        
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: 2 }}>
                          <Typography sx={{ color: "#fff", fontWeight: 800, fontSize: "0.9rem" }}>Free</Typography>
                          {isInstalled ? (
                            <Chip size="small" label="インストール済み" sx={{ bgcolor: "rgba(100, 255, 100, 0.1)", color: "#80ff80", height: 24, fontSize: "0.7rem", fontWeight: 800 }} />
                          ) : service.scope && service.workspaceId ? (
                            <Button size="small" onClick={() => { window.location.href = service.path; }} sx={{ bgcolor: "#fff", color: "#000", fontWeight: 800, "&:hover": { bgcolor: "#eee" } }}>
                              試す
                            </Button>
                          ) : (
                            <Chip size="small" label="準備中" sx={{ bgcolor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)", height: 24, fontSize: "0.7rem", fontWeight: 800 }} />
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                  );
                })}
              </Box>
            </Box>
          )}

        </Box>
      </Box>
    </Box>
  );
}

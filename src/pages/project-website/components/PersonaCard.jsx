import React, { useState, useEffect } from "react";
import { Box, Typography, Paper, TextField, IconButton, Chip, Collapse, Button, Tooltip as MuiTooltip, Slider } from "@mui/material";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import ExpandLessRoundedIcon from "@mui/icons-material/ExpandLessRounded";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Cell, CartesianGrid } from "recharts";

const textFieldStyles = {
  "& .MuiOutlinedInput-root": {
    color: "#fff", bgcolor: "rgba(0,0,0,0.2)",
    "& fieldset": { borderColor: "rgba(255,255,255,0.1)" },
    "&:hover fieldset": { borderColor: "rgba(255,255,255,0.3)" },
    "&.Mui-focused fieldset": { borderColor: "#fa709a" },
  },
  "& .MuiInputBase-input": { color: "#fff" }
};

export default function PersonaCard({ block, onChange, onDelete, onDuplicate, editMode }) {
  const [profileName, setProfileName] = useState(block.profileName || "");
  const [traits, setTraits] = useState((block.traits || []).join(", "));
  const [age, setAge] = useState(block.age || "");
  const [occupation, setOccupation] = useState(block.occupation || "");
  const [budget, setBudget] = useState(block.budget || "");
  
  // Advanced fields toggle
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    setProfileName(block.profileName || "");
    setTraits((block.traits || []).join(", "));
    setAge(block.age || "");
    setOccupation(block.occupation || "");
    setBudget(block.budget || "");
  }, [block]);

  const handleBlur = (field, value) => onChange(block.id, field, value);
  const handleTraitsBlur = () => {
    const arr = traits.split(",").map(s => s.trim()).filter(Boolean);
    onChange(block.id, "traits", arr);
  };

  const handleDeleteClick = () => {
    if (window.confirm(`${block.profileName || "このペルソナ"} を削除してもよろしいですか？`)) {
      onDelete();
    }
  };

  const radarData = [
    { subject: 'デザイン性', key: 'needsDesign', A: block.needsDesign ?? 80, fullMark: 100 },
    { subject: 'コスパ', key: 'needsPrice', A: block.needsPrice ?? 60, fullMark: 100 },
    { subject: '機能性', key: 'needsFunc', A: block.needsFunc ?? 90, fullMark: 100 },
    { subject: 'ブランド', key: 'needsBrand', A: block.needsBrand ?? 40, fullMark: 100 },
    { subject: '利便性', key: 'needsConv', A: block.needsConv ?? 70, fullMark: 100 },
  ];

  const defaultTimeline = [
    { time: "08:00", activity: "起床・準備", val: 20 },
    { time: "10:00", activity: "移動・出社", val: 50 },
    { time: "12:00", activity: "ランチ休", val: 80 },
    { time: "15:00", activity: "カフェ作業", val: 100 },
    { time: "19:00", activity: "帰宅・自由", val: 60 },
  ];

  const [localTimeline, setLocalTimeline] = useState(block.timeline || defaultTimeline);

  useEffect(() => {
    if (block.timeline) setLocalTimeline(block.timeline);
  }, [block.timeline]);

  const handleTimelineChange = (idx, field, val) => {
    const newArr = [...localTimeline];
    newArr[idx] = { ...newArr[idx], [field]: val };
    setLocalTimeline(newArr);
  };

  const commitTimelineChange = () => {
    onChange(block.id, "timeline", localTimeline);
  };

  return (
    <Paper sx={{ 
      p: 3, bgcolor: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.08)", 
      borderRadius: 4, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", gap: 3
    }}>
      <Box sx={{ position: "absolute", top: 0, right: 0, width: 120, height: 120, bgcolor: "rgba(250, 112, 154, 0.05)", borderRadius: "0 16px 0 100%" }} />
      
      {/* Header & Actions */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative", zIndex: 1 }}>
        <Box>
          <Typography variant="caption" sx={{ color: "#fa709a", fontWeight: 800, letterSpacing: 1.5, display: "block", mb: 0.5 }}>PERSONA PROFILE</Typography>
          {!editMode ? (
            <Typography variant="h5" sx={{ color: "#fff", fontWeight: 900, mb: 1, letterSpacing: "-0.5px" }}>
              {block.profileName || "名称未設定のペルソナ"}
            </Typography>
          ) : (
            <TextField 
              variant="outlined" size="small" placeholder="ペルソナ名" value={profileName}
              onChange={(e) => setProfileName(e.target.value)} onBlur={() => handleBlur("profileName", profileName)}
              sx={{ ...textFieldStyles, mb: 1, width: 250 }}
            />
          )}
        </Box>
        <Box sx={{ display: "flex", gap: 0.5 }}>
          <MuiTooltip title="複製 (Clone)">
            <IconButton size="small" onClick={onDuplicate} sx={{ color: "rgba(255,255,255,0.5)", "&:hover": { color: "#fff", bgcolor: "rgba(255,255,255,0.1)" } }}>
              <ContentCopyRoundedIcon fontSize="small" />
            </IconButton>
          </MuiTooltip>
          <MuiTooltip title="削除 (Delete)">
            <IconButton size="small" onClick={handleDeleteClick} sx={{ color: "rgba(255,77,79,0.5)", "&:hover": { color: "#ff4d4f", bgcolor: "rgba(255,77,79,0.1)" } }}>
              <DeleteOutlineRoundedIcon fontSize="small" />
            </IconButton>
          </MuiTooltip>
        </Box>
      </Box>

      {/* Basic Traits */}
      <Box sx={{ position: "relative", zIndex: 1 }}>
        {!editMode ? (
          (!block.traits || block.traits.length === 0) ? (
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.3)", fontStyle: "italic" }}>特徴・ニーズが未入力です。</Typography>
          ) : (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {(block.traits || []).map((t, idx) => (
                <Chip key={idx} label={t} size="small" sx={{ bgcolor: "rgba(250, 112, 154, 0.08)", color: "#ffb199", fontWeight: 600, border: "1px solid rgba(250, 112, 154, 0.2)" }} />
              ))}
            </Box>
          )
        ) : (
          <TextField 
            fullWidth variant="outlined" size="small" placeholder="特徴・ニーズ（カンマ区切り）" value={traits}
            onChange={(e) => setTraits(e.target.value)} onBlur={handleTraitsBlur}
            sx={textFieldStyles}
          />
        )}
      </Box>

      {/* Advanced Toggles & Visualizations */}
      <Box sx={{ position: "relative", zIndex: 1 }}>
        <Button 
          size="small" 
          onClick={() => setShowAdvanced(!showAdvanced)} 
          endIcon={showAdvanced ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
          sx={{ color: "rgba(255,255,255,0.6)", textTransform: "none", p: 0, minWidth: "auto", "&:hover": { bgcolor: "transparent", color: "#fa709a" } }}
        >
          {showAdvanced ? "詳細プロフィールを閉じる" : "詳細プロフィール・行動特性を開く"}
        </Button>

        <Collapse in={showAdvanced}>
          <Box sx={{ mt: 3, display: "flex", flexDirection: "column", gap: 3 }}>
            
            {/* Demographics / Attributes */}
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
              <Box sx={{ flex: "1 1 calc(33% - 16px)" }}>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.4)", display: "block", mb: 0.5 }}>年齢・性別</Typography>
                {editMode ? (
                  <TextField size="small" value={age} onChange={e=>setAge(e.target.value)} onBlur={()=>handleBlur("age", age)} sx={textFieldStyles} placeholder="例: 30代女性" />
                ) : (
                  <Typography variant="body2" sx={{ color: "#fff", fontWeight: 700 }}>{block.age || "未設定"}</Typography>
                )}
              </Box>
              <Box sx={{ flex: "1 1 calc(33% - 16px)" }}>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.4)", display: "block", mb: 0.5 }}>職業・ライフスタイル</Typography>
                {editMode ? (
                  <TextField size="small" value={occupation} onChange={e=>setOccupation(e.target.value)} onBlur={()=>handleBlur("occupation", occupation)} sx={textFieldStyles} placeholder="例: フリーランス" />
                ) : (
                  <Typography variant="body2" sx={{ color: "#fff", fontWeight: 700 }}>{block.occupation || "未設定"}</Typography>
                )}
              </Box>
              <Box sx={{ flex: "1 1 calc(33% - 16px)" }}>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.4)", display: "block", mb: 0.5 }}>予算感・支出傾向</Typography>
                {editMode ? (
                  <TextField size="small" value={budget} onChange={e=>setBudget(e.target.value)} onBlur={()=>handleBlur("budget", budget)} sx={textFieldStyles} placeholder="例: 中〜高価格帯" />
                ) : (
                  <Typography variant="body2" sx={{ color: "#fff", fontWeight: 700 }}>{block.budget || "未設定"}</Typography>
                )}
              </Box>
            </Box>

            {/* Charts Row */}
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mt: 1 }}>
              {/* Needs Radar */}
              <Box sx={{ flex: "1 1 200px", height: 220, bgcolor: "rgba(0,0,0,0.1)", borderRadius: 3, p: 2 }}>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)", fontWeight: 700 }}>価値観・重視ポイント</Typography>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                    <PolarGrid stroke="rgba(255,255,255,0.1)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar dataKey="A" stroke="#fa709a" fill="#fa709a" fillOpacity={0.4} />
                    <RechartsTooltip contentStyle={{ backgroundColor: 'rgba(10,15,25,0.9)', borderColor: 'rgba(255,255,255,0.1)' }} itemStyle={{ color: '#fa709a' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </Box>
              {/* Daily Timeline */}
              <Box sx={{ flex: "2 1 300px", height: 220, bgcolor: "rgba(0,0,0,0.1)", borderRadius: 3, p: 2 }}>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)", fontWeight: 700 }}>1日の行動特性と滞在ポテンシャル</Typography>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={localTimeline} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="time" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <RechartsTooltip 
                      cursor={{ fill: "rgba(255,255,255,0.05)" }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <Box sx={{ bgcolor: 'rgba(10,15,25,0.9)', p: 1.5, borderRadius: 2, border: '1px solid rgba(255,255,255,0.1)' }}>
                              <Typography variant="caption" sx={{ color: "#fff", display: "block", fontWeight: 800 }}>{data.time}</Typography>
                              <Typography variant="body2" sx={{ color: "#00BFFF", mt: 0.5 }}>{data.activity}</Typography>
                            </Box>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="val" radius={[4, 4, 0, 0]}>
                      {localTimeline.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.val === 100 ? "#fa709a" : "#00BFFF"} fillOpacity={entry.val / 100} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </Box>

            {/* Advanced Edit Mode Inputs */}
            {editMode && (
              <Box sx={{ mt: 2, p: 3, bgcolor: "rgba(0,0,0,0.3)", borderRadius: 3, border: "1px dashed rgba(255,255,255,0.2)" }}>
                <Typography variant="caption" sx={{ color: "#fa709a", fontWeight: 700, mb: 3, display: "block" }}>
                  チャート指標の編集 (Chart Metrics Editor)
                </Typography>
                
                <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.6)", mb: 2 }}>価値観・重視ポイント (Radar Chart)</Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3, mb: 4 }}>
                  {radarData.map((m) => (
                    <Box key={m.key} sx={{ flex: "1 1 calc(20% - 24px)", minWidth: 100 }}>
                      <Typography variant="caption" sx={{ color: "#fff", display: "block", mb: 1 }}>{m.subject}</Typography>
                      <Slider 
                        size="small"
                        min={0} max={100} step={5}
                        // To avoid jumpiness on render tick, using local state or relying on block prop.
                        // Since edit mode only syncs on blur generally, for sliders we use defaultValue or value + commit.
                        value={m.A} 
                        onChange={(e, val) => {
                          // Allow pure local drag, handled partially.
                          // Setting it via a generic local handler would be better, but firing DB onChange on generic commit works if slightly jumpy.
                        }}
                        onChangeCommitted={(e, val) => onChange(block.id, m.key, val)}
                        sx={{ color: "#fa709a" }}
                      />
                    </Box>
                  ))}
                </Box>

                <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.6)", mb: 2 }}>1日の行動特性 (Timeline Bar Chart)</Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {localTimeline.map((entry, idx) => (
                    <Box key={idx} sx={{ display: "flex", gap: { xs: 1, md: 2 }, alignItems: "center" }}>
                      <TextField size="small" placeholder="時間" value={entry.time} onChange={(e) => handleTimelineChange(idx, "time", e.target.value)} onBlur={commitTimelineChange} sx={{ ...textFieldStyles, width: 80 }} />
                      <TextField size="small" placeholder="行動" value={entry.activity} onChange={(e) => handleTimelineChange(idx, "activity", e.target.value)} onBlur={commitTimelineChange} sx={{ ...textFieldStyles, flex: 1 }} />
                      <Slider size="small" min={0} max={100} step={10} value={entry.val} onChange={(e, val) => handleTimelineChange(idx, "val", val)} onChangeCommitted={commitTimelineChange} sx={{ color: "#00BFFF", width: { xs: 80, md: 100 }, ml: 2 }} />
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

          </Box>
        </Collapse>
      </Box>
    </Paper>
  );
}

// src/features/Dashboard/BoardDetailPage/BoardDetailInformation.jsx
import { useEffect, useState } from "react";
import {
  Box, Typography, TextField, Chip, Button, Autocomplete,
  Grid, Divider, Container,
} from "@mui/material";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/shared/config/firebase";
import { useAuth } from "@/features/auth/context/AuthContext";
import { updateProject } from "@sekkeiya/global-panel";
import { useSelectedProjectContext } from "@/shared/contexts/SelectedProjectContext";
import BoardCategories from "@/shared/constants/BoardCategories";
import { boardDetailStyles } from "@/shared/styles/BoardDetail/BoardDetail";
import BoardDetailArea from "./BoardDetailArea";
import TextsmsOutlinedIcon from "@mui/icons-material/TextsmsOutlined";
import ViewComfyOutlinedIcon from "@mui/icons-material/ViewComfyOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import { renderSelect } from "./formUtils";

/** @や前後空白を除いたハンドルへ整形 */
const normalizeHandle = (raw) => {
  if (!raw) return null;
  const h = String(raw).trim().replace(/^@+/, "");
  return h || null;
};

const BoardDetailInformation = ({ board }) => {
  const { user } = useAuth();
  const { selectedProject, setSelectedProject } = useSelectedProjectContext();

  // Deduce IDs from the passed board prop or context fallback
  const boardId = board?.id || board?.boardId || selectedProject?.id;
  const userId = board?.ownerId || board?.owner || board?.userId || selectedProject?.ownerId || selectedProject?.owner;

  const [boardData, setBoardData] = useState(null);
  const [isEditable, setIsEditable] = useState(false);
  const [memberMap, setMemberMap] = useState({});

  const [boardName, setBoardName] = useState("");
  const [boardDescription, setBoardDescription] = useState("");
  const [buildingType, setBuildingType] = useState("");
  const [floorCount, setFloorCount] = useState("");
  const [ceilingHeight, setCeilingHeight] = useState("");
  const [siteAreaSqm, setSiteAreaSqm] = useState("");
  const [siteAreaTsubo, setSiteAreaTsubo] = useState("");
  const [roomTypes, setRoomTypes] = useState("");
  const [requiredAreas, setRequiredAreas] = useState("");
  const [requiredFunctions, setRequiredFunctions] = useState("");
  const [requiredSeats, setRequiredSeats] = useState("");
  const [budget, setBudget] = useState("");
  const [estimatedCompletion, setEstimatedCompletion] = useState("");
  const [clientName, setClientName] = useState("");
  const [projectType, setProjectType] = useState("");

  /* ===== 取得 ===== */
  useEffect(() => {
    const fetchBoard = async () => {
      try {
        const unifiedRef = doc(db, "projects", boardId);
        const snap = await getDoc(unifiedRef);
        if (snap.exists()) {
          const data = snap.data();
          setBoardData(data);
          setSelectedProject({ id: boardId, ...data });

          const amOwner = data.ownerId === user?.uid;
          const isMember = Array.isArray(data.memberIds) && data.memberIds.includes(user?.uid);
          setIsEditable(amOwner || isMember);

          if (Array.isArray(data.memberIds) && data.memberIds.length) {
            const map = {};
            await Promise.all(
              data.memberIds.map(async (uid) => {
                try {
                  const uSnap = await getDoc(doc(db, "users", uid));
                  map[uid] = uSnap.exists() ? uSnap.data().username || "NoName" : "不明なユーザー";
                } catch {
                  map[uid] = "取得失敗";
                }
              })
            );
            setMemberMap(map);
          }
        }
      } catch (err) {
        console.error("ボード取得エラー:", err);
      }
    };
    if (boardId) {
      fetchBoard();
    }
  }, [boardId, user?.uid, setSelectedProject]);

  /* ===== ローカル state 初期化 ===== */
  useEffect(() => {
    if (!selectedProject) return;
    setBoardName(selectedProject.name || "");
    setBoardDescription(selectedProject.description || "");
    setBuildingType(selectedProject.buildingType || "");
    setSiteAreaSqm(selectedProject.siteAreaSqm || "");
    setSiteAreaTsubo(selectedProject.siteAreaTsubo || "");
    setRoomTypes(selectedProject.roomTypes || "");
    setRequiredAreas(selectedProject.requiredAreas || "");
    setRequiredSeats(selectedProject.requiredSeats || "");
    setRequiredFunctions(selectedProject.requiredFunctions || "");
    setBudget(selectedProject.budget || "");
    setClientName(selectedProject.clientName || "");
    setEstimatedCompletion(selectedProject.estimatedCompletion || "");
    setProjectType(selectedProject.projectType || "");
    setFloorCount(selectedProject.floorCount || "");
    setCeilingHeight(selectedProject.ceilingHeight || "");
  }, [selectedProject]);

  /* ===== 保存 ===== */
  const handleSave = async () => {
    if (!boardData || !user?.uid) return;

    // ユーザの handle 解決
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    const u = userSnap.exists() ? userSnap.data() || {} : {};
    const handle =
      normalizeHandle(u.handle) ||
      normalizeHandle(u.handleLower) ||
      normalizeHandle(u.ownerHandle) ||
      normalizeHandle(u.ownerHandleLower) ||
      normalizeHandle(u.username) ||
      normalizeHandle(u.displayName) ||
      "";

    const ownerFields = handle
      ? { ownerName: handle, ownerHandle: handle, ownerHandleLower: handle.toLowerCase() }
      : {};

    const formValues = {
      name: boardName,
      description: boardDescription,
      buildingType,
      floorCount,
      ceilingHeight,
      siteAreaSqm,
      siteAreaTsubo,
      roomTypes,
      requiredAreas,
      requiredFunctions,
      requiredSeats,
      budget,
      estimatedCompletion,
      clientName,
      projectType,
      areaSeats: Array.isArray(boardData?.areaSeats) ? boardData.areaSeats : [],
      ...ownerFields,
    };

    try {
      const amOwner = boardData.ownerId === user.uid;
      const isMember = Array.isArray(boardData.memberIds) && boardData.memberIds.includes(user.uid);

      if (!amOwner && !isMember) {
        throw new Error("このボードを編集する権限がありません。");
      }

      await updateProject(boardId, formValues);
      
      const snap = await getDoc(doc(db, "projects", boardId));
      if (snap.exists()) {
        setSelectedProject({ id: boardId, ...snap.data() });
      }

      alert("保存しました！");
    } catch (err) {
      console.error("保存エラー:", err);
      alert(`保存に失敗しました：${err?.message || err}`);
    }
  };

  if (!boardData) {
    return (
      <Typography sx={{ color: "#fff", textAlign: "center", mt: 10 }}>
        読み込み中...
      </Typography>
    );
  }

  // ローカルのテキストフィールドラッパ
  const renderTF = (label, value, onChange, props = {}) => (
    <TextField label={label} value={value} onChange={onChange} sx={boardDetailStyles.textField} {...props} />
  );

  return (
    <Container maxWidth="lg" sx={boardDetailStyles.container}>
      <Typography variant="h5" sx={boardDetailStyles.title}>プロジェクトボード詳細情報</Typography>
      <Divider sx={boardDetailStyles.divider} />

      <Box sx={boardDetailStyles.section}>
        {/* プロジェクト名 */}
        <Typography variant="subtitle1" sx={boardDetailStyles.subTitle}>プロジェクト名</Typography>
        <Box sx={boardDetailStyles.section}>
          {renderTF("ボード名", boardName, (e) => setBoardName(e.target.value))}
        </Box>
        <Divider sx={boardDetailStyles.divider} />

        {/* チームメンバー */}
        {Array.isArray(boardData?.memberIds) && boardData.memberIds.length > 0 && (
          <Box>
            <Typography variant="subtitle1" sx={boardDetailStyles.subTitle}>メンバー</Typography>
            <Box sx={boardDetailStyles.section}>
              {boardData.memberIds.map((uid) => (
                <Chip key={uid} label={memberMap[uid] || "読み込み中..."} sx={boardDetailStyles.chip} />
              ))}
            </Box>
          </Box>
        )}
        <Divider sx={boardDetailStyles.divider} />

        {/* 建築仕様 */}
        <Box>
          <Typography variant="subtitle2" sx={{ ...boardDetailStyles.subTitle, display: "flex", alignItems: "center", gap: 1 }}>
            <DescriptionOutlinedIcon />建築仕様
          </Typography>
            <Box sx={boardDetailStyles.section}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  {renderSelect({
                    id: "project-type",
                    label: "プロジェクトタイプ",
                    value: projectType,
                    onChange: (e) => setProjectType(e.target.value),
                    options: BoardCategories.projectTypes,
                  })}
                </Grid>
                <Grid item xs={12} sm={6}>
                  {renderSelect({
                    id: "building-type",
                    label: "建物タイプ",
                    value: buildingType,
                    onChange: (e) => setBuildingType(e.target.value),
                    options: BoardCategories.buildingTypes,
                  })}
                </Grid>
              </Grid>
            </Box>
          <Divider sx={boardDetailStyles.divider} />
        </Box>

        {/* 延床面積 */}
        <Box>
          <Typography variant="subtitle2" sx={{ ...boardDetailStyles.subTitle, display: "flex", alignItems: "center", gap: 1 }}>
            <ViewComfyOutlinedIcon />延床面積（㎡・坪）
          </Typography>
          <Box sx={boardDetailStyles.section}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                {renderTF("面積（㎡）", siteAreaSqm, (e) => setSiteAreaSqm(e.target.value), {
                  onBlur: () => {
                    const val = parseFloat(siteAreaSqm);
                    if (!isNaN(val)) setSiteAreaTsubo((val / 3.3058).toFixed(2));
                  },
                })}
              </Grid>
              <Grid item xs={12} sm={6}>
                {renderTF("面積（坪）", siteAreaTsubo, (e) => setSiteAreaTsubo(e.target.value), {
                  onBlur: () => {
                    const val = parseFloat(siteAreaTsubo);
                    if (!isNaN(val)) setSiteAreaSqm((val * 3.3058).toFixed(2));
                  },
                })}
              </Grid>
            </Grid>
          </Box>
          <Divider sx={boardDetailStyles.divider} />
        </Box>

        {/* 用途別エリア設定 */}
        <Box>
          <BoardDetailArea
            initialAreaSeatList={boardData?.areaSeats || []}
            onChange={(updatedList) => setBoardData((prev) => ({ ...prev, areaSeats: updatedList }))}
          />
        </Box>

        {/* 要望・その他 */}
        <Box>
          <Typography variant="subtitle2" sx={{ ...boardDetailStyles.subTitle, display: "flex", alignItems: "center", gap: 1 }}>
            <TextsmsOutlinedIcon />要望・その他
          </Typography>
          <Box sx={boardDetailStyles.section}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>{renderTF("予算（万円）", budget, (e) => setBudget(e.target.value))}</Grid>
              <Grid item xs={12} sm={6}>{renderTF("クライアント名", clientName, (e) => setClientName(e.target.value))}</Grid>
              <Grid item xs={12} sm={6}>{renderTF("竣工予定時期", estimatedCompletion, (e) => setEstimatedCompletion(e.target.value))}</Grid>
            </Grid>
          </Box>
          <Divider sx={boardDetailStyles.divider} />
        </Box>

        {/* 機能 */}
        <Box>
          <Typography variant="subtitle2" sx={boardDetailStyles.subTitle}>機能</Typography>
          <Box sx={boardDetailStyles.section}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Autocomplete
                  multiple
                  disableCloseOnSelect
                  options={BoardCategories.clientNeeds.filter(
                    (opt) => !(requiredFunctions?.split(",") || []).includes(opt)
                  )}
                  value={requiredFunctions?.split(",") || []}
                  onChange={(event, newValue) => setRequiredFunctions(newValue.join(","))}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => {
                      const { key, ...chipProps } = getTagProps({ index });
                      return (
                        <Chip key={option} variant="filled" label={option} sx={boardDetailStyles.chip} {...chipProps} />
                      );
                    })
                  }
                  renderInput={(params) => (
                    <TextField {...params} variant="outlined" label="必要な機能" sx={boardDetailStyles.textField} />
                  )}
                />
              </Grid>
            </Grid>
          </Box>
        </Box>

        <Button variant="contained" sx={boardDetailStyles.saveButton} onClick={handleSave} disabled={!isEditable}>
          保存
        </Button>
      </Box>
    </Container>
  );
};

export default BoardDetailInformation;

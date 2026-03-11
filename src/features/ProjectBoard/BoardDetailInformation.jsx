// src/features/Dashboard/BoardDetailPage/BoardDetailInformation.jsx
import { useEffect, useState } from "react";
import {
  Box, Typography, TextField, Chip, Button, Autocomplete,
  Grid, Divider, Container,
} from "@mui/material";
import { doc, getDoc, updateDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/shared/config/firebase";
import { useAuth } from "@/features/auth/context/AuthContext";
import { updateMyBoardInfo } from "@/shared/api/boards/myBoards";
import { useSelectedBoardContext } from "@/shared/contexts/SelectedBoardContext";
import BoardCategories from "@/shared/constants/BoardCategories";
import { boardDetailStyles } from "@/shared/styles/BoardDetail/BoardDetail";
import BoardDetailArea from "./BoardDetailArea";
import TextsmsOutlinedIcon from "@mui/icons-material/TextsmsOutlined";
import ViewComfyOutlinedIcon from "@mui/icons-material/ViewComfyOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import { renderSelect } from "./formUtils";

/* ===== teamBoards で更新可のキー（ルール想定と一致） ===== */
const TEAM_ALLOWED_UPDATE_KEYS = new Set([
  "name","description","buildingType","floorCount","ceilingHeight",
  "siteAreaSqm","siteAreaTsubo","roomTypes","requiredAreas","requiredFunctions",
  "requiredSeats","budget","estimatedCompletion","clientName","projectType",
  "areaSeats","ownerName","ownerHandle","ownerHandleLower","updatedAt",
]);

/* ===== 送信禁止キー（オーナーでも送らない） ===== */
const TEAM_FORBIDDEN_KEYS = new Set([
  "owner","ownerId","members","visibility","isPublic","isPrivate",
  "publicId","publicMode","publicRefsUpdatedAt","createdAt","publishAt","writeAccess",
]);

/** @や前後空白を除いたハンドルへ整形 */
const normalizeHandle = (raw) => {
  if (!raw) return null;
  const h = String(raw).trim().replace(/^@+/, "");
  return h || null;
};

/** 変更のあったキーのみ抽出 */
const pickChanged = (before = {}, after = {}) => {
  const out = {};
  for (const [k, v] of Object.entries(after)) {
    const a = v;
    const b = before?.[k];
    const same =
      typeof a === "object" || typeof b === "object"
        ? JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
        : a === b;
    if (!same) out[k] = a;
  }
  return out;
};

/** teamBoards へ送るデータのサニタイズ（ホワイトリスト＋禁止キー） */
const sanitizeForTeamGlobal = (src) => {
  const out = {};
  for (const [k, v] of Object.entries(src || {})) {
    if (TEAM_FORBIDDEN_KEYS.has(k)) continue;
    if (!TEAM_ALLOWED_UPDATE_KEYS.has(k)) continue;
    if (v === undefined) continue;
    out[k] = v;
  }
  if (!("updatedAt" in out)) out.updatedAt = serverTimestamp();
  return out;
};

/** users/{uid}/teamBoards の軽量ミラー */
const sanitizeForUserLink = (src) => {
  const out = {};
  for (const [k, v] of Object.entries(src || {})) {
    if (v === undefined) continue;
    out[k] = v;
  }
  out.updatedAt = serverTimestamp();
  return out;
};

const BoardDetailInformation = ({ board }) => {
  const { user } = useAuth();
  const { selectedBoard, setSelectedBoard } = useSelectedBoardContext();

  // Deduce IDs from the passed board prop or context fallback
  const boardId = board?.id || board?.boardId || selectedBoard?.id;
  const userId = board?.ownerId || board?.owner || board?.userId || selectedBoard?.ownerId || selectedBoard?.owner;

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
        // myBoards を優先
        const myBoardRef = doc(db, "users", userId, "myBoards", boardId);
        const mySnap = await getDoc(myBoardRef);
        if (mySnap.exists()) {
          const data = mySnap.data();
          setBoardData({ ...data, boardType: "myBoards" });
          setSelectedBoard({ id: boardId, ...data, boardType: "myBoards" });
          setIsEditable(user?.uid === userId);
          return;
        }

        // teamBoards（実体）
        const teamBoardRef = doc(db, "teamBoards", boardId);
        const teamSnap = await getDoc(teamBoardRef);
        if (teamSnap.exists()) {
          const data = teamSnap.data();
          setBoardData({ ...data, boardType: "teamBoards" });
          setSelectedBoard({ id: boardId, ...data, boardType: "teamBoards" });

          const amOwner = data.owner === user?.uid || data.ownerId === user?.uid;
          const isMember = Array.isArray(data.members) && data.members.includes(user?.uid);
          setIsEditable(amOwner || isMember);

          if (Array.isArray(data.members) && data.members.length) {
            const map = {};
            await Promise.all(
              data.members.map(async (uid) => {
                try {
                  const snap = await getDoc(doc(db, "users", uid));
                  map[uid] = snap.exists() ? snap.data().username || "NoName" : "不明なユーザー";
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
    fetchBoard();
  }, [userId, boardId, user?.uid, setSelectedBoard]);

  /* ===== ローカル state 初期化 ===== */
  useEffect(() => {
    if (!selectedBoard) return;
    setBoardName(selectedBoard.name || "");
    setBoardDescription(selectedBoard.description || "");
    setBuildingType(selectedBoard.buildingType || "");
    setSiteAreaSqm(selectedBoard.siteAreaSqm || "");
    setSiteAreaTsubo(selectedBoard.siteAreaTsubo || "");
    setRoomTypes(selectedBoard.roomTypes || "");
    setRequiredAreas(selectedBoard.requiredAreas || "");
    setRequiredSeats(selectedBoard.requiredSeats || "");
    setRequiredFunctions(selectedBoard.requiredFunctions || "");
    setBudget(selectedBoard.budget || "");
    setClientName(selectedBoard.clientName || "");
    setEstimatedCompletion(selectedBoard.estimatedCompletion || "");
    setProjectType(selectedBoard.projectType || "");
    setFloorCount(selectedBoard.floorCount || "");
    setCeilingHeight(selectedBoard.ceilingHeight || "");
  }, [selectedBoard]);

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
      const isMy = boardData.boardType === "myBoards";
      const amOwner = boardData.owner === user.uid || boardData.ownerId === user.uid;
      const isMember = Array.isArray(boardData.members) && boardData.members.includes(user.uid);

      console.log("[DEBUG] teamBoards save", {
        boardId,
        isMy,
        amOwner,
        isMember,
        docOwner: boardData.owner,
        docOwnerId: boardData.ownerId,
        members: boardData.members,
      });

      if (isMy) {
        const payload = { ...formValues, updatedAt: serverTimestamp() };
        const mRef = doc(db, "users", user.uid, "myBoards", boardId);
        console.log("[WRITE myBoards]", mRef.path, payload);
        await updateMyBoardInfo(user.uid, boardId, payload);
        const snap = await getDoc(mRef);
        if (snap.exists()) {
          setSelectedBoard({ id: boardId, ...snap.data(), boardType: "myBoards" });
        }
      } else {
        // === ここが重要：不変フィールドを “常在させる” ためにパススルー ===
        if (!amOwner) {
          throw new Error("このボードはオーナーのみ編集できます。");
        }

        // 変更分を抽出
        const changed = pickChanged(boardData, formValues);
        // 変更がなくても updatedAt は更新
        changed.updatedAt = serverTimestamp();

        // 送信前に、**ルールが常在を要求する不変キー**をドキュメントからパススルーで同梱
        // （※値は変更しない）
        const invariants = {};
        if (boardData.ownerId !== undefined) invariants.ownerId = boardData.ownerId;
        if (boardData.members !== undefined) invariants.members = boardData.members;
        if (boardData.writeAccess !== undefined) invariants.writeAccess = boardData.writeAccess;
        if (boardData.createdAt !== undefined) invariants.createdAt = boardData.createdAt;
        if (boardData.publicId !== undefined) invariants.publicId = boardData.publicId;
        if (boardData.publicMode !== undefined) invariants.publicMode = boardData.publicMode;

        // サニタイズ（可変キーのみ通す）＋ 不変キーを最後に上書き（= 変更しない）
        const gPayload = { ...sanitizeForTeamGlobal(changed), ...invariants };

        // 送る内容を最小化（名前だけ触ったケース）
        const gRef = doc(db, "teamBoards", boardId);
        console.log("[WRITE teamBoards]", gRef.path, gPayload);
        await updateDoc(gRef, gPayload);

        // user-link の軽同期
        const lRef = doc(db, "users", user.uid, "teamBoards", boardId);
        const lPayload = sanitizeForUserLink({
          name: formValues.name,
          projectType: formValues.projectType,
          buildingType: formValues.buildingType,
          siteAreaSqm: formValues.siteAreaSqm,
          siteAreaTsubo: formValues.siteAreaTsubo,
        });
        console.log("[WRITE user link]", lRef.path, lPayload);
        await setDoc(lRef, lPayload, { merge: true });

        const snap = await getDoc(gRef);
        if (snap.exists()) {
          setSelectedBoard({ id: boardId, ...snap.data(), boardType: "teamBoards" });
        }
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
        {boardData?.boardType === "teamBoards" && Array.isArray(boardData?.members) && boardData.members.length > 0 && (
          <Box>
            <Typography variant="subtitle1" sx={boardDetailStyles.subTitle}>チームメンバー</Typography>
            <Box sx={boardDetailStyles.section}>
              {boardData.members.map((uid) => (
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

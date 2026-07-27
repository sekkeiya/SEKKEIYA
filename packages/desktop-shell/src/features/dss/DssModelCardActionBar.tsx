import React, { useState, useEffect } from "react";
import { Box, Typography, IconButton, Tooltip, Avatar } from "@mui/material";

import FavoriteRoundedIcon from "@mui/icons-material/FavoriteRounded";
import FavoriteBorderRoundedIcon from "@mui/icons-material/FavoriteBorderRounded";
import BookmarkAddRoundedIcon from "@mui/icons-material/BookmarkAddRounded";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import { useAuthStore } from "../../store/useAuthStore";
import { useModelLike } from "./hooks/useModelLike";

interface DssModelCardActionBarProps {
  model: any;
  cardContext?: "models" | "boards" | "publicModels" | "privateModels" | "boardModels" | "localModels";
  isBusy?: boolean;
  onSave?: (model: any) => void;
  onShare?: (model: any) => void;
  onDelete?: (model: any) => void;
  onDuplicate?: (model: any) => void;
  onAuthorClick?: (model: any) => void;
}

export const DssModelCardActionBar: React.FC<DssModelCardActionBarProps> = ({
  model,
  cardContext = "models",
  isBusy = false,
  onSave,
  onShare,
  onDelete,
  onDuplicate,
  onAuthorClick,
}) => {
  const currentUser = useAuthStore((state: any) => state.currentUser);
  const modelOwnerId = model.ownerId || model.authorId;
  const isOwner = Boolean(currentUser && modelOwnerId && currentUser.uid === modelOwnerId);

  const [resolvedAuthor, setResolvedAuthor] = useState<string | null>(null);
  const [resolvedAvatarUrl, setResolvedAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchOwnerDetails = async () => {
      // If we don't have basic cache on the model, fetch it from the unified user profile
      if (modelOwnerId && !model.handle && !model.ownerName && !model.authorName) {
        try {
          const { doc, getDoc } = await import('firebase/firestore');
          const { db } = await import('../../lib/firebase/client');
          const snap = await getDoc(doc(db, 'users', modelOwnerId));
          if (snap.exists() && isMounted) {
             const data = snap.data();
             if (data.displayName) setResolvedAuthor(data.displayName);
             if (data.photoURL) setResolvedAvatarUrl(data.photoURL);
           }
        } catch (e) {
          console.error("Failed to fetch owner profile for model card", e);
        }
      }
    };
    fetchOwnerDetails();
    return () => { isMounted = false; };
  }, [modelOwnerId, model.handle, model.ownerName, model.authorName]);

  const title = model.title || model.name || "Untitled";
  const initialAuthor = model.handle || model.ownerName || model.authorName;
  const author = isOwner && currentUser?.displayName
    ? currentUser.displayName
    : (resolvedAuthor || initialAuthor || "SEKKEIYA Creator");

  const initialAvatarUrl = model.ownerPhotoUrl || model.authorPhotoUrl;
  const avatarUrl = isOwner && currentUser?.photoURL
    ? currentUser.photoURL
    : (resolvedAvatarUrl || initialAvatarUrl);

  // いいねの読み取りは1カードにつき getCountFromServer + getDoc の2回のFirestore読み取りが発生する。
  // 一覧にはカードが多数並び、react-window の仮想化で画面外のカードはマウントされないが、
  // 画面内のカードは常時マウントされていてCSSでホバー時のみ可視化しているだけ
  // （DssModelCard.tsx の `.DssModelCard-details`）。マウント時に即読みに行くと
  // 画面内のカード数だけ読み取りが走ってしまうため、実際にホバーされてから読みに行く。
  const [warmed, setWarmed] = useState(false);
  const { liked, favoriteCount, loading: likeLoading, toggling: likeBusy, toggleLike } = useModelLike({
    model,
    uid: currentUser?.uid ?? null,
    enabled: warmed,
  });

  const isModels = cardContext === "models";
  const isBoards = cardContext === "boards";
  const isPublicModels = cardContext === "publicModels";
  const isPrivateModels = cardContext === "privateModels";
  const isBoardModels = cardContext === "boardModels";
  const isLocalModels = cardContext === "localModels";

  const showLike =
    isModels ||
    isBoards ||
    isPublicModels ||
    isPrivateModels ||
    isBoardModels;

  const showSave =
    isModels ||
    isPublicModels ||
    isPrivateModels ||
    isBoardModels;

  const showShare =
    isModels ||
    isBoards ||
    isPublicModels ||
    isPrivateModels ||
    isBoardModels;

  const showDelete = isPublicModels || isPrivateModels || isBoardModels || isLocalModels;

  const showDuplicate = isBoards;

  const handleToggleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isBusy || likeBusy || likeLoading || !currentUser?.uid) return;
    void toggleLike();
  };

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isBusy) return;
    if (onSave) onSave(model);
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isBusy) return;
    if (onShare) onShare(model);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isBusy) return;

    if (onDelete) onDelete(model);
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isBusy) return;
    if (onDuplicate) onDuplicate(model);
  };

  return (
    <Box
      onMouseEnter={() => setWarmed(true)}
      sx={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        pt: 1.1,
        pb: 0.8,
        px: 1.2,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1,
        background:
          "linear-gradient(to top, rgb(var(--slate-panel-rgb) / 0.96), rgb(var(--slate-panel-rgb) / 0.75), rgb(var(--slate-panel-rgb) / 0))",
        backdropFilter: "blur(6px)",
        zIndex: 12,
      }}
    >
      <Box
        sx={{
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 0.2,
        }}
      >
        <Typography
          variant="subtitle2"
          noWrap
          sx={{
            color: "var(--brand-fg)",
            fontWeight: 600,
            fontSize: 13,
          }}
          title={title}
        >
          {title}
        </Typography>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            mt: 0.5,
            cursor: onAuthorClick ? "pointer" : "default",
            "&:hover": onAuthorClick ? { opacity: 0.8 } : {},
          }}
          onClick={(e) => {
            if (onAuthorClick) {
              e.stopPropagation();
              e.preventDefault();
              onAuthorClick(model);
            }
          }}
        >
          <Avatar
            sx={{
              width: 16,
              height: 16,
              fontSize: 10,
              bgcolor: "primary.main",
              color: "var(--brand-fg)",
            }}
            src={avatarUrl}
          >
            {author.charAt(0).toUpperCase()}
          </Avatar>
          <Typography
            variant="caption"
            noWrap
            sx={{ color: "rgb(var(--slate-ink-rgb) / 0.95)", fontSize: 11 }}
          >
            {author}
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          position: "relative",
          bottom: -10,
          flexShrink: 0,
        }}
      >
        {showLike && (
          <Tooltip title={currentUser ? "いいね" : "ログインすると押せます"}>
            <span>
              <IconButton
                size="small"
                onClick={handleToggleLike}
                disabled={isBusy || likeBusy || likeLoading || !currentUser}
                sx={{
                  p: 0.5,
                  "& .fav-count": {
                    ml: 0.3,
                    fontSize: 10,
                    color: "var(--brand-fg)",
                  },
                }}
              >
                {liked ? (
                  <FavoriteRoundedIcon
                    sx={{ fontSize: 16, color: "#f97316" }}
                  />
                ) : (
                  <FavoriteBorderRoundedIcon
                    sx={{ fontSize: 16, color: "var(--brand-fg)" }}
                  />
                )}
                <span className="fav-count">{favoriteCount}</span>
              </IconButton>
            </span>
          </Tooltip>
        )}

        {showSave && (
          <Tooltip title="プロジェクトに保存">
            <span>
              <IconButton
                size="small"
                onClick={handleSave}
                disabled={isBusy}
                sx={{ p: 0.5 }}
              >
                <BookmarkAddRoundedIcon
                  sx={{ fontSize: 16, color: "var(--brand-fg)" }}
                />
              </IconButton>
            </span>
          </Tooltip>
        )}

        {showDuplicate && (
          <Tooltip title="複製">
            <span>
              <IconButton
                size="small"
                onClick={handleDuplicate}
                disabled={isBusy}
                sx={{ p: 0.5 }}
              >
                <ContentCopyRoundedIcon
                  sx={{ fontSize: 16, color: "var(--brand-fg)" }}
                />
              </IconButton>
            </span>
          </Tooltip>
        )}

        {showShare && (
          <Tooltip title="共有">
            <span>
              <IconButton
                size="small"
                onClick={handleShare}
                disabled={isBusy}
                sx={{ p: 0.5 }}
              >
                <ShareRoundedIcon sx={{ fontSize: 16, color: "var(--brand-fg)" }} />
              </IconButton>
            </span>
          </Tooltip>
        )}

        {showDelete && (
          <Tooltip title={isBoardModels ? "このボードから削除" : "削除"}>
            <span>
              <IconButton
                size="small"
                onClick={handleDeleteClick}
                disabled={isBusy}
                sx={{ p: 0.5 }}
              >
                <DeleteOutlineRoundedIcon
                  sx={{ fontSize: 16, color: "#f97316" }}
                />
              </IconButton>
            </span>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
};

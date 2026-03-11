import React from "react";
import { Breadcrumbs, Typography, Link, IconButton } from "@mui/material";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import { useDriveStore } from "../../store/useDriveStore";

export default function DriveBreadcrumbs() {
  const { folders, currentFolderId, navigateToFolder } = useDriveStore();

  // Compute breadcrumbs dynamically based on the current folder's ancestors
  const crumbs = [];
  if (currentFolderId) {
    const currentFolder = folders.find((f) => f.id === currentFolderId);
    if (currentFolder) {
      // Add all ancestors
      currentFolder.ancestors.forEach((ancId) => {
        const anc = folders.find((f) => f.id === ancId);
        if (anc) crumbs.push(anc);
      });
      // Add current folder
      crumbs.push(currentFolder);
    }
  }

  return (
    <Breadcrumbs
      separator={<NavigateNextIcon fontSize="small" sx={{ color: "rgba(255,255,255,0.3)" }} />}
      aria-label="breadcrumb"
    >
      <Link
        underline="hover"
        sx={{
          display: "flex",
          alignItems: "center",
          color: currentFolderId === null ? "#fff" : "rgba(255,255,255,0.6)",
          fontWeight: currentFolderId === null ? 600 : 500,
          cursor: "pointer",
          fontSize: 14,
        }}
        onClick={() => navigateToFolder(null, folders)}
      >
        <HomeRoundedIcon sx={{ mr: 0.5, fontSize: 18 }} />
        ルート
      </Link>

      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        return (
          <Link
            key={crumb.id}
            underline={isLast ? "none" : "hover"}
            sx={{
              color: isLast ? "#fff" : "rgba(255,255,255,0.6)",
              fontWeight: isLast ? 600 : 500,
              cursor: isLast ? "default" : "pointer",
              fontSize: 14,
            }}
            onClick={() => {
              if (!isLast) navigateToFolder(crumb.id, folders);
            }}
          >
            {crumb.name}
          </Link>
        );
      })}
    </Breadcrumbs>
  );
}

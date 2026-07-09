import React from "react";
import { Grid, Box, Typography } from "@mui/material";
import { getIconForGroup, normalizeGroupLabelForUI } from "./LibraryConstants";
import LibraryCategoryTile from "./LibraryCategoryTile";

export default function LibraryCategoryGrid({ items, columns = 2, formatLabel = false, onClick }) {
  if (!items || items.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center', opacity: 0.3 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 500 }}>No Categories</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ px: 1, py: 1 }}>
      <Grid container spacing={1.5}>
        {items.map((item) => {
          const displayedLabel = formatLabel ? normalizeGroupLabelForUI(item.label) : item.label;
          const icon = item.icon || React.cloneElement(getIconForGroup(item.id), { sx: { fontSize: 32 } });
          
          return (
            <Grid item xs={12 / columns} size={12 / columns} key={item.id}>
              <LibraryCategoryTile
                label={displayedLabel}
                icon={icon}
                onClick={() => onClick(item)}
              />
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}

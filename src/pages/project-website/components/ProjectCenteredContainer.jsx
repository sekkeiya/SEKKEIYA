import React from "react";
import { Container } from "@mui/material";

/**
 * Shared layout wrapper for "Home-like" project pages (Landing, Strategy).
 * Ensures a consistent centered width (max 1040px) distinct from the fluid Dashboard layout.
 */
export default function ProjectCenteredContainer({ children, sx = {}, ...props }) {
  return (
    <Container 
      sx={{ 
        maxWidth: "1040px !important", 
        ...sx 
      }}
      {...props}
    >
      {children}
    </Container>
  );
}

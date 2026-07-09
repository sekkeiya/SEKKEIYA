# 3D Shape Series Routing Configuration

This document outlines the `base` (Vite) and `basename` (React Router) settings across the SEKKEIYA ecosystem for unified proxy development and static production delivery.

## 1. 3D Shape Share (3DSS)
- **Repository:** `r3dm-share`
- **Vite `base`:** `/app/share/`
- **Router `basename`:** `/app/share`
- **Port:** `5174`

## 2. 3D Shape Layout (3DSL)
- **Repository:** `3d-shape-layout`
- **Vite `base`:** `/app/layout/`
- **Router `basename`:** `/app/layout` (Assumed managed via BrowserRouter)
- **Port:** `5175`

## 3. 3D Shape Create (3DSC)
- **Repository:** `3dshapecreate-web`
- **Vite `base`:** `/app/create/`
- **Router `basename`:** `/app/create`
- **Port:** `5176`

## 4. 3D Shape Presents (3DSP)
- **Repository:** `3dshapepresents-web`
- **Vite `base`:** `/app/presents/`
- **Router `basename`:** `/app/presents`
- **Port:** `5177`

## 5. 3D Shape Quest (3DSQ)
- **Repository:** `3dshapequest`
- **Vite `base`:** `/app/quest/`
- **Router `basename`:** `/app/quest`
- **Port:** `5178`

## 6. 3D Shape Books (3DSB)
- **Repository:** `3dshapebooks`
- **Vite `base`:** `/app/books/`
- **Router `basename`:** `/app/books`
- **Port:** `5179`

## SEKKEIYA (Parent)
- **Repository:** `sekkeiya`
- **Vite `base`:** `/`
- **Router `basename`:** `/`
- **Port:** `5173`
- **Proxy Configuration:**
  - Routes `/app/{app}` to respective ports in development.
  - Generates to `dist/app/{app}/` via `deploy_unified.ps1` in production.

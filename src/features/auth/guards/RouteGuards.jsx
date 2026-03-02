// // src/pages/RouteGuards.jsx
// import React from "react";
// import { Navigate, useLocation } from "react-router-dom";
// import { Box, CircularProgress } from "@mui/material";
// import { useAuthState } from "../auth/useAuthState";

// const DUMMY_KEY = "MVP_DUMMY_AUTH";

// // ✅ 本番ではダミー認証を無効化（事故防止）
// const ENABLE_DUMMY = import.meta.env.DEV;

// function isDummyAuthed() {
//   if (!ENABLE_DUMMY) return false;
//   try {
//     return localStorage.getItem(DUMMY_KEY) === "1";
//   } catch {
//     return false;
//   }
// }

// function FullscreenLoading() {
//   return (
//     <Box
//       sx={{
//         minHeight: "100vh",
//         display: "grid",
//         placeItems: "center",
//         background: "#050815",
//       }}
//     >
//       <CircularProgress size={28} />
//     </Box>
//   );
// }

// export function PrivateRoute({ children }) {
//   const { isAuthed, isLoading } = useAuthState();
//   const location = useLocation();

//   const ok = isAuthed || isDummyAuthed();

//   // ✅ “null” はやめる（本番で「遷移してない」ように見える）
//   if (isLoading) return <FullscreenLoading />;

//   if (!ok) {
//     const from = location.pathname + location.search + location.hash;
//     return <Navigate to="/login" replace state={{ from }} />;
//   }

//   return children;
// }

// export function PublicRoute({ children }) {
//   const { isAuthed, isLoading } = useAuthState();
//   const ok = isAuthed || isDummyAuthed();

//   if (isLoading) return <FullscreenLoading />;

//   // ✅ すでにログイン済みなら dashboard へ
//   if (ok) return <Navigate to="/dashboard" replace />;

//   return children;
// }

// export function HomeEntryRedirect() {
//   const { isAuthed, isLoading } = useAuthState();
//   const ok = isAuthed || isDummyAuthed();

//   if (isLoading) return <FullscreenLoading />;

//   return <Navigate to={ok ? "/dashboard" : "/home"} replace />;
// }

// // ✅ 任意：どこからでも呼べるダミーログアウト（DEVのみ意味がある）
// export function clearDummyAuth() {
//   try {
//     localStorage.removeItem(DUMMY_KEY);
//   } catch {
//     // noop
//   }
// }

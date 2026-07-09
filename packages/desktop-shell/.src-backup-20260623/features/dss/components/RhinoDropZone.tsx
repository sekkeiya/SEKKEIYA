
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Stack,
  Button,
  Tooltip,
} from "@mui/material";
import CloudUploadRoundedIcon from "@mui/icons-material/CloudUploadRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import type { RhinoDocument } from "../hooks/useRhinoDragImport";

interface RhinoDropZoneProps {
  open: boolean;
  docs?: RhinoDocument[];
  errorMessage?: string;
  onSelectDoc?: (docId: string) => void;
  onClose?: () => void;
}

export default function RhinoDropZone({
  open,
  docs = [],
  errorMessage,
  onSelectDoc,
  onClose,
}: RhinoDropZoneProps) {
  if (!open) return null;

  const hasDocs = Array.isArray(docs) && docs.length > 0;
  const primaryText = hasDocs
    ? "Rhino で開いているファイルを選択して、このモデルをインポートします。"
    : errorMessage ||
      "Rhino が開いていないか、プラグインからの情報待ちです。Rhino を起動し、S.Models プラグインを設定してから再度お試しください。";

  const secondaryText =
    !hasDocs && !errorMessage
      ? "Rhino を起動し、S.Models プラグインを設定してから再度お試しください。"
      : errorMessage && !hasDocs
      ? "S.Models プラグインをインストールし、設定が完了しているかご確認ください。"
      : "";

  return (
    <>
      {/* Background clicking invisible overlay */}
      <Box
        sx={{
          position: "fixed",
          inset: 0,
          zIndex: 1300,
        }}
        onClick={onClose}
      />

      {/* Bottom bar container */}
      <Box
        sx={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1301,
          display: "flex",
          justifyContent: "center",
          pointerEvents: "none", // only contents clickable
        }}
      >
        <Paper
          elevation={8}
          sx={{
            pointerEvents: "auto",
            mb: 2,
            px: 2.5,
            py: 1.5,
            borderRadius: 999,
            display: "flex",
            alignItems: "center",
            minWidth: 560,
            maxWidth: 840,
            background:
              "linear-gradient(135deg, rgba(15,23,42,0.96), rgba(15,23,42,0.98))",
            border: "1px solid rgba(148,163,184,0.4)",
            boxShadow:
              "0 20px 45px rgba(15,23,42,0.85), 0 0 0 1px rgba(15,23,42,0.6)",
          }}
        >
          {/* Icon */}
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: "999px",
              mr: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background:
                "radial-gradient(circle at 30% 20%, #22c55e, #0f766e, #020617)",
              boxShadow: "0 0 0 1px rgba(15,23,42,0.85)",
            }}
          >
            <CloudUploadRoundedIcon sx={{ fontSize: 22, color: "#e5e7eb" }} />
          </Box>

          {/* Texts & docs list */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="body2"
              sx={{
                fontSize: 13,
                fontWeight: 600,
                color: "#e5e7eb",
              }}
            >
              {primaryText}
            </Typography>

            {secondaryText && (
              <Typography
                variant="caption"
                sx={{
                  mt: 0.2,
                  fontSize: 11,
                  display: "block",
                  color: "rgba(148,163,184,0.9)",
                }}
              >
                {secondaryText}
              </Typography>
            )}

            {/* Document list */}
            {hasDocs && (
              <Stack
                direction="row"
                spacing={1}
                sx={{ mt: 0.8, flexWrap: "wrap" }}
              >
                {docs.map((doc) => (
                  <Tooltip
                    key={doc.id}
                    title={doc.path || doc.name || doc.id}
                    arrow
                  >
                    <Button
                      size="small"
                      variant={doc.is_active ? "contained" : "outlined"}
                      startIcon={<CloudUploadRoundedIcon sx={{ fontSize: 17 }} />}
                      sx={{
                        textTransform: "none",
                        fontSize: 12,
                        fontWeight: 600,
                        borderRadius: 999,
                        py: 0.5,
                        px: 1.5,
                        borderColor: doc.is_active
                          ? "rgba(34,197,94,0.7)"
                          : "rgba(148,163,184,0.6)",
                        backgroundColor: doc.is_active
                          ? "rgba(22,163,74,0.9)"
                          : "rgba(15,23,42,0.9)",
                        "&:hover": {
                          backgroundColor: doc.is_active
                            ? "rgba(22,163,74,1)"
                            : "rgba(15,23,42,1)",
                          borderColor: doc.is_active
                            ? "rgba(34,197,94,0.9)"
                            : "rgba(148,163,184,0.9)",
                        },
                      }}
                      onClick={() => onSelectDoc?.(doc.id)}
                    >
                      {doc.name ? `${doc.name} へインポート` : "インポートを実行"}
                    </Button>
                  </Tooltip>
                ))}
              </Stack>
            )}
          </Box>

          {/* Close button */}
          <IconButton
            size="small"
            onClick={onClose}
            sx={{
              ml: 1.5,
              backgroundColor: "rgba(15,23,42,0.9)",
              border: "1px solid rgba(31,41,55,0.9)",
              "&:hover": {
                backgroundColor: "rgba(15,23,42,1)",
              },
            }}
          >
            <CloseRoundedIcon sx={{ fontSize: 18, color: "#e5e7eb" }} />
          </IconButton>
        </Paper>
      </Box>
    </>
  );
}

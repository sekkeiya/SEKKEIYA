import { IconButton, Tooltip } from "@mui/material";
import VerticalAlignTopIcon from "@mui/icons-material/VerticalAlignTop";
import { useViewportUiStore } from "../../store/viewportUiStore";

export default function AlignTopButton() {
  const requestAlignTool = useViewportUiStore((s) => s.requestAlignTool);
  const activeViewportId = useViewportUiStore((s) => s.activeViewportId);

  return (
    <Tooltip title="Align Top (AT)">
      <IconButton
        size="small"
        onClick={() => requestAlignTool("top", activeViewportId)} // ✁Etarget明示
      >
        <VerticalAlignTopIcon fontSize="inherit" />
      </IconButton>
    </Tooltip>
  );
}

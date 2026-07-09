// src/features/layout/components/Header/components/ToolButtons/MaterialPickerCursorManager.jsx
import { useEffect } from "react";
import { useToolsStore } from "@desktop/features/dsl/layout/store/toolsStore/useToolsStore";

export default function MaterialPickerCursorManager() {
  const materialPicking = useToolsStore((s) => s.materialPicking);

  useEffect(() => {
    const cls = "is-material-picking";
    const root = document.documentElement; // html

    if (materialPicking) root.classList.add(cls);
    else root.classList.remove(cls);

    return () => root.classList.remove(cls);
  }, [materialPicking]);

  return null;
}

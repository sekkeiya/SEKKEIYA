import React from "react";
import LayoutToolbar from "./LayoutToolbar";

export default function ModeToolbar({ layoutItems = [], ...props }) {
  return (
    <>
      <LayoutToolbar layoutItems={layoutItems} {...props} />
    </>
  );
}

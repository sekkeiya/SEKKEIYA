// src/features/layout/components/MainArea/components/scene/Lights.jsx
import React from "react";

export default function Lights() {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[6, 10, 6]} intensity={1.2} castShadow />
    </>
  );
}

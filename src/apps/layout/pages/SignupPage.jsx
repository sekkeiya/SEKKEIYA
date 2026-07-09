import React from "react";

export default function SignupPage() {
  return (
    <div style={{ padding: 40, color: "#eaf0ff" }}>
      <h2>アカウント作成</h2>
      <p style={{ opacity: 0.8 }}>
        アカウント作成は S.Modelから行います。
      </p>

      {/* URLはあとであなたの3DSSのURLに差し替え */}
      <a href="https://3dshapeshare.com/signup" style={{ color: "#7aa7ff" }}>
        S.Modelでアカウント作成
      </a>
    </div>
  );
}

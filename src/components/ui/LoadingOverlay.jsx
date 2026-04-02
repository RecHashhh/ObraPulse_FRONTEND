import React from "react";
import { useLoading } from "../../context/LoadingContext";

export default function LoadingOverlay() {
  const { loading } = useLoading();
  if (!loading) return null;

  return (
    <div style={overlayStyle} aria-hidden={!loading}>
      <div style={boxStyle}>
        <div style={spinnerStyle} />
        <div style={{ marginTop: 12, color: "#fff" }}>Procesando descarga...</div>
      </div>
    </div>
  );
}

const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
};

const boxStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: 20,
  borderRadius: 8,
};

const spinnerStyle = {
  width: 44,
  height: 44,
  borderRadius: "50%",
  border: "6px solid rgba(255,255,255,0.2)",
  borderTopColor: "#ffffff",
  animation: "spin 1s linear infinite",
};

// Add keyframes to document head once
if (typeof document !== "undefined") {
  const id = "loading-overlay-spin";
  if (!document.getElementById(id)) {
    const style = document.createElement("style");
    style.id = id;
    style.innerHTML = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
  }
}

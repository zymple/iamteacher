import React from "react";

/**
 * AlertBox
 * Props:
 * - open: boolean
 * - text: string
 * - onClose: () => void
 * - detectInAppBrowser: (ua?: string) => boolean
 */
export default function AlertBox({ open, text, onClose, detectInAppBrowser }) {
  if (!open) return null;

  const handleOk = () => {
    if (typeof detectInAppBrowser === "function" && detectInAppBrowser()) {
      // open in external browser if in-app detected
      window.open(window.location.href, "_blank");
    }
    onClose?.();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          padding: "16px 18px",
          borderRadius: 12,
          maxWidth: 480,
          width: "90%",
          boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
          whiteSpace: "pre-wrap",
          lineHeight: 1.4,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Heads up</div>
        <div style={{ fontSize: 14 }}>{text}</div>
        <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
          <button
            onClick={handleOk}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: "#f9f9f9",
              cursor: "pointer",
            }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

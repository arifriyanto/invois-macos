"use client";

import * as React from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // also log to console for desktop inspection
    console.error(error);
  }, [error]);

  return (
    <div style={{ padding: 24, fontFamily: "ui-monospace, monospace", maxWidth: 900, margin: "0 auto" }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>⚠️ Something went wrong</h2>
      <p style={{ fontSize: 13, color: "#666", marginBottom: 12 }}>
        Screenshot the red text below and send it to the developer:
      </p>
      <pre
        style={{
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          background: "#fff5f5",
          border: "1px solid #fcc",
          borderRadius: 8,
          padding: 12,
          color: "#c00",
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        {error?.name}: {error?.message}
        {error?.digest ? `\n\ndigest: ${error.digest}` : ""}
        {error?.stack ? `\n\n${error.stack}` : ""}
      </pre>
      <button
        onClick={reset}
        style={{
          marginTop: 16,
          padding: "8px 16px",
          borderRadius: 8,
          border: "1px solid #ccc",
          background: "#1a1a2e",
          color: "#fff",
          fontSize: 14,
        }}
      >
        Try again
      </button>
    </div>
  );
}

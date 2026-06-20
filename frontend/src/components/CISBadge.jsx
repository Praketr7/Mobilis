import React from "react";

export default function CISBadge({ rl }) {
  const styles = {
    CRITICAL: { bg: "#FCEBEB", color: "#791F1F", border: "#F3A9A9" },
    HIGH: { bg: "#FAEEDA", color: "#633806", border: "#E5C396" },
    MODERATE: { bg: "#E6F1FB", color: "#0C447C", border: "#ADCFF2" },
    LOW: { bg: "#EAF3DE", color: "#27500A", border: "#C5DF9E" }
  };
  const theme = styles[rl] || styles["LOW"];

  return (
    <span style={{
      fontSize: 10,
      fontWeight: 600,
      padding: "3px 8px",
      borderRadius: 4,
      letterSpacing: "0.02em",
      background: theme.bg,
      color: theme.color,
      border: `0.5px solid ${theme.border}`,
      display: "inline-block"
    }}>{rl}</span>
  );
}

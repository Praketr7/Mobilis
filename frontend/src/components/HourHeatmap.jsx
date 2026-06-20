import React from "react";

export default function HourHeatmap({ hp }) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const maxH = Math.max(...hours.map(h => hp[h] || 0));

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(24,1fr)", gap: 2, marginTop: 8 }}>
        {hours.map(h => {
          const v = hp[h] || 0;
          const alpha = Math.max(0.06, maxH > 0 ? v / maxH : 0);
          return (
            <div key={h} title={`${h}:00 — ${v} violations`}
              style={{ height: 24, borderRadius: 2, background: `rgba(55,138,221,${alpha.toFixed(2)})` }} />
          );
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(24,1fr)", gap: 2, marginTop: 4 }}>
        {hours.map(h => (
          <div key={h} style={{ fontSize: 8, color: "var(--t3)", textAlign: "center", fontWeight: 500 }}>{h}</div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 8 }}>Darker blue represents higher violation frequency.</div>
    </div>
  );
}

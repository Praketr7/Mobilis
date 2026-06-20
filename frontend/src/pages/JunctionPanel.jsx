import React from "react";
import CISBadge from "../components/CISBadge";
import HourHeatmap from "../components/HourHeatmap";
import ActionCard from "../components/ActionCard";

function fmt(n) { 
  return n ? n.toLocaleString("en-IN") : "0"; 
}

function ViolationBars({ tv }) {
  const total = Object.values(tv).reduce((a, b) => a + b, 0);
  return (
    <div>
      {Object.entries(tv).map(([k, v]) => (
        <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: "var(--t2)", width: 160, flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={k}>{k}</div>
          <div style={{ flex: 1, height: 8, background: "var(--bg2)", borderRadius: 4, overflow: "hidden", border: "1px solid var(--border)" }}>
            <div style={{ height: "100%", borderRadius: 4, background: "#378ADD", width: `${Math.round((v / total) * 100)}%` }} />
          </div>
          <div style={{ fontSize: 11, color: "var(--t2)", width: 45, textAlign: "right", flexShrink: 0, fontWeight: 600 }}>{fmt(v)}</div>
        </div>
      ))}
    </div>
  );
}

export default function JunctionPanel({ j, API }) {
  return (
    <div style={{ 
      background: "var(--bg1)", 
      border: "1px solid var(--border)", 
      borderRadius: 10, 
      padding: "20px 24px", 
      marginBottom: 12,
      boxShadow: "0 4px 12px rgba(0,0,0,0.02)"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--t1)", marginBottom: 2 }}>{j.n}</div>
          <div style={{ fontSize: 12, color: "var(--t2)" }}>
            Assigned: <strong style={{ color: "var(--t1)" }}>{j.ps}</strong> police station · Score: <strong style={{ color: "var(--t1)" }}>{j.cis}/10</strong>
          </div>
        </div>
        <CISBadge rl={j.rl} />
      </div>

      {/* Action Card Component with interactive selector */}
      <div style={{ marginBottom: 20 }}>
        <ActionCard junctionName={j.n} initialHour={j.ph} API={API} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--t2)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Violation Breakdown</div>
          <ViolationBars tv={j.tv} />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--t2)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Hourly Patterns (24h)</div>
          <HourHeatmap hp={j.hp} />
        </div>
      </div>
    </div>
  );
}

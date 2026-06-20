import React, { useState, useEffect } from "react";
import CISBadge from "./CISBadge";

export default function ActionCard({ junctionName, initialHour = 9, API }) {
  const [hour, setHour] = useState(initialHour);
  const [cardData, setCardData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/action-card/${encodeURIComponent(junctionName)}?hour=${hour}`)
      .then(r => r.json())
      .then(data => {
        setCardData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load action card", err);
        setLoading(false);
      });
  }, [junctionName, hour, API]);

  if (loading && !cardData) {
    return (
      <div style={{ padding: "16px", color: "var(--t2)", background: "var(--bg2)", borderRadius: 8, border: "1px solid var(--border)", fontSize: 13 }}>
        Generating intelligence card...
      </div>
    );
  }

  if (!cardData || cardData.error) {
    return (
      <div style={{ padding: "16px", color: "#E24B4A", background: "var(--bg2)", borderRadius: 8, border: "1px solid var(--border)", fontSize: 13 }}>
        Error loading deployment advice.
      </div>
    );
  }

  const act = cardData.recommended_action;

  return (
    <div style={{
      background: "var(--bg2)", 
      borderRadius: 8, 
      padding: "16px 18px", 
      border: "1px solid var(--border)",
      borderLeft: `4px solid ${cardData.risk_level === "CRITICAL" || cardData.risk_level === "HIGH" ? "#E24B4A" : "#378ADD"}`,
      boxShadow: "0 2px 6px rgba(0,0,0,0.01)"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: act.priority === "IMMEDIATE" ? "#E24B4A" : "#378ADD", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          ⚡ BTP Deployment Advisory
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 10, color: "var(--t3)" }}>Preview Hour:</span>
          <select 
            value={hour} 
            onChange={(e) => setHour(parseInt(e.target.value))}
            style={{
              fontSize: 10,
              padding: "2px 6px",
              borderRadius: 4,
              border: "1px solid var(--border)",
              background: "var(--bg1)",
              color: "var(--t1)",
              fontWeight: 500
            }}
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>{i}:00</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ fontSize: 13, color: "var(--t1)", lineHeight: 1.5, marginBottom: 14 }}>
        {cardData.ai_recommendation}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, fontWeight: 500, padding: "3px 8px", borderRadius: 4, background: "var(--bg1)", border: "1px solid var(--border)", color: "var(--t2)" }}>
          👤 Deploy: {act.officers_recommended} Officers
        </span>
        <span style={{ fontSize: 10, fontWeight: 500, padding: "3px 8px", borderRadius: 4, background: "var(--bg1)", border: "1px solid var(--border)", color: "var(--t2)" }}>
          🚨 {act.unit_type}
        </span>
        {act.towing_required && (
          <span style={{ fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 4, background: "#FCEBEB", border: "0.5px solid #F3A9A9", color: "#791F1F" }}>
            🚛 Towing Required
          </span>
        )}
        <span style={{ fontSize: 10, fontWeight: 500, padding: "3px 8px", borderRadius: 4, background: "var(--bg1)", border: "1px solid var(--border)", color: "var(--t2)" }}>
          📈 Trend: {cardData.trend}
        </span>
      </div>
    </div>
  );
}

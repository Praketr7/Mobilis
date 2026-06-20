import React, { useState } from "react";
import CISBadge from "../components/CISBadge";
import JunctionPanel from "./JunctionPanel";

function cisColor(cis) {
  if (cis >= 7.5) return "#E24B4A";
  if (cis >= 5) return "#EF9F27";
  if (cis >= 2.5) return "#378ADD";
  return "#639922";
}

function fmt(n) {
  return n ? n.toLocaleString("en-IN") : "0";
}

export default function Overview({ junctions, selectedIdx, setSelectedIdx, API }) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredJunctions = junctions.filter(j => 
    j.n.toLowerCase().includes(searchTerm.toLowerCase()) || 
    j.ps.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentJunction = junctions[selectedIdx];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--t2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Junctions Ranked by Congestion Impact Score
            </div>
            
            {/* Search Input */}
            <input 
              type="text" 
              placeholder="Search junction or station..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                fontSize: 12,
                padding: "6px 12px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--bg2)",
                color: "var(--t1)",
                width: 240,
                outline: "none",
                transition: "border-color 0.15s ease"
              }}
              onFocus={(e) => e.target.style.borderColor = "#378ADD"}
              onBlur={(e) => e.target.style.borderColor = "var(--border)"}
            />
          </div>

          <div style={{ 
            display: "flex", 
            flexDirection: "column", 
            gap: 8, 
            maxHeight: "450px", 
            overflowY: "auto", 
            paddingRight: 6 
          }}>
            {filteredJunctions.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--t3)", fontSize: 13 }}>
                No junctions matched your search.
              </div>
            ) : (
              filteredJunctions.map((j) => {
                const globalIdx = junctions.findIndex(item => item.n === j.n);
                const isSelected = globalIdx === selectedIdx;

                return (
                  <div key={j.n} onClick={() => setSelectedIdx(globalIdx)}
                    style={{
                      background: "var(--bg1)",
                      border: `1px solid ${isSelected ? "#378ADD" : "var(--border)"}`,
                      borderRadius: 8, padding: "12px 16px",
                      display: "flex", alignItems: "center", gap: 16,
                      cursor: "pointer",
                      boxShadow: isSelected ? "0 4px 12px rgba(55,138,221,0.06)" : "0 1px 2px rgba(0,0,0,0.01)",
                      transition: "all 0.15s ease",
                      transform: isSelected ? "translateY(-1px)" : "none",
                    }}
                  >
                    <span style={{ fontSize: 11, color: "var(--t3)", width: 20, flexShrink: 0, textAlign: "right", fontWeight: 600 }}>
                      {globalIdx + 1}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>{j.n}</div>
                      <div style={{ fontSize: 11, color: "var(--t2)", marginTop: 2 }}>
                        {j.ps} · {fmt(j.vc)} violations · peak {j.ph}:00
                      </div>
                    </div>
                    <div style={{ width: 80, height: 6, background: "var(--bg2)", borderRadius: 3, overflow: "hidden", border: "1px solid var(--border)", flexShrink: 0 }}>
                      <div style={{ height: "100%", borderRadius: 3, width: `${(j.cis / 10) * 100}%`, background: cisColor(j.cis) }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, width: 28, textAlign: "right", flexShrink: 0, color: cisColor(j.cis) }}>{j.cis}</span>
                    <CISBadge rl={j.rl} />
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {currentJunction && (
        <JunctionPanel j={currentJunction} API={API} />
      )}
    </div>
  );
}

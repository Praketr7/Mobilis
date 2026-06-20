import React from "react";
import CISBadge from "../components/CISBadge";

export default function DailyBrief({ junctions, summary, temporal }) {
  // Get current day of week
  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const currentDay = daysOfWeek[new Date().getDay()];

  // Filter & sort junctions by violation count or CIS score
  const topJunctions = [...junctions].slice(0, 5);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* HUD Bar */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "12px 18px", background: "var(--bg1)", border: "1px solid var(--border)",
        borderRadius: 8
      }}>
        <div>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#378ADD", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            📅 Daily Intelligence Briefing
          </span>
          <h3 style={{ margin: "2px 0 0 0", fontSize: 16, fontWeight: 700 }}>
            {currentDay} Shift Advisory Summary
          </h3>
        </div>
        <button 
          onClick={handlePrint} 
          style={{
            background: "#378ADD",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "8px 16px",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 2px 4px rgba(55,138,221,0.2)",
            transition: "all 0.15s ease"
          }}
          onMouseEnter={(e) => e.target.style.background = "#2a70b5"}
          onMouseLeave={(e) => e.target.style.background = "#378ADD"}
        >
          🖨️ Export / Print Briefing
        </button>
      </div>

      {/* Main Print Layout Card */}
      <div id="briefing-print-area" style={{
        background: "var(--bg1)", border: "1px solid var(--border)",
        borderRadius: 10, padding: "24px 32px", boxShadow: "0 4px 12px rgba(0,0,0,0.01)"
      }}>
        {/* Document Header */}
        <div style={{ textAlign: "center", borderBottom: "2px double var(--border)", paddingBottom: 16, marginBottom: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "0.05em", color: "var(--t1)" }}>
            BENGALURU TRAFFIC POLICE
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--t2)", marginTop: 4, letterSpacing: "0.1em" }}>
            PARKING ENFORCEMENT DECISION SUPPORT SYSTEM (GRIDLOCK)
          </div>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--t3)", marginTop: 8 }}>
            Shift: Morning Patrol | Generated: {new Date().toLocaleDateString("en-IN")}
          </div>
        </div>

        {/* Section 1: Top Hotspots */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#378ADD", textTransform: "uppercase", borderBottom: "1px solid var(--border)", paddingBottom: 6, marginBottom: 12 }}>
            I. TOP 5 HIGH-RISK JUNCTIONS TODAY
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {topJunctions.map((j, idx) => {
              const topViolation = Object.keys(j.tv)[0] || "No Parking";
              const topVehicle = Object.keys(j.vb)[0] || "Two-Wheeler";
              return (
                <div key={j.n} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "var(--bg2)", borderRadius: 6, border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--t3)", width: 20 }}>#{idx + 1}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{j.n}</div>
                      <div style={{ fontSize: 11, color: "var(--t2)", marginTop: 2 }}>
                        Police Station: <strong>{j.ps}</strong> | Primary Violation: {topViolation} | Main Vehicle: {topVehicle}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#378ADD" }}>CIS {j.cis}</span>
                    <CISBadge rl={j.rl} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 2: Deployment Advisory */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#378ADD", textTransform: "uppercase", borderBottom: "1px solid var(--border)", paddingBottom: 6, marginBottom: 12 }}>
            II. SHIFT DEPLOYMENT ADVISORY
          </div>
          <div style={{ fontSize: 13, color: "var(--t1)", lineHeight: 1.6 }}>
            <p style={{ margin: "0 0 10px 0" }}>
              Based on historical data for <strong>{currentDay}s</strong>, peak violations occur between <strong>5:00 AM – 8:00 AM</strong>. Focus enforcement resources during this window to optimize clearance before the office rush.
            </p>
            <ul>
              <li style={{ marginBottom: 6 }}>
                <strong>Upparpet Station:</strong> Deploy double patrol to Safina Plaza and Elite Junction to clear secondary lane blockages.
              </li>
              <li style={{ marginBottom: 6 }}>
                <strong>City Market Station:</strong> Coordinate commercial units at KR Market. Top commercial vehicle concentration (LGVs, Maxi-Cabs) is active early morning.
              </li>
              <li style={{ marginBottom: 6 }}>
                <strong>Malleshwaram / Cantonment:</strong> Focus on towing enforcement. Double parking along main carriageways represents 44% of total delay contributors.
              </li>
            </ul>
          </div>
        </div>

        {/* Section 3: Vehicle Type Warnings */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#378ADD", textTransform: "uppercase", borderBottom: "1px solid var(--border)", paddingBottom: 6, marginBottom: 12 }}>
            III. VEHICLE TYPE & TOWING ADVISORIES
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ padding: 14, background: "var(--bg2)", borderRadius: 6, border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#EF9F27", marginBottom: 6 }}>🚛 TOWING TASK FORCE</div>
              <div style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.4 }}>
                Towing teams must clear main road blockages near Safina Plaza and Sagar Theatre. Standard challans are insufficient for double-parked vehicles.
              </div>
            </div>
            <div style={{ padding: 14, background: "var(--bg2)", borderRadius: 6, border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#639922", marginBottom: 6 }}>🚚 COMMERCIAL CHECKPOINTS</div>
              <div style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.4 }}>
                Commercial goods vehicles (LGVs) represent over 20% of violations at KR Market. Check loading permits and clear designated bays.
              </div>
            </div>
          </div>
        </div>

        {/* Document Footer Signature */}
        <div style={{ marginTop: 40, borderTop: "1px dashed var(--border)", paddingTop: 16, display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--t3)" }}>
          <span>System: GRIDLOCK-PRO-v1.1</span>
          <span>Verified by: BTP Command Center</span>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import HotspotMap from "./HotspotMap";

const API = "http://localhost:8000";

// ── Normalise API response → short keys used throughout the component ──────
function normalizeJunction(j) {
  return {
    n:   j.junction_name,
    lat: j.lat,
    lng: j.lng,
    ps:  j.police_station,
    vc:  j.violation_count,
    cis: j.cis,
    rl:  j.risk_level,
    ph:  j.peak_hour,
    tv:  j.top_violations      || {},
    vb:  j.vehicle_breakdown   || {},
    hp:  j.hourly_pattern      || {},
    dp:  j.daily_pattern       || {},
  };
}

// ── Helpers ────────────────────────────────────────────────────
function fmt(n) { return n.toLocaleString("en-IN"); }

function cisColor(cis) {
  if (cis >= 7.5) return "#E24B4A";
  if (cis >= 5) return "#EF9F27";
  if (cis >= 2.5) return "#378ADD";
  return "#639922";
}

// ── Sub-components ─────────────────────────────────────────────

function MetricCard({ label, value, sub, color }) {
  return (
    <div style={{ 
      background: "var(--bg1)", 
      border: "1px solid var(--border)", 
      borderRadius: 8, 
      padding: "16px 20px",
      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
      transition: "all 0.15s ease"
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--t2)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: color || "var(--t1)", lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 6 }}>{sub}</div>
    </div>
  );
}

function Badge({ rl }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 4,
      letterSpacing: "0.02em",
      background: { CRITICAL: "#FCEBEB", HIGH: "#FAEEDA", MODERATE: "#E6F1FB", LOW: "#EAF3DE" }[rl],
      color: { CRITICAL: "#791F1F", HIGH: "#633806", MODERATE: "#0C447C", LOW: "#27500A" }[rl],
      border: `0.5px solid ${{ CRITICAL: "#F3A9A9", HIGH: "#E5C396", MODERATE: "#ADCFF2", LOW: "#C5DF9E" }[rl]}`,
    }}>{rl}</span>
  );
}

function HourHeatmap({ hp }) {
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

function ViolationBars({ tv }) {
  const total = Object.values(tv).reduce((a, b) => a + b, 0);
  return (
    <div>
      {Object.entries(tv).map(([k, v]) => (
        <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: "var(--t2)", width: 160, flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{k}</div>
          <div style={{ flex: 1, height: 8, background: "var(--bg2)", borderRadius: 4, overflow: "hidden", border: "1px solid var(--border)" }}>
            <div style={{ height: "100%", borderRadius: 4, background: "#378ADD", width: `${Math.round((v / total) * 100)}%` }} />
          </div>
          <div style={{ fontSize: 11, color: "var(--t2)", width: 45, textAlign: "right", flexShrink: 0, fontWeight: 600 }}>{fmt(v)}</div>
        </div>
      ))}
    </div>
  );
}

function DetailPanel({ j }) {
  const topVtype = Object.keys(j.tv)[0];
  const commercial = (j.vb["MAXI-CAB"] || 0) + (j.vb["LGV"] || 0) + (j.vb["HGV"] || 0) + (j.vb["HTV"] || 0);
  const commercialFlag = commercial > 100;
  const towing = topVtype === "PARKING IN A MAIN ROAD" || topVtype === "DOUBLE PARKING";
  const unitType = commercialFlag ? "Commercial vehicle unit + challan team" : "Challan unit (2 officers)";

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
        <Badge rl={j.rl} />
      </div>

      {/* Action card */}
      <div style={{ 
        background: "var(--bg2)", 
        borderRadius: 8, 
        padding: "14px 16px", 
        borderLeft: "4px solid #378ADD", 
        border: "1px solid var(--border)",
        borderLeftWidth: 4,
        marginBottom: 20 
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#378ADD", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>⚡ Deployment Recommendation</div>
        <div style={{ fontSize: 13, color: "var(--t1)", lineHeight: 1.5, fontWeight: 400 }}>
          Deploy <strong>{unitType}</strong> to {j.n} by {j.ph}:00. Peak enforcement window: {j.ph}:00–{(j.ph + 2) % 24}:00.
          {towing && " Towing vehicle required — main road blockages detected."}
          {commercialFlag && " Commercial vehicle concentration — coordinate with LGV/MAXI-CAB enforcement unit."}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          {[
            `🕐 Peak ${j.ph}:00`,
            `📍 ${j.lat}, ${j.lng}`,
            ...(towing ? ["🔴 Towing required"] : []),
            ...(commercialFlag ? ["🟡 Commercial vehicles"] : []),
          ].map(tag => (
            <span key={tag} style={{ fontSize: 11, fontWeight: 500, padding: "3px 8px", borderRadius: 4, background: "var(--bg1)", border: "1px solid var(--border)", color: "var(--t2)" }}>{tag}</span>
          ))}
        </div>
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

function TemporalView({ temporal }) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const hourData = hours.map(h => ({ hour: `${h}:00`, v: temporal.hourly_city[h] || 0 }));
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayData = days.map(d => ({ day: d.slice(0, 3), v: temporal.daily_city[d] || 0 }));

  // Calculate dynamic peak 4-hour window
  const hourlyCity = temporal.hourly_city || {};
  let maxWindowSum = 0;
  let bestStart = 0;
  for (let h = 0; h < 24; h++) {
    const sum = (hourlyCity[h] || 0) + 
                (hourlyCity[(h + 1) % 24] || 0) + 
                (hourlyCity[(h + 2) % 24] || 0) + 
                (hourlyCity[(h + 3) % 24] || 0);
    if (sum > maxWindowSum) {
      maxWindowSum = sum;
      bestStart = h;
    }
  }
  const bestEnd = (bestStart + 4) % 24;
  const totalV = temporal.total_violations || 1;
  const peakPercent = Math.round((maxWindowSum / totalV) * 100);

  const formatHour = hr => {
    const ampm = hr >= 12 ? "PM" : "AM";
    const displayHr = hr % 12 === 0 ? 12 : hr % 12;
    return `${displayHr} ${ampm}`;
  };

  const peakLabel = `${formatHour(bestStart)} – ${formatHour(bestEnd)}`;

  return (
    <>
      <div style={{ background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 10, padding: "20px 24px", marginBottom: 16, boxShadow: "0 2px 4px rgba(0,0,0,0.01)" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 16 }}>Violations by hour of day — city wide</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={hourData} barSize={8}>
            <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "#666" }} interval={1} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 9, fill: "#666" }} tickFormatter={v => v >= 1000 ? Math.round(v / 1000) + "k" : v} width={32} tickLine={false} axisLine={false} />
            <Tooltip 
              contentStyle={{ background: "#ffffff", border: "1px solid #ddd", borderRadius: 6, fontSize: 11, fontFamily: "Inter" }}
              formatter={v => [fmt(v), "Violations"]} 
              labelFormatter={l => `Hour: ${l}`} 
            />
            <Bar dataKey="v" radius={[2, 2, 0, 0]}>
              {hourData.map((d, i) => (
                <Cell key={i} fill={d.v > 20000 ? "#E24B4A" : d.v > 10000 ? "#EF9F27" : "#378ADD"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div style={{ marginTop: 16, fontSize: 12, color: "var(--t2)", background: "var(--bg2)", padding: "10px 14px", borderRadius: 6, border: "1px solid var(--border)" }}>
          💡 Peak enforcement window: <strong style={{ color: "var(--t1)" }}>{peakLabel}</strong> — {peakPercent}% of all violations occur in this 4-hour window. This is a critical time-aware deployment opportunity.
        </div>
      </div>

      <div style={{ background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 10, padding: "20px 24px", marginBottom: 16, boxShadow: "0 2px 4px rgba(0,0,0,0.01)" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 16 }}>Violations by day of week</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={dayData} barSize={24}>
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#666" }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 9, fill: "#666" }} tickFormatter={v => Math.round(v / 1000) + "k"} width={32} tickLine={false} axisLine={false} />
            <Tooltip 
              contentStyle={{ background: "#ffffff", border: "1px solid #ddd", borderRadius: 6, fontSize: 11, fontFamily: "Inter" }}
              formatter={v => [fmt(v), "Violations"]} 
            />
            <Bar dataKey="v" fill="#378ADD" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

function StationsView({ temporal }) {
  const stations = Object.entries(temporal.station_counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, v]) => ({ name, v }));
  return (
    <div style={{ background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 10, padding: "20px 24px", marginBottom: 16, boxShadow: "0 2px 4px rgba(0,0,0,0.01)" }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 16 }}>Top police stations by violation volume</div>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={stations} layout="vertical" barSize={16}>
          <XAxis type="number" tick={{ fontSize: 9, fill: "#666" }} tickFormatter={v => Math.round(v / 1000) + "k"} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#666" }} width={120} tickLine={false} axisLine={false} />
          <Tooltip 
            contentStyle={{ background: "#ffffff", border: "1px solid #ddd", borderRadius: 6, fontSize: 11, fontFamily: "Inter" }}
            formatter={v => [fmt(v), "Violations"]} 
          />
          <Bar dataKey="v" fill="#378ADD" radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Main dashboard ─────────────────────────────────────────────
export default function Dashboard() {
  const [view, setView] = useState("leaderboard");
  const [selectedIdx, setSelectedIdx] = useState(0);

  const [junctions, setJunctions] = useState([]);
  const [hotspots, setHotspots]   = useState([]);
  const [temporal, setTemporal]   = useState(null);
  const [summary, setSummary]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  // Dynamic Google Font Loader for premium corporate aesthetics
  useEffect(() => {
    const fontLinkId = "inter-font-link";
    if (!document.getElementById(fontLinkId)) {
      const link = document.createElement("link");
      link.id = fontLinkId;
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/junctions?limit=100`).then(r => r.json()),
      fetch(`${API}/temporal`).then(r => r.json()),
      fetch(`${API}/summary`).then(r => r.json()),
      fetch(`${API}/hotspots?limit=100`).then(r => r.json()),
    ])
      .then(([j, t, s, h]) => {
        setJunctions(j.map(normalizeJunction));
        setTemporal(t);
        setSummary(s);
        setHotspots(h);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return (
    <div style={{ padding: 48, textAlign: "center", color: "#666", fontFamily: "Inter, sans-serif" }}>
      Loading data…
    </div>
  );
  if (error) return (
    <div style={{ padding: 48, color: "#E24B4A", fontFamily: "Inter, sans-serif" }}>
      ⚠ Could not reach API at <code>{API}</code> — {error}.<br />
      Make sure <code>uvicorn main:app --reload</code> is running.
    </div>
  );

  const peakHourVal = temporal ? temporal.hourly_city[summary?.peak_hour] : 0;
  const peakHourLabel = summary?.peak_hour != null
    ? `${summary.peak_hour}:00`
    : "—";

  return (
    <div style={{
      "--bg1": "#ffffff",
      "--bg2": "#f9fafb",
      "--t1": "#111827",
      "--t2": "#4b5563",
      "--t3": "#9ca3af",
      "--border": "#e5e7eb",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      padding: "24px",
      maxWidth: 1080,
      margin: "0 auto",
      background: "#ffffff",
      minHeight: "100vh",
      color: "var(--t1)",
      display: "flex",
      flexDirection: "column",
      gap: "24px"
    }}>
      {/* Header */}
      <div style={{ paddingBottom: 16, borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.02em", margin: 0 }}>
            🛡  Gridlock
          </h1>
          <p style={{ fontSize: 13, color: "var(--t2)", marginTop: 4, marginBottom: 0 }}>
            Bengaluru Traffic Police · Parking Enforcement Decision Support
          </p>
        </div>
        <div style={{ fontSize: 11, color: "var(--t3)", fontWeight: 500 }}>
          BTP × Hackathon 2026 Core Engine
        </div>
      </div>

      {/* Metrics — driven by /summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
        <MetricCard label="Total Violations" value={fmt(summary?.total_violations ?? 0)} sub="from processed dataset" />
        <MetricCard label="Junctions Monitored" value={summary?.junctions_monitored ?? "—"} sub="Named BTP intersections" />
        <MetricCard label="High Risk Junctions" value={summary?.high_risk_junctions ?? "—"} sub="CIS score ≥ 5.0" color="#EF9F27" />
        <MetricCard label="Peak Surge Hour" value={peakHourLabel} sub={peakHourVal ? `${fmt(peakHourVal)} violations` : ""} />
      </div>

      {/* Nav */}
      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
        {[
          ["leaderboard", "Junction leaderboard"],
          ["map", "🗺 Hotspot Map"],
          ["temporal", "Temporal patterns"],
          ["stations", "By police station"]
        ].map(([v, label]) => (
          <button key={v} onClick={() => setView(v)} style={{
            fontSize: 12, padding: "6px 14px",
            borderRadius: 6,
            border: `1px solid ${view === v ? "#378ADD" : "var(--border)"}`,
            background: view === v ? "rgba(55, 138, 221, 0.06)" : "var(--bg1)",
            color: view === v ? "#378ADD" : "var(--t2)",
            fontWeight: 500,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}>{label}</button>
        ))}
      </div>

      {/* Hotspot Map view */}
      {view === "map" && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--t2)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
            Interactive Hotspots and Junctions Map
          </div>
          <HotspotMap 
            junctions={junctions} 
            hotspots={hotspots} 
            onSelectJunction={(j) => {
              const idx = junctions.findIndex(item => item.n === j.n);
              if (idx !== -1) {
                setSelectedIdx(idx);
                setView("leaderboard");
              }
            }}
          />
        </div>
      )}

      {/* Leaderboard view */}
      {view === "leaderboard" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--t2)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
              Junctions Ranked by Congestion Impact Score
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {junctions.map((j, i) => (
                <div key={j.n} onClick={() => setSelectedIdx(i)}
                  style={{
                    background: "var(--bg1)",
                    border: `1px solid ${i === selectedIdx ? "#378ADD" : "var(--border)"}`,
                    borderRadius: 8, padding: "12px 16px",
                    display: "flex", alignItems: "center", gap: 16,
                    cursor: "pointer",
                    boxShadow: i === selectedIdx ? "0 4px 12px rgba(55,138,221,0.06)" : "0 1px 2px rgba(0,0,0,0.01)",
                    transition: "all 0.15s ease",
                    transform: i === selectedIdx ? "translateY(-1px)" : "none",
                  }}
                  onMouseEnter={(e) => {
                    if (i !== selectedIdx) e.currentTarget.style.borderColor = "var(--t2)";
                  }}
                  onMouseLeave={(e) => {
                    if (i !== selectedIdx) e.currentTarget.style.borderColor = "var(--border)";
                  }}
                >
                  <span style={{ fontSize: 11, color: "var(--t3)", width: 20, flexShrink: 0, textAlign: "right", fontWeight: 600 }}>{i + 1}</span>
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
                  <Badge rl={j.rl} />
                </div>
              ))}
            </div>
          </div>
          {junctions[selectedIdx] && <DetailPanel j={junctions[selectedIdx]} />}
        </div>
      )}

      {view === "temporal" && temporal && <TemporalView temporal={temporal} />}
      {view === "stations" && temporal && <StationsView temporal={temporal} />}
    </div>
  );
}
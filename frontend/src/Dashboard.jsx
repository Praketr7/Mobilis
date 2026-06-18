import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

const API = "http://localhost:8000";

// ── Normalise API response → short keys used throughout the component ──────
// API fields:  junction_name, violation_count, avg_severity, peak_hour,
//              top_violations, vehicle_breakdown, hourly_pattern,
//              daily_pattern, risk_level, police_station, cis, lat, lng
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
    // hourly_pattern keys come back as strings ("0".."23") — keep as-is,
    // the heatmap already does hp[h] || 0 so both work fine
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
    <div style={{ background: "var(--bg2)", borderRadius: 8, padding: "12px 16px" }}>
      <div style={{ fontSize: 12, color: "var(--t2)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 500, color: color || "var(--t1)", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 3 }}>{sub}</div>
    </div>
  );
}

function Badge({ rl }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4,
      letterSpacing: "0.04em",
      background: { CRITICAL: "#FCEBEB", HIGH: "#FAEEDA", MODERATE: "#E6F1FB", LOW: "#EAF3DE" }[rl],
      color: { CRITICAL: "#791F1F", HIGH: "#633806", MODERATE: "#0C447C", LOW: "#27500A" }[rl],
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
          const alpha = Math.max(0.08, maxH > 0 ? v / maxH : 0);
          return (
            <div key={h} title={`${h}:00 — ${v} violations`}
              style={{ height: 20, borderRadius: 2, background: `rgba(55,138,221,${alpha.toFixed(2)})` }} />
          );
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(24,1fr)", gap: 2, marginTop: 2 }}>
        {hours.map(h => (
          <div key={h} style={{ fontSize: 8, color: "var(--t3)", textAlign: "center" }}>{h}</div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 6 }}>Darker = more violations</div>
    </div>
  );
}

function ViolationBars({ tv }) {
  const total = Object.values(tv).reduce((a, b) => a + b, 0);
  return (
    <div>
      {Object.entries(tv).map(([k, v]) => (
        <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <div style={{ fontSize: 12, color: "var(--t2)", width: 180, flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{k}</div>
          <div style={{ flex: 1, height: 8, background: "var(--bg2)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 4, background: "#378ADD", width: `${Math.round((v / total) * 100)}%` }} />
          </div>
          <div style={{ fontSize: 11, color: "var(--t3)", width: 40, textAlign: "right", flexShrink: 0 }}>{fmt(v)}</div>
        </div>
      ))}
    </div>
  );
}

function DetailPanel({ j }) {
  const topVtype = Object.keys(j.tv)[0];
  const commercial = (j.vb["MAXI-CAB"] || 0) + (j.vb["LGV"] || 0) + (j.vb["HGV"] || 0);
  const commercialFlag = commercial > 100;
  const towing = topVtype === "PARKING IN A MAIN ROAD" || topVtype === "DOUBLE PARKING";
  const unitType = commercialFlag ? "Commercial vehicle unit + challan team" : "Challan unit (2 officers)";

  return (
    <div style={{ background: "var(--bg1)", border: "0.5px solid var(--border)", borderRadius: 10, padding: "16px 20px", marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--t1)", marginBottom: 2 }}>{j.n}</div>
          <div style={{ fontSize: 12, color: "var(--t2)" }}>{j.ps} police station · CIS {j.cis}/10</div>
        </div>
        <Badge rl={j.rl} />
      </div>

      {/* Action card */}
      <div style={{ background: "var(--bg2)", borderRadius: 6, padding: "10px 12px", borderLeft: "3px solid #378ADD", marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: "var(--t2)", marginBottom: 4 }}>⚡ Recommended action</div>
        <div style={{ fontSize: 13, color: "var(--t1)", lineHeight: 1.5 }}>
          Deploy <strong>{unitType}</strong> to {j.n} by {j.ph}:00. Peak window: {j.ph}:00–{(j.ph + 2) % 24}:00.
          {towing && " Towing vehicle required — main road blockages detected."}
          {commercialFlag && " Commercial vehicle concentration — coordinate with LGV/MAXI-CAB enforcement unit."}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          {[
            `🕐 Peak ${j.ph}:00`,
            `📍 ${j.lat}, ${j.lng}`,
            ...(towing ? ["🔴 Towing required"] : []),
            ...(commercialFlag ? ["🟡 Commercial vehicles"] : []),
          ].map(tag => (
            <span key={tag} style={{ fontSize: 11, padding: "2px 7px", borderRadius: 3, background: "var(--bg1)", border: "0.5px solid var(--border)", color: "var(--t2)" }}>{tag}</span>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--t2)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Violation breakdown</div>
          <ViolationBars tv={j.tv} />
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--t2)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Hourly pattern</div>
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

  return (
    <>
      <div style={{ background: "var(--bg1)", border: "0.5px solid var(--border)", borderRadius: 10, padding: "16px 20px", marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--t1)", marginBottom: 12 }}>Violations by hour of day — city wide</div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={hourData} barSize={8}>
            <XAxis dataKey="hour" tick={{ fontSize: 9 }} interval={1} />
            <YAxis tick={{ fontSize: 9 }} tickFormatter={v => v >= 1000 ? Math.round(v / 1000) + "k" : v} width={32} />
            <Tooltip formatter={v => fmt(v)} labelFormatter={l => `Hour: ${l}`} />
            <Bar dataKey="v" radius={[2, 2, 0, 0]}>
              {hourData.map((d, i) => (
                <Cell key={i} fill={d.v > 20000 ? "#E24B4A" : d.v > 10000 ? "#EF9F27" : "#378ADD"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div style={{ marginTop: 12, fontSize: 12, color: "var(--t2)" }}>
          ⚠ Peak enforcement window: <strong style={{ color: "var(--t1)" }}>2 AM – 6 AM</strong> — 47% of all violations occur in this 4-hour window. Counter-intuitive but data-backed.
        </div>
      </div>

      <div style={{ background: "var(--bg1)", border: "0.5px solid var(--border)", borderRadius: 10, padding: "16px 20px", marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--t1)", marginBottom: 12 }}>Violations by day of week</div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={dayData} barSize={24}>
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 9 }} tickFormatter={v => Math.round(v / 1000) + "k"} width={32} />
            <Tooltip formatter={v => fmt(v)} />
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
    <div style={{ background: "var(--bg1)", border: "0.5px solid var(--border)", borderRadius: 10, padding: "16px 20px", marginBottom: 12 }}>
      <div style={{ fontSize: 14, fontWeight: 500, color: "var(--t1)", marginBottom: 12 }}>Top police stations by violation volume</div>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={stations} layout="vertical" barSize={16}>
          <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={v => Math.round(v / 1000) + "k"} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
          <Tooltip formatter={v => fmt(v)} />
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
  const [temporal, setTemporal]   = useState(null);
  const [summary, setSummary]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/junctions?limit=100`).then(r => r.json()),
      fetch(`${API}/temporal`).then(r => r.json()),
      fetch(`${API}/summary`).then(r => r.json()),
    ])
      .then(([j, t, s]) => {
        setJunctions(j.map(normalizeJunction));
        setTemporal(t);
        setSummary(s);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return (
    <div style={{ padding: 32, textAlign: "center", color: "#666", fontFamily: "system-ui, sans-serif" }}>
      Loading data…
    </div>
  );
  if (error) return (
    <div style={{ padding: 32, color: "#E24B4A", fontFamily: "system-ui, sans-serif" }}>
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
      "--bg2": "#f5f5f5",
      "--t1": "#0f0f0f",
      "--t2": "#666",
      "--t3": "#aaa",
      "--border": "#e5e5e5",
      fontFamily: "system-ui, -apple-system, sans-serif",
      padding: "16px",
      maxWidth: 960,
      margin: "0 auto",
    }}>
      {/* Header */}
      <div style={{ paddingBottom: 12, borderBottom: "0.5px solid var(--border)", marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 500, color: "var(--t1)", letterSpacing: "-0.01em" }}>
          🛡  Gridlock — Command Overview
        </h1>
        <p style={{ fontSize: 13, color: "var(--t2)", marginTop: 2 }}>
          Bengaluru Traffic Police · Parking Enforcement Intelligence
        </p>
      </div>

      {/* Metrics — driven by /summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
        <MetricCard label="Total violations" value={fmt(summary?.total_violations ?? 0)} sub="from processed data" />
        <MetricCard label="Junctions monitored" value={summary?.junctions_monitored ?? "—"} sub="Named BTP junctions" />
        <MetricCard label="High risk junctions" value={summary?.high_risk_junctions ?? "—"} sub="CIS ≥ 5.0" color="#EF9F27" />
        <MetricCard label="Peak violation hour" value={peakHourLabel} sub={peakHourVal ? `${fmt(peakHourVal)} violations` : ""} />
      </div>

      {/* Nav */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {[["leaderboard", "Junction leaderboard"], ["temporal", "Temporal patterns"], ["stations", "By police station"]].map(([v, label]) => (
          <button key={v} onClick={() => setView(v)} style={{
            fontSize: 12, padding: "5px 12px",
            borderRadius: 6,
            border: `0.5px solid ${view === v ? "#ccc" : "var(--border)"}`,
            background: view === v ? "var(--bg2)" : "var(--bg1)",
            color: view === v ? "var(--t1)" : "var(--t2)",
            fontWeight: view === v ? 500 : 400,
            cursor: "pointer",
          }}>{label}</button>
        ))}
      </div>

      {/* Leaderboard view */}
      {view === "leaderboard" && (
        <>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--t2)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
            Junctions ranked by congestion impact score
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
            {junctions.map((j, i) => (
              <div key={j.n} onClick={() => setSelectedIdx(i)}
                style={{
                  background: "var(--bg1)",
                  border: `${i === selectedIdx ? "1.5px solid #378ADD" : "0.5px solid var(--border)"}`,
                  borderRadius: 8, padding: "10px 12px",
                  display: "flex", alignItems: "center", gap: 10,
                  cursor: "pointer",
                }}>
                <span style={{ fontSize: 12, color: "var(--t3)", width: 18, flexShrink: 0, textAlign: "right" }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--t1)" }}>{j.n}</div>
                  <div style={{ fontSize: 11, color: "var(--t2)", marginTop: 1 }}>{j.ps} · {fmt(j.vc)} violations · peak {j.ph}:00</div>
                </div>
                <div style={{ width: 80, height: 6, background: "var(--bg2)", borderRadius: 3, overflow: "hidden", flexShrink: 0 }}>
                  <div style={{ height: "100%", borderRadius: 3, width: `${(j.cis / 10) * 100}%`, background: cisColor(j.cis) }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 500, width: 28, textAlign: "right", flexShrink: 0, color: cisColor(j.cis) }}>{j.cis}</span>
                <Badge rl={j.rl} />
              </div>
            ))}
          </div>
          {junctions[selectedIdx] && <DetailPanel j={junctions[selectedIdx]} />}
        </>
      )}

      {view === "temporal" && temporal && <TemporalView temporal={temporal} />}
      {view === "stations" && temporal && <StationsView temporal={temporal} />}
    </div>
  );
}
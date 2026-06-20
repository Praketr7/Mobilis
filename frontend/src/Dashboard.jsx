import { Fragment, useState, useEffect } from "react";
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
  if (cis >= 7.5) return "#B42318";
  if (cis >= 5) return "#C79200";
  if (cis >= 2.5) return "#3B7D3A";
  return "#2E6B2E";
}

// ── Sub-components ─────────────────────────────────────────────

function MetricCard({ label, value, sub, color }) {
  return (
    <div style={{ 
      background: "var(--bg1)", 
      border: "1px solid var(--border)", 
      borderRadius: 4, 
      padding: "16px 18px",
      boxShadow: "none",
      borderTop: `3px solid ${color || "var(--accent)"}`
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t2)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
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
      background: { CRITICAL: "#FDECEC", HIGH: "#FFF4D6", MODERATE: "#EEF7EE", LOW: "#E7F2E7" }[rl],
      color: { CRITICAL: "#8F1D1D", HIGH: "#7A5A00", MODERATE: "#275B27", LOW: "#275B27" }[rl],
      border: `1px solid ${{ CRITICAL: "#F0B7B7", HIGH: "#E4CB91", MODERATE: "#C6DDC6", LOW: "#C6DDC6" }[rl]}`,
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
              style={{ height: 24, borderRadius: 2, background: `rgba(59,125,58,${alpha.toFixed(2)})` }} />
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
            <div style={{ height: "100%", borderRadius: 4, background: "#3B7D3A", width: `${Math.round((v / total) * 100)}%` }} />
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
      borderRadius: 4, 
      padding: "20px 24px", 
      marginBottom: 12,
      boxShadow: "none"
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
        borderLeft: "4px solid #3B7D3A", 
        border: "1px solid var(--border)",
        borderLeftWidth: 4,
        marginBottom: 20 
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Deployment Recommendation</div>
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
      <div style={{ background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 4, padding: "20px 24px", marginBottom: 16, boxShadow: "none" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 16 }}>Violations by hour of day — city wide</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={hourData} barSize={8}>
            <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#666", fontWeight: 600 }} interval={1} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 9, fill: "#666" }} tickFormatter={v => v >= 1000 ? Math.round(v / 1000) + "k" : v} width={32} tickLine={false} axisLine={false} />
            <Tooltip 
              contentStyle={{ background: "#ffffff", border: "1px solid var(--border)", borderRadius: 4, fontSize: 11, fontFamily: "Segoe UI, Arial, sans-serif" }}
              formatter={v => [fmt(v), "Violations"]} 
              labelFormatter={l => `Hour: ${l}`} 
            />
            <Bar dataKey="v" radius={[2, 2, 0, 0]}>
              {hourData.map((d, i) => (
                <Cell key={i} fill={d.v > 20000 ? "#B42318" : d.v > 10000 ? "#C79200" : "#3B7D3A"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div style={{ marginTop: 16, fontSize: 12, color: "var(--t2)", background: "var(--bg2)", padding: "10px 14px", borderRadius: 4, border: "1px solid var(--border)" }}>
          Peak enforcement window: <strong style={{ color: "var(--t1)" }}>{peakLabel}</strong> — {peakPercent}% of all violations occur in this 4-hour window.
        </div>
      </div>

      <div style={{ background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 4, padding: "20px 24px", marginBottom: 16, boxShadow: "none" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 16 }}>Violations by day of week</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={dayData} barSize={24}>
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#666" }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 9, fill: "#666" }} tickFormatter={v => Math.round(v / 1000) + "k"} width={32} tickLine={false} axisLine={false} />
            <Tooltip 
              contentStyle={{ background: "#ffffff", border: "1px solid var(--border)", borderRadius: 4, fontSize: 11, fontFamily: "Segoe UI, Arial, sans-serif" }}
              formatter={v => [fmt(v), "Violations"]} 
            />
            <Bar dataKey="v" fill="#3B7D3A" radius={[3, 3, 0, 0]} />
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
    <div style={{ background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 4, padding: "20px 24px", marginBottom: 16, boxShadow: "none" }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 16 }}>Top police stations by violation volume</div>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={stations} layout="vertical" barSize={16}>
          <XAxis type="number" tick={{ fontSize: 9, fill: "#666" }} tickFormatter={v => Math.round(v / 1000) + "k"} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#666" }} width={120} tickLine={false} axisLine={false} />
          <Tooltip 
            contentStyle={{ background: "#ffffff", border: "1px solid var(--border)", borderRadius: 6, fontSize: 11, fontFamily: "Segoe UI, Arial, sans-serif" }}
            formatter={v => [fmt(v), "Violations"]} 
          />
          <Bar dataKey="v" fill="#3B7D3A" radius={[0, 3, 3, 0]} />
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
    <div style={{ padding: 48, textAlign: "center", color: "#666", fontFamily: "Segoe UI, Arial, sans-serif" }}>
      Loading data…
    </div>
  );
  if (error) return (
    <div style={{ padding: 48, color: "#B42318", fontFamily: "Segoe UI, Arial, sans-serif" }}>
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
      "--bg1": "#fbfaf6",
      "--bg2": "#f4f1e8",
      "--t1": "#1b1b1b",
      "--t2": "#514c44",
      "--t3": "#7f7668",
      "--border": "#d8d0c2",
      "--accent": "#3B7D3A",
      "--accent-amber": "#C79200",
      "--accent-red": "#B42318",
      fontFamily: "'Segoe UI', Arial, sans-serif",
      padding: "24px",
      maxWidth: 1080,
      margin: "0 auto",
      background: "#f3f0e8",
      minHeight: "100vh",
      color: "var(--t1)",
      display: "flex",
      flexDirection: "column",
      gap: "24px"
    }}>
      {/* Header */}
      <div style={{ paddingBottom: 16, borderBottom: "2px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--t1)", letterSpacing: "0.01em", margin: 0 }}>
            Gridlock Enforcement Dashboard
          </h1>
          <p style={{ fontSize: 13, color: "var(--t2)", marginTop: 4, marginBottom: 0 }}>
            Bengaluru Traffic Police · Parking Enforcement Decision Support
          </p>
        </div>
        <div style={{ fontSize: 11, color: "var(--t3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Official Operations View
        </div>
      </div>

      {/* Metrics — driven by /summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
        <MetricCard label="Total Violations" value={fmt(summary?.total_violations ?? 0)} sub="from processed dataset" />
        <MetricCard label="Junctions Monitored" value={summary?.junctions_monitored ?? "—"} sub="Named BTP intersections" />
        <MetricCard label="High Risk Junctions" value={summary?.high_risk_junctions ?? "—"} sub="CIS score ≥ 5.0" color="var(--accent-amber)" />
        <MetricCard label="Peak Surge Hour" value={peakHourLabel} sub={peakHourVal ? `${fmt(peakHourVal)} violations` : ""} />
      </div>

      {/* Nav */}
      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--border)", paddingBottom: 12, flexWrap: "wrap" }}>
        {[
          ["leaderboard", "Junction leaderboard"],
          ["map", "Hotspot Map"],
          ["temporal", "Temporal patterns"],
          ["stations", "By police station"]
        ].map(([v, label]) => (
          <button key={v} onClick={() => setView(v)} style={{
            fontSize: 12, padding: "7px 14px",
            borderRadius: 4,
            border: `1px solid ${view === v ? "var(--accent)" : "var(--border)"}`,
            background: view === v ? "rgba(59, 125, 58, 0.08)" : "var(--bg1)",
            color: view === v ? "var(--accent)" : "var(--t2)",
            fontWeight: 600,
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
                <Fragment key={j.n}>
                  <div onClick={() => setSelectedIdx(prev => prev === i ? null : i)}
                    style={{
                      background: "var(--bg1)",
                      border: `1px solid ${i === selectedIdx ? "var(--accent)" : "var(--border)"}`,
                      borderRadius: 4, padding: "12px 16px",
                      display: "flex", alignItems: "center", gap: 16,
                      cursor: "pointer",
                      boxShadow: "none",
                      transition: "all 0.15s ease",
                      transform: "none",
                    }}
                    onMouseEnter={(e) => {
                      if (i !== selectedIdx) e.currentTarget.style.borderColor = "var(--accent)";
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
                  {i === selectedIdx && (
                    <div style={{ marginTop: 8, paddingLeft: 24 }}>
                      <DetailPanel j={j} />
                    </div>
                  )}
                </Fragment>
              ))}
            </div>
          </div>
        </div>
      )}

      {view === "temporal" && temporal && <TemporalView temporal={temporal} />}
      {view === "stations" && temporal && <StationsView temporal={temporal} />}

      {/* Floating AI Assistant Widget */}
      <ChatWidget />
    </div>
  );
}

// ── Floating Chatbot Widget ────────────────────────────────────
function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hello officer! I am your Assistant. Ask me anything about traffic congestion, hotspots, or deployment recommendations today." }
  ]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Helper to parse basic Markdown (bold/italic) to HTML
  const formatMessageText = (text) => {
    if (!text) return "";
    let escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    
    // Bold **text** -> <strong>text</strong>
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    // Italic *text* -> <em>text</em>
    escaped = escaped.replace(/\*(.*?)\*/g, "<em>$1</em>");
    
    return <span dangerouslySetInnerHTML={{ __html: escaped }} />;
  };

  // Auto scroll to bottom
  useEffect(() => {
    const el = document.getElementById("chat-message-list");
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, isLoading, isOpen]);

  const handleSend = async (text) => {
    if (!text.trim()) return;
    const userMsg = { role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setInputText("");
    setIsLoading(true);

    try {
      const response = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: messages.map(m => ({ role: m.role, content: m.content })).slice(-8)
        })
      });
      const data = await response.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.response }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Could not connect to Assistant. Please check if the backend is running." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const suggestions = [
    "Show top hotspots today",
    "Where to deploy in Upparpet now?",
    "Show city overview status"
  ];

  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, fontFamily: "Inter, sans-serif" }}>
      {!isOpen ? (
        <button onClick={() => setIsOpen(true)} style={{
          background: "#3B7D3A",
          color: "#fff",
          border: "none",
          borderRadius: 24,
          padding: "12px 20px",
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
          boxShadow: "0 4px 16px rgba(59, 125, 58, 0.3)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          transition: "all 0.2s ease-in-out",
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.05)"}
        onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
        >
          <span>💬</span> Assistant
        </button>
      ) : (
        <div style={{
          width: 360,
          height: 480,
          background: "#fff",
          border: "1px solid var(--border)",
          borderRadius: 12,
          boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{ background: "#3B7D3A", color: "#fff", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16 }}>🤖</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Assistant</div>
                <div style={{ fontSize: 10, opacity: 0.85, display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ADE80", display: "inline-block" }}></span> Online
                </div>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 16, padding: 4 }}>✕</button>
          </div>

          {/* Messages */}
          <div id="chat-message-list" style={{ flex: 1, padding: 16, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, background: "#fafafa" }}>
            {messages.map((m, idx) => (
              <div key={idx} style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "80%",
                background: m.role === "user" ? "#3B7D3A" : "#ffffff",
                color: m.role === "user" ? "#ffffff" : "var(--t1)",
                padding: "10px 14px",
                borderRadius: m.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                fontSize: 13,
                lineHeight: 1.4,
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                border: m.role === "user" ? "none" : "1px solid var(--border)",
                whiteSpace: "pre-line"
              }}>
                {formatMessageText(m.content)}
              </div>
            ))}
            {isLoading && (
              <div style={{ alignSelf: "flex-start", background: "#ffffff", border: "1px solid var(--border)", padding: "10px 14px", borderRadius: "12px 12px 12px 2px", fontSize: 13, color: "var(--t2)", display: "flex", gap: 4, alignItems: "center" }}>
                <span>Assistant is typing...</span>
              </div>
            )}
          </div>

          {/* Suggestions */}
          {!isLoading && (
            <div style={{ padding: "8px 12px", background: "#fff", borderTop: "1px solid var(--border)", display: "flex", gap: 6, flexWrap: "wrap" }}>
              {suggestions.map((s, idx) => (
                <button key={idx} onClick={() => handleSend(s)} style={{
                  background: "var(--bg2)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: "4px 10px",
                  fontSize: 11,
                  color: "#3B7D3A",
                  cursor: "pointer",
                  fontWeight: 500,
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(59, 125, 58, 0.06)"; e.currentTarget.style.borderColor = "#3B7D3A"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg2)"; e.currentTarget.style.borderColor = "var(--border)"; }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ padding: 12, borderTop: "1px solid var(--border)", display: "flex", gap: 8, background: "#fff" }}>
            <input 
              type="text" 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend(inputText)}
              placeholder="Ask Assistant..." 
              style={{
                flex: 1,
                padding: "8px 12px",
                border: "1px solid var(--border)",
                borderRadius: 6,
                fontSize: 13,
                outline: "none",
              }}
            />
            <button onClick={() => handleSend(inputText)} style={{
              background: "#3B7D3A",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer"
            }}>
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
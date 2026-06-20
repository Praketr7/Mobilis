import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

function fmt(n) { 
  return n ? n.toLocaleString("en-IN") : "0"; 
}

export default function Temporal({ temporal }) {
  if (!temporal) return null;

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

import { useEffect, useRef, useState } from "react";
import L from "leaflet";

// Helpers
function cisColor(cis) {
  if (cis >= 7.5) return "#E24B4A";
  if (cis >= 5) return "#EF9F27";
  if (cis >= 2.5) return "#378ADD";
  return "#639922";
}

export default function HotspotMap({ junctions, hotspots, onSelectJunction }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const layerGroupRef = useRef(null);
  const [filter, setFilter] = useState("heatmap"); // "heatmap", "all", "commercial", "blockage"
  const [heatScriptLoaded, setHeatScriptLoaded] = useState(false);

  // Load Leaflet CSS and Leaflet.heat Script dynamically to keep component self-contained
  useEffect(() => {
    // 1. Load Leaflet CSS
    const linkId = "leaflet-css-link";
    if (!document.getElementById(linkId)) {
      const link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    // 2. Load Leaflet.heat script
    const scriptId = "leaflet-heat-script";
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js";
      script.onload = () => {
        setHeatScriptLoaded(true);
      };
      document.body.appendChild(script);
    } else {
      setHeatScriptLoaded(true);
    }
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current && mapContainerRef.current) {
      // Coordinates centered on Bengaluru: 12.9716, 77.5946
      const map = L.map(mapContainerRef.current).setView([12.9716, 77.5946], 12);
      
      // Use premium CartoDB Positron tile layer for high-end corporate aesthetics (light theme)
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20
      }).addTo(map);

      mapRef.current = map;
      layerGroupRef.current = L.layerGroup().addTo(map);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerGroupRef.current = null;
      }
    };
  }, []);

  // Render Markers, Clusters, or Heatmap
  useEffect(() => {
    if (!mapRef.current || !layerGroupRef.current) return;

    const layerGroup = layerGroupRef.current;
    layerGroup.clearLayers();

    if (filter === "heatmap") {
      if (!heatScriptLoaded || !window.L || !window.L.heatLayer) return;

      // Create a smooth, weighted visual heatmap using hotspots (high density) and junctions (low-to-mid density)
      const heatPoints = [];
      const maxHotspotCount = Math.max(...hotspots.map(h => h.violation_count), 1);
      
      hotspots.forEach(h => {
        const weight = h.violation_count / maxHotspotCount;
        heatPoints.push([h.lat, h.lng, weight * 0.95]);
      });

      junctions.forEach(j => {
        const weight = j.cis / 10;
        heatPoints.push([j.lat, j.lng, weight * 0.3]);
      });

      // Helper to dynamically calculate radius and blur based on zoom
      // to ensure a clean, smooth, non-splotchy blending at all zoom levels.
      const getHeatParams = (zoom) => {
        if (zoom <= 10) return { radius: 12, blur: 15 };
        if (zoom === 11) return { radius: 16, blur: 20 };
        if (zoom === 12) return { radius: 22, blur: 25 };
        if (zoom === 13) return { radius: 30, blur: 30 };
        if (zoom === 14) return { radius: 40, blur: 35 };
        if (zoom === 15) return { radius: 50, blur: 40 };
        return { radius: 60, blur: 45 };
      };

      const initialZoom = mapRef.current.getZoom();
      const initialParams = getHeatParams(initialZoom);

      const heatLayer = window.L.heatLayer(heatPoints, {
        ...initialParams,
        maxZoom: 15,
        max: 0.25, // Lower threshold ensures red areas are clearly visible and bloom nicely
        minOpacity: 0.15,
        gradient: {
          0.1: "#378ADD",  // Blue (Low density)
          0.3: "#00D2C4",  // Cyan (Low-Mid)
          0.5: "#639922",  // Green (Mid)
          0.7: "#EF9F27",  // Orange (High)
          0.85: "#FF3B30", // Vibrant Bright Red (Very High)
          1.0: "#C62828"   // Deep rich red (Critical core)
        }
      });
      heatLayer.addTo(layerGroup);

      const handleZoom = () => {
        if (mapRef.current) {
          const params = getHeatParams(mapRef.current.getZoom());
          heatLayer.setOptions(params);
        }
      };

      mapRef.current.on("zoomend", handleZoom);

      // Clean up listener when layer changes or component updates
      return () => {
        if (mapRef.current) {
          mapRef.current.off("zoomend", handleZoom);
        }
      };
    } else {
      // 1. Filter data based on selection
      let filteredJunctions = [...junctions];
      let filteredHotspots = [...hotspots];

      if (filter === "commercial") {
        filteredJunctions = junctions.filter(j => {
          const totalComm = (j.vb["MAXI-CAB"] || 0) + (j.vb["LGV"] || 0) + (j.vb["HTV"] || 0) + (j.vb["HGV"] || 0);
          return totalComm > 50;
        });
        filteredHotspots = hotspots.filter(h => 
          ["MAXI-CAB", "LGV", "HTV", "HGV", "UNKNOWN"].includes(h.top_vehicle)
        );
      } else if (filter === "blockage") {
        filteredJunctions = junctions.filter(j => {
          const topV = Object.keys(j.tv)[0];
          return topV === "PARKING IN A MAIN ROAD" || topV === "DOUBLE PARKING";
        });
        filteredHotspots = hotspots.filter(h => 
          h.top_violation === "PARKING IN A MAIN ROAD" || h.top_violation === "DOUBLE PARKING"
        );
      }

      // 2. Render DBSCAN Hotspots as transparent red zones
      filteredHotspots.forEach(h => {
        const radius = Math.min(600, Math.max(150, h.violation_count * 0.4)); // scaled radius in meters
        const circle = L.circle([h.lat, h.lng], {
          color: "#E24B4A",
          fillColor: "#E24B4A",
          fillOpacity: 0.18,
          weight: 1.5,
          radius: radius
        });

        const popupContent = `
          <div style="font-family: sans-serif; min-width: 200px;">
            <h4 style="margin: 0 0 6px 0; color: #E24B4A; font-size: 14px;">🔥 Hotspot Cluster #${h.cluster_id}</h4>
            <div style="font-size: 12px; line-height: 1.4; color: #444;">
              <strong>Violations:</strong> ${h.violation_count.toLocaleString("en-IN")}<br/>
              <strong>Primary Offense:</strong> ${h.top_violation}<br/>
              <strong>Top Vehicle:</strong> ${h.top_vehicle}<br/>
              <strong>Peak Hour:</strong> ${h.peak_hour}:00
            </div>
          </div>
        `;

        circle.bindPopup(popupContent);
        circle.addTo(layerGroup);
      });

      // 3. Render Named BTP Junctions
      filteredJunctions.forEach(j => {
        const color = cisColor(j.cis);
        const marker = L.circleMarker([j.lat, j.lng], {
          radius: 8,
          fillColor: color,
          color: "#ffffff",
          weight: 1.5,
          opacity: 1,
          fillOpacity: 0.9
        });

        const popupDiv = document.createElement("div");
        popupDiv.style.fontFamily = "sans-serif";
        popupDiv.style.minWidth = "220px";
        popupDiv.innerHTML = `
          <h4 style="margin: 0 0 4px 0; color: #333; font-size: 13px;">📍 ${j.n}</h4>
          <div style="font-size: 11px; color: #666; margin-bottom: 8px;">
            Police Station: ${j.ps}<br/>
            CIS Score: <strong>${j.cis}</strong> (${j.rl})<br/>
            Violations Count: ${j.vc.toLocaleString("en-IN")}
          </div>
        `;

        const btn = document.createElement("button");
        btn.innerText = "Select Junction";
        btn.style.width = "100%";
        btn.style.padding = "5px 0";
        btn.style.fontSize = "11px";
        btn.style.background = "#378ADD";
        btn.style.color = "#fff";
        btn.style.border = "none";
        btn.style.borderRadius = "4px";
        btn.style.cursor = "pointer";
        btn.onclick = () => {
          onSelectJunction(j);
          marker.closePopup();
        };

        popupDiv.appendChild(btn);
        marker.bindPopup(popupDiv);
        marker.addTo(layerGroup);
      });
    }

  }, [junctions, hotspots, filter, heatScriptLoaded, onSelectJunction]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: 550 }}>
      {/* Filters HUD */}
      <div style={{
        display: "flex", gap: 8, padding: "10px 14px", 
        background: "var(--bg1)", border: "1px solid var(--border)", 
        borderRadius: 8, alignItems: "center"
      }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--t2)" }}>Map Overlays:</span>
        {[
          ["heatmap", "🔥 Visual Heatmap"],
          ["all", "📍 Junction Pins"],
          ["commercial", "🚚 Commercial Focus"],
          ["blockage", "🚧 Carriageway Blockages"]
        ].map(([v, label]) => (
          <button key={v} onClick={() => setFilter(v)} style={{
            fontSize: 11, padding: "5px 12px", borderRadius: 4,
            border: `1px solid ${filter === v ? "#378ADD" : "var(--border)"}`,
            background: filter === v ? "rgba(55,138,221,0.08)" : "var(--bg1)",
            color: filter === v ? "#378ADD" : "var(--t2)",
            fontWeight: filter === v ? 600 : 400,
            cursor: "pointer",
            transition: "all 0.15s ease"
          }}>{label}</button>
        ))}
      </div>

      {/* Map Canvas */}
      <div style={{ position: "relative", flex: 1, minHeight: 450, borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)" }}>
        <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />
        
        {/* Dynamic Legend */}
        <div style={{
          position: "absolute", bottom: 12, right: 12, zIndex: 1000,
          background: "rgba(255,255,255,0.95)", border: "1px solid #ddd",
          borderRadius: 6, padding: "10px 12px", fontSize: 10, fontFamily: "sans-serif",
          display: "flex", flexDirection: "column", gap: 6, boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
        }}>
          {filter === "heatmap" ? (
            <>
              <div style={{ fontWeight: 600, color: "#333", marginBottom: 2 }}>Violation Density</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 12, height: 12, background: "#FF3B30", borderRadius: 2 }} /> Critical Surge
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 12, height: 12, background: "#EF9F27", borderRadius: 2 }} /> High Density
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 12, height: 12, background: "#639922", borderRadius: 2 }} /> Moderate
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 12, height: 12, background: "#378add", borderRadius: 2 }} /> Low Density
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 600, color: "#333", marginBottom: 2 }}>CIS Severity</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#E24B4A" }} /> Critical (≥ 7.5)
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#EF9F27" }} /> High (≥ 5.0)
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#378ADD" }} /> Moderate (≥ 2.5)
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#639922" }} /> Low
              </div>
              <div style={{ borderTop: "1px solid #eee", marginTop: 4, paddingTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 14, height: 14, borderRadius: "50%", background: "rgba(255,59,48,0.18)", border: "1px solid #FF3B30" }} /> Hotspot Zone
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import L from "leaflet";

// Helpers
function cisColor(cis) {
  if (cis >= 7.5) return "#B42318";
  if (cis >= 5) return "#C79200";
  if (cis >= 2.5) return "#3B7D3A";
  return "#2E6B2E";
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
      
        // Use a neutral light tile layer to match the official dashboard style.
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
            0.1: "#2E6B2E",
            0.4: "#3B7D3A",
            0.6: "#C79200",
            0.8: "#C79200",
            1.0: "#B42318"
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
          <div style="font-family: Segoe UI, Arial, sans-serif; min-width: 200px;">
            <h4 style="margin: 0 0 6px 0; color: #B42318; font-size: 14px;">Hotspot Cluster #${h.cluster_id}</h4>
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
          <h4 style="margin: 0 0 4px 0; color: #1b1b1b; font-size: 13px;">${j.n}</h4>
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
        btn.style.background = "#3B7D3A";
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
        borderRadius: 4, alignItems: "center"
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--t2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Map Overlays</span>
        {[
          ["heatmap", "Visual Heatmap"],
          ["all", "Junction Pins"],
          ["commercial", "Commercial Focus"],
          ["blockage", "Carriageway Blockages"]
        ].map(([v, label]) => (
          <button key={v} onClick={() => setFilter(v)} style={{
            fontSize: 11, padding: "6px 12px", borderRadius: 4,
            border: `1px solid ${filter === v ? "var(--accent)" : "var(--border)"}`,
            background: filter === v ? "rgba(59,125,58,0.08)" : "var(--bg1)",
            color: filter === v ? "var(--accent)" : "var(--t2)",
            fontWeight: filter === v ? 600 : 500,
            cursor: "pointer",
            transition: "all 0.15s ease"
          }}>{label}</button>
        ))}
      </div>

      {/* Map Canvas */}
      <div style={{ position: "relative", flex: 1, minHeight: 450, borderRadius: 4, overflow: "hidden", border: "1px solid var(--border)" }}>
        <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />
        
        {/* Dynamic Legend */}
        <div style={{
          position: "absolute", bottom: 12, right: 12, zIndex: 1000,
          background: "rgba(255,255,255,0.96)", border: "1px solid var(--border)",
          borderRadius: 4, padding: "10px 12px", fontSize: 10, fontFamily: "Segoe UI, Arial, sans-serif",
          display: "flex", flexDirection: "column", gap: 6, boxShadow: "none"
        }}>
          {filter === "heatmap" ? (
            <>
              <div style={{ fontWeight: 600, color: "#333", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.05em" }}>Violation Density</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 12, height: 12, background: "#B42318", borderRadius: 2 }} /> Critical Surge
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 12, height: 12, background: "#C79200", borderRadius: 2 }} /> High Density
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 12, height: 12, background: "#3B7D3A", borderRadius: 2 }} /> Moderate
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 12, height: 12, background: "#2E6B2E", borderRadius: 2 }} /> Low Density
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 600, color: "#333", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.05em" }}>CIS Severity</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#B42318" }} /> Critical (≥ 7.5)
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#C79200" }} /> High (≥ 5.0)
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#3B7D3A" }} /> Moderate (≥ 2.5)
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#2E6B2E" }} /> Low
              </div>
              <div style={{ borderTop: "1px solid var(--border)", marginTop: 4, paddingTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 14, height: 14, borderRadius: "50%", background: "rgba(180,35,24,0.18)", border: "1px solid #B42318" }} /> Hotspot Zone
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

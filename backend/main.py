"""
FastAPI Backend
"""
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import json

app = FastAPI(title="Gridlock API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = Path(__file__).parent / "data" / "processed"

def load(filename):
    return json.loads((DATA_DIR / filename).read_text())

# ── Cache on startup ────────────────────────────────────────────
_cache = {}

@app.on_event("startup")
def load_cache():
    _cache["junctions"] = load("junctions.json")
    _cache["temporal"] = load("temporal.json")
    _cache["clusters"] = load("clusters.json")
    print(f"Loaded: {len(_cache['junctions'])} junctions, {len(_cache['clusters'])} clusters")

# ── Endpoints ───────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "API running"}

@app.get("/junctions")
def get_junctions(limit: int = 50):
    """All junctions sorted by CIS score descending."""
    return _cache["junctions"][:limit]

@app.get("/junctions/{junction_name}")
def get_junction(junction_name: str):
    """Single junction detail by name or BTP code."""
    junctions = _cache["junctions"]
    for j in junctions:
        if junction_name.lower() in j["junction_name"].lower():
            return j
    return {"error": "Junction not found"}

@app.get("/hotspots")
def get_hotspots(limit: int = 50, min_violations: int = 100):
    """Top grid-based hotspot clusters."""
    clusters = [c for c in _cache["clusters"] if c["violation_count"] >= min_violations]
    return clusters[:limit]

@app.get("/temporal")
def get_temporal():
    """City-wide hourly/daily patterns."""
    return _cache["temporal"]

@app.get("/summary")
def get_summary():
    """Dashboard top-line stats."""
    junctions = _cache["junctions"]
    temporal = _cache["temporal"]
    clusters = _cache["clusters"]

    critical = [j for j in junctions if j.get("risk_level") == "CRITICAL"]
    high = [j for j in junctions if j.get("risk_level") == "HIGH"]

    return {
        "total_violations": temporal["total_violations"],
        "junctions_monitored": len(junctions),
        "hotspot_clusters": len([c for c in clusters if c["violation_count"] >= 100]),
        "critical_junctions": len(critical),
        "high_risk_junctions": len(high),
        "peak_hour": max(temporal["hourly_city"], key=temporal["hourly_city"].get) if temporal.get("hourly_city") else "0",
        "top_junction": junctions[0]["junction_name"] if junctions else None,
        "top_station": max(temporal["station_counts"], key=temporal["station_counts"].get) if temporal.get("station_counts") else None,
    }

@app.get("/action-card/{junction_name}")
def get_action_card(junction_name: str, hour: int = Query(default=9)):
    """
    Returns a structured action card for a junction at a given hour.
    Used by dashboard and Telegram bot (non-AI version).
    """
    junctions = _cache["junctions"]
    junction = None
    for j in junctions:
        if junction_name.lower() in j["junction_name"].lower():
            junction = j
            break

    if not junction:
        return {"error": "Junction not found"}

    hourly = junction.get("hourly_pattern", {})
    current_violations = hourly.get(str(hour), 0)
    next_hour_violations = hourly.get(str((hour + 1) % 24), 0)
    trend = "ESCALATING" if next_hour_violations > current_violations else "STABLE"

    top_vtype = list(junction["top_violations"].keys())[0] if junction["top_violations"] else "WRONG PARKING"
    top_vehicle = list(junction["vehicle_breakdown"].keys())[0] if junction["vehicle_breakdown"] else "SCOOTER"
    commercial = any(v in junction["vehicle_breakdown"] for v in ["MAXI-CAB", "LGV", "HTV", "HGV"])

    risk = junction.get("risk_level", "MODERATE")
    cis = junction.get("cis", 5.0)

    return {
        "junction": junction["junction_name"],
        "police_station": junction["police_station"],
        "cis": cis,
        "risk_level": risk,
        "current_hour_violations": current_violations,
        "trend": trend,
        "recommended_action": {
            "priority": "IMMEDIATE" if risk in ["CRITICAL", "HIGH"] else "ROUTINE",
            "unit_type": "COMMERCIAL VEHICLE UNIT + CHALLAN TEAM" if commercial else "CHALLAN UNIT",
            "officers_recommended": 3 if risk == "CRITICAL" else 2 if risk == "HIGH" else 1,
            "towing_required": top_vtype in ["PARKING IN A MAIN ROAD", "DOUBLE PARKING"],
        },
        "top_violation": top_vtype,
        "top_vehicle": top_vehicle,
        "commercial_vehicle_flag": commercial,
        "lat": junction["lat"],
        "lng": junction["lng"],
    }
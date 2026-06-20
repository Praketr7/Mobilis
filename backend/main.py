"""
FastAPI Backend
"""
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import json
from dotenv import load_dotenv

# Load environment variables from the .env file in the workspace root
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

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


def normalize_hour_key(value):
    try:
        return str(int(float(value)))
    except (TypeError, ValueError):
        return str(value)


def normalize_hour_map(hour_map):
    return {
        normalize_hour_key(key): int(value)
        for key, value in (hour_map or {}).items()
    }

# ── Cache on startup ────────────────────────────────────────────
_cache = {}

@app.on_event("startup")
def load_cache():
    junctions = load("junctions.json")
    for junction in junctions:
        junction["peak_hour"] = int(float(junction.get("peak_hour", 0)))
        junction["hourly_pattern"] = normalize_hour_map(junction.get("hourly_pattern"))

    temporal = load("temporal.json")
    temporal["hourly_city"] = normalize_hour_map(temporal.get("hourly_city"))

    _cache["junctions"] = junctions
    _cache["temporal"] = temporal
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


from pydantic import BaseModel
from typing import List, Optional
import os
from groq import Groq

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = None

SYSTEM_PROMPT = """You are Assistant, a helpful and tactical decision support chatbot for Bengaluru Traffic Police (BTP) officers.

You have access to live BTP parking violation intelligence and deployment data.

Guidelines:
1. For casual greetings, thanks, or general conversation, respond naturally, professionally, and politely (e.g., "You're welcome! Let me know if you need any other deployment insights.").
2. Keep it protected: refuse to engage in inappropriate, illegal, or completely irrelevant off-topic queries.
3. When asked traffic, deployment, or junction status questions, format your response in a highly structured, concise manner matching the dashboard's deployment card style:
   - **Junction**: <Name> (CIS: <Score>/10 | <Risk Level> Risk)
   - **Deployment**: Deploy <Unit Type> (e.g. Challan unit or Commercial vehicle unit) by <Peak Hour>:00.
   - **Peak Window**: <Peak Hour>:00 to <Peak Hour + 2>:00
   - **Advisories**: (Add towing vehicle coordinates or commercial coordination flag only if relevant, based on the top violation types or vehicle breakdown ratios).
4. Emojis must be avoided as much as possible. Responses should remain concise, professional, and directly informative. No hedging, warnings, or disclaimers.
"""

@app.post("/chat")
def chat_query(payload: ChatRequest):
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return {
            "response": "⚠️ Groq API key is not configured. Please set the GROQ_API_KEY environment variable in your .env file."
        }

    # Fetch live context to pass to Groq
    junctions = _cache.get("junctions", [])
    temporal = _cache.get("temporal", {})

    import datetime
    now_hour = datetime.datetime.now().hour
    now_day = datetime.datetime.now().strftime("%A")

    context_blob = {
        "current_time": {"hour": now_hour, "day": now_day},
        "top_junctions": [
            {
                "junction_name": j["junction_name"],
                "police_station": j["police_station"],
                "violation_count": j["violation_count"],
                "cis": j["cis"],
                "risk_level": j["risk_level"],
                "peak_hour": j["peak_hour"],
                "top_violations": j["top_violations"]
            }
            for j in junctions[:15]
        ],
        "hourly_city": temporal.get("hourly_city", {}),
        "station_counts": temporal.get("station_counts", {})
    }

    user_prompt = f"""Current time context:
Day: {now_day}, Hour: {now_hour:02d}:00

Live Gridlock data context:
{json.dumps(context_blob, indent=2)}

Officer query: {payload.message}"""

    # Build messages array
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    if payload.history:
        for msg in payload.history:
            # map roles properly (e.g. system, user, assistant)
            messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": user_prompt})

    try:
        client = Groq(api_key=api_key)
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            max_tokens=800,
            messages=messages,
            temperature=0.2,
        )
        return {"response": response.choices[0].message.content}
    except Exception as e:
        return {"response": f"⚠️ Error querying Groq: {str(e)}"}
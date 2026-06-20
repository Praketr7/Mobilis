import json
from pathlib import Path
import datetime

DATA_DIR = Path(__file__).parent.parent / "backend" / "data" / "processed"

def generate_daily_brief_text():
    """
    Generates a structured text briefing for the Telegram channel.
    Reads preprocessed JSON files directly to avoid external API calls.
    """
    try:
        junctions = json.loads((DATA_DIR / "junctions.json").read_text())
        clusters = json.loads((DATA_DIR / "clusters.json").read_text())
    except Exception as e:
        return f"⚠️ Error loading briefing data: {str(e)}"

    now = datetime.datetime.now()
    current_day = now.strftime("%A")

    top_5 = junctions[:5]
    active_clusters = [c for c in clusters if c.get("violation_count", 0) >= 100]

    brief = []
    brief.append(f"🌅 *Gridlock Morning Brief — {current_day}, {now.strftime('%d %b %Y')}*")
    brief.append("\n*TOP 5 ACTIVE HOTSPOTS TODAY:*")
    
    for idx, j in enumerate(top_5):
        top_v = list(j.get("top_violations", {}).keys())[0] if j.get("top_violations") else "WRONG PARKING"
        brief.append(f"{idx+1}. {j['junction_name']} — *{j['risk_level']}* (Peak: {j['peak_hour']}:00, Top: {top_v})")

    brief.append("\n*DEPLOYMENT ADVISORY:*")
    brief.append(f"• *Upparpet station:* Prioritize patrols at {top_5[0]['junction_name']} and {top_5[1]['junction_name']}.")
    
    lgv_hotspots = [j['junction_name'] for j in top_5 if any(k in j.get("vehicle_breakdown", {}) for k in ["LGV", "MAXI-CAB"])]
    if lgv_hotspots:
        brief.append(f"• *City Market station:* Coordinate commercial checkpoints at: {', '.join(lgv_hotspots[:2])}.")

    brief.append("\n*VEHICLE TYPE & TOWING ADVISORY:*")
    brief.append(f"• Towing vehicle recommended at: {top_5[0]['junction_name']} (Main Road obstruction).")
    brief.append(f"• Active hotspot clusters detected: {len(active_clusters)} zone(s) across the city.")

    return "\n".join(brief)

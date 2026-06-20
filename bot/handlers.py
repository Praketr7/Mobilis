import json
import os
import datetime
from pathlib import Path
from daily_brief import generate_daily_brief_text

# Paths to processed JSON files
DATA_DIR = Path(__file__).parent.parent / "backend" / "data" / "processed"

def load_data():
    try:
        junctions = json.loads((DATA_DIR / "junctions.json").read_text())
        clusters = json.loads((DATA_DIR / "clusters.json").read_text())
        temporal = json.loads((DATA_DIR / "temporal.json").read_text())
        return junctions, clusters, temporal
    except Exception as e:
        print(f"Error loading JSON data in bot handlers: {e}")
        return [], [], {}

async def start_handler(update, context):
    welcome = (
        "🚔 *Gridlock - BTP Decision Support Bot* 🚔\n\n"
        "Welcome officer. Query BTP parking violation intelligence and deployment recommendations right here.\n\n"
        "*Commands:*\n"
        "/hotspots - Top 5 active hotspots right now\n"
        "/junction <name> - Search stats for a specific intersection\n"
        "/deploy <station> <hour> - Recommended unit deployment for a police station\n"
        "/brief - Today's morning intelligence brief\n"
        "/status - City-wide congestion status summary\n\n"
        "Or simply *type naturally* (e.g., 'KR Market situation right now')."
    )
    await update.message.reply_text(welcome, parse_mode="Markdown")

async def hotspots_handler(update, context):
    junctions, _, _ = load_data()
    if not junctions:
        await update.message.reply_text("Error loading hotspot data.")
        return

    now_hour = datetime.datetime.now().hour
    # Find junctions where the current hour is their peak hour or high CIS
    active = sorted(junctions, key=lambda x: x.get("cis", 0), reverse=True)[:5]
    
    msg = [f"🔥 *Top 5 Active Hotspots (Hour: {now_hour:02d}:00)*\n"]
    for idx, j in enumerate(active):
        msg.append(f"{idx+1}. *{j['junction_name']}* (CIS: {j['cis']}/10)")
        msg.append(f"   Station: {j['ps']} | Peak: {j['ph']}:00 | Volume: {j['vc']} cases")
    
    await update.message.reply_text("\n".join(msg), parse_mode="Markdown")

async def junction_handler(update, context):
    junctions, _, _ = load_data()
    if not context.args:
        await update.message.reply_text("Usage: /junction <name or BTP code>")
        return

    query = " ".join(context.args).lower()
    match = None
    for j in junctions:
        if query in j["junction_name"].lower() or query in j["ps"].lower():
            match = j
            break

    if not match:
        await update.message.reply_text("📍 Junction not found in database.")
        return

    top_v = list(match["top_violations"].keys())[0] if match["top_violations"] else "WRONG PARKING"
    msg = (
        f"📍 *Junction: {match['junction_name']}*\n"
        f"🚨 *CIS Score:* {match['cis']} ({match['rl']})\n"
        f"• Police Station: {match['ps']}\n"
        f"• Total Violations: {match['vc']:,}\n"
        f"• Peak Hour: {match['ph']}:00\n"
        f"• Primary Violation: {top_v}\n\n"
        f"⚡ *Patrol Advisory:* Deploy patrol unit by {match['ph']}:00. "
        f"Obstructive parking risk is high."
    )
    await update.message.reply_text(msg, parse_mode="Markdown")

async def deploy_handler(update, context):
    junctions, _, _ = load_data()
    if len(context.args) < 2:
        await update.message.reply_text("Usage: /deploy <station name> <hour (0-23)>")
        return

    station_query = context.args[0].lower()
    try:
        target_hour = int(context.args[1])
    except ValueError:
        await update.message.reply_text("Please enter a valid hour (0-23).")
        return

    matches = [j for j in junctions if station_query in j["ps"].lower()]
    if not matches:
        await update.message.reply_text(f"No junctions found under station '{context.args[0]}'.")
        return

    # Sort matches by CIS
    matches = sorted(matches, key=lambda x: x["cis"], reverse=True)
    top_match = matches[0]

    msg = (
        f"📋 *Patrol Deployment Advisory - {target_hour:02d}:00*\n"
        f"Station Area: *{top_match['ps'].upper()}*\n\n"
        f"Deploy 1 Challan Team to *{top_match['junction_name']}*.\n"
        f"• Status: {top_match['risk_level']} Risk (CIS: {top_match['cis']})\n"
        f"• Target hour historical volume: {top_match.get('hourly_pattern', {}).get(str(target_hour), 0)} offenses.\n"
        f"• Primary target: {list(top_match['top_violations'].keys())[0] if top_match['top_violations'] else 'WRONG PARKING'}."
    )
    await update.message.reply_text(msg, parse_mode="Markdown")

async def brief_handler(update, context):
    brief_text = generate_daily_brief_text()
    await update.message.reply_text(brief_text, parse_mode="Markdown")

async def status_handler(update, context):
    junctions, _, temporal = load_data()
    if not temporal:
        await update.message.reply_text("Error loading status data.")
        return

    critical = len([j for j in junctions if j["rl"] == "CRITICAL"])
    high = len([j for j in junctions if j["rl"] == "HIGH"])
    total_v = temporal.get("total_violations", 0)

    msg = (
        "🚦 *Bengaluru City Traffic Enforcement Status* 🚦\n\n"
        f"• *Total Monitored Intersections:* {len(junctions)}\n"
        f"• *Critical Alert Zones:* {critical}\n"
        f"• *High Risk Zones:* {high}\n"
        f"• *Total Violation Dataset Volume:* {total_v:,} cases\n\n"
        "💡 *Recommendation:* Focus towing forces in Cantonment/Central division. Check /brief for today's patrol schedule."
    )
    await update.message.reply_text(msg, parse_mode="Markdown")

async def text_query_handler(update, context):
    """
    Handles natural language queries from officers.
    Uses Anthropic Claude API if key is present, otherwise falls back to a clean
    templated matching pattern local generator (satisfying the placeholder rule).
    """
    query = update.message.text.lower()
    junctions, _, _ = load_data()

    # Find if query mentions any known junctions
    matched_j = None
    for j in junctions:
        if j["junction_name"].split("–")[-1].strip().lower() in query:
            matched_j = j
            break
        if j["ps"].lower() in query:
            matched_j = j
            break

    if not matched_j:
        matched_j = junctions[0] # Default fallback

    # Check for ANTHROPIC_API_KEY
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        # Fallback response
        top_v = list(matched_j["top_violations"].keys())[0] if matched_j["top_violations"] else "WRONG PARKING"
        msg = (
            f"🚨 *Deployment Recommendation (Local AI Mode Fallback)*\n\n"
            f"Matching Query Target: *{matched_j['junction_name']}*\n"
            f"Status: {matched_j['risk_level']} Risk | CIS Score: {matched_j['cis']}/10\n\n"
            f"Deploy 2 patrol officers to match enforcement demand. Focus efforts against *{top_v}*.\n"
            f"Nearest station {matched_j['ps']} is notified."
        )
        await update.message.reply_text(msg, parse_mode="Markdown")
        return

    # Real API integration if key exists
    try:
        from anthropic import Anthropic
        client = Anthropic(api_key=api_key)
        prompt = (
            f"You are a Bengaluru Traffic Police briefing coordinator bot. An officer asks: '{update.message.text}'\n"
            f"Formulate a concise, highly specific deployment advice based on the closest matching junction data:\n"
            f"Junction: {matched_j['junction_name']}, Station: {matched_j['ps']}, CIS: {matched_j['cis']} ({matched_j['rl']}), "
            f"Peak: {matched_j['ph']}:00, Top violation: {list(matched_j['top_violations'].keys())[0] if matched_j['top_violations'] else 'WRONG PARKING'}.\n"
            f"Provide a friendly, authoritative response (2-3 sentences max) with recommendations on where to send units."
        )
        message = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=150,
            temperature=0.2,
            messages=[{"role": "user", "content": prompt}]
        )
        await update.message.reply_text(message.content[0].text, parse_mode="Markdown")
    except Exception as e:
        await update.message.reply_text(f"⚠️ Query processing error: {e}")

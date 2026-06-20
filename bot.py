"""
Gridlock Telegram Bot
─────────────────────
Setup:
    pip install python-telegram-bot anthropic httpx python-dotenv

Environment variables (create a .env file or export):
    TELEGRAM_BOT_TOKEN=<your bot token from @BotFather>
    ANTHROPIC_API_KEY=<your Anthropic key>
    GRIDLOCK_API=http://localhost:8000   # your FastAPI backend

Run:
    python bot.py
"""

import os
import json
import logging
import asyncio
from datetime import datetime
from dotenv import load_dotenv

import httpx
import anthropic
from telegram import Update, BotCommand
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    ContextTypes,
    filters,
)
from telegram.constants import ParseMode

load_dotenv()

TELEGRAM_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
ANTHROPIC_KEY  = os.environ["ANTHROPIC_API_KEY"]
API_BASE       = os.environ.get("GRIDLOCK_API", "http://localhost:8000")

logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    level=logging.INFO,
)
log = logging.getLogger("gridlock_bot")

ai_client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_KEY)


# ── API helpers ────────────────────────────────────────────────

async def api(path: str, params: dict = None) -> dict | list:
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(f"{API_BASE}{path}", params=params)
        r.raise_for_status()
        return r.json()


def risk_emoji(rl: str) -> str:
    return {"CRITICAL": "🔴", "HIGH": "🟠", "MODERATE": "🔵", "LOW": "🟢"}.get(rl, "⚪")


def cis_bar(cis: float) -> str:
    filled = round(cis)
    return "█" * filled + "░" * (10 - filled)


def fmt_violations(n: int) -> str:
    return f"{n:,}"


# ── /start ─────────────────────────────────────────────────────

async def cmd_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    text = (
        "🛡 *Gridlock — BTP Enforcement Intelligence*\n\n"
        "Built for field officers and station in-charges\\.\n\n"
        "*Commands:*\n"
        "`/hotspots` — Top 5 active hotspots right now\n"
        "`/junction <name>` — Full intel card for a junction\n"
        "`/deploy <station> <time>` — Deployment recommendation\n"
        "`/brief` — Morning intelligence briefing\n"
        "`/status` — City\\-wide congestion summary\n\n"
        "*AI Mode:* Just type freely\\.\n"
        "_\"Where should I send my 3 units, it's Wednesday morning\"_\n"
        "_\"KR Market situation right now\"_\n\n"
        "Powered by BTP violation data · Bengaluru Traffic Police"
    )
    await update.message.reply_text(text, parse_mode=ParseMode.MARKDOWN_V2)


# ── /hotspots ──────────────────────────────────────────────────

async def cmd_hotspots(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    now_hour = datetime.now().hour
    try:
        clusters = await api("/hotspots", {"limit": 5, "min_violations": 100})
        junctions = await api("/junctions", {"limit": 50})
    except Exception as e:
        await update.message.reply_text(f"⚠️ Could not reach API: {e}")
        return

    # Score junctions by current-hour activity
    def hour_score(j):
        hp = j.get("hourly_pattern", {})
        return hp.get(str(now_hour), 0)

    top_junctions = sorted(junctions, key=hour_score, reverse=True)[:5]

    lines = [f"🔥 *Top 5 Active Hotspots — {now_hour:02d}:00*\n"]
    for i, j in enumerate(top_junctions, 1):
        rl = j.get("risk_level", "MODERATE")
        em = risk_emoji(rl)
        hp = j.get("hourly_pattern", {})
        curr = hp.get(str(now_hour), 0)
        lines.append(
            f"{em} *{i}\\. {escape(j['junction_name'])}*\n"
            f"   CIS {j['cis']}/10 · {curr} violations this hour\n"
            f"   📍 {escape(j['police_station'])} station\n"
        )

    if clusters:
        lines.append("\n🗺 *DBSCAN Hotspot Clusters*")
        for c in clusters[:3]:
            lines.append(
                f"• Cluster \\#{c['cluster_id']} — "
                f"{fmt_violations(c['violation_count'])} violations · "
                f"Peak {c['peak_hour']}:00 · {escape(c['top_violation'])}"
            )

    await update.message.reply_text("\n".join(lines), parse_mode=ParseMode.MARKDOWN_V2)


# ── /junction <name> ───────────────────────────────────────────

async def cmd_junction(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not ctx.args:
        await update.message.reply_text("Usage: `/junction <name or BTP code>`", parse_mode=ParseMode.MARKDOWN_V2)
        return

    name = " ".join(ctx.args)
    try:
        j = await api(f"/junctions/{name}")
    except Exception as e:
        await update.message.reply_text(f"⚠️ API error: {e}")
        return

    if "error" in j:
        await update.message.reply_text(f"❌ Junction not found: *{escape(name)}*", parse_mode=ParseMode.MARKDOWN_V2)
        return

    now_hour = datetime.now().hour
    hp = j.get("hourly_pattern", {})
    curr = hp.get(str(now_hour), 0)
    nxt  = hp.get(str((now_hour + 1) % 24), 0)
    trend = "📈 ESCALATING" if nxt > curr else "📉 STABLE"

    top_v = list(j.get("top_violations", {}).items())[:3]
    top_v_lines = "\n".join(f"   • {escape(k)}: {v}" for k, v in top_v)

    vb = j.get("vehicle_breakdown", {})
    commercial = sum(vb.get(v, 0) for v in ["MAXI-CAB", "LGV", "HTV", "HGV"])
    comm_flag = "🟡 Commercial vehicles detected" if commercial > 50 else ""

    top_vtype = top_v[0][0] if top_v else ""
    tow_flag  = "🔴 Towing vehicle required" if top_vtype in ("PARKING IN A MAIN ROAD", "DOUBLE PARKING") else ""

    rl = j.get("risk_level", "MODERATE")
    em = risk_emoji(rl)

    text = (
        f"{em} *{escape(j['junction_name'])}*\n"
        f"CIS Score: `{j['cis']}/10`  {escape(cis_bar(j['cis']))}\n"
        f"Risk Level: *{rl}*  \\|  Station: {escape(j['police_station'])}\n\n"
        f"⏱ *Now \\({now_hour:02d}:00\\):* {curr} violations · {trend}\n"
        f"Peak hour: {j['peak_hour']}:00 · Total: {fmt_violations(j['violation_count'])}\n\n"
        f"📋 *Top Violations:*\n{top_v_lines}\n\n"
        f"⚡ *Deployment:* Deploy challan unit by {j['peak_hour']}:00\\.\n"
        + (f"{comm_flag}\n" if comm_flag else "")
        + (f"{tow_flag}\n" if tow_flag else "")
    )
    await update.message.reply_text(text, parse_mode=ParseMode.MARKDOWN_V2)


# ── /deploy <station> <HH> ─────────────────────────────────────

async def cmd_deploy(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if len(ctx.args) < 2:
        await update.message.reply_text(
            "Usage: `/deploy <station name> <hour>`\nExample: `/deploy Upparpet 9`",
            parse_mode=ParseMode.MARKDOWN_V2
        )
        return

    hour_str = ctx.args[-1]
    station  = " ".join(ctx.args[:-1])
    try:
        hour = int(hour_str)
    except ValueError:
        await update.message.reply_text("⚠️ Hour must be a number (0–23)")
        return

    try:
        junctions = await api("/junctions", {"limit": 100})
    except Exception as e:
        await update.message.reply_text(f"⚠️ API error: {e}")
        return

    # Filter by station (fuzzy)
    station_junctions = [
        j for j in junctions
        if station.lower() in j.get("police_station", "").lower()
    ]

    if not station_junctions:
        await update.message.reply_text(f"❌ No junctions found for station: *{escape(station)}*", parse_mode=ParseMode.MARKDOWN_V2)
        return

    def deploy_score(j):
        hp = j.get("hourly_pattern", {})
        return hp.get(str(hour), 0) * j.get("cis", 0)

    ranked = sorted(station_junctions, key=deploy_score, reverse=True)[:4]

    lines = [f"🚨 *Deployment Recommendation — {escape(station)} · {hour:02d}:00*\n"]
    for i, j in enumerate(ranked, 1):
        hp   = j.get("hourly_pattern", {})
        curr = hp.get(str(hour), 0)
        rl   = j.get("risk_level", "MODERATE")
        em   = risk_emoji(rl)
        vb   = j.get("vehicle_breakdown", {})
        commercial = sum(vb.get(v, 0) for v in ["MAXI-CAB", "LGV", "HTV", "HGV"])
        unit = "Challan \\+ Commercial unit" if commercial > 50 else "Challan unit"
        officers = 3 if rl == "CRITICAL" else 2 if rl == "HIGH" else 1
        lines.append(
            f"{em} *Unit {i} → {escape(j['junction_name'])}*\n"
            f"   {curr} violations at {hour:02d}:00 · CIS {j['cis']}/10\n"
            f"   Deploy: {unit} · {officers} officer{'s' if officers > 1 else ''}\n"
        )

    await update.message.reply_text("\n".join(lines), parse_mode=ParseMode.MARKDOWN_V2)


# ── /brief ─────────────────────────────────────────────────────

async def cmd_brief(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    try:
        junctions = await api("/junctions", {"limit": 100})
        temporal  = await api("/temporal")
        summary   = await api("/summary")
    except Exception as e:
        await update.message.reply_text(f"⚠️ API error: {e}")
        return

    today = datetime.now().strftime("%A, %d %b %Y")
    now_hour = datetime.now().hour

    # Top 5 by CIS
    top5 = junctions[:5]

    # Peak window analysis
    hourly = {int(k): v for k, v in temporal.get("hourly_city", {}).items()}
    peak_h = max(hourly, key=hourly.get) if hourly else 9

    # Station clusters
    station_map: dict[str, list] = {}
    for j in junctions:
        ps = j.get("police_station", "Unknown")
        station_map.setdefault(ps, []).append(j)

    top_stations = sorted(station_map.items(), key=lambda x: sum(j["cis"] for j in x[1]), reverse=True)[:3]

    lines = [
        f"🌅 *Gridlock Morning Brief — {escape(today)}*\n",
        "*TOP HOTSPOTS TODAY*"
    ]
    for i, j in enumerate(top5, 1):
        em = risk_emoji(j.get("risk_level", "MODERATE"))
        lines.append(f"{i}\\. {em} {escape(j['junction_name'])} — {j['risk_level']} \\(peak {j['peak_hour']}:00\\)")

    lines += [
        "",
        "*DEPLOYMENT ADVISORY*",
    ]
    for station, js in top_stations:
        top_j = sorted(js, key=lambda x: x["cis"], reverse=True)[:2]
        names = " \\+ ".join(escape(j["junction_name"]) for j in top_j)
        lines.append(f"• {escape(station)}: prioritise {names}")

    lines += [
        "",
        "*CITY OVERVIEW*",
        f"• Total violations on record: {fmt_violations(summary.get('total_violations', 0))}",
        f"• Critical junctions: {summary.get('critical_junctions', 0)}",
        f"• High risk junctions: {summary.get('high_risk_junctions', 0)}",
        f"• Peak surge hour today: {peak_h}:00",
    ]

    # Commercial vehicle flag
    comm_junctions = [
        j for j in junctions
        if sum(j.get("vehicle_breakdown", {}).get(v, 0) for v in ["MAXI-CAB", "LGV", "HTV", "HGV"]) > 50
    ]
    if comm_junctions:
        names = ", ".join(escape(j["junction_name"]) for j in comm_junctions[:3])
        lines += ["", "*VEHICLE TYPE ADVISORY*", f"• Commercial vehicle hotspots: {names}"]

    await update.message.reply_text("\n".join(lines), parse_mode=ParseMode.MARKDOWN_V2)


# ── /status ────────────────────────────────────────────────────

async def cmd_status(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    try:
        summary   = await api("/summary")
        temporal  = await api("/temporal")
        junctions = await api("/junctions", {"limit": 50})
    except Exception as e:
        await update.message.reply_text(f"⚠️ API error: {e}")
        return

    now_hour = datetime.now().hour
    hourly = {int(k): v for k, v in temporal.get("hourly_city", {}).items()}
    curr_load = hourly.get(now_hour, 0)
    max_load  = max(hourly.values()) if hourly else 1
    load_pct  = round(curr_load / max_load * 100)

    load_bar = "█" * (load_pct // 10) + "░" * (10 - load_pct // 10)

    critical_count  = summary.get("critical_junctions", 0)
    high_count      = summary.get("high_risk_junctions", 0)
    total_monitored = summary.get("junctions_monitored", 0)

    overall = "🔴 HIGH ALERT" if critical_count >= 3 else "🟠 ELEVATED" if high_count >= 5 else "🟢 NORMAL"

    text = (
        f"📡 *City\\-Wide Congestion Status — {now_hour:02d}:00*\n\n"
        f"Overall: *{overall}*\n"
        f"Current load: `{load_bar}` {load_pct}%\n\n"
        f"🔴 Critical junctions: {critical_count}\n"
        f"🟠 High risk junctions: {high_count}\n"
        f"📍 Total monitored: {total_monitored}\n"
        f"📊 Peak hour: {summary.get('peak_hour', '—')}:00\n\n"
        f"Top station: *{escape(summary.get('top_station', '—'))}*\n"
        f"Top junction: *{escape(summary.get('top_junction', '—'))}*"
    )
    await update.message.reply_text(text, parse_mode=ParseMode.MARKDOWN_V2)


# ── AI natural language handler ────────────────────────────────

SYSTEM_PROMPT = """You are Gridlock AI, a tactical intelligence assistant for Bengaluru Traffic Police (BTP) field officers and station in-charges.

You have been given live data from the Gridlock API (junctions, hotspots, temporal patterns, and summary stats). Use it to answer questions precisely.

Output format rules:
- Respond in plain Telegram-safe text (no markdown headers, no HTML)
- Use emojis naturally (🚨 📍 ⚡ 🔴 🟠 🟢) 
- Be concise and actionable — officers need fast answers
- Always include: junction name, CIS score, recommended unit type, and peak time where relevant
- For deployment questions: rank junctions, specify unit count, note commercial vehicle flags
- For status questions: give the current-hour context, trend, and dominant violation type

You are talking to a police officer. Be direct. No disclaimers or hedging.
"""

async def ai_query(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    text = update.message.text.strip()
    if not text:
        return

    # Fetch fresh data for AI context
    try:
        junctions = await api("/junctions", {"limit": 50})
        hotspots  = await api("/hotspots", {"limit": 20})
        summary   = await api("/summary")
        temporal  = await api("/temporal")
    except Exception as e:
        await update.message.reply_text(f"⚠️ Could not fetch data for AI context: {e}")
        return

    now_hour = datetime.now().hour
    now_day  = datetime.now().strftime("%A")

    context_blob = json.dumps({
        "current_time": {"hour": now_hour, "day": now_day},
        "summary": summary,
        "top_junctions": junctions[:20],  # top 20 by CIS
        "top_hotspots": hotspots[:10],
        "hourly_city": temporal.get("hourly_city", {}),
        "station_counts": temporal.get("station_counts", {}),
    }, indent=2)

    user_prompt = f"""Current time context:
Day: {now_day}, Hour: {now_hour:02d}:00

Live Gridlock data:
{context_blob}

Officer query: {text}"""

    # Show typing indicator
    await update.message.reply_chat_action("typing")

    try:
        response = await ai_client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=800,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )
        reply = response.content[0].text
    except Exception as e:
        log.error(f"Anthropic API error: {e}")
        await update.message.reply_text(f"⚠️ AI error: {e}")
        return

    # Split long replies (Telegram 4096 char limit)
    if len(reply) > 4000:
        reply = reply[:3997] + "…"

    await update.message.reply_text(reply)


# ── Markdown escaping for MarkdownV2 ──────────────────────────

def escape(text: str) -> str:
    """Escape special characters for Telegram MarkdownV2."""
    if not isinstance(text, str):
        text = str(text)
    special = r"\_*[]()~`>#+-=|{}.!"
    return "".join(f"\\{c}" if c in special else c for c in text)


# ── Main ───────────────────────────────────────────────────────

async def post_init(app: Application):
    await app.bot.set_my_commands([
        BotCommand("start",     "Onboarding + command guide"),
        BotCommand("hotspots",  "Top 5 active hotspots right now"),
        BotCommand("junction",  "Intel card for a junction"),
        BotCommand("deploy",    "Deployment recommendation"),
        BotCommand("brief",     "Daily intelligence briefing"),
        BotCommand("status",    "City-wide congestion status"),
    ])
    log.info("Bot commands registered.")


def main():
    app = (
        Application.builder()
        .token(TELEGRAM_TOKEN)
        .post_init(post_init)
        .build()
    )

    app.add_handler(CommandHandler("start",    cmd_start))
    app.add_handler(CommandHandler("hotspots", cmd_hotspots))
    app.add_handler(CommandHandler("junction", cmd_junction))
    app.add_handler(CommandHandler("deploy",   cmd_deploy))
    app.add_handler(CommandHandler("brief",    cmd_brief))
    app.add_handler(CommandHandler("status",   cmd_status))

    # Any non-command text → AI handler
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, ai_query))

    log.info("🛡 Gridlock bot polling…")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()

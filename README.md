# TrafficIQ 🚔
### Parking Enforcement Decision Support System for Bengaluru Traffic Police

> Built for the BTP × Flipkart Hackathon 2026 | Theme: Poor Visibility on Parking-Induced Congestion

---

## The Problem

Bengaluru Traffic Police handle parking enforcement reactively. Officers patrol fixed routes, violations are logged after the fact, and there is no system to tell a station in-charge *where to deploy units right now* or *what the next two hours will look like* at any given junction.

The result: high-violation junctions like Safina Plaza (15,449 violations) and KR Market (11,538 violations) receive the same patrol priority as low-risk zones, carriageways stay choked, and enforcement effort is wasted.

**TrafficIQ turns 298,450 historical violation records into specific, time-aware, actionable deployment decisions — delivered via a command dashboard and an embedded AI chatbot that any BTP officer can use without training.**

---

## What TrafficIQ Does

TrafficIQ has three layers:

### 1. Intelligence Engine (Python Backend)
Processes the raw BTP violation dataset and computes:
- **Spatial hotspot clusters** using DBSCAN on lat/long coordinates
- **Congestion Impact Score (CIS)** per junction — weighted by violation severity, time-of-day, and carriageway obstruction risk
- **Temporal surge patterns** — hour-of-day and day-of-week violation distributions per junction
- **Vehicle composition analysis** — identifies whether a hotspot is dominated by commercial vehicles (MAXI-CAB, LGV) or personal vehicles, which determines which enforcement unit to dispatch

### 2. Dashboard (Web)
A real-time command center for station in-charges and traffic controllers.

### 3. Embedded AI Chatbot
Field-facing interface embedded directly into the website. Officers query in natural language and receive specific action cards. The same interface can later be extended to WhatsApp integration for BTP deployment.

---

## Dataset

**Source:** BTP Violation Records (Jan–May, provided by HackerEarth)
**Records:** 298,450 violations
**Fields used:** `latitude`, `longitude`, `junction_name`, `violation_type`, `vehicle_type`, `created_datetime`, `police_station`, `validation_status`
**Date range:** November 2023 – April 2024
**Coverage:** 169 named junctions, 54 police stations across Bengaluru

### Key findings from EDA:

| Metric | Value |
|---|---|
| Total violations analyzed | 298,450 |
| Highest-risk junction | BTP051 – Safina Plaza Junction (15,449) |
| Second highest | BTP082 – KR Market Junction (11,538) |
| Peak violation hour | 5:00 AM – 6:00 AM IST |
| Highest violation day | Sunday (46,863) |
| Most common violation | Wrong Parking (164,977) |
| Carriageway-blocking violations | 23,943 (Parking in Main Road) |
| Most affected police station | Upparpet (34,468) |

### Violation type severity weights used in CIS:

| Violation | Severity Weight | Reason |
|---|---|---|
| Parking in Main Road | 1.0 | Direct carriageway blockage |
| Double Parking | 0.9 | Lane reduction |
| Parking Near Road Crossing | 0.85 | Intersection risk |
| Parking Near Traffic Light / Zebra Cross | 0.85 | Signal obstruction |
| No Parking | 0.7 | Zone violation |
| Wrong Parking | 0.6 | General obstruction |
| Parking on Footpath | 0.5 | Pedestrian displacement |
| Parking Near Bus Stop / School / Hospital | 0.5 | Zone sensitivity |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    TrafficIQ System                     │
├──────────────┬──────────────────┬───────────────────────┤
│  Data Layer  │   API Layer      │   Interface Layer     │
│              │                  │                       │
│  CSV (298K   │  FastAPI         │  React Dashboard      │
│  records)    │  /junctions      │  (station in-charge)  │
│              │  /hotspots       │                       │
│  Preprocessed│  /action-cards   │  Embedded Chatbot     │
│  JSON cache  │  /daily-brief    │  (field officers)     │
│              │  /query          │                       │
│  DBSCAN      │                  │  Groq API             │
│  clusters    │                  │  (NL decision layer)  │
└──────────────┴──────────────────┴───────────────────────┘
```

---

## Dashboard — Screens & Features

### Screen 1: Command Overview
- **Live Congestion Impact Score (CIS) leaderboard** — ranked list of all 169 junctions, updating based on current time-of-day weights
- **Status badges** per junction: `CRITICAL` / `HIGH` / `MODERATE` / `LOW`
- **Quick-deploy button** per junction that generates an instant action card
- Top-line stats: total violations in dataset, junctions monitored, active hotspot clusters, peak hour countdown

### Screen 2: Hotspot Map
- Bengaluru map (Leaflet.js) with violation density heatmap overlay
- DBSCAN cluster markers — each cluster shows: violation count, dominant violation type, dominant vehicle type, peak hour window
- Toggle between: all violations / main road blockages only / commercial vehicle violations only
- Click any junction marker → opens junction detail panel (see Screen 3)
- Color scale: green → yellow → orange → red by CIS score

### Screen 3: Junction Intelligence Panel
Triggered by clicking a junction on the map or selecting from the leaderboard.

Shows for any junction (e.g. BTP051 – Safina Plaza):
- **Violation breakdown** by type (bar chart)
- **Hourly heatmap** — 24-hour × 7-day grid showing violation intensity
- **Vehicle composition** — donut chart (Scooter / Car / Motorcycle / Auto / LGV / MAXI-CAB)
- **Historical trend** — weekly violation count over the full dataset period
- **AI Action Card** — generated by Claude API based on current time input:
  > *"It is Tuesday 9:00 AM. Deploy challan unit to BTP051 Safina Plaza by 9:15 AM. Expected surge: 47 violations/hr between 9–11 AM based on Tuesday pattern. Dominant vehicle type: SCOOTER (38%). Recommend: 2 officers on foot, 1 vehicle for towing coordination. Priority violation: Wrong Parking on main carriageway."*
- **Nearest police station** and estimated patrol response distance

### Screen 4: Temporal Analysis
- **Hour-of-day chart** — city-wide violations by hour (peak: 5–6 AM, counter-intuitive insight worth highlighting)
- **Day-of-week breakdown** — Sunday highest (46,863), Monday lowest (38,931)
- **Police station workload** — bar chart showing violation volume per station (Upparpet: 34,468 at top)
- **Time-based deployment planner** — input a time window → system outputs ranked junction priority list for that window

---

## Embedded AI Chatbot

The chatbot is designed for field officers and station in-charges who need answers quickly without navigating multiple dashboard screens.

### Natural Language Query

Officers can also just type freely:

**Input:**
> "Where should I send my 3 units, it's Wednesday morning"

**Output:**
> 🚨 **Deployment Recommendation — Wednesday 9:00 AM**
>
> **Unit 1 → BTP051 Safina Plaza Junction**
> Highest Wednesday morning surge. Avg 52 violations/hr between 9–11 AM. Dominant: Wrong Parking + Main Road Parking. Send 2 officers on foot.
>
> **Unit 2 → BTP082 KR Market Junction**
> High LGV and MAXI-CAB concentration (31%). Carriageway blockage risk. Coordinate with commercial vehicle unit.
>
> **Unit 3 → BTP044 Sagar Theatre Junction**
> Hold until 10:15 AM — Wednesday peak hits at 10:30 AM. Redeploy from Safina Plaza after initial clearance.
>
> 📍 All three junctions fall under Upparpet and City Market stations.

---

**Input:**
> "KR Market situation right now"

**Output:**
> 📍 **BTP082 – KR Market Junction**
> **CIS Score: 8.4 / 10 — HIGH RISK**
>
> Current hour (9 AM) historically logs 61 violations at this junction on Wednesdays.
> Dominant violation: No Parking (44%) + Parking in Main Road (28%)
> Vehicle mix: MAXI-CAB 24%, CAR 31%, SCOOTER 22%
>
> ⚡ **Recommended action:** Dispatch challan unit + towing vehicle. Commercial vehicle concentration requires authority to move goods vehicles. Alert City Market station.

---

### Daily Brief (auto-sent at 7 AM)

Every morning the bot pushes a briefing to subscribed station channels:

```
🌅 TrafficIQ Morning Brief — Wednesday, [Date]

TOP HOTSPOTS TODAY
1. BTP051 Safina Plaza — CRITICAL (peak: 9–11 AM)
2. BTP082 KR Market — HIGH (peak: 8–10 AM, LGV heavy)
3. BTP040 Elite Junction — HIGH (peak: 10 AM–12 PM)
4. BTP044 Sagar Theatre — MODERATE (peak: 10:30 AM)
5. BTP211 Central Street — MODERATE (peak: 9 AM)

DEPLOYMENT ADVISORY
Upparpet station: prioritize Safina Plaza + KR Market split
City Market station: KR Market commercial vehicle coordination
Malleshwaram station: Elite Junction + Subbanna Junction rotation

VEHICLE TYPE ADVISORY
Commercial vehicle (LGV/MAXI-CAB) hotspots today: KR Market, NR Road
Towing vehicle recommended at: Safina Plaza, Sagar Theatre

```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Data processing | Python, Pandas, Scikit-learn (DBSCAN) |
| Backend API | FastAPI |
| Frontend dashboard | React, Leaflet.js, Recharts |
| AI decision layer | Groq API |

---

## Operational Impact — What BTP Can Actually Decide

This is not a monitoring tool. Every output is an action.

| TrafficIQ Output | BTP Decision Enabled |
|---|---|
| Junction CIS score + peak hour window | *"Deploy unit to Safina Plaza by 9:00 AM Tuesday — 73% of violations occur before 11 AM"* |
| Main Road + Double Parking cluster | *"Carriageway obstruction imminent at KR Market — dispatch towing vehicle now"* |
| Violation velocity trending up | *"Sagar Theatre escalating — intervene before 10:30 AM peak locks in"* |
| Commercial vehicle composition flag | *"KR Market violations are 31% MAXI-CAB/LGV — coordinate commercial vehicle unit, not regular patrol"* |
| Station-to-junction distance gap | *"Anand Rao Junction is underserved — nearest assigned station is 4+ km away"* |
| Day-of-week pattern match | *"Sunday is the highest violation day citywide — increase deployment by 20% vs Monday baseline"* |
| Daily brief at 7 AM | Station in-charge walks into shift with ranked priority list, no manual analysis needed |

---

## Setup & Run

### Prerequisites
- Python 3.10+
- Node.js 18+
- Groq API Key

### Backend
```bash
cd backend
pip install -r requirements.txt
python preprocess.py              # Run once — processes CSV, outputs JSON cache
uvicorn main:app --reload
```

### Embedded AI Chatbot
```bash
cd bot
python bot.py
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Environment Variables
```
GROQ_API_KEY=
API_BASE_URL=http://localhost:8000
```

---
Built at BTP × Flipkart Hackathon 2026 — Round 2 Prototype Phase
Dataset provided by HackerEarth. Only the provided dataset was used (no external data sources).
# Gridlock — Testing and Setup Guide

This guide explains what was fixed and provides instructions on how to test the preprocessing pipeline and run the application end-to-end.

---

## 🛠 What Was Done (Bugs Fixed)

We have resolved several bugs across the stack to ensure clean runs and reliable integration:

### 1. Data Preprocessing (`backend/preprocess.py`)
* **DBSCAN eps correction**: Corrected `eps` from `0.005` (which grouped coordinates across 32 km when passed to `haversine` in radians) to `0.5 / 6371.0` (~`0.0000785` radians) to cluster hotspots correctly within a **500m radius**.
* **Flexible file lookup**: Preprocessor now automatically falls back to search for `violations_raw.csv` at the root folder if it's not present in `backend/data/`.
* **Missing `id` fallback**: Gracefully handles datasets that do not have an `id` column by using dataframe indexes.
* **Safe mode extraction**: Prevented `IndexError` by checking if `mode()` results are empty before indexing.
* **Included CIS Score 0.0**: Binned 0.0 scores into `LOW` risk (previously returned `NaN` due to default `pd.cut` exclusion).
* **Console prints formatting**: Replaced all unicode elements (like `→` and `✅`) with ASCII characters to avoid `UnicodeEncodeError` in Windows shells.

### 2. Backend API (`backend/main.py`)
* **Empty list guards**: Added guards to prevent backend crashes in `max()` lookup endpoints when temporal patterns are empty.
* **Commercial Vehicle Alignment**: Updated queries to inspect both `HTV` (Heavy Transport Vehicle) and `HGV` (Heavy Goods Vehicle) commercial vehicle types.

### 3. Frontend UI (`frontend/`)
* **Missing packages**: Added `recharts` to the `package.json` dependencies.
* **Commercial vehicle definitions**: Aligned `Dashboard.jsx`'s commercial checker to count both `HTV` and `HGV` classes.

---

## 🚀 How to Test and Run the Project

### Step 1: Preprocessing the Dataset
We have already processed your 298k row `violations_raw.csv` file using the updated script. The JSON caches are generated in `backend/data/processed/`.

If you ever wish to re-run the preprocessing on a modified dataset:
```powershell
cd backend
python preprocess.py
```
*Expected Output:*
```text
Loading CSV...
  Loaded 298,450 records
Computing junction stats...
  Saved 168 junctions -> junctions.json
Computing temporal patterns...
  Saved -> temporal.json
Running DBSCAN clustering...
  Found 47 clusters -> clusters.json

[OK] Preprocessing complete. Files in data/processed/
   junctions.json  - 168 junctions
   temporal.json   - city-wide patterns
   clusters.json   - 47 hotspot clusters
```

---

### Step 2: Start the Backend API
Start the FastAPI server:
```powershell
cd backend
uvicorn main:app --reload
```
Once running, verify it's working by opening: [http://localhost:8000/summary](http://localhost:8000/summary)

---

### Step 3: Run the Frontend
We have already installed the NPM dependencies (including `recharts`). To start the React dashboard, open a new shell:
```powershell
cd frontend
npm run dev
```
Open the dashboard at [http://localhost:5173](http://localhost:5173).

You should see:
* **Top line metrics** loaded live from `/summary`.
* **Junction leaderboard** sorted by Congestion Impact Score.
* **Interactive charts** showing hourly surges and top violation stations.

"""
Data Preprocessing
Run once: python preprocess.py
Outputs JSON cache files consumed by FastAPI endpoints.
"""

import pandas as pd
import numpy as np
import json
import ast
from sklearn.cluster import DBSCAN
from collections import Counter
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"
OUT_DIR = DATA_DIR / "processed"
OUT_DIR.mkdir(parents=True, exist_ok=True)

SEVERITY_WEIGHTS = {
    "PARKING IN A MAIN ROAD": 1.0,
    "DOUBLE PARKING": 0.9,
    "PARKING NEAR ROAD CROSSING": 0.85,
    "PARKING NEAR TRAFFIC LIGHT OR ZEBRA CROSS": 0.85,
    "NO PARKING": 0.7,
    "WRONG PARKING": 0.6,
    "PARKING ON FOOTPATH": 0.5,
    "PARKING NEAR BUSTOP/SCHOOL/HOSPITAL ETC": 0.5,
    "PARKING OPPOSITE TO ANOTHER PARKED VEHICLE": 0.4,
}

def parse_violation_types(raw):
    try:
        return ast.literal_eval(raw) if pd.notna(raw) else []
    except:
        return []

def severity_score(vtypes):
    if not vtypes:
        return 0.3
    return max(SEVERITY_WEIGHTS.get(v, 0.3) for v in vtypes)

def compute_cis(row):
    """
    Congestion Impact Score (0–10)
    = normalized violation count × severity weight × peak hour multiplier
    """
    base = row["violation_count"] / row["max_count"]  # normalized 0-1
    sev = row["avg_severity"]
    peak_mult = 1.3 if row["peak_hour"] in range(7, 11) or row["peak_hour"] in range(17, 21) else 1.0
    return round(min(base * sev * peak_mult * 10, 10), 2)

def main():
    print("Loading CSV...")
    csv_path = DATA_DIR / "violations_raw.csv"
    df = pd.read_csv(csv_path)
    print(f"  Loaded {len(df):,} records")

    # Parse timestamps
    df["created_dt"] = pd.to_datetime(df["created_datetime"], errors="coerce", utc=True)
    df["hour"] = df["created_dt"].dt.hour
    df["day_of_week"] = df["created_dt"].dt.day_name()
    df["month"] = df["created_dt"].dt.month

    # Parse violation types
    df["vtypes"] = df["violation_type"].apply(parse_violation_types)
    df["severity"] = df["vtypes"].apply(severity_score)

    # Drop rows with no lat/long
    df = df.dropna(subset=["latitude", "longitude"])

    print("Computing junction stats...")
    # ── Junction-level aggregation ──────────────────────────────
    named = df[df["junction_name"] != "No Junction"].copy()

    junction_stats = []
    for jname, grp in named.groupby("junction_name"):
        vtypes_flat = [v for sublist in grp["vtypes"] for v in sublist]
        type_counts = Counter(vtypes_flat)
        vehicle_counts = grp["vehicle_type"].value_counts().to_dict()
        hourly = grp["hour"].value_counts().to_dict()
        daily = grp["day_of_week"].value_counts().to_dict()
        peak_hour = grp["hour"].mode()[0] if len(grp) > 0 else 9

        junction_stats.append({
            "junction_name": jname,
            "lat": round(grp["latitude"].mean(), 6),
            "lng": round(grp["longitude"].mean(), 6),
            "police_station": grp["police_station"].mode()[0] if grp["police_station"].notna().any() else "Unknown",
            "violation_count": len(grp),
            "avg_severity": round(grp["severity"].mean(), 3),
            "peak_hour": int(peak_hour),
            "top_violations": dict(type_counts.most_common(5)),
            "vehicle_breakdown": vehicle_counts,
            "hourly_pattern": {str(k): int(v) for k, v in hourly.items()},
            "daily_pattern": daily,
        })

    jdf = pd.DataFrame(junction_stats)
    jdf["max_count"] = jdf["violation_count"].max()
    jdf["cis"] = jdf.apply(compute_cis, axis=1)
    jdf["risk_level"] = pd.cut(
        jdf["cis"],
        bins=[0, 2.5, 5, 7.5, 10],
        labels=["LOW", "MODERATE", "HIGH", "CRITICAL"]
    )
    jdf = jdf.drop(columns=["max_count"])
    jdf = jdf.sort_values("cis", ascending=False)

    out = jdf.to_dict(orient="records")
    (OUT_DIR / "junctions.json").write_text(json.dumps(out, indent=2))
    print(f"  Saved {len(out)} junctions → junctions.json")

    print("Computing temporal patterns...")
    # ── City-wide temporal patterns ──────────────────────────────
    hourly_city = df["hour"].value_counts().sort_index().to_dict()
    daily_city = df["day_of_week"].value_counts().to_dict()
    station_counts = df["police_station"].value_counts().head(15).to_dict()

    temporal = {
        "hourly_city": {str(k): int(v) for k, v in hourly_city.items()},
        "daily_city": daily_city,
        "station_counts": station_counts,
        "total_violations": len(df),
        "date_range": {
            "start": str(df["created_dt"].min()),
            "end": str(df["created_dt"].max()),
        }
    }
    (OUT_DIR / "temporal.json").write_text(json.dumps(temporal, indent=2))
    print("  Saved → temporal.json")

    print("Running DBSCAN clustering...")
    # ── Spatial clustering ───────────────────────────────────────
    # Sample 50K rows for clustering to keep memory reasonable
    sample_df = df.sample(n=min(50000, len(df)), random_state=42)
    coords = sample_df[["latitude", "longitude"]].values
    # eps=0.005 ≈ 500m radius, min_samples=30
    db = DBSCAN(eps=0.005, min_samples=30, algorithm="ball_tree", metric="haversine").fit(
        np.radians(coords)
    )
    sample_df = sample_df.copy()
    sample_df["cluster"] = db.labels_
    df = df.merge(sample_df[["id", "cluster"]], on="id", how="left")
    df["cluster"] = df["cluster"].fillna(-1).astype(int)

    clusters = []
    for cid in sorted(df["cluster"].unique()):
        if cid == -1:
            continue
        cgrp = df[df["cluster"] == cid]
        vtypes_flat = [v for sublist in cgrp["vtypes"] for v in sublist]
        type_counts = Counter(vtypes_flat)
        clusters.append({
            "cluster_id": int(cid),
            "lat": round(cgrp["latitude"].mean(), 6),
            "lng": round(cgrp["longitude"].mean(), 6),
            "violation_count": len(cgrp),
            "top_violation": type_counts.most_common(1)[0][0] if type_counts else "UNKNOWN",
            "top_vehicle": cgrp["vehicle_type"].mode()[0] if len(cgrp) > 0 else "UNKNOWN",
            "peak_hour": int(cgrp["hour"].mode()[0]) if len(cgrp) > 0 else 9,
            "severity": round(cgrp["severity"].mean(), 3),
        })

    clusters_sorted = sorted(clusters, key=lambda x: x["violation_count"], reverse=True)
    (OUT_DIR / "clusters.json").write_text(json.dumps(clusters_sorted, indent=2))
    print(f"  Found {len(clusters_sorted)} clusters → clusters.json")

    print("\n✅ Preprocessing complete. Files in data/processed/")
    print(f"   junctions.json  — {len(out)} junctions")
    print(f"   temporal.json   — city-wide patterns")
    print(f"   clusters.json   — {len(clusters_sorted)} hotspot clusters")

if __name__ == "__main__":
    main()
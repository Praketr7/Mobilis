import pandas as pd
import ast

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

import pandas as pd

def extract_temporal_patterns(df):
    """
    Extracts citywide hourly, daily, station-wide violation counts and date ranges.
    """
    hourly_city = df["hour"].value_counts().sort_index().to_dict()
    daily_city = df["day_of_week"].value_counts().to_dict()
    station_counts = df["police_station"].value_counts().head(15).to_dict()

    return {
        "hourly_city": {str(k): int(v) for k, v in hourly_city.items()},
        "daily_city": daily_city,
        "station_counts": station_counts,
        "total_violations": len(df),
        "date_range": {
            "start": str(df["created_dt"].min()),
            "end": str(df["created_dt"].max()),
        }
    }

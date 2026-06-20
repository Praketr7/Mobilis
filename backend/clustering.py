import pandas as pd
import numpy as np
from sklearn.cluster import DBSCAN
from sklearn.neighbors import BallTree
from collections import Counter

def run_dbscan_clustering(df, max_sample=50000):
    """
    Runs DBSCAN clustering on the latitude/longitude values of the dataframe.
    Returns a list of structured hotspot clusters.
    """
    # Sample rows for clustering to keep memory reasonable
    sample_df = df.sample(n=min(max_sample, len(df)), random_state=42)
    coords = sample_df[["latitude", "longitude"]].values
    
    # eps=0.005 ≈ 500m radius, min_samples=30
    # In radians: 500m / 6371000m ≈ 0.0000785
    db = DBSCAN(eps=0.0000785, min_samples=30, algorithm="ball_tree", metric="haversine").fit(
        np.radians(coords)
    )
    sample_df = sample_df.copy()
    sample_df["cluster"] = db.labels_

    # Compute centroids of the sampled clusters
    centroids = []
    for cid in sorted(sample_df["cluster"].unique()):
        if cid == -1:
            continue
        cgrp = sample_df[sample_df["cluster"] == cid]
        centroids.append({
            "cluster": cid,
            "lat": cgrp["latitude"].mean(),
            "lng": cgrp["longitude"].mean()
        })

    if centroids:
        centroid_coords = np.array([[c["lat"], c["lng"]] for c in centroids])
        centroid_rad = np.radians(centroid_coords)
        df_rad = np.radians(df[["latitude", "longitude"]].values)
        
        tree = BallTree(centroid_rad, metric="haversine")
        dists, indices = tree.query(df_rad, k=1)
        
        # Threshold of 500m in radians
        max_dist_rad = 0.5 / 6371.0
        
        assigned_clusters = []
        for dist, idx in zip(dists, indices):
            if dist[0] <= max_dist_rad:
                assigned_clusters.append(int(centroids[idx[0]]["cluster"]))
            else:
                assigned_clusters.append(-1)
        df["cluster"] = assigned_clusters
    else:
        df["cluster"] = -1

    clusters = []
    for cid in sorted(df["cluster"].unique()):
        if cid == -1:
            continue
        cgrp = df[df["cluster"] == cid]
        vtypes_flat = [v for sublist in cgrp["vtypes"] for v in sublist]
        type_counts = Counter(vtypes_flat)

        veh_mode = cgrp["vehicle_type"].dropna().mode()
        top_veh = veh_mode.iloc[0] if not veh_mode.empty else "UNKNOWN"

        hour_mode = cgrp["hour"].dropna().mode()
        peak_h = int(hour_mode.iloc[0]) if not hour_mode.empty else 9

        clusters.append({
            "cluster_id": int(cid),
            "lat": round(cgrp["latitude"].mean(), 6),
            "lng": round(cgrp["longitude"].mean(), 6),
            "violation_count": len(cgrp),
            "top_violation": type_counts.most_common(1)[0][0] if type_counts else "UNKNOWN",
            "top_vehicle": top_veh,
            "peak_hour": peak_h,
            "severity": round(cgrp["severity"].mean(), 3),
        })

    return sorted(clusters, key=lambda x: x["violation_count"], reverse=True)

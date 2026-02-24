import os
import pandas as pd
import geopandas as gpd
from pyrosm import OSM
from shapely.geometry import Point
from shapely.strtree import STRtree
import numpy as np
import seaborn as sns
import matplotlib.pyplot as plt
import ee
import geemap
import time
from tqdm import tqdm
from datetime import timedelta
from sklearn.cluster import DBSCAN
from sklearn.metrics.pairwise import haversine_distances
import sys
import math
import subprocess
from pathlib import Path
from scipy.spatial import cKDTree


FIRE_CSV = "/content/fire_events.csv"  # Upload your fire events file here
OUT_DIR = "/content/fire_distance_outputs"
os.makedirs(OUT_DIR, exist_ok=True)

ISLAND_URLS = {
    "sumatra": "https://download.geofabrik.de/asia/indonesia/sumatra-latest.osm.pbf",
    "java": "https://download.geofabrik.de/asia/indonesia/java-latest.osm.pbf",
    "kalimantan": "https://download.geofabrik.de/asia/indonesia/kalimantan-latest.osm.pbf",
    "sulawesi": "https://download.geofabrik.de/asia/indonesia/sulawesi-latest.osm.pbf",
    "maluku": "https://download.geofabrik.de/asia/indonesia/maluku-latest.osm.pbf",
    "papua": "https://download.geofabrik.de/asia/indonesia/papua-latest.osm.pbf",
    "nusa-tenggara": "https://download.geofabrik.de/asia/indonesia/nusa-tenggara-latest.osm.pbf"
}

def download_pbf(island):
    """Download PBF file for a given island if not already available."""
    url = ISLAND_URLS[island]
    out_path = f"/content/{island}.osm.pbf"
    if not os.path.exists(out_path) or os.path.getsize(out_path) < 1_000_000:
        print(f"Downloading {island} dataset ...")
        subprocess.run(f"wget -c {url} -O {out_path}", shell=True, check=True)
    print(f"{island} downloaded ({os.path.getsize(out_path)//1024**2} MB)")
    return out_path

def extract_places_osmium(pbf_path, island):
    """Extract settlement nodes (place=*) into GeoJSON."""
    out_geojson = f"/content/{island}_places.geojson"
    if os.path.exists(out_geojson):
        print(f"Settlements for {island} already extracted.")
        return out_geojson
    print(f"Extracting settlements from {island}...")
    subprocess.run(f"osmium tags-filter {pbf_path} n/place=city,town,village,hamlet,suburb,locality -o /tmp/{island}_places.pbf", shell=True, check=True)
    subprocess.run(f"osmium export /tmp/{island}_places.pbf -o {out_geojson}", shell=True, check=True)
    print(f"Exported {island} settlements to {out_geojson}")
    return out_geojson

def compute_distances(fires_gdf, places_gdf):
    """Compute nearest settlement distance using KDTree (in meters)."""
    fires = fires_gdf.to_crs(epsg=3857)
    places = places_gdf.to_crs(epsg=3857)
    coords_places = np.array([(g.x, g.y) for g in places.geometry])
    tree = cKDTree(coords_places)
    coords_fires = np.array([(g.x, g.y) for g in fires.geometry])
    dist, _ = tree.query(coords_fires, k=1)
    fires_gdf["distance_to_settlement_m"] = dist
    return fires_gdf

def process_island(island, fires_gdf):
    """Run full pipeline for one island."""
    print(f"\n Processing island: {island.upper()}")

    pbf = download_pbf(island)
    geojson = extract_places_osmium(pbf, island)

    places = gpd.read_file(geojson)
    if places.crs is None:
        places.set_crs(epsg=4326, inplace=True)

    if places.empty:
        print(f"No settlement data found for {island}. Skipping.")
        return None

    # Filter fires roughly by bounding box (to save time)
    minx, miny, maxx, maxy = places.total_bounds
    subset = fires_gdf.cx[minx:maxx, miny:maxy]
    if subset.empty:
        print(f"No fires in {island} region.")
        return None

    print(f"{len(subset)} fire events within {island} bounds.")
    subset_out = compute_distances(subset, places)
    out_csv = f"{OUT_DIR}/fire_events_with_distance_{island}.csv"
    subset_out.drop(columns="geometry").to_csv(out_csv, index=False)
    print(f"Saved: {out_csv}")
    return subset_out

fires = pd.read_csv(FIRE_CSV)
fires_gdf = gpd.GeoDataFrame(fires, geometry=gpd.points_from_xy(fires.avg_longitude, fires.avg_latitude), crs="EPSG:4326")

print(f"Total fire events loaded: {len(fires_gdf)}")

all_results = []

for island in ISLAND_URLS.keys():
    result = process_island(island, fires_gdf)
    if result is not None:
        all_results.append(result)

if all_results:
    final_df = pd.concat(all_results, ignore_index=True)
    final_out = f"{OUT_DIR}/fire_events_with_distance_all.csv"
    final_df.drop(columns="geometry", errors="ignore").to_csv(final_out, index=False)
    print(f"\n All islands processed successfully.")
    print(f"Final merged file: {final_out}")
else:
    print("No results were generated.")

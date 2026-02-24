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

cluster_df = pd.read_csv("/content/fire_events.csv")

cluster_gdf = gpd.GeoDataFrame(
    cluster_df,
    geometry=gpd.points_from_xy(cluster_df.avg_longitude, cluster_df.avg_latitude),
    crs="EPSG:4326"
)

roads_gdf = gpd.read_file("/content/indonesia_roads/indonesia_roads.shp").to_crs(epsg=4326)

cluster_gdf = cluster_gdf.to_crs(epsg=3857)
roads_gdf = roads_gdf.to_crs(epsg=3857)

nearest_matches = cluster_gdf.sjoin_nearest(
    roads_gdf,
    how="left",
    distance_col="dist_to_major_road",
)

nearest_matches = nearest_matches[~nearest_matches.index.duplicated(keep="first")]

nearest_matches = nearest_matches.loc[cluster_gdf.index]

cluster_df["dist_to_major_road"] = nearest_matches["dist_to_major_road"].values

cluster_df.head()

cluster_df.to_csv("fire_events_with_roads.csv")

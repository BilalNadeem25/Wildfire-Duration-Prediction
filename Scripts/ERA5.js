var fires = ee.FeatureCollection('projects/gen-lang-client-0216464347/assets/fire_events');

var era5 = ee.ImageCollection('ECMWF/ERA5_LAND/DAILY_AGGR');

var vars = [
  'temperature_2m_max',            // Kelvin
  'dewpoint_temperature_2m_max',   // Kelvin
  'total_precipitation_sum',       // meters
  'v_component_of_wind_10m'    // m/s
];

var extractERA5Daily = function(feature) {
  // Parse date range
  var start = ee.Date(feature.get('first_detection_date')).advance(-1, 'day');
  var end = ee.Date(feature.get('last_detection_date')).advance(1, 'day');

  // Define region of interest (5 km buffer)
  var region = feature.geometry().buffer(5000);

  // Filter ERA5 for date range and select variables
  var filtered = era5.filterDate(start, end).select(vars);

  // Temporal mean (daily images → one mean image)
  var meanImg = filtered.mean();

  // Spatial mean within buffer
  var reduced = meanImg.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: region,
    scale: 1000,
    bestEffort: true,
    maxPixels: 1e9
  });

  return feature.set({
    temperature_2m: reduced.get('temperature_2m_max'),
    dewpoint_temperature_2m: reduced.get('dewpoint_temperature_2m_max'),
    total_precipitation: reduced.get('total_precipitation_sum'),
    v_component_of_wind_10m: reduced.get('v_component_of_wind_10m')
  });
};

var results = fires.map(extractERA5Daily);

var sortedResults = results.sort('event_id');

Export.table.toDrive({
  collection: sortedResults,
  description: 'ERA5',
  fileFormat: 'CSV'
});


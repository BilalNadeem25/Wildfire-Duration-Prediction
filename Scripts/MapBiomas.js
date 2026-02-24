var fires = ee.FeatureCollection('projects/gen-lang-client-0216464347/assets/fire1000');

var mapbiomas = ee.Image('projects/mapbiomas-public/assets/indonesia/lulc/collection4/mapbiomas_indonesia_collection4_coverage_v2');

fires = fires.map(function(f) {
  var year = ee.Date(f.get('first_detection_date')).get('year');
  return f.set('year', year);
});

var bufferRadius = 5000; // 5 km buffer

var firesBuffered = fires.map(function(f) {
  return f.buffer(bufferRadius);
});

var firesWithLC = firesBuffered.map(function(f) {
  var year = ee.Number(f.get('year'));
  var bandName = ee.String('classification_').cat(year.format());
  var availableBands = mapbiomas.bandNames();
  var bandExists = availableBands.contains(bandName);

  // If year not available (after 2022), use classification_2022
  var selectedBand = ee.String(ee.Algorithms.If(bandExists, bandName, 'classification_2022'));
  var img = mapbiomas.select(selectedBand);

  // Extract majority land cover value
  var majority = img.reduceRegion({
    reducer: ee.Reducer.mode(),
    geometry: f.geometry(),
    scale: 30,
    maxPixels: 1e9
  });

    return f
    .set('LandCover_Code', majority.get(selectedBand))
    .set('LC_Year_Used', selectedBand);
});

Export.table.toDrive({
  collection: firesWithLC,
  description: 'MapBiomas',
  fileFormat: 'CSV'
});



var fires = ee.FeatureCollection("projects/gen-lang-client-0216464347/assets/fire1000");

var modis = ee.ImageCollection("MODIS/006/MOD13Q1");

var addVegetation = function(feature) {
  var start = ee.Date(feature.get('first_detection_date'));
  var end = ee.Date(feature.get('last_detection_date'));

  // Expand window ±8 days to ensure overlap with MOD13Q1 composites
  var extendedStart = start.advance(-8, 'day');
  var extendedEnd = end.advance(8, 'day');

  // Filter relevant MODIS composites
  var subset = modis
    .filterDate(extendedStart, extendedEnd)
    .filterBounds(feature.geometry());

  // Mask clouds using SummaryQA band (0=good, 1=marginal)
  var maskQA = function(image) {
    var qa = image.select('SummaryQA');
    var mask = qa.lt(2);
    return image.updateMask(mask);
  };

  subset = subset.map(maskQA);

  var meanImg = subset.mean().select(['NDVI', 'EVI']);

  var meanVals = meanImg.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: feature.geometry().buffer(5000),
    scale: 250,
    maxPixels: 1e13
  });

  var ndvi = ee.Number(meanVals.get('NDVI'));
  var evi = ee.Number(meanVals.get('EVI'));

  // Apply scaling only if values exist
  var ndviScaled = ee.Algorithms.If(ndvi, ndvi.multiply(0.0001), null);
  var eviScaled = ee.Algorithms.If(evi, evi.multiply(0.0001), null);

  // Return feature with vegetation attributes
  return feature.set({
    mean_NDVI: ndviScaled,
    mean_EVI: eviScaled
  });
};

var fires_with_veg = fires.map(addVegetation);

Export.table.toDrive({
  collection: fires_with_veg,
  description: 'MOD13Q1',
  fileFormat: 'CSV'
});

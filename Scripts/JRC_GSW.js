var fireEvents = ee.FeatureCollection("projects/gen-lang-client-0216464347/assets/fire_events");

var gsw = ee.Image("JRC/GSW1_4/GlobalSurfaceWater");

var occurrence = gsw.select('occurrence');

var permanentWater = occurrence.gt(90);

var distanceToWater = permanentWater.fastDistanceTransform(1000)
  .sqrt()
  .multiply(30)
  .rename('dist_to_water_m');

var fireWithDistance = distanceToWater.sampleRegions({
  collection: fireEvents,
  properties: fireEvents.first().propertyNames(),
  scale: 30,
  geometries: true
});

Export.table.toDrive({
  collection: fireWithDistance,
  description: 'JRC_GSW',
  fileFormat: 'CSV'
});

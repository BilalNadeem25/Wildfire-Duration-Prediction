var fires = ee.FeatureCollection('projects/gen-lang-client-0216464347/assets/fire_events');

var srtm = ee.Image("USGS/SRTMGL1_003");

var terrain = ee.Terrain.products(srtm);
var elevation = srtm.select('elevation');
var slope = terrain.select('slope');
var aspect = terrain.select('aspect');

var hotspots = ee.FeatureCollection("projects/gen-lang-client-0216464347/assets/fire_hotspots_Indonesia_with_gpw_year");

var hotspots_with_terrain = elevation.addBands(slope).addBands(aspect)
    .sampleRegions({
      collection: hotspots,
      properties: hotspots.propertyNames(),
      scale: 30,
      geometries: true
    });

Export.table.toDrive({
  collection: hotspots_with_terrain,
  description: 'SRTM',
  fileFormat: 'CSV'
});

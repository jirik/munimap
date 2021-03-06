goog.provide('munimap.source.Cluster');


goog.require('munimap.lang');


/**
 * @param {ol.Map} map
 * @param {ol.Feature} f1
 * @param {ol.Feature} f2
 * @return {number}
 */
munimap.source.Cluster.compareFn = function(map, f1, f2) {
  var m1 = munimap.marker.isMarker(map, f1);
  var m2 = munimap.marker.isMarker(map, f2);
  var result = m2 - m1;
  if (!result) {
    var n1 = f1.get(munimap.lang.getMsg(
        munimap.lang.Translations.BUILDING_TITLE_FIELD_NAME)) ||
        f1.get('polohKod') || f1.get('label') || '';
    var n2 = f2.get(munimap.lang.getMsg(
        munimap.lang.Translations.BUILDING_TITLE_FIELD_NAME)) ||
        f2.get('polohKod') || f2.get('label') || '';
    result = n1.localeCompare(n2);
  }
  return result;
};

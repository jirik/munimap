// FIXME keep cluster cache by resolution ?
// FIXME distance not respected because of the centroid

goog.provide('munimap.source.Cluster');

goog.require('goog.asserts');
goog.require('ol.Feature');
goog.require('ol.coordinate');
goog.require('ol.events.EventType');
goog.require('ol.extent');
goog.require('ol.geom.Point');
goog.require('ol.source.Vector');



/**
 * @classdesc
 * Layer source to cluster vector data.
 *
 * @constructor
 * @param {munimap.source.Cluster.Options} options Constructor options.
 * @extends {ol.source.Vector}
 * @api
 */
munimap.source.Cluster = function(options) {
  goog.base(this, {
    attributions: options.attributions,
    extent: options.extent,
    logo: options.logo,
    projection: options.projection,
    wrapX: options.wrapX
  });

  /**
   * @type {number|undefined}
   * @private
   */
  this.resolution_ = undefined;

  /**
   * @type {number}
   * @private
   */
  this.distance_ = options.distance !== undefined ? options.distance : 20;

  /**
   * @type {munimap.source.Cluster.CompareFunction|undefined}
   * @private
   */
  this.compareFn_ = options.compareFn;

  /**
   * @type {Array.<ol.Feature>}
   * @private
   */
  this.features_ = [];

  /**
   * @type {ol.source.Vector}
   * @private
   */
  this.source_ = options.source;

  this.source_.on(ol.events.EventType.CHANGE,
      munimap.source.Cluster.prototype.onSourceChange_, this);
};
goog.inherits(munimap.source.Cluster, ol.source.Vector);


/**
 * @typedef {{attributions: (Array.<ol.Attribution>|undefined),
 *     distance: (number|undefined),
 *     extent: (ol.Extent|undefined),
 *     format: (ol.format.Feature|undefined),
 *     logo: (string|undefined),
 *     projection: ol.proj.ProjectionLike,
 *     source: ol.source.Vector,
 *     wrapX: (boolean|undefined),
 *     compareFn: (munimap.source.Cluster.CompareFunction|undefined)
 *     }}
 */
munimap.source.Cluster.Options;


/**
 * @typedef {function(ol.Feature, ol.Feature): number}
 */
munimap.source.Cluster.CompareFunction;


/**
 * Get a reference to the wrapped source.
 * @return {ol.source.Vector} Source.
 * @api
 */
munimap.source.Cluster.prototype.getSource = function() {
  return this.source_;
};


/**
 * @inheritDoc
 */
munimap.source.Cluster.prototype.loadFeatures = function(extent, resolution,
    projection) {
  this.source_.loadFeatures(extent, resolution, projection);
  if (resolution !== this.resolution_) {
    this.clear();
    this.resolution_ = resolution;
    this.cluster_();
    this.addFeatures(this.features_);
  }
};


/**
 * handle the source changing
 * @private
 */
munimap.source.Cluster.prototype.onSourceChange_ = function() {
  this.clear();
  this.cluster_();
  this.addFeatures(this.features_);
  this.changed();
};


/**
 * @private
 */
munimap.source.Cluster.prototype.cluster_ = function() {
  if (this.resolution_ === undefined) {
    return;
  }
  this.features_.length = 0;
  var extent = ol.extent.createEmpty();
  var mapDistance = this.distance_ * this.resolution_;
  var features = this.source_.getFeatures();
  if (this.compareFn_) {
    features.sort(this.compareFn_);
  }

  /**
   * @type {!Object.<string, boolean>}
   */
  var clustered = {};

  /**
   * @type {Array<ol.Feature>}
   */
  var noGeometry = [];

  for (var i = 0, ii = features.length; i < ii; i++) {
    var feature = features[i];
    if (!(goog.getUid(feature).toString() in clustered)) {
      var geometry = feature.getGeometry();
      if (!geometry) {
        noGeometry.push(feature);
        continue;
      }
      var center = ol.extent.getCenter(geometry.getExtent());
      ol.extent.createOrUpdateFromCoordinate(center, extent);
      ol.extent.buffer(extent, mapDistance, extent);

      var neighbors = this.source_.getFeaturesInExtent(extent);
      goog.asserts.assert(neighbors.length >= 1, 'at least one neighbor found');
      neighbors = neighbors.filter(function(neighbor) {
        var uid = goog.getUid(neighbor).toString();
        if (!(uid in clustered)) {
          clustered[uid] = true;
          return true;
        } else {
          return false;
        }
      });
      this.features_.push(this.createCluster_(neighbors));
    }
  }
  goog.asserts.assert(
      goog.object.getCount(clustered) + noGeometry.length ==
          this.source_.getFeatures().length,
      'number of clustered equals number of features in the source');
};


/**
 * @param {Array.<ol.Feature>} features Features
 * @return {ol.Feature} The cluster feature.
 * @private
 */
munimap.source.Cluster.prototype.createCluster_ = function(features) {
  var length = features.length;
  var centroid = [0, 0];
  for (var i = 0; i < length; i++) {
    var geometry = features[i].getGeometry();
    goog.asserts.assert(!!geometry, 'feature geometry should not be null');
    var center = ol.extent.getCenter(geometry.getExtent());
    ol.coordinate.add(centroid, center);
  }
  ol.coordinate.scale(centroid, 1 / length);

  var cluster = new ol.Feature(new ol.geom.Point(centroid));
  cluster.set('features', features);
  return cluster;
};


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
    var n1 = f1.get('nazev') || f1.get('polohKod');
    var n2 = f2.get('nazev') || f2.get('polohKod');
    result = n1.localeCompare(n2);
  }
  return result;
};
'use strict';
const basemap = require('./basemap.js');

/**
  * @ngdoc module
  * @name mapManager
  * @description
  *
  * The `MapManager` module exports an object with the following properties:
  * - `Extent` {type} of esri/geometry
  * - `Map` {type} of esri/map
  * - `OverviewMap` {type} of esri/dijit/OverviewMap
  * - `Scalebar` {type} of esri/dijit/Scalebar
  * - `getExtentFromSetting {function} create an ESRI Extent object from extent setting JSON object.
  * - `setupMap` {function} interates over config settings and apply logic for any items present.
  * - `setProxy` {function} Set proxy service URL to avoid same origin issues
  */

// mapManager module, provides function to setup a map
module.exports = function (esriBundle) {
    // note: a decision was made to include esri/dijit/Scalebar here because
    // it has minimum interaction after creation, no need for the additional
    // scalebar.js
    const mapManager = {
        Extent: esriBundle.Extent,
        Map: esriBundle.Map,
        OverviewMap: esriBundle.OverviewMap,
        Scalebar: esriBundle.Scalebar,
        getExtentFromJson,
        setupMap,
        setProxy,
        mapDefault,
        findClosestLOD,
        checkBoundary
    };

    let basemapCtrl;
    let scalebarCtrl;
    let overviewMapCtrl;

    /**
     * @ngdoc method
     * @name setupMap
     * @memberof mapManager
     * @description
     * Setup map features with info provided by configuration
     * <div>
     * -- Demo: The follwoing is from description section of ngDoc --
     *
     * <h4>TODO</h4>
     * <p>Rename BasemapControl and ScalebarControl</p>
     * -- End of description section --
     * </div>
     *
     * @param {esriMap} map ESRI map object
     * @param {Object} settings JSON object of map configurations
     * @return {Object} with following properties:
     * <ul>
     *    <li>BasemapControl - an object with setBasemap function and a BasemapGallery object</li>
     *    <li>OverviewMapControl - a reference to the overviewMap control on the map</li>
     *    <li>ScalebarControl - a reference to the scalebar control on the map</li>
     * </ul>
     */
    function setupMap(map, settings) {

        // check to see if property exists in settings
        if (settings.basemaps) {

            // need to pass esriBundle to basemap module in order to use it
            // the alternative is to pass geoApi reference after creation, and then use the geoApi to
            // access the properly initialized modules.
            // or Is there an other way to do it?
            const lbasemap = basemap(esriBundle);

            // basemapCtrl is a basemap gallery object, should store this value for application use
            basemapCtrl = lbasemap.makeBasemaps(settings.basemaps, map);
        } else {
            console.warn('warning: basemaps setting does not exist');
        }

        // TODO: add code to setup scalebar
        if (settings.scalebar) {

            scalebarCtrl = new mapManager.Scalebar({
                map: map,
                attachTo: settings.scalebar.attachTo,
                scalebarUnit: settings.scalebar.scalebarUnit
            });

            scalebarCtrl.show();

        } else {
            console.warn('scalebar setting does not exists');
        }

        // TODO: add code to setup north arrow

        // Setup overview map
        if (settings.overviewMap && settings.overviewMap.enabled) {
            if (overviewMapCtrl) {
                overviewMapCtrl.destroy();
                overviewMapCtrl = null;
            }

            overviewMapCtrl = mapManager.OverviewMap({
                map: map,
                expandFactor: 1,
                visible: settings.overviewMap.enabled
            });

            overviewMapCtrl.startup();

            basemapCtrl.basemapGallery.on('selection-change', () => {
                overviewMapCtrl.destroy();

                overviewMapCtrl = mapManager.OverviewMap({
                    map: map,
                    expandFactor: 1,
                    visible: settings.overviewMap.enabled
                });

                overviewMapCtrl.startup();
            });

        } else {
            console.warn('overviewMap setting does not exist, or it\'s visible' +
                ' setting is set to false.');
        }

        // TODO: add code to setup mouse co-ordinates

        // return as object so we can use this in our geo section of fgpv
        return {
            BasemapControl: basemapCtrl,
            OverviewMapControl: overviewMapCtrl,
            ScalebarControl: scalebarCtrl
        };
    }

    /**
     * @ngdoc method
     * @name setProxy
     * @memberof mapManager
     * @description
     * Set proxy service URL to avoid same origin issues
     *
     * @param {string} proxyUrl should point to a proxy with an interface compatible with ESRI's resource proxy
     */
    function setProxy(proxyUrl) {
        esriBundle.esriConfig.defaults.io.proxyUrl = proxyUrl;
    }

    /**
     * @ngdoc method
     * @name mapDefault
     * @memberof mapManager
     * @description
     * Sets or gets map default config values.
     *
     * @param {String} key name of the default property
     * @param {Any} value value to set for the specified default property
     */
    function mapDefault(key, value) {
        if (typeof value === 'undefined') {
            return esriBundle.esriConfig.defaults.map[key];
        } else {
            esriBundle.esriConfig.defaults.map[key] = value;
        }
    }

    /**
     * @ngdoc method
     * @name getExtentFromJson
     * @memberof mapManager
     * @description
     * create an ESRI Extent object from extent setting JSON object.
     *
     * @param {object} extentJson that follows config spec
     */
    function getExtentFromJson(extentJson) {

        return esriBundle.Extent({ xmin: extentJson.xmin, ymin: extentJson.ymin,
            xmax: extentJson.xmax, ymax: extentJson.ymax,
            spatialReference: { wkid: extentJson.spatialReference.wkid } });
    }

    /**
     * @ngdoc method
     * @name findClosestLOD
     * @memberof mapManager
     * Finds the level of detail closest to the provided scale.
     *
     * @param  {Array} lods     list of levels of detail objects
     * @param  {Number} scale   scale value to search for in the levels of detail
     * @return {Object} the level of detail object closest to the scale
     */
    function findClosestLOD(lods, scale) {
        const diffs = lods.map(lod => Math.abs(lod.scale - scale));
        const lodIdx = diffs.indexOf(Math.min(...diffs));
        return lods[lodIdx];
    }

    /**
     * @ngdoc method
     * @name checkBoundary
     * @memberof mapManager
     * Checks if the given extent is outside of the maximum extent. If it is,
     * also provides an adjusted extent that is inside the maximum extent
     *
     * @param {Object} extent      an ESRI extent to test
     * @param {Object} maxExtent   an ESRI extent indicating the boundary of the map
     * @return {Object}            an object with two properties. adjusted - boolean, true if extent was adjusted. newExtent - object, adjusted ESRI extent
     */
    function checkBoundary(extent, maxExtent) {
        // clone extent
        const newExtent = esriBundle.Extent(extent.toJson());
        let flag = false;

        // determine dimensions of adjusted extent.
        // same as input, unless input is so large it consumes max.
        // in that case, we shrink to the max. This avoids the "washing machine"
        // bug where we over-correct past the valid range,
        // and achieve infinite oscillating pans
        const height = Math.min(extent.getHeight(), maxExtent.getHeight());
        const width = Math.min(extent.getWidth(), maxExtent.getWidth());
        const center = extent.getCenter();

        // test if the center of our extent is outside of the boundary
        if (center.y > maxExtent.ymax) {
            newExtent.ymax = maxExtent.ymax;
            newExtent.ymin = maxExtent.ymax - height;
            flag = true;
        } else if (center.y < maxExtent.ymin) {
            newExtent.ymin = maxExtent.ymin;
            newExtent.ymax = maxExtent.ymin + height;
            flag = true;
        }

        if (center.x > maxExtent.xmax) {
            newExtent.xmax = maxExtent.xmax;
            newExtent.xmin = maxExtent.xmax - width;
            flag = true;
        } else if (center.x < maxExtent.xmin) {
            newExtent.xmin = maxExtent.xmin;
            newExtent.xmax = maxExtent.xmin + width;
            flag = true;
        }

        return {
            newExtent,
            adjusted: flag
        };
    }

    return mapManager;
};

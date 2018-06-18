'use strict';

/**
 * Make basemap gallery based on the settings of basemap metadata.
 *
 * @function
 * @param {Object} esriBundle ESRI modules from the initial startup
 * @param {Array} basemapsConfig array of basemap settings in the form { id: string, layers: [string], title: string, thumbnailUrl: string, wkid: integer }
 * @param {esriMap} map ESRI map object
 * @return {Object} an object with the following properties:
 * <ul>
 *   <li>setBasemap {function} set current basemap with a basemap uid</li>
 *   <li>basemapGallery {object} basemapGallery object</li>
 * </ul>
 */
function initBasemaps(esriBundle, basemapsConfig, map) {

    const basemapGallery = new esriBundle.BasemapGallery({ showArcGISBasemaps: false, map });

    // iterate through basemap configs
    basemapsConfig.forEach(basemapConfig => {

        const basemap = createBasemap(esriBundle, basemapConfig);

        basemapGallery.add(basemap);
    });

    // finalize basmap gallery
    basemapGallery.startup();

    // display message
    // TODO: add ui hook? to display msg on screen
    basemapGallery.on('error', msg => { console.error(msg); });

    return basemapGallery;
}

/**
 * Create a basemap object using the config settings provided.
 *
 * @function
 * @param {Object} esriBundle ESRI modules from the initial startup
 * @param {Object} basemapConfig basemap settings in the form { id: string, layers: [string], title: string, thumbnailUrl: string, wkid: integer }
 * @return {Object} a basemap object:
 */
function createBasemap(esriBundle, basemapConfig) {
    // create basemap, add to basemap gallery
    const layers = basemapConfig.layers.map(config =>
        new esriBundle.BasemapLayer({ url: config.url, opacity: config.opacity }));

    const basemap = new esriBundle.Basemap({
        id: basemapConfig.id,
        layers: layers,
        title: basemapConfig.name,
        thumbnailUrl: basemapConfig.thumbnailUrl,
        wkid: basemapConfig.wkid
    });

    return basemap;
}

/**
  *
  * The `Basemap` module provides basemap related functions.
  *
  * This module exports an object with the following properties
  * - `Basemap` esri/dijit/Basemap class
  * - `BasemapGallery` esri/dijit/BasemapGallery class
  * - `BasemapLayer` esri/dijit/BasemapLayer class
  * - `initBasemaps` function that makes a basemap gallery based on the settings provided
  * - 'createBasemap' helper function that makes an individual basemap to be added to the gallery
  */

// Basemap related modules
module.exports = { initBasemaps, createBasemap };

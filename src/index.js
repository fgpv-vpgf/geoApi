'use strict';
const layer = require('./layer.js');
const proj = require('./proj.js');
const basemap = require('./basemap.js');
const mapManager = require('./mapManager.js');
const attribute = require('./attribute.js');
const events = require('./events.js');

function initAll(esriBundle) {
    let debug = false;
    const api = {};

    api.layer = layer(esriBundle, api);
    api.proj = proj(esriBundle);
    api.basemap = basemap(esriBundle);
    api.mapManager = mapManager(esriBundle);
    api.attribs = attribute(esriBundle);
    api.events = events();
    api.debug = function () {
        if (arguments.length === 1) {
            debug = arguments[0] === true;
        }
    };
    api.esriBundle = function () {
        if (debug) {
            return esriBundle;
        }
        throw new Error('Must set debug to directly access the bundle');
    };

    return api;
}

module.exports = function (esriLoaderUrl, window) {

    // esriDeps is an array pairing ESRI JSAPI dependencies with their imported names
    // in esriBundle
    const esriDeps = [
        ['dojo/Deferred', 'Deferred'],
        ['esri/config', 'esriConfig'],
        ['esri/dijit/Basemap', 'Basemap'],
        ['esri/dijit/BasemapGallery', 'BasemapGallery'],
        ['esri/dijit/BasemapLayer', 'BasemapLayer'],
        ['esri/dijit/Scalebar', 'Scalebar'],
        ['esri/geometry/Point', 'Point'],
        ['esri/layers/ArcGISDynamicMapServiceLayer', 'ArcGISDynamicMapServiceLayer'],
        ['esri/layers/ArcGISImageServiceLayer', 'ArcGISImageServiceLayer'],
        ['esri/layers/ArcGISTiledMapServiceLayer', 'ArcGISTiledMapServiceLayer'],
        ['esri/layers/FeatureLayer', 'FeatureLayer'],
        ['esri/layers/GraphicsLayer', 'GraphicsLayer'],
        ['esri/layers/WMSLayer', 'WmsLayer'],
        ['esri/map', 'Map'],
        ['esri/request', 'esriRequest'],
        ['esri/SpatialReference', 'SpatialReference'],
        ['esri/tasks/GeometryService', 'GeometryService'],
        ['esri/tasks/ProjectParameters', 'ProjectParameters']
    ];

    function makeDojoRequests() {
        return new Promise(function (resolve, reject) {

            // NOTE: do not change the callback to an arrow function since we don't know if
            // Dojo's require has any expectations of the scope within that function or
            // does any odd metaprogramming
            window.require(esriDeps.map(deps => deps[0]), function () {
                const esriBundle = {};

                // iterate over arguments to avoid creating an ugly giant function call
                // arguments is not an array so we do this the hard way
                for (let i = 0; i < arguments.length; ++i) {
                    esriBundle[esriDeps[i][1]] = arguments[i];
                }
                resolve(esriBundle);
            });
            window.require.on('error', reject);
        });
    }

    // the startup for this module is:
    // 1. add a script tag to load the API (this typically points to a custom ESRI build)
    // 2. load all the ESRI and Dojo dependencies `makeDojoRequests()`
    // 3. initialize all of our modules
    // everything is done in an async model and the result is a promise which resolves to
    // a reference to our API
    return new Promise(function (resolve, reject) {
        if (window.require) {
            console.warn('window.require has been set, ' +
                         'attempting to reuse existing loader with no new script tag created');
            resolve();
            return;
        }

        const oScript = window.document.createElement('script');
        const oHead = window.document.head || window.document.getElementsByTagName('head')[0];

        oScript.type = 'text\/javascript';
        oScript.onerror = err => reject(err);
        oScript.onload = () => resolve();
        oHead.appendChild(oScript);
        oScript.src = esriLoaderUrl; //'//ec.cloudapp.net/~aly/esri/dojo/dojo.js';
        console.log('made a promise');
    }).then(makeDojoRequests).then(initAll);
};

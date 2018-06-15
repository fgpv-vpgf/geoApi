'use strict';

const layerInterface = require('./layerInterface.js')();
const shared = require('./shared.js')();
const root = require('./root.js')();

/**
 * @class LayerRecord
 */
class LayerRecord extends root.Root {
    // NOTE: we used to override layerClass in each specific class.
    //       since we require the class in the generic constructor,
    //       and since it was requested that the esri class be passed in
    //       as a constructor parameter instead of holding a ref to the esriBundle,
    //       and since you must call `super` first in a constructor,
    //       it was impossible to assign the specific class before the generic
    //       constructor executed, resulting in null-dereferences.
    //       this approach solves the problem.
    get layerClass () { return this._layerClass; }
    get config () { return this.initialConfig; } // TODO: add a live config reference if needed
    get legendEntry () { return this._legendEntry; } // legend entry class corresponding to those defined in legend entry service
    set legendEntry (value) { this._legendEntry = value; } // TODO: determine if we still link legends inside this class
    get state () { return this._state; }
    set state (value) { this._state = value; }
    get layerId () { return this.config.id; }

    get rootUrl () { return this._rootUrl; }
    set rootUrl (value) { this._rootUrl = value; }

    // TODO should probably remove passthrough bindings?
    get _layerPassthroughBindings () { return ['setOpacity', 'setVisibility']; } // TODO when jshint parses instance fields properly we can change this from a property to a field
    get _layerPassthroughProperties () { return ['visibleAtMapScale', 'visible', 'spatialReference']; } // TODO when jshint parses instance fields properly we can change this from a property to a field
    get userLayer () { return this._user; } // indicates if layer was added by a user
    set userLayer (value) { this._user = value; }

    // really this is the client layer type. how it is implemented in the map stack.
    // layerType is implemented by the classes that inherit LayerRecord. So if someone forgets
    // they will get a lovely null here to remind them.
    // in the case of a record, the implementation will usually match the record type.
    get parentLayerType () { return this.layerType; }

    get visibility () {
        if (this._layer) {
            return this._layer.visible;
        } else {
            return true; // TODO what should a proper default be? example of this situation??
        }
    }
    set visibility (value) {
        if (this._layer) {
            this._layer.setVisibility(value);
        }

        // TODO do we need an ELSE case here?
    }

    get opacity () {
        if (this._layer) {
            return this._layer.opacity;
        } else {
            return 1; // TODO what should a proper default be? example of this situation??
        }
    }
    set opacity (value) {
        if (this._layer) {
            this._layer.setOpacity(value);
        }

        // TODO do we need an ELSE case here?
    }

    /**
     * Attach record event handlers to common layer events
     *
     * @function bindEvents
     * @param {Object} layer the api layer object
     */
    bindEvents (layer) {
        // TODO optional refactor.  Rather than making the events object in the parameter,
        //      do it as a variable, and only add mouse-over, mouse-out events if we are
        //      in an app configuration that will use it. May save a bit of processing
        //      by not having unused events being handled and ignored.
        //      Second optional thing. Call a separate wrapEvents in FeatuerRecord class
        // TODO apply johann update here
        this._apiRef.events.wrapEvents(layer, {
            // wrapping the function calls to keep `this` bound correctly
            load: () => this.onLoad(),
            error: e => this.onError(e),
            'update-start': () => this.onUpdateStart(),
            'update-end': () => this.onUpdateEnd(),
            'mouse-over': e => this.onMouseOver(e),
            'mouse-out': e => this.onMouseOut(e)
        });
    }

    /**
     * Generates a new api layer object.
     *
     * @function constructLayer
     * @returns {Object} the new api layer object.
     */
    constructLayer () {
        this._layer = this.layerClass(this.config.url, this.makeLayerConfig());
        this.bindEvents(this._layer);
        return this._layer;
    }

    /**
     * Reacts to a layer-level state change.
     *
     * @function _stateChange
     * @private
     * @param {String} newState the state the layer has now become
     */
    _stateChange (newState) {
        // console.log(`State change for ${this.layerId} to ${newState}`);
        this._state = newState;

        // if we don't copy the array we could be looping on an array
        // that is being modified as it is being read
        this._fireEvent(this._stateListeners, this._state);
    }

    /**
     * Wire up state change listener.
     *
     * @function addStateListener
     * @param {Function} listenerCallback function to call when a state change event happens
     */
    addStateListener (listenerCallback) {
        this._stateListeners.push(listenerCallback);
        return listenerCallback;
    }

    /**
     * Remove a state change listener.
     *
     * @function removeStateListener
     * @param {Function} listenerCallback function to not call when a state change event happens
     */
    removeStateListener (listenerCallback) {
        const idx = this._stateListeners.indexOf(listenerCallback);
        if (idx < 0) {
            throw new Error('Attempting to remove a listener which is not registered.');
        }
        this._stateListeners.splice(idx, 1);
    }

    /**
     * Reacts to a layer downloading attributes.
     *
     * @function _attribsAdded
     * @private
     * @param {String} idx the index of the layer whose attributes were downloaded
     * @param {Object} attribs the layer attributes downloaded
     */
    _attribsAdded (idx, attribs) {
        // if we don't copy the array we could be looping on an array
        // that is being modified as it is being read
        this._fireEvent(this._attribListeners, this, idx, attribs);
    }

    /**
     * Wire up attrib added listener.
     *
     * @function addAttribListener
     * @param {Function} listenerCallback function to call when attributes download event happens
     */
    addAttribListener (listenerCallback) {
        this._attribListeners.push(listenerCallback);
        return listenerCallback;
    }

    /**
     * Remove an attribute added listener.
     *
     * @function removeAttribListener
     * @param {Function} listenerCallback function to not call when attributes download event happens
     */
    removeAttribListener (listenerCallback) {
        const idx = this._attribListeners.indexOf(listenerCallback);
        if (idx < 0) {
            throw new Error('Attempting to remove a listener which is not registered.');
        }
        this._attribListeners.splice(idx, 1);
    }

    /**
     * Wire up mouse hover listener.
     *
     * @function addHoverListener
     * @param {Function} listenerCallback function to call when a hover event happens
     */
    addHoverListener (listenerCallback) {
        this._hoverListeners.push(listenerCallback);
        return listenerCallback;
    }

    /**
     * Remove a mouse hover listener.
     *
     * @function removeHoverListener
     * @param {Function} listenerCallback function to not call when a hover event happens
     */
    removeHoverListener (listenerCallback) {
        const idx = this._hoverListeners.indexOf(listenerCallback);
        if (idx < 0) {
            throw new Error('Attempting to remove a listener which is not registered.');
        }
        this._hoverListeners.splice(idx, 1);
    }

    /**
     * Triggers when the layer loads.
     *
     * @function onLoad
     * @returns {Array} list of promises that need to resolve for layer to be considered loaded.
     */
    onLoad () {
        // only super-general stuff in here, that all layers should run.
        console.info(`Layer loaded: ${this._layer.id}`);

        if (!this.name) {
            // no name from config. attempt layer name
            this.name = this._layer.name;
        }

        if (!this.extent) {
            // no extent from config. attempt layer extent
            this.extent = this._layer.fullExtent;
        }

        this.extent = shared.makeSafeExtent(this.extent);

        let lookupPromise = Promise.resolve();
        if (this._epsgLookup) {
            const check = this._apiRef.proj.checkProj(this.spatialReference, this._epsgLookup);
            if (check.lookupPromise) {
                lookupPromise = check.lookupPromise;
            }

            // TODO if we don't find a projection, the app will show the layer loading forever.
            //      might need to handle the fail case and show something to the user.
        }
        return [lookupPromise];
    }

    /**
     * Triggers when the layer has an error.
     *
     * @function onError
     * @param {Object} e error event object
     */
    onError (e) {
        console.warn(`Layer error: ${e}`);
        console.warn(e);
        this._stateChange(shared.states.ERROR);
    }

    /**
     * Triggers when the layer starts to update.
     *
     * @function onUpdateStart
     */
    onUpdateStart () {
        this._stateChange(shared.states.REFRESH);
    }

    /**
     * Triggers when the layer finishes updating.
     *
     * @function onUpdateEnd
     */
    onUpdateEnd () {
        this._stateChange(shared.states.LOADED);
    }

    /**
     * Handles when the mouse enters a layer
     */
    onMouseOver () {
        // do nothing in baseclass
    }

    /**
     * Handles when the mouse leaves a layer
     */
    onMouseOut () {
        // do nothing in baseclass
    }

    /**
     * Indicates if layer is file based, WMS, WFS, or esri based.
     *
     * @function dataSource
     */
    dataSource () {
        // only instances of FeatureLayer can be file based or WFS and only instances of WMSLayer are type wms; those classes override this function
        return 'esri';
    }

    /**
     * Creates an options object for the map API object
     *
     * @function makeLayerConfig
     * @returns {Object} an object with api options
     */
    makeLayerConfig () {
        return {
            id: this.config.id,
            opacity: this.config.state.opacity,
            visible: this.config.state.visibility,
            refreshInterval: this.config.refreshInterval
        };
    }

    /**
     * Figure out visibility scale.  Will use layer minScale/maxScale
     * and map levels of detail to determine scale boundaries.
     *
     * @function findZoomScale
     * @param {Array} lods            array of valid levels of detail for the map
     * @param {Object} scaleSet       contains .minScale and .maxScale for valid viewing scales
     * @param {Boolean} zoomIn        the zoom to scale direction; true need to zoom in; false need to zoom out
     * @returns {Object} a level of detail (lod) object for the appropriate scale to zoom to
     */
    findZoomScale (lods, scaleSet, zoomIn = true) {
        // TODO optional. add quick check...if our minScale/maxScale we are comparing against is 0,
        //      then no need to search array, just take first item.

        // the lods array is ordered largest scale to smallest scale.  e.g. world view to city view
        // if zoomOut is false, we reverse the array so we search it in the other direction.
        const modLods = zoomIn ? lods : [...lods].reverse();

        const scaleLod = modLods.find(currentLod => zoomIn ? currentLod.scale < scaleSet.minScale :
                currentLod.scale > scaleSet.maxScale);

        // if we did not encounter a boundary go to last
        return scaleLod || modLods[modLods.length - 1];
    }

    /**
     * Set map scale depending on zooming in or zooming out of layer visibility scale
     *
     * @function setMapScale
     * @param {Object} map                   layer to zoom to scale to for feature layers; parent layer for dynamic layers
     * @param {Object} lod                   scale object the map will be set to
     * @param {Boolean} zoomIn               the zoom to scale direction; true need to zoom in; false need to zoom out
     * @param {Boolean} positionOverLayer    ensures the map is over the layer's extent after zooming. only applied if zoomIn is true. defaults to true
     * @returns {Promise} resolves after map is done changing its extent
     */
    setMapScale (map, lod, zoomIn, positionOverLayer = true) {
        // TODO possible this would live in the map manager in a bigger refactor.
        // NOTE because we utilize the layer object's full extent (and not child feature class extents),
        //      this function stays in this class.
        // TODO since we now support extents in child layers, it might be worth looking at using those
        //      extents instead of the overall layer extent.

        // if zoom in is needed; must find center of layer's full extent and perform center&zoom
        if (zoomIn && positionOverLayer) {
            // need to reproject in case full extent in a different sr than basemap
            const gextent = this._apiRef.proj.localProjectExtent(this.extent, map.spatialReference);

            const reprojLayerFullExt = this._apiRef.Map.Extent(gextent.x0, gextent.y0,
                gextent.x1, gextent.y1, gextent.sr);

            // check if current map extent already in layer extent
            return map.setScale(lod.scale).then(() => {
                // if map extent not in layer extent, zoom to center of layer extent
                // don't need to return Deferred otherwise because setScale already resolved here
                if (!reprojLayerFullExt.intersects(map.extent)) {
                    return map.centerAt(reprojLayerFullExt.getCenter());
                }
            });
        } else {
            return map.setScale(lod.scale);
        }
    }

    /**
     * Figure out visibility scale and zoom to it.  Will use layer minScale/maxScale
     * and map levels of detail to determine scale boundaries.
     *
     * @function _zoomToScaleSet
     * @private
     * @param {Object} map                   the map object
     * @param {Array} lods                   level of details array for basemap
     * @param {Boolean} zoomIn               the zoom to scale direction; true need to zoom in; false need to zoom out
     * @param {Object} scaleSet              contains min and max scales for the layer
     * @param {Boolean} positionOverLayer    ensures the map is over the layer's extent after zooming. only applied if zoomIn is true. defaults to true
     * @returns {Promise}                    promise that resolves after map finishes moving about
     */
    _zoomToScaleSet (map, lods, zoomIn, scaleSet, positionOverLayer = true) {
        // TODO update function parameters once things are working

        // NOTE we use lods provided by config rather that system-ish map.__tileInfo.lods
        const zoomLod = this.findZoomScale(lods, scaleSet, zoomIn);

        return this.setMapScale(map, zoomLod, zoomIn, positionOverLayer);
    }

    /**
     * Zoom to a valid scale level for this layer.
     *
     * @function zoomToScale
     * @param {Object} map                   the map object
     * @param {Array} lods                   level of details array for basemap
     * @param {Boolean} zoomIn               the zoom to scale direction; true need to zoom in; false need to zoom out
     * @param {Boolean} positionOverLayer    ensures the map is over the layer's extent after zooming. only applied if zoomIn is true. defaults to true
     * @returns {Promise}                    promise that resolves after map finishes moving about
     */
    zoomToScale (map, lods, zoomIn, positionOverLayer = true) {
        // get scale set from child, then execute zoom
        const scaleSet = this._featClasses[this._defaultFC].getScaleSet();
        return this._zoomToScaleSet(map, lods, zoomIn, scaleSet, positionOverLayer);
    }

    /**
     * Indicates if the feature class is not visible at the given scale,
     * and if so, if we need to zoom in to see it or zoom out
     *
     * @function isOffScale
     * @param {Integer}  mapScale the scale to test against
     * @returns {Object} has boolean properties `offScale` and `zoomIn`
     */
    isOffScale (mapScale) {
        return this._featClasses[this._defaultFC].isOffScale(mapScale);
    }

    /**
     * Zoom to layer boundary of the layer specified by layerId
     *
     * @function zoomToBoundary
     * @param {Object} map  esriMap object we want to execute the zoom on
     * @return {Promise} resolves when map is done zooming
     */
    zoomToBoundary (map) {
        return map.zoomToExtent(this.extent);
    }

    /**
     * Returns the visible scale values of the layer
     *
     * @function getVisibleScales
     * @returns {Object} has properties .minScale and .maxScale
     */
    getVisibleScales () {
        // default layer, take from layer object
        // TODO do we need to handle a missing layer case?
        //      no one should be calling this until layer is loaded anyways
        return {
            minScale: this._layer.minScale,
            maxScale: this._layer.maxScale
        };
    }

    /**
     * Returns the feature count
     *
     * @function getFeatureCount
     * @returns {Promise} resolves feature count
     */
    getFeatureCount () {
        // TODO determine best result to indicate that layer does not have features
        //      we may want a null so that UI can display a different message (or suppress the message).
        //      of note, the proxy is currently returning undefined for non-feature things
        return Promise.resolve(0);
    }

    /**
     * Create an extent centered around a point, that is appropriate for the current map scale.
     *
     * @function makeClickBuffer
     * @param {Object} point       point on the map for extent center
     * @param {Object} map         map object the extent is relevant for
     * @param {Integer} tolerance  optional. distance in pixels from mouse point that qualifies as a hit. default is 5
     * @return {Object} an extent of desired size and location
     */
    makeClickBuffer (point, map, tolerance = 5) {
        // take pixel tolerance, convert to map units at current scale. x2 to turn radius into diameter
        const buffSize = 2 * tolerance * map.extent.getWidth() / map.width;

        // Build tolerance envelope of correct size
        const cBuff = this._apiRef.Map.Extent(0, 0, buffSize, buffSize, point.spatialReference);

        // move the envelope so it is centered around the point
        return cBuff.centerAt(point);
    }

    get symbology () { return this._featClasses[this._defaultFC].symbology; }

    /**
     * Indicates the layer is queryable.
     *
     * @function isQueryable
     * @returns {Boolean} the queryability of the layer
     */
    isQueryable () {
        return this._featClasses[this._defaultFC].queryable;
    }

    /**
     * Applies queryability to the layer.
     *
     * @function setQueryable
     * @param {Boolean} value the new queryability setting
     */
    setQueryable (value) {
        this._featClasses[this._defaultFC].queryable = value;
    }

    /**
     * Indicates the geometry type of the layer.
     *
     * @function getGeomType
     * @returns {String} the geometry type of the layer
     */
    getGeomType () {
        // standard case, layer has no geometry. This gets overridden in feature-based Record classes.
        return undefined;
    }

    /**
     * Indicates the oid field of the layer.
     *
     * @function getOidField
     * @returns {String} the oid field of the layer
     */
    getOidField () {
        // standard case, layer has no oid field. This gets overridden in feature-based Record classes.
        return undefined;
    }

    /**
     * Provides the proxy interface object to the layer.
     *
     * @function getProxy
     * @returns {Object} the proxy interface for the layer
     */
    getProxy () {
        // NOTE baseclass used by things like WMSRecord, ImageRecord, TileRecord
        if (!this._rootProxy) {
            this._rootProxy = new layerInterface.LayerInterface(this, this.initialConfig.controls);
            this._rootProxy.convertToSingleLayer(this);
        }
        return this._rootProxy;
    }

    /**
     * Determines if layer's spatial ref matches the given spatial ref.
     * Mainly used to determine if a tile wont display on a map.
     * Highly recommend only calling this after a layer's load event has happened.
     * @param {Object} spatialReference    spatial reference to compare against.
     * @return {Boolean}                   true if layer has same sr as input. false otherwise.
     */
    validateProjection (spatialReference) {
        if (spatialReference && this._layer && this._layer.spatialReference) {
            return this._apiRef.proj.isSpatialRefEqual(spatialReference, this._layer.spatialReference);
        } else {
            throw new error('validateProjection called -- essential info wasnt available');
        }
    }

    /**
     * Deletes any pre-loaded attributes when the layer automatically refreshes to ensure up-to-date attributes are loaded next time
     *
     * @function cleanUpAttribs
     */
    cleanUpAttribs () {
        Object.keys(this._featClasses).forEach(fc => {
            delete this._featClasses[fc]._formattedAttributes;

            if (this._featClasses[fc]._layerPackage) {
                delete this._featClasses[fc]._layerPackage._attribData;
                this._featClasses[fc]._layerPackage.loadIsDone = false;
            }
        });
    }

    /**
     * Create a layer record with the appropriate geoApi layer type.  Layer config
     * should be fully merged with all layer options defined (i.e. this constructor
     * will not apply any defaults).
     * @param {Object} layerClass    the ESRI api object for the layer
     * @param {Object} apiRef        object pointing to the geoApi. allows us to call other geoApi functions.
     * @param {Object} config        layer config values
     * @param {Object} esriLayer     an optional pre-constructed layer
     * @param {Function} epsgLookup  an optional lookup function for EPSG codes (see geoService for signature)
     */
    constructor (layerClass, apiRef, config, esriLayer, epsgLookup) {
        super();
        this._layerClass = layerClass;
        this.name = config.name || '';
        this._featClasses = {};
        this._defaultFC = '0';
        this._apiRef = apiRef;
        this.initialConfig = config;
        this._stateListeners = [];
        this._attribListeners = [];
        this._hoverListeners = [];
        this._user = false;
        this._epsgLookup = epsgLookup;
        this.extent = config.extent; // if missing, will fill more values after layer loads

        // TODO verify we still use passthrough bindings.
        this._layerPassthroughBindings.forEach(bindingName =>
            this[bindingName] = (...args) => this._layer[bindingName](...args));
        this._layerPassthroughProperties.forEach(propName => {
            const descriptor = {
                enumerable: true,
                get: () => this._layer[propName]
            };
            Object.defineProperty(this, propName, descriptor);
        });

        if (esriLayer) {
            this.constructLayer = () => { throw new Error('Cannot construct pre-made layers'); };
            this._layer = esriLayer;
            this.bindEvents(this._layer);
            this._rootUrl = esriLayer.url || '';

            // TODO might want to change this to be whatever layer says it is
            this._state = shared.states.LOADING;
            if (!this.name) {
                // no name from config. attempt layer name
                this.name = esriLayer.name;
            }

            if (!esriLayer.url) {
                // file layer. force snapshot, force an onload
                this._snapshot = true;
                this.onLoad();
            }

        } else {
            this._rootUrl = config.url;
            this.constructLayer(config);
            this._state = shared.states.LOADING;
        }
    }
}

module.exports = () => ({
    LayerRecord
});

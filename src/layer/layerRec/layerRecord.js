'use strict';

const layerInterface = require('./layerInterface.js')();
const shared = require('./shared.js')();

/**
 * @class LayerRecord
 */
class LayerRecord {
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
    get bbox () { return this._bbox; } // bounding box layer
    get state () { return this._state; }
    set state (value) { this._state = value; }
    get layerId () { return this.config.id; }
    get _layerPassthroughBindings () { return ['setOpacity', 'setVisibility']; } // TODO when jshint parses instance fields properly we can change this from a property to a field
    get _layerPassthroughProperties () { return ['visibleAtMapScale', 'visible', 'spatialReference']; } // TODO when jshint parses instance fields properly we can change this from a property to a field
    get userLayer () { return this._user; } // indicates if layer was added by a user
    set userLayer (value) { this._user = value; }
    get layerName () { return this._name; } // the top level layer name
    set layerName (value) { this._name = value; }
    get symbology () { return this._symbolBundle; }

    get visibility () {
        // TEST STATUS none
        if (this._layer) {
            return this._layer.visible;
        } else {
            return true; // TODO what should a proper default be? example of this situation??
        }
    }
    set visibility (value) {
        // TEST STATUS none
        if (this._layer) {
            this._layer.visible = value;
        }

        // TODO do we need an ELSE case here?
    }

    get opacity () {
        // TEST STATUS none
        if (this._layer) {
            return this._layer.opacity;
        } else {
            return 1; // TODO what should a proper default be? example of this situation??
        }
    }
    set opacity (value) {
        // TEST STATUS none
        if (this._layer) {
            this._layer.opacity = value;
        }

        // TODO do we need an ELSE case here?
    }

    /**
     * Generate a bounding box for the layer on the given map.
     */
    createBbox (spatialReference) {
        // TEST STATUS none
        if (!this._bbox) {
            // TODO possibly adjust extent parameter to use a config-based override
            this._bbox = this._apiRef.layer.bbox.makeBoundingBox(`bbox_${this._layer.id}`,
                                                                this._layer.fullExtent,
                                                                spatialReference);
        }
        return this._bbox;
    }

    /**
     * Destroy bounding box
     */
    destroyBbox (map) {
        // TEST STATUS none
        // TODO should we remove the map.remove step?  just drop the internal reference.
        map.removeLayer(this._bbox);
        this._bbox = undefined;
    }

    /**
     * Attach event handlers to layer events
     */
    bindEvents (layer) {
        // TEST STATUS basic
        // TODO optional refactor.  Rather than making the events object in the parameter,
        //      do it as a variable, and only add mouse-over, mouse-out events if we are
        //      in an app configuration that will use it. May save a bit of processing
        //      by not having unused events being handled and ignored.
        //      Second optional thing. Call a separate wrapEvents in FeatuerRecord class
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
     * Perform layer initialization tasks
     */
    constructLayer () {
        // TEST STATUS basic
        this._layer = this.layerClass(this.config.url, this.makeLayerConfig());
        this.bindEvents(this._layer);
        return this._layer;
    }

    /**
     * Handle a change in layer state
     */
    _stateChange (newState) {
        // TEST STATUS basic
        this._state = newState;
        console.log(`State change for ${this.layerId} to ${newState}`);

        // if we don't copy the array we could be looping on an array
        // that is being modified as it is being read
        this._fireEvent(this._stateListeners, this._state);
    }

    /**
     * Wire up state change listener
     */
    addStateListener (listenerCallback) {
        // TEST STATUS none
        this._stateListeners.push(listenerCallback);
        return listenerCallback;
    }

    /**
     * Remove a state change listener
     */
    removeStateListener (listenerCallback) {
        // TEST STATUS none
        const idx = this._stateListeners.indexOf(listenerCallback);
        if (idx < 0) {
            throw new Error('Attempting to remove a listener which is not registered.');
        }
        this._stateListeners.splice(idx, 1);
    }

    /**
     * Wire up mouse hover listener
     */
    addHoverListener (listenerCallback) {
        // TEST STATUS none
        this._hoverListeners.push(listenerCallback);
        return listenerCallback;
    }

    /**
     * Remove a mouse hover listener
     */
    removeHoverListener (listenerCallback) {
        // TEST STATUS none
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
    */
    onLoad () {
        // TEST STATUS basic
        // TODO is legend entry valid anymore? will it be a different system?
        if (this.legendEntry && this.legendEntry.removed) { return; }
        console.info(`Layer loaded: ${this._layer.id}`);

        if (!this._name) {
            // no name from config. attempt layer name
            this._name = this._layer.name;
        }

        let lookupPromise = Promise.resolve();
        if (this._epsgLookup) {
            const check = this._apiRef.proj.checkProj(this.spatialReference, this._epsgLookup);
            if (check.lookupPromise) {
                lookupPromise = check.lookupPromise;
            }

            // TODO if we don't find a projection, the app will show the layer loading forever.
            //      might need to handle the fail case and show something to the user.
        }
        lookupPromise.then(() => this._stateChange(shared.states.LOADED));
    }

    /**
     * Handles when the layer has an error
     */
    onError (e) {
        // TEST STATUS basic
        console.warn(`Layer error: ${e}`);
        console.warn(e);
        this._stateChange(shared.states.ERROR);
    }

    /**
     * Handles when the layer starts to update
     */
    onUpdateStart () {
        // TEST STATUS none
        this._stateChange(shared.states.REFRESH);
    }

    /**
     * Handles when the layer finishes updating
     */
    onUpdateEnd () {
        // TEST STATUS none
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
     * Utility for triggering an event and giving it to the listeners
     */
    _fireEvent (handlerArray, ...eventParams) {
        // TEST STATUS none
        handlerArray.slice(0).forEach(l => l(...eventParams));
    }

    /**
     * Creates an options object for the physical layer
     */
    makeLayerConfig () {
        // TEST STATUS none
        return {
            id: this.config.id,
            opacity: this.config.state.opacity,
            visible: this.config.state.visibility
        };
    }

    /**
     * Indicates if the bounding box is visible
     *
     * @returns {Boolean} indicates if the bounding box is visible
     */
    isBBoxVisible () {
        // TEST STATUS none
        if (this._bbox) {
            return this._bbox.visible;
        } else {
            return false;
        }
    }

    /**
     * Figure out visibility scale.  Will use layer minScale/maxScale
     * and map levels of detail to determine scale boundaries.
     *
     * @param {Array} lods            array of valid levels of detail for the map
     * @param {Object} scaleSet       contains .minScale and .maxScale for valid viewing scales
     * @param {Boolean} zoomIn        the zoom to scale direction; true need to zoom in; false need to zoom out
     * @param {Boolean} zoomGraphic   an optional value when zoomToScale is use to zoom to a graphic element;
     *                                    true used to zoom to a graphic element; false not used to zoom to a graphic element
     * @returns {Object} a level of detail (lod) object for the appropriate scale to zoom to
     */
    findZoomScale (lods, scaleSet, zoomIn, zoomGraphic = false) {
        // TEST STATUS none
        // TODO rename function to getZoomScale?
        // TODO take a second look at parameters zoomIn and zoomGraphic. how are they derived (in the caller code)?
        //      seems weird to me to do it this way
        // TODO naming of "zoomIn" is very misleading and confusing. in practice, we are often
        //      setting the value to false when we are zooming down close to the ground.
        //      Need full analysis of usage, possibly rename parameter or update param docs.
        // TODO update function parameters once things are working

        // if the function is used to zoom to a graphic element and the layer is out of scale we always want
        // the layer to zoom to the maximum scale allowed for the layer. In this case, zoomIn must be
        // always false

        zoomIn = (zoomGraphic) ? false : zoomIn;

        // TODO double-check where lods are coming from in old code
        // change search order of lods depending if we are zooming in or out
        const modLods = zoomIn ? lods : [...lods].reverse();

        return modLods.find(currentLod => zoomIn ? currentLod.scale < scaleSet.minScale :
                currentLod.scale > scaleSet.maxScale);
    }

    /**
    * Set map scale depending on zooming in or zooming out of layer visibility scale
    *
    * @param {Object} map layer to zoom to scale to for feature layers; parent layer for dynamic layers
    * @param {Object} lod scale object the map will be set to
    * @param {Boolean} zoomIn the zoom to scale direction; true need to zoom in; false need to zoom out
    * @returns {Promise} resolves after map is done changing its extent
    */
    setMapScale (map, lod, zoomIn) {
        // TEST STATUS none
        // TODO possible this would live in the map manager in a bigger refactor.
        // NOTE because we utilize the layer object's full extent (and not child feature class extents),
        //      this function stays in this class.

        // if zoom in is needed; must find center of layer's full extent and perform center&zoom
        if (zoomIn) {
            // need to reproject in case full extent in a different sr than basemap
            const gextent = this._apiRef.proj.localProjectExtent(this._layer.fullExtent, map.spatialReference);

            const reprojLayerFullExt = this._apiRef.mapManager.Extent(gextent.x0, gextent.y0,
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
     * @private
     * @param {Object} map            the map object
     * @param {Array} lods            level of details array for basemap
     * @param {Boolean} zoomIn        the zoom to scale direction; true need to zoom in; false need to zoom out
     * @param {Object} scaleSet       contains min and max scales for the layer.
     * @param {Boolean} zoomGraphic   an optional value when zoomToScale is use to zoom to a graphic element;
     *                                    true used to zoom to a graphic element; false not used to zoom to a graphic element
     */
    _zoomToScaleSet (map, lods, zoomIn, scaleSet, zoomGraphic = false) {
        // TEST STATUS none
        // TODO update function parameters once things are working

        // if the function is used to zoom to a graphic element and the layer is out of scale we always want
        // the layer to zoom to the maximum scale allowed for the layer. In this case, zoomIn must be
        // always false
        zoomIn = (zoomGraphic) ? false : zoomIn;

        // NOTE we use lods provided by config rather that system-ish map.__tileInfo.lods
        const zoomLod = this.findZoomScale(lods, scaleSet, zoomIn, zoomGraphic = false);

        // TODO ponder on the implementation of this
        return this.setMapScale(this._layer, zoomLod, zoomIn);

    }

    // TODO docs
    zoomToScale (map, lods, zoomIn, zoomGraphic = false) {
        // TEST STATUS none
        // get scale set from child, then execute zoom
        return this._featClasses[this._defaultFC].getScaleSet().then(scaleSet => {
            return this._zoomToScaleSet(map, lods, zoomIn, scaleSet, zoomGraphic);
        });
    }

    // TODO docs
    isOffScale (mapScale) {
        // TEST STATUS none
        return this._featClasses[this._defaultFC].isOffScale(mapScale);
    }

    /**
    * Zoom to layer boundary of the layer specified by layerId
    * @param {Object} map  map object we want to execute the zoom on
    * @return {Promise} resolves when map is done zooming
    */
    zoomToBoundary (map) {
        // TEST STATUS none
        // TODO add some caching? make sure it will get wiped if we end up changing projections
        //                        or use wkid as caching key?
        // NOTE this function uses the full extent property of the layer object.  it does not
        //      drill into extents of sub-layers of dynamic layers

        const l = this._layer;
        let gextent;

        // some user added layers have the fullExtent field, but the properties in it are undefined. Check to see if the fullExtent properties are present
        if (!l.fullExtent.xmin) {
            // TODO make this code block more robust? check that we have graphics?
            gextent = this._apiRef.proj.localProjectExtent(
                this._apiRef.proj.graphicsUtils.graphicsExtent(l.graphics), map.spatialReference);
        } else {
            gextent = this._apiRef.proj.localProjectExtent(l.fullExtent, map.spatialReference);
        }

        const reprojLayerFullExt = this._apiRef.mapManager.Extent(gextent.x0, gextent.y0,
            gextent.x1, gextent.y1, gextent.sr);

        return map.setExtent(reprojLayerFullExt);
    }

    /**
    * Returns the visible scale values of the layer
    * @returns {Promise} resolves in object properties .minScale and .maxScale
    */
    getVisibleScales () {
        // TEST STATUS basic
        // default layer, take from layer object
        return Promise.resolve({
            minScale: this._layer.minScale,
            maxScale: this._layer.maxScale
        });
    }

    /**
    * Returns the feature count
    * @returns {Promise} resolves feature count
    */
    getFeatureCount () {
        // TEST STATUS basic
        // TODO determine best result to indicate that layer does not have features
        //      we may want a null so that UI can display a different message (or suppress the message)
        return Promise.resolve(0);
    }

    // TODO docs
    getSymbology () {
        // TEST STATUS basic
        return this._featClasses[this._defaultFC].getSymbology();
    }

    /**
     * Create an extent centered around a point, that is appropriate for the current map scale.
     * @param {Object} point       point on the map for extent center
     * @param {Object} map         map object the extent is relevant for
     * @param {Integer} tolerance  optional. distance in pixels from mouse point that qualifies as a hit. default is 5
     * @return {Object} an extent of desired size and location
     */
    makeClickBuffer (point, map, tolerance = 5) {
        // TEST STATUS none
        // take pixel tolerance, convert to map units at current scale. x2 to turn radius into diameter
        const buffSize = 2 * tolerance * map.extent.getWidth() / map.width;

        // Build tolerance envelope of correct size
        const cBuff = new this._apiRef.mapManager.Extent(0, 0, buffSize, buffSize, point.spatialReference);

        // move the envelope so it is centered around the point
        return cBuff.centerAt(point);
    }

    // TODO docs
    isQueryable () {
        // TEST STATUS basic
        return this._featClasses[this._defaultFC].queryable;
    }

    // TODO docs
    setQueryable (value) {
        // TEST STATUS none
        this._featClasses[this._defaultFC].queryable = value;
    }

    getGeomType () {
        // TEST STATUS none
        // standard case, layer has no geometry. This gets overridden in feature-based Record classes.
        return undefined;
    }

    // returns the proxy interface object for the root of the layer (i.e. main entry in legend, not nested child things)
    // TODO docs
    getProxy () {
        // TEST STATUS basic
        // TODO figure out control name arrays from config (specifically, disabled list)
        //      updated config schema uses term "enabled" but have a feeling it really means available
        // TODO figure out how placeholders work with all this
        // TODO does this even make sense in the baseclass anymore? Everything *should* be overriding this.
        if (!this._rootProxy) {
            this._rootProxy = new layerInterface.LayerInterface(this, this.initialConfig.controls);
            this._rootProxy.convertToSingleLayer(this);
        }
        return this._rootProxy;
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
        // TEST STATUS basic
        this._layerClass = layerClass;
        this._name = config.name || '';
        this._featClasses = {}; // TODO how to populate first one
        this._defaultFC = '0'; // TODO how to populate first one  TODO check if int or string
        this._apiRef = apiRef;
        this.initialConfig = config;
        this._stateListeners = [];
        this._hoverListeners = [];
        this._user = false;
        this._epsgLookup = epsgLookup;

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

        // default to placeholder symbol. real stuff will be inserted during loaded event
        // TODO deal with lack of random colour library
        this._symbolBundle = {
            stack: [apiRef.symbology.generatePlaceholderSymbology(this._name || '?', '#16bf27')],
            renderStyle: 'icons'
        };

        if (esriLayer) {
            this.constructLayer = () => { throw new Error('Cannot construct pre-made layers'); };
            this._layer = esriLayer;
            this.bindEvents(this._layer);
            this._state = shared.states.LOADED;
            if (!this._name) {
                // no name from config. attempt layer name
                this._name = esriLayer.name;
            }

            // TODO fire loaded event?
        } else {
            this.constructLayer(config);
            this._state = shared.states.LOADING;
        }
    }
}

module.exports = () => ({
    LayerRecord
});

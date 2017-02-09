'use strict';

// TODO bump version.
// TODO look at ripping out esriBundle, and passing specific classes as needed

// Classes for handling different types of layers

/* Class heirarchy overview:
We have FC and Record classes
FC represents a logical layer.  Think of a feature class (gis term, not programming term)
or a raster source. It is one atomic layer.
Record represents a physical layer.  Think of a layer in the ESRI map stack. Think of
something represented by an ESRI API layer object.
FC classes are contained within *Record classes.
If a property or function applies to a logical layer (e.g. min and max scale levels),
it should reside in an FC class. If it applies to a physical layer (e.g. loading
state), it should reside in a Record.

E.g.
A feature layer is implemented with one Record and one FC, because by nature,
a feature layer can only contain data from one feature class.
A dynamic layer is implemented with one Record, and a FC for every
leaf child layer.
*/

const states = { // these are used as css classes; hence the `rv` prefix
    NEW: 'rv-new',
    REFRESH: 'rv-refresh',
    LOADING: 'rv-loading',
    LOADED: 'rv-loaded', // TODO maybe loaded and default are the same?
    DEFAULT: 'rv-default',
    ERROR: 'rv-error'
};

// TODO crazy idea. instead of having attribute .layerInfo as a promise,
//      we pair that promise with the layer's load event.  Essentially, don't
//      change our state to loaded until both the layer is loaded AND the .layerInfo
//      is loaded.  Then we store the result in a not-promise var, and everything else
//      can access it synchronously.
//      Risks: need to make sure we never need to use .layerInfo prior to the layer loading.

// TODO full review of use of object id, specificly the type -- is it string or integer

// The FC classes are meant to be internal to this module. They help manage differences between single-type layers
// like feature layers, image layers, and composite layers like dynamic layers.

/**
 * @class BasicFC
 */
class BasicFC {
    // base class for feature class object. deals with stuff specific to a feature class (or raster equivalent)

    constructor (parent, idx) {
        this._parent = parent;
        this._idx = idx;
    }

    // returns a promise of an object with minScale and maxScale values for the feature class
    getScaleSet () {
        // basic case - we get it from the esri layer
        const l = this._parent._layer;
        return Promise.resolve({
            minScale: l.minScale,
            maxScale: l.maxScale
        });
    }

    isOffScale (mapScale) {
        return this.getScaleSet().then(scaleSet => {
            // GIS for dummies.
            // scale increases as you zoom out, decreases as you zoom in
            // minScale means if you zoom out beyond this number, hide the layer
            // maxScale means if you zoom in past this number, hide the layer
            // 0 value for min or max scale means there is no hiding in effect
            const result = {
                offScale: false,
                zoomIn: false
            };

            // check if out of scale and set zoom direction to scaleSet
            if (mapScale < scaleSet.maxScale && scaleSet.maxScale !== 0) {
                result.offScale = true;
                result.zoomIn = false;
            } else if (mapScale > scaleSet.minScale && scaleSet.minScale !== 0) {
                result.offScale = true;
                result.zoomIn = true;
            }

            return result;
        });
    }
}

/**
 * @class BasicFC
 */
class AttribFC extends BasicFC {
    // attribute-specific variant for feature class object.
    // deals with stuff specific to a feature class that has attributes

   // TODO add attribute and layer info promises

    /**
     * Create an attribute specific feature class object
     * @param {Object} parent        record object this FC belongs to.
     * @param {String} idx           feature index of the feature class
     * @param {Object} layerPackage  a layer package object from the attribute module for this feature class
     */
    constructor (parent, idx, layerPackage) {
        super(parent, idx);

        this._layerPackage = layerPackage;

        // moar?
    }

    getAttribs () {
        return this._layerPackage.getAttribs();
    }

    getLayerData () {
        return this._layerPackage.layerData;
    }

    /**
    * Extract the feature name from a feature as best we can.
    * Support for dynamic layers is limited at the moment.
    *
    * @function getFeatureName
    * @param {String} objId      the object id of the attribute
    * @param {Object} attribs    optional. the dictionary of attributes for the feature. uses internal attributes if not provided.
    * @returns {Promise}         resolves with the name of the feature
    */
    getFeatureName (objId, attribs) {

        let nameField = '';

        if (this.nameField) {
            nameField = this.nameField;
        } else if (this.parent._layer && this.parent._layer.displayField) {
            nameField = this.parent._layer.displayField;
        }

        if (nameField) {
            // determine if we have been given a set of attributes, or need to use our own
            let attribPromise;
            if (attribs) {
                attribPromise = Promise.resolve(attribs);
            } else {
                attribPromise = this.getAttribs().then(layerAttribs => {
                    return layerAttribs.features[layerAttribs.oidIndex[objId]].attributes;
                });
            }

            // after attributes are loaded, extract name
            return attribPromise.then(finalAttribs => {
                return finalAttribs[nameField];
            });
        } else {
            // FIXME wire in "feature" to translation service
            return Promise.resolve('Feature ' + objId);
        }
    }

    /**
     * Retrieves attributes from a layer for a specified feature index
     * @return {Promise}            promise resolving with formatted attributes to be consumed by the datagrid and esri feature identify
     */
    getFormattedAttributes () {

        if (this._formattedAttributes) {
            return this._formattedAttributes;
        }

        this._formattedAttributes = Promise.all([this.getAttribs(), this.getLayerData()])
            .then(([aData, lData]) => {
                // create columns array consumable by datables
                const columns = lData.fields
                    .filter(field =>

                        // assuming there is at least one attribute - empty attribute budnle promises should be rejected, so it never even gets this far
                        // filter out fields where there is no corresponding attribute data
                        aData.features[0].attributes.hasOwnProperty(field.name))
                    .map(field => ({
                        data: field.name,
                        title: field.alias || field.name
                    }));

                return {
                    columns,
                    rows: aData.features.map(feature => feature.attributes),
                    fields: lData.fields, // keep fields for reference ...
                    oidField: lData.oidField, // ... keep a reference to id field ...
                    oidIndex: aData.oidIndex, // ... and keep id mapping array
                    renderer: lData.renderer
                };
            })
            .catch(() => {
                delete this._formattedAttributes; // delete cached promise when the geoApi `getAttribs` call fails, so it will be requested again next time `getAttributes` is called;
                throw new Error('Attrib loading failed');
            });

        return this._formattedAttributes;
    }

    /**
     * Check to see if the attribute in question is an esriFieldTypeDate type.
     *
     * @param {String} attribName     the attribute name we want to check if it's a date or not
     * @return {Promise}              resolves to true or false based on the attribName type being esriFieldTypeDate
     */
    checkDateType (attribName) {

        // grab attribute info (waiting for it it finish loading)
        return this.getLayerData().then(lData => {
            // inspect attribute fields
            if (lData.fields) {
                const attribField = lData.fields.find(field => {
                    return field.name === attribName;
                });
                if (attribField && attribField.type) {
                    return attribField.type === 'esriFieldTypeDate';
                }
            }
            return false;
        });
    }

    /**
     * Get the best user-friendly name of a field. Uses alias if alias is defined, else uses the system attribute name.
     *
     * @param {String} attribName     the attribute name we want a nice name for
     * @return {Promise}              resolves to the best available user friendly attribute name
     */
    aliasedFieldName (attribName) {

        // grab attribute info (waiting for it it finish loading)
        return this.getLayerData().then(lData => {
            return AttribFC.aliasedFieldNameDirect(attribName, lData.fields);
        });

    }

    static aliasedFieldNameDirect (attribName, fields) {

        let fName = attribName;

        // search for aliases
        if (fields) {
            const attribField = fields.find(field => {
                return field.name === attribName;
            });
            if (attribField && attribField.alias && attribField.alias.length > 0) {
                fName = attribField.alias;
            }
        }
        return fName;
    }

    /**
     * Convert an attribute set so that any keys using aliases are converted to proper fields
     *
     * @param  {Object} attribs      attribute key-value mapping, potentially with aliases as keys
     * @param  {Array} fields       fields definition array for layer
     * @return {Object}              attribute key-value mapping with fields as keys
     */
    static unAliasAttribs (attribs, fields) {
        const newA = {};
        fields.forEach(field => {
            // attempt to extract on name. if not found, attempt to extract on alias
            // dump value into the result
            newA[field.name] = attribs.hasOwnProperty(field.name) ? attribs[field.name] : attribs[field.alias];
        });
        return newA;
    }

   // TODO perhaps a splitting of server url and layer index to make things consistent between feature and dynamic?
   //      could be on constructor, then parent can easily feed in the treats.

}

/**
 * @class BasicFC
 */
class DynamicFC extends AttribFC {
    // dynamic child variant for feature class object.
    // deals with stuff specific to dynamic children (i.e. virtual layer on client)

    constructor (parent, idx, layerPackage) {
        super(parent, idx, layerPackage);

        // TODO moar?  if not, erase and use attribfc constructor
    }

    // returns an object with minScale and maxScale values for the feature class
    getScaleSet () {
        // get the layerData promise for this FC, wait for it to load,
        // then return the scale data
        return this.getLayerData().then(lData => {
            return {
                minScale: lData.minScale,
                maxScale: lData.maxScale
            };
        });
    }

}

/**
 * @class IdentifyResult
 */
class IdentifyResult {
    /**
     * @param  {String} name      layer name of the queried layer
     * @param  {Array} symbology array of layer symbology to be displayed in details panel
     * @param  {String} format    indicates data formating template
     * @param  {Object} layerRec  layer record for the queried layer
     * @param  {Integer} featureIdx  optional feature index of queried layer (should be provided for attribute based layers)
     * @param  {String} caption   optional captions to be displayed along with the name
     */
    constructor (name, symbology, format, layerRec, featureIdx, caption) {
        // TODO revisit what should be in this class, and what belongs in the app
        // also what can be abstacted to come from layerRec
        this.isLoading = true;
        this.requestId = -1;
        this.requester = {
            name,
            symbology,
            format,
            caption,
            layerRec,
            featureIdx
        };
        this.data = [];
    }
}

// the Record classes are meant to be public facing and consumed by other modules and the client.

/**
 * @class LayerRecord
 */
class LayerRecord {
    get layerClass () { throw new Error('This should be overridden in subclasses'); }
    get config () { return this.initialConfig; } // TODO: add a live config reference if needed
    get legendEntry () { return this._legendEntry; } // legend entry class corresponding to those defined in legend entry service
    set legendEntry (value) { this._legendEntry = value; } // TTODO: determine if we still link legends inside this class
    get bbox () { return this._bbox; } // bounding box layer
    get state () { return this._state; }
    set state (value) { this._state = value; }
    get layerId () { return this.config.id; }
    get _layerPassthroughBindings () { return ['setOpacity', 'setVisibility']; } // TODO when jshint parses instance fields properly we can change this from a property to a field
    get _layerPassthroughProperties () { return ['visibleAtMapScale', 'visible', 'spatialReference']; } // TODO when jshint parses instance fields properly we can change this from a property to a field

    /**
     * Generate a bounding box for the layer on the given map.
     */
    createBbox (map) {
        if (this._bbox) {
            throw new Error('Bbox is already setup');
        }
        this._bbox = this._apiRef.layer.bbox.makeBoundingBox(`bbox_${this._layer.id}`,
                                                        this._layer.fullExtent,
                                                        map.extent.spatialReference);
        map.addLayer(this._bbox);
    }

    /**
     * Destroy bounding box
     */
    destroyBbox (map) {
        map.removeLayer(this._bbox);
        this._bbox = undefined;
    }

    /**
     * Attach event handlers to layer events
     */
    bindEvents (layer) {
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
        this._layer = this.layerClass(this.config.url, this.makeLayerConfig());
        this.bindEvents(this._layer);
        return this._layer;
    }

    /**
     * Handle a change in layer state
     */
    _stateChange (newState) {
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
        this._stateListeners.push(listenerCallback);
        return listenerCallback;
    }

    /**
     * Remove a state change listener
     */
    removeStateListener (listenerCallback) {
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
        this._hoverListeners.push(listenerCallback);
        return listenerCallback;
    }

    /**
     * Remove a mouse hover listener
     */
    removeHoverListener (listenerCallback) {
        const idx = this._hoverListeners.indexOf(listenerCallback);
        if (idx < 0) {
            throw new Error('Attempting to remove a listener which is not registered.');
        }
        this._hoverListeners.splice(idx, 1);
    }

    /**
     * Handles when the layer finishes loading
     */
    onLoad () {
        if (this.legendEntry && this.legendEntry.removed) { return; }
        console.info(`Layer loaded: ${this._layer.id}`);
        let lookupPromise = Promise.resolve();
        if (this._epsgLookup) {
            const check = this._apiRef.proj.checkProj(this.spatialReference, this._epsgLookup);
            if (check.lookupPromise) {
                lookupPromise = check.lookupPromise;
            }

            // TODO if we don't find a projection, the app will show the layer loading forever.
            //      might need to handle the fail case and show something to the user.
        }
        lookupPromise.then(() => this._stateChange(states.LOADED));
    }

    /**
     * Handles when the layer has an error
     */
    onError (e) {
        console.warn(`Layer error: ${e}`);
        console.warn(e);
        this._stateChange(states.ERROR);
    }

    /**
     * Handles when the layer starts to update
     */
    onUpdateStart () {
        this._stateChange(states.REFRESH);
    }

    /**
     * Handles when the layer finishes updating
     */
    onUpdateEnd () {
        this._stateChange(states.LOADED);
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
        handlerArray.slice(0).forEach(l => l(...eventParams));
    }

    /**
     * Creates a config snippet for the layer
     */
    makeLayerConfig () {
        return {
            id: this.config.id,
            opacity: this.config.options.opacity.value,
            visible: this.config.options.visibility.value
        };
    }

    /**
     * Figure out visibility scale and zoom to it.  Will use layer minScale/maxScale
     * and map levels of detail to determine scale boundaries.
     *
     * @param {Integer} lods    index of item we want
     * @param {Array} scaleSet            level of detail definitions for the current map
     * @param {Boolean} zoomIn        the zoom to scale direction; true need to zoom in; false need to zoom out
     * @param {Boolean} zoomGraphic   an optional value when zoomToScale is use to zoom to a graphic element;
     *                                    true used to zoom to a graphic element; false not used to zoom to a graphic element
     */
    findZoomScale (lods, scaleSet, zoomIn, zoomGraphic = false) {
        // TODO rename function to getZoomScale?
        // TODO take a second look at parameters zoomIn and zoomGraphic. how are they derived (in the caller code)?
        //      seems weird to me to do it this way
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

    zoomToScale (map, lods, zoomIn, zoomGraphic = false) {
        // get scale set from child, then execute zoom
        return this._featClasses[this._defaultFC].getScaleSet().then(scaleSet => {
            return this._zoomToScaleSet(map, lods, zoomIn, scaleSet, zoomGraphic);
        });
    }

    isOffScale (mapScale) {
        return this._featClasses[this._defaultFC].isOffScale(mapScale);
    }

    /**
    * Zoom to layer boundary of the layer specified by layerId
    * @param {Object} map  map object we want to execute the zoom on
    * @return {Promise} resolves when map is done zooming
    */
    zoomToBoundary (map) {
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
        // TODO determine best result to indicate that layer does not have features
        //      we may want a null so that UI can display a different message (or suppress the message)
        return Promise.resolve(0);
    }

    /**
     * Create an extent centered around a point, that is appropriate for the current map scale.
     * @param {Object} point       point on the map for extent center
     * @param {Object} map         map object the extent is relevant for
     * @param {Integer} tolerance  optional. distance in pixels from mouse point that qualifies as a hit. default is 5
     * @return {Object} an extent of desired size and location
     */
    makeClickBuffer (point, map, tolerance = 5) {
        // take pixel tolerance, convert to map units at current scale. x2 to turn radius into diameter
        const buffSize = 2 * tolerance * map.extent.getWidth() / map.width;

        // Build tolerance envelope of correct size
        const cBuff = new this._api.mapManager.Extent(0, 0, buffSize, buffSize, point.spatialReference);

        // move the envelope so it is centered around the point
        return cBuff.centerAt(point);
    }

    /**
     * Create a layer record with the appropriate geoApi layer type.  Layer config
     * should be fully merged with all layer options defined (i.e. this constructor
     * will not apply any defaults).
     * @param {Object} apiRef        object pointing to the geoApi. allows us to call other geoApi functions.
     * @param {Object} config        layer config values
     * @param {Object} esriLayer     an optional pre-constructed layer
     * @param {Function} epsgLookup  an optional lookup function for EPSG codes (see geoService for signature)
     */
    constructor (apiRef, config, esriLayer, epsgLookup) {
        this._featClasses = {}; // TODO how to populate first one
        this._defaultFC = '0'; // TODO how to populate first one  TODO check if int or string
        this._apiRef = apiRef;
        this.initialConfig = config;
        this._stateListeners = [];
        this._hoverListeners = [];
        this._epsgLookup = epsgLookup;
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
            this.state = states.LOADED;
        } else {
            this.constructLayer(config);
            this.state = states.LOADING;
        }
    }
}

/**
 * @class AttrRecord
 */
class AttrRecord extends LayerRecord {

    // FIXME clickTolerance is not specific to AttrRecord but rather Feature and Dynamic
    get clickTolerance () { return this.config.tolerance; }

    constructor (esriRequest, apiRef, config, esriLayer, epsgLookup) {
        super(apiRef, config, esriLayer, epsgLookup);

        this._esriRequest = esriRequest;
    }

    /**
     * Get the best user-friendly name of a field. Uses alias if alias is defined, else uses the system attribute name.
     *
     * @param {String} attribName     the attribute name we want a nice name for
     * @return {Promise}              resolves to the best available user friendly attribute name
     */
    aliasedFieldName (attribName) {
        return this._featClasses[this._defaultFC].aliasedFieldName(attribName);
    }

    /**
     * Retrieves attributes from a layer for a specified feature index
     * @return {Promise}            promise resolving with formatted attributes to be consumed by the datagrid and esri feature identify
     */
    getFormattedAttributes () {
        return this._featClasses[this._defaultFC].getFormattedAttributes();
    }

    checkDateType (attribName) {
        return this._featClasses[this._defaultFC].checkDateType(attribName);
    }

    getAttribs () {
        return this._featClasses[this._defaultFC].getAttribs();
    }

    getLayerData () {
        return this._featClasses[this._defaultFC].getLayerData();
    }

    getFeatureName (objId, attribs) {
        return this._featClasses[this._defaultFC].getFeatureName(objId, attribs);
    }

    getFeatureCount (url) {

        if (url) {
            // wrapping server call in a function, as we regularly encounter sillyness
            // where we need to execute the count request twice.
            // having a function (with finalTry flag) lets us handle the double-request
            const esriServerCount = (layerUrl, finalTry = false) => {
                // extract info for this service
                const defService = this._esriRequest({
                    url: `${layerUrl}/query`,
                    content: {
                        f: 'json',
                        where: '1=1',
                        returnCountOnly: true,
                        returnGeometry: false
                    },
                    callbackParamName: 'callback',
                    handleAs: 'json',
                });

                return new Promise((resolve, reject) => {
                    defService.then(serviceResult => {
                        if (serviceResult && (typeof serviceResult.error === 'undefined') &&
                            (typeof serviceResult.count !== 'undefined')) {
                            // we got a row count
                            resolve(serviceResult.count);
                        } else if (!finalTry) {
                            // do a second attempt
                            resolve(esriServerCount(layerUrl, true));
                        } else {
                            // TODO different message? more verbose?
                            reject('error getting feature count');
                        }
                    }, error => {
                        // failed to load service info.
                        // TODO any tricks to avoid duplicating the error case in both blocks?
                        if (!finalTry) {
                            // do a second attempt
                            resolve(esriServerCount(layerUrl, true));
                        } else {
                            // TODO different message? more verbose?
                            console.warn(error);
                            reject('error getting feature count');
                        }
                    });
                });
            };

            return esriServerCount(url);

        } else {
            // file based layer.  count local features
            return Promise.resolve(this._layer.graphics.length);
        }
    }

    /**
     * Transforms esri key-value attribute object into key value array with format suitable
     * for consumption by the details pane.
     *
     * @param  {Object} attribs      attribute key-value mapping, potentially with aliases as keys
     * @param  {Array} fields        optional. fields definition array for layer. no aliasing done if not provided
     * @return {Array}               attribute data transformed into a list, with potential field aliasing applied
     */
    attributesToDetails (attribs, fields) {
        // TODO make this extensible / modifiable / configurable to allow different details looks for different data
        // simple array of text mapping for demonstration purposes. fancy grid formatting later?
        return Object.keys(attribs)
            .map(key => {
                const fieldType = fields ? fields.find(f => f.name === key) : null;
                return {
                    key: AttribFC.aliasedFieldNameDirect(key, fields), // need synchronous variant of alias lookup
                    value: attribs[key],
                    type: fieldType ? fieldType.type : fieldType
                };
            });
    }
}

/**
 * @class ImageRecord
 */
class ImageRecord extends LayerRecord {
    // NOTE: if we decide to support attributes from ImageServers,
    //       we would extend from AttrRecord instead of LayerRecord
    //       (and do a lot of testing!)
    get layerClass () { return this.ArcGISImageServiceLayer; }

    constructor (layerClass, apiRef, config, esriLayer, epsgLookup) {
        super(apiRef, config, esriLayer, epsgLookup);
        this.ArcGISImageServiceLayer = layerClass;
    }

    onLoad () {
        super.onLoad();

        // TODO consider making this a function, as it is common across less-fancy layers
        this._defaultFC = '0';
        this._featClasses['0'] = new BasicFC(this, '0');
    }
}

/**
 * @class DynamicRecord
 */
class DynamicRecord extends AttrRecord {
    get _layerPassthroughBindings () {
        return ['setOpacity', 'setVisibility', 'setVisibleLayers', 'setLayerDrawingOptions'];
    }
    get _layerPassthroughProperties () {
        return ['visibleAtMapScale', 'visible', 'spatialReference', 'layerInfos', 'supportsDynamicLayers'];
    }
    get layerClass () { return this.ArcGISDynamicMapServiceLayer; }

    constructor (layerClass, esriRequest, apiRef, config, esriLayer, epsgLookup) {
        super(esriRequest, apiRef, config, esriLayer, epsgLookup);
        this.ArcGISDynamicMapServiceLayer = layerClass;
    }

    getFeatureCount (featureIdx) {
        // point url to sub-index we want
        // TODO might change how we manage index and url
        return super.getFeatureCount(this._layer.url + '/' + featureIdx);
    }

    onLoad () {

        super.onLoad();

        // trigger attribute load and set up children bundles.
        const attributeBundle = this._apiRef.attribs.loadLayerAttribs(this._layer);

        attributeBundle.indexes.forEach(idx => {
            this._featClasses[idx] = new DynamicFC(this, idx, attributeBundle[idx]);
        });

    }

    // override to add child index parameter
    zoomToScale (childIdx, map, lods, zoomIn, zoomGraphic = false) {
        // get scale set from child, then execute zoom
        return this._featClasses[childIdx].getScaleSet().then(scaleSet => {
            return this._zoomToScaleSet(map, lods, zoomIn, scaleSet, zoomGraphic);
        });
    }

    isOffScale (childIdx, mapScale) {
        return this._featClasses[childIdx].isOffScale(mapScale);
    }

    /**
     * Get the best user-friendly name of a field. Uses alias if alias is defined, else uses the system attribute name.
     *
     * @param {String} attribName     the attribute name we want a nice name for
     * @param {String}  childIndex    index of the child layer whos attributes we are looking at
     * @return {Promise}              resolves to the best available user friendly attribute name
     */
    aliasedFieldName (attribName, childIndex) {
        return this._featClasses[childIndex].aliasedFieldName(attribName);
    }

    /**
     * Retrieves attributes from a layer for a specified feature index
     * @param {String}  childIndex  index of the child layer to get attributes for
     * @return {Promise}            promise resolving with formatted attributes to be consumed by the datagrid and esri feature identify
     */
    getFormattedAttributes (childIndex) {
        return this._featClasses[childIndex].getFormattedAttributes();
    }

    /**
     * Check to see if the attribute in question is an esriFieldTypeDate type.
     *
     * @param {String} attribName     the attribute name we want to check if it's a date or not
     * @param {String}  childIndex    index of the child layer whos attributes we are looking at
     * @return {Promise}              resolves to true or false based on the attribName type being esriFieldTypeDate
     */
    checkDateType (attribName, childIndex) {
        return this._featClasses[childIndex].checkDateType(attribName);
    }

    getAttribs (childIndex) {
        return this._featClasses[childIndex].getAttribs();
    }

    getLayerData (childIndex) {
        return this._featClasses[childIndex].getLayerData();
    }

    getFeatureName (childIndex, objId, attribs) {
        return this._featClasses[childIndex].getFeatureName(objId, attribs);
    }

    /**
    * Run a query on a dynamic layer, return the result as a promise.
    * @function identify
    * @param {Object} opts additional argumets like map object, clickEvent, etc.
    * @returns {Object} an object with identify results array and identify promise resolving when identify is complete; if an empty object is returned, it will be skipped
    */
    identify (opts) {

        // TODO caller must pass in layer ids to interrogate.  geoApi wont know what is toggled in the legend.
        //      param is opts.layerIds, array of integer for every leaf to interrogate.
        // TODO add full documentation for options parameter

        // bundles results from all leaf layers
        const identifyResults = [];

        // create an results object for every leaf layer we are inspecting
        opts.layerIds.forEach(leafIndex => {

            // TODO fix these params
            // TODO legendEntry.name, legendEntry.symbology appear to be fast links to populate the left side of the results
            //      view.  perhaps it should not be in this object anymore?
            // TODO see how the client is consuming the internal pointer to layerRecord.  this may also now be
            //      directly available via the legend object.
            const identifyResult =
                new IdentifyResult('legendEntry.name', 'legendEntry.symbology', 'EsriFeature', this,
                    leafIndex, 'legendEntry.master.name'); // provide name of the master group as caption

            identifyResults[leafIndex] = identifyResult;
        });

        opts.tolerance = this.clickTolerance;

        const identifyPromise = this._api.layer.serverLayerIdentify(this._layer, opts)
            .then(clickResults => {
                const hitIndexes = []; // sublayers that we got results for

                // transform attributes of click results into {name,data} objects
                // one object per identified feature
                //
                // each feature will have its attributes converted into a table
                // placeholder for now until we figure out how to signal the panel that
                // we want to make a nice table
                clickResults.forEach(ele => {
                    // NOTE: the identify service returns aliased field names, so no need to look them up here.
                    //       however, this means we need to un-alias the data when doing field lookups.
                    // NOTE: ele.layerId is what we would call featureIdx
                    hitIndexes.push(ele.layerId);

                    // get metadata about this sublayer
                    this.getLayerData(ele.layerId).then(lData => {
                        const identifyResult = identifyResults[ele.layerId];

                        if (lData.supportsFeatures) {
                            const unAliasAtt = AttribFC.unAliasAttribs(ele.feature.attributes, lData.fields);

                            // TODO traditionally, we did not pass fields into attributesToDetails as data was
                            //      already aliased from the server. now, since we are extracting field type as
                            //      well, this means things like date formatting might not be applied to
                            //      identify results. examine the impact of providing the fields parameter
                            //      to data that is already aliased.
                            identifyResult.data.push({
                                name: ele.value,
                                data: this.attributesToDetails(ele.feature.attributes),
                                oid: unAliasAtt[lData.oidField],
                                symbology: [{
                                    svgcode: this._api.symbology.getGraphicIcon(unAliasAtt, lData.renderer)
                                }]
                            });
                        }
                        identifyResult.isLoading = false;
                    });
                });

                // set the rest of the entries to loading false
                identifyResults.forEach(identifyResult => {
                    if (hitIndexes.indexOf(identifyResult.requester.featureIdx) === -1) {
                        identifyResult.isLoading = false;
                    }
                });

            });

        return {
            identifyResults: identifyResults.filter(identifyResult => identifyResult), // collapse sparse array
            identifyPromise
        };
    }

}

/**
 * @class TileRecord
 */
class TileRecord extends LayerRecord {
    get layerClass () { return this.ArcGISTiledMapServiceLayer; }

    constructor (layerClass, apiRef, config, esriLayer, epsgLookup) {
        super(apiRef, config, esriLayer, epsgLookup);
        this.ArcGISTiledMapServiceLayer = layerClass;
    }

    onLoad () {
        super.onLoad();

        // TODO consider making this a function, as it is common across less-fancy layers
        this._defaultFC = '0';
        this._featClasses['0'] = new BasicFC(this, '0');
    }

}

/**
 * @class WmsRecord
 */
class WmsRecord extends LayerRecord {
    get layerClass () { return this.WmsLayer; }

    constructor (layerClass, apiRef, config, esriLayer, epsgLookup) {
        super(apiRef, config, esriLayer, epsgLookup);
        this.WmsLayer = layerClass;
    }

    makeLayerConfig () {
        const cfg = super.makeLayerConfig();
        cfg.visibleLayers = this.config.layerEntries.map(le => le.id);
        return cfg;
    }

    onLoad () {
        super.onLoad();

        // TODO consider making this a function, as it is common across less-fancy layers
        this._defaultFC = '0';
        this._featClasses['0'] = new BasicFC(this, '0');
    }

    /**
     * Run a getFeatureInfo on a WMS layer, return the result as a promise.  Fills the panelData array on resolution.
     *
     * @param {Object} opts additional argumets like map object, clickEvent, etc.
     * @returns {Object} an object with identify results array and identify promise resolving when identify is complete; if an empty object is returned, it will be skipped
     */
    identify (opts) {
        // TODO add full documentation for options parameter

        // TODO consider having a constants area in geoApi / better place for this definition
        const infoMap = {
            'text/html;fgpv=summary': 'HTML',
            'text/html': 'HTML',
            'text/plain': 'Text',
            'application/json': 'EsriFeature'
        };

        // ignore layers with no mime type
        if (!infoMap.hasOwnProperty(this.config.featureInfoMimeType)) {
            return {};
        }

        // TODO fix these params
        // TODO legendEntry.name, legendEntry.symbology appear to be fast links to populate the left side of the results
        //      view.  perhaps it should not be in this object anymore?
        // TODO see how the client is consuming the internal pointer to layerRecord.  this may also now be
        //      directly available via the legend object.
        const identifyResult =
            new IdentifyResult('legendEntry.name', 'legendEntry.symbology', infoMap[this.config.featureInfoMimeType],
                this);

        const identifyPromise = this._api.layer.ogc
            .getFeatureInfo(
                this._layer,
                opts.clickEvent,
                this.config.layerEntries.map(le => le.id),
                this.config.featureInfoMimeType)
            .then(data => {
                identifyResult.isLoading = false;

                // TODO: check for French service
                // check if a result is returned by the service. If not, do not add to the array of data
                if (data.indexOf('Search returned no results') === -1 && data !== '') {
                    identifyResult.data.push(data);
                }

                // console.info(data);
            });

        return { identifyResults: [identifyResult], identifyPromise };
    }
}

/**
 * @class FeatureRecord
 */
class FeatureRecord extends AttrRecord {
    get layerClass () { return this.FeatureLayer; }

    // TODO add flags for file based layers?

    constructor (layerClass, esriRequest, apiRef, config, esriLayer, epsgLookup) {
        super(esriRequest, apiRef, config, esriLayer, epsgLookup);
        this.FeatureLayer = layerClass;
    }

    // TODO ensure whoever is making layers from config fragments is also setting the feature index.
    //      remove comment once that is done

    makeLayerConfig () {
        const cfg = super.makeLayerConfig();
        cfg.mode = this.config.options.snapshot.value ? this.layerClass.MODE_SNAPSHOT
                                                        : this.layerClass.MODE_ONDEMAND;
        this.config.options.snapshot.enabled = !this.config.options.snapshot.value;
        return cfg;
    }

    onLoad () {

        super.onLoad();

        // set up attributes, set up children bundles.
        const attributeBundle = this._apiRef.attribs.loadLayerAttribs(this._layer);

        // feature has only one layer
        const idx = attributeBundle.indexes[0];
        const aFC = new AttribFC(this, idx, attributeBundle[idx]);
        aFC.nameField = this.config.nameField;
        this._defaultFC = idx;
        this._featClasses[idx] = aFC;

    }

    getFeatureCount () {
        // just use the layer url (or lack of in case of file layer)
        return super.getFeatureCount(this._layer.url);
    }

    isFileLayer () {
        // TODO revisit.  is it robust enough?
        return this._layer && this._layer.url === '';
    }

    onMouseOver (e) {
        if (this._hoverListeners.length > 0) {
            // TODO add in quick lookup for layers that dont have attributes loaded yet

            const showBundle = {
                type: 'mouseOver',
                point: e.screenPoint,
                target: e.target
            };

            // tell anyone listening we moused into something
            this._fireEvent(this._hoverListeners, showBundle);

            // pull metadata for this layer.
            this.getLayerData().then(lInfo => {
                // TODO this will change a bit after we add in quick lookup. for now, get all attribs
                return Promise.all([Promise.resolve(lInfo), this.getAttribs()]);
            }).then(([lInfo, aInfo]) => {
                // graphic attributes will only have the OID if layer is server based
                const oid = e.graphic.attributes[lInfo.oidField];

                // get name via attribs and name field
                const featAttribs = aInfo.features[aInfo.oidIndex[oid]].attributes;
                const featName = this.getFeatureName(oid, featAttribs);

                // get icon via renderer and geoApi call
                const svgcode = this._apiRef.symbology.getGraphicIcon(featAttribs, lInfo.renderer);

                // duplicate the position so listener can verify this event is same as mouseOver event above
                const loadBundle = {
                    type: 'tipLoaded',
                    name: featName,
                    target: e.target,
                    svgcode
                };

                // tell anyone listening we moused into something
                this._fireEvent(this._hoverListeners, loadBundle);
            });
        }
    }

    onMouseOut (e) {
        // tell anyone listening we moused out
        const outBundle = {
            type: 'mouseOut',
            target: e.target
        };
        this._fireEvent(this._hoverListeners, outBundle);
    }

    /**
    * Run a query on a feature layer, return the result as a promise.  Fills the panelData array on resolution. // TODO update
    * @function identify
    * @param {Object} opts additional argumets like map object, clickEvent, etc.
    * @returns {Object} an object with identify results array and identify promise resolving when identify is complete; if an empty object is returned, it will be skipped
    */
    identify (opts) {
        // TODO add full documentation for options parameter

        // TODO fix these params
        // TODO legendEntry.name, legendEntry.symbology appear to be fast links to populate the left side of the results
        //      view.  perhaps it should not be in this object anymore?
        // TODO see how the client is consuming the internal pointer to layerRecord.  this may also now be
        //      directly available via the legend object.
        const identifyResult =
            new IdentifyResult('legendEntry.name', 'legendEntry.symbology', 'EsriFeature',
                this, this._defaultFC);

        // run a spatial query
        const qry = new this._api.layer.Query();
        qry.outFields = ['*']; // this will result in just objectid fields, as that is all we have in feature layers

        // more accurate results without making the buffer if we're dealing with extents
        // polygons from added file need buffer
        // TODO further investigate why esri is requiring buffer for file-based polygons. logic says it shouldnt
        if (this._layer.geometryType === 'esriGeometryPolygon' && !this.isFileLayer()) {
            qry.geometry = opts.geometry;
        } else {
            qry.geometry = this.makeClickBuffer(opts.clickEvent.mapPoint, opts.map, this.clickTolerance);
        }

        const identifyPromise = Promise.all([
                this.getAttributes(),
                Promise.resolve(this._layer.queryFeatures(qry)),
                this.getLayerData()
            ])
            .then(([attributes, queryResult, layerData]) => {
                // transform attributes of query results into {name,data} objects one object per queried feature
                //
                // each feature will have its attributes converted into a table
                // placeholder for now until we figure out how to signal the panel that
                // we want to make a nice table
                identifyResult.isLoading = false;
                identifyResult.data = queryResult.features.map(
                    feat => {
                        // grab the object id of the feature we clicked on.
                        const objId = feat.attributes[attributes.oidField];
                        const objIdStr = objId.toString();

                        // use object id find location of our feature in the feature array, and grab its attributes
                        const featAttribs = attributes.features[attributes.oidIndex[objIdStr]];
                        return {
                            name: this.getFeatureName(objIdStr, featAttribs),
                            data: this.attributesToDetails(featAttribs, layerData.fields),
                            oid: objId,
                            symbology: [
                                { svgcode: this._api.symbology.getGraphicIcon(featAttribs, layerData.renderer) }
                            ]
                        };
                    });
            });

        return { identifyResults: [identifyResult], identifyPromise };
    }

}

module.exports = () => ({
    DynamicRecord,
    FeatureRecord,
    ImageRecord,
    TileRecord,
    WmsRecord,
    States: states
});

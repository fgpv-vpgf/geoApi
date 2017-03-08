'use strict';

// TODO bump version.
// TODO look at ripping out esriBundle, and passing specific classes as needed
// TODO consider splitting out into one-file-per-class.  Remember the class must be available at compile time
//      edit: for real, this file is getting silly-big

// Classes for handling different types of layers

/*
Class heirarchy overview:

We have FC, Record, and Interface classes

FC represents a logical layer.  Think of a feature class (gis term, not programming term)
or a raster source. It is one atomic layer.

Record represents a physical layer.  Think of a layer in the ESRI map stack. Think of
something represented by an ESRI API layer object.

Interfac is a classs that presents information to the UI and facilitates bindings.
It also exposes calls to perform actions on the layer (e.g. the action a UI button
would execute).

FC classes are contained within Record classes.
If a property or function applies to a logical layer (e.g. min and max scale levels),
it should reside in an FC class. If it applies to a physical layer (e.g. loading
state), it should reside in a Record.

E.g.
A feature layer is implemented with one Record and one FC, because by nature,
a feature layer can only contain data from one feature class.
A dynamic layer is implemented with one Record, and a FC for every
leaf child layer.

An interface object should exist for every layer-bound entry in the legend.
Most Records will have one interface, as they just have one legend entry.
Dynamic Records will also have interfaces for children. This can include
group items, which don't have FC objects. Tricky, eh!

*/

// TODO revisit if we still need rv- in these constants.
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
//      Risk: need to make sure we never need to use .layerInfo prior to the layer loading.
//      Risk: layer needs to wait until it has pulled additional info prior to being active (negligible?)

// TODO full review of use of object id, specificly the type -- is it string or integer
// TODO ditto for featureIdx.

// Controls Interface class is used to provide something to the UI that it can bind to.
// It helps the UI keep in line with the layer state.
// Due to bindings, we cannot destroy & recreate an interface when a legend item
// goes from 'Unknown Placeholder' to 'Specific Layer Type'. This means we cannot
// do object heirarchies, as to go from PlaceholderInterface to FeatureLayerInterface
// would require a new object. Instead, we have a class that exposes all possible
// methods and properties as error throwing stubs. Then we replace those functions
// with real ones once we know the flavour of interface we want.

// TODO rename this? A legend entry that is just text will use this to bind content. So the word Layer might be wrong
class LayerInterface {

    /**
     * @param {Object} source                          object that provides info to the interface. usually a LayerRecord or FeatureClass
     * @param {Array} availableControls [optional=[]]  an array or controls names that are displayed inside the legendEntry
     * @param {Array} disabledControls [optional=[]]   an array or controls names that are disabled and cannot be interacted wiht by a user
     */
    constructor (source, availableControls = [], disabledControls = []) {
        this._source = source;
        this._availableControls = availableControls;
        this._disabledConrols = disabledControls;
    }

    // shortcut function for throwing errors on unimplemented functions.
    _iAmError () {
        throw new Error('Call not supported.');
    }

    // these expose ui controls available on the interface and indicate which ones are disabled
    get availableControls () { return this._availableControls; }
    get disabledControls () { return this._disabledControls; }
    get symbology () { this._iAmError(); }

    // can be group or node name
    get name () { this._iAmError(); }

    // these are needed for the type flag
    get layerType () { this._iAmError(); }
    get geometryType () { this._iAmError(); }
    get featureCount () { this._iAmError(); }

    // layer states
    get layerState () { this._iAmError(); }
    get isRefreshing () { this._iAmError(); }

    // these return the current values of the corresponding controls
    get visibility () { this._iAmError(); }
    get opacity () { this._iAmError(); }
    get boundingBox () { this._iAmError(); }
    get query () { this._iAmError(); }
    get snapshot () { this._iAmError(); }

    // fetches attributes for use in the datatable
    get formattedAttributes () { this._iAmError(); }

    // content for static legend entires (non-layer/non-group)
    get infoType () { this._iAmError(); }
    get infoContent () { this._iAmError(); }

    // these set values to the corresponding controls
    setVisibility () { this._iAmError(); }
    setOpacity () { this._iAmError(); }
    setBoundingBox () { this._iAmError(); }
    setQuery () { this._iAmError(); }
    setSnapshot () { this._iAmError(); }

    // updates what this interface is pointing to, in terms of layer data source.
    // often, the interface starts with a placeholder to avoid errors and return
    // defaults. This update happens after a layer has loaded, and new now want
    // the interface reading off the real FC.
    // TODO docs
    updateSource (newSource) {
        this._source = newSource;
    }

    convertToSingleLayer (layerRecord) {
        this._source = layerRecord;

        newProp(this, 'symbology', standardGetSymbology);
        newProp(this, 'layerState', standardGetLayerState);
        newProp(this, 'isRefreshing', standardGetIsRefreshing);

        newProp(this, 'visibility', standardGetVisibility);
        newProp(this, 'opacity', standardGetOpacity);
        newProp(this, 'boundingBox', standardGetBoundingBox);
        newProp(this, 'query', standardGetQuery);

        newProp(this, 'geometryType', standardGetGeometryType);
        newProp(this, 'featureCount', standardGetFeatureCount);

        this.setVisibility = standardSetVisibility;
        this.setOpacity = standardSetOpacity;
        this.setBoundingBox = standardSetBoundingBox;
        this.setQuery = standardSetQuery;
    }

    convertToFeatureLayer (layerRecord) {
        this.convertToSingleLayer(layerRecord);

        newProp(this, 'snapshot', featureGetSnapshot);
        newProp(this, 'formattedAttributes', standardGetFormattedAttributes);

        this.setSnapshot = featureSetSnapshot;
    }

    convertToDynamicLeaf (dynamicFC) {
        this._source = dynamicFC;

        newProp(this, 'symbology', dynamicLeafGetSymbology);

        newProp(this, 'visibility', dynamicLeafGetVisibility);
        newProp(this, 'opacity', dynamicLeafGetOpacity);
        newProp(this, 'query', dynamicLeafGetQuery);
        newProp(this, 'formattedAttributes', dynamicLeafGetFormattedAttributes);
        newProp(this, 'geometryType', dynamicLeafGetGeometryType);
        newProp(this, 'featureCount', dynamicLeafGetFeatureCount);

        this.setVisibility = dynamicLeafSetVisibility;
        this.setOpacity = dynamicLeafSetOpacity;
        this.setQuery = dynamicLeafSetQuery;
    }

    convertToDynamicGroup (layerRecord, groupId) {
        this._source = layerRecord;
        this._groupId = groupId;

        // contains a list of all child leaves for fast access
        this._childLeafs = [];

        newProp(this, 'visibility', dynamicGroupGetVisibility);
        newProp(this, 'opacity', dynamicGroupGetOpacity);

        this.setVisibility = dynamicGroupSetVisibility;
        this.setOpacity = dynamicGroupSetOpacity;
    }

    convertToStatic () {
        // TODO figure out what is involved here.
    }

}

/**
 * Worker function to add or override a get property on an object
 *
 * @function newProp
 * @private
 * @param {Object} target     the object that will receive the new property
 * @param {String} propName   name of the get property
 * @param {Function} getter   the function defining the guts of the get property.
 */
function newProp(target, propName, getter) {
    Object.defineProperty(target, propName, {
        get: getter
    });
}

// these functions are upgrades to the duds above.
// we don't use arrow notation, as we want the `this` to point at the object
// that these functions get smashed into.

function standardGetLayerState() {
    /* jshint validthis: true */

    // returns one of Loading, Loaded, Error
    // TODO verify what DEFAULT actually is
    switch (this._source.state) {
        case states.NEW:
        case states.LOADING:
            return states.LOADING;
        case states.LOADED:
        case states.REFRESH:
        case states.DEFAULT:
            return states.LOADED;
        case states.ERROR:
            return states.ERROR;
    }
}

function standardGetIsRefreshing() {
    /* jshint validthis: true */
    return this._source.state === states.REFRESH;
}

function standardGetVisibility() {
    /* jshint validthis: true */

    // TODO should we make interface on _source (a layer record) for this and other properties?
    //      e.g. _source.getVisiblility() ?
    //      or too much overkill on fancy abstractions?
    return this._source._layer.visibile;
}

function dynamicLeafGetVisibility() {
    /* jshint validthis: true */
    return this._source.getVisibility();
}

function dynamicGroupGetVisibility() {
    /* jshint validthis: true */

    // check visibility of all children.
    // only return false if all children are invisible
    return this._childLeafs.some(leaf => { return leaf.visibility; });
}

function standardGetOpacity() {
    /* jshint validthis: true */
    return this._source._layer.opacity;
}

function dynamicLeafGetOpacity() {
    /* jshint validthis: true */

    // TODO figure out how to handle layers that don't support this.
    //      possibly crosscheck against disabled settings
    //      might not be an issue if, since there will be no control, nothing will call this
    //      Alternative: convertToDynamicLeaf() will check and make decisions then?
    // TODO ensure .opacity is implemented.
    return this._sourceFC.opacity;
}

function dynamicGroupGetOpacity() {
    // TODO validate if we really need this?
    //      currently changing opacity on a group will do nothing.
    //      see AAFC AGRI Environmental Indicators layer in index-one sample.
    //      could be we should not show opacity for groups?
    return 1;
}

function standardGetBoundingBox() {
    /* jshint validthis: true */

    // dont be fooled by function/prop name, we are returning bbox visibility,
    // not the box itself
    return this._source.isBBoxVisible();
}

function standardGetQuery() {
    /* jshint validthis: true */

    return this._source.isQueryable();
}

// TODO do we have group-level queryable settings?
//      e.g. click a control on dynamic root, all childs get setting?
function dynamicLeafGetQuery() {
    /* jshint validthis: true */

    return this._source.queryable();
}

function standardGetFormattedAttributes() {
    /* jshint validthis: true */

    return this._source.getFormattedAttributes();
}

function dynamicLeafGetFormattedAttributes() {
    /* jshint validthis: true */

    // TODO code-wise this looks identical to standardGetFormattedAttributes.
    //      however in this case, ._source is a DynamicFC, not a LayerRecord.
    //      This is safer. Deleting this would avoid the duplication. Decide.
    return this._source.getFormattedAttributes();
}

function standardGetSymbology() {
    /* jshint validthis: true */

    return this._source.getSymbology();
}

function dynamicLeafGetSymbology() {
    /* jshint validthis: true */

    // TODO code-wise this looks identical to standardGetSymbology.
    //      however in this case, ._source is a DynamicFC, not a LayerRecord.
    //      This is safer. Deleting this would avoid the duplication. Decide.
    return this._source.getSymbology();
}

function standardGetGeometryType() {
    /* jshint validthis: true */
    return this._source.getGeomType();
}

function dynamicLeafGetGeometryType() {
    /* jshint validthis: true */
    return this._source.geomType;
}

function standardGetFeatureCount() {
    /* jshint validthis: true */
    return this._source.getFeatureCount();
}

function dynamicLeafGetFeatureCount() {
    /* jshint validthis: true */
    return this._source._parent.getFeatureCount(this._source._idx);
}

function standardSetVisibility(value) {
    /* jshint validthis: true */
    this._source._layer.visibile = value;
}

function dynamicLeafSetVisibility(value) {
    /* jshint validthis: true */
    this._source.setVisibility(value);

    // TODO see if we need to trigger any refresh of parents.
    //      it may be that the bindings automatically work.
}

function dynamicGroupSetVisibility(value) {
    /* jshint validthis: true */

    // TODO be aware of cycles of updates. may need a force / dont broadcast flag.
    //      since we are only hitting leaves and skipping child-groups, should be ok.
    this._childLeafs.forEach(leaf => {
        leaf.setVisibility(value);
    });
}

function standardSetOpacity(value) {
    /* jshint validthis: true */
    this._source._layer.opacity = value;
}

function dynamicLeafSetOpacity(value) {
    /* jshint validthis: true */
    this._source.opacity = value;

    // TODO call something in this._parent that will update
    //      this._source._parent._layer.layerDrawingOptions[this._source.idx].transparency
    //      being careful to remember that transparency is opacity * -1 (good job!)
}

function dynamicGroupSetOpacity(value) {
    // TODO see comments on dynamicGroupSetVisibility
    console.log('enhance group opacity', value);
}

function standardSetBoundingBox(value) {
    /* jshint validthis: true */

    // TODO test if object exists? Is it possible to have control without bbox layer?
    this._source.bbox.visible = value;
}

function standardSetQuery(value) {
    /* jshint validthis: true */

    this._source.setQueryable(value);
}

function dynamicLeafSetQuery(value) {
    /* jshint validthis: true */

    this._source.queryable = value;
}

function featureGetSnapshot() {
    /* jshint validthis: true */
    return this._source.isSnapshot;
}

function featureSetSnapshot() {
    // TODO trigger the snapshot process.  need the big picture on how this orchestrates.
    //      it involves a layer reload so possible this function is irrelevant, as the record
    //      will likely get nuked
    console.log('MOCKING THE SNAPSHOT PROCESS');
}

// TODO implement function to get .name
//      where does it come from in single-layer? config? verify new schema
//      group node?  a config entry? a layer property in auto-gen?
//      deal with unbound information-only case (static entry)?

// TODO implement infoType / infoContent for static entry.
//      who supplies this? how does it get passed in.

/* jshint validthis: false */

// The FC classes are meant to be internal to this module. They help manage differences between single-type layers
// like feature layers, image layers, and composite layers like dynamic layers.
// Can toy with alternate approaches. E.g. have a convertToPlaceholder function in the interface.

// simple object packager for client symbology package
// TODO proper docs
function makeSymbologyOutput(symbolArray, style) {
    return {
        stack: symbolArray,
        renderStyle: style
    };
}

// legend data is our modified legend structure.
// it is similar to esri's server output, but all individual
// items are promises.
// TODO proper docs
function makeSymbologyArray(legendData) {
    return legendData.map(item => {

        const symbologyItem = {
            svgcode: null,
            name: null
        };

        // file-based layers don't have symbology labels, default to ''
        // legend items are promises
        item.then(data => {
            symbologyItem.svgcode = data.svgcode;
            symbologyItem.name = data.label || '';
        });

        return symbologyItem;
    });
}

class PlaceholderFC {
    // contains dummy stuff to stop placeholder states from freaking out
    // prior to a layer being loaded.

    constructor (parent, name) {
        this._parent = parent;
        this._name = name;
    }

    // TODO probably need more stuff

    getVisibility () {
        // TODO enhance to have some default value, assigned in constructor?
        // TODO can a user toggle placeholders? does state need to be updated?
        return true;
    }

    // TODO same questions as visibility
    get opacity () { return 1; }

    getSymbology () {
        if (!this._symbology) {
            // TODO deal with random colours
            this._symbology = this._parent._api.symbology.generatePlaceholderSymbology(this._name, '#16bf27')
                .then(symbologyItem => {
                    return makeSymbologyOutput([symbologyItem], 'icons');
                });
        }
        return this._symbology;
    }

}

/**
 * @class BasicFC
 */
class BasicFC {
    // base class for feature class object. deals with stuff specific to a feature class (or raster equivalent)

    // TODO determine who is setting this. LayerRecord constructor & dynamic child generator?
    get queryable () { return this._queryable; }
    set queryable (value) { this._queryable = value; }

    // TODO determine who is setting this. LayerRecord constructor & dynamic child generator?
    get geomType () { return this._geomType; }
    set geomType (value) { this._geomType = value; }

    /**
     * @param {Object} parent        the Record object that this Feature Class belongs to
     * @param {String} idx           the service index of this Feature Class. an integer in string format. use '0' for non-indexed sources.
     */
    constructor (parent, idx) {
        this._parent = parent;
        this._idx = idx;
    }

    // returns a promise of an object with minScale and maxScale values for the feature class
    // TODO we may be able to make scale stuff non-asynch. scales are stored in dynamiclayer.layerInfos[idx]
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

    // TODO docs
    getVisibility () {
        return this._parent._layer.visible;
    }

    // TODO docs
    setVisibility (val) {
        // basic case - set layer visibility
        this._parent._layer.visible = val;
    }

    getSymbology () {
        if (!this._symbology) {
            // get symbology from service legend.
            // this is used for non-feature based sources (tiles, image, raster).
            // wms will override with own special logic.
            const url = this._parent._layer.url;
            if (url) {
                // fetch legend from server, convert to local format, process local format
                this._symbology = this._parent._api.symbology.mapServerToLocalLegend(url, this._idx)
                    .then(legendData => {
                        return makeSymbologyOutput(makeSymbologyArray(legendData.layers[0]), 'icons');
                    });
            } else {
                // this shouldn't happen. non-url layers should be files, which are features,
                // which will have a basic renderer and will use FeatureFC override.
                throw new Error('encountered layer with no renderer and no url');
            }
        }
        return this._symbology;
    }

}

/**
 * @class AttribFC
 */
class AttribFC extends BasicFC {
    // attribute-specific variant for feature class object.
    // deals with stuff specific to a feature class that has attributes

    // TODO add attribute and layer info promises

    /**
     * Create an attribute specific feature class object
     * @param {Object} parent        the Record object that this Feature Class belongs to
     * @param {String} idx           the service index of this Feature Class. an integer in string format. use '0' for non-indexed sources.
     * @param {Object} layerPackage  a layer package object from the attribute module for this feature class
     */
    constructor (parent, idx, layerPackage) {
        super(parent, idx);

        this._layerPackage = layerPackage;

        // moar?
    }

    /**
    * Returns attribute data for this FC.
    *
    * @function getAttribs
    * @returns {Promise}         resolves with a layer attribute data object
    */
    getAttribs () {
        return this._layerPackage.getAttribs();
    }

    /**
    * Returns layer-specific data for this FC.
    *
    * @function getLayerData
    * @returns {Promise}         resolves with a layer data object
    */
    getLayerData () {
        return this._layerPackage.layerData;
    }

    getSymbology () {
        if (!this._symbology) {
            this._symbology = this.getLayerData().then(lData => {
                if (lData.layerType === 'Feature Layer') {
                    // feature always has a single item, so index 0
                    return makeSymbologyOutput(makeSymbologyArray(lData.legend.layers[0].legend), 'icons');
                } else {
                    // non-feature source. use legend server
                    return super.getSymbology();
                }
            });
        }
        return this._symbology;
    }

    /**
    * Extract the feature name from a feature as best we can.
    * Support for dynamic layers is limited at the moment. // TODO explain this comment
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

    /**
     * Create an feature class object for a feature class that is a child of a dynamic layer
     * @param {Object} parent        the Record object that this Feature Class belongs to
     * @param {String} idx           the service index of this Feature Class. an integer in string format. use '0' for non-indexed sources.
     * @param {Object} layerPackage  a layer package object from the attribute module for this feature class
     */
    constructor (parent, idx, layerPackage) {
        super(parent, idx, layerPackage);

        // store pointer to the layerinfo for this FC.
        // while most information here can also be gleaned from the layer object,
        // we cannot know the type (e.g. Feature Layer, Raster Layer), so this object
        // is required.
        this._layerInfo = parent._layer.layerInfos[idx];

        // TODO this may be obsolete now.
        this._visible = true; // TODO should be config value or some type of default if auto-gen
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

    // TODO we may need to override some of the methods in AttribFC
    //      and have logic like
    //      if this._layerInfo.then(l.layerType === 'Feature Layer') then super(xxx) else non-attrib response
    //
    //      could be tricky, as it is promised based, thus wrecking the override of any synchronous function

    setVisibility (val) {
        // update visible layers array
        const vLayers = this._parent.visibleLayers;
        const intIdx = parseInt(this._idx);
        const vIdx = vLayers.indexOf(intIdx);
        if (val && vIdx === -1) {
            // was invisible, now visible
            vLayers.push(intIdx);
        } else if (!val && vIdx > -1) {
            // was visible, now invisible
            vLayers.splice(vIdx, 1);
        }
    }

    // TODO extend this function to other FC's?  do they need it?
    getVisibility () {
        return this._parent.visibleLayers.indexOf(parseInt(this._idx)) > -1;
    }

}

/**
 * Searches for a layer title defined by a wms.
 * @function getWMSLayerTitle
 * @private
 * @param  {Object} wmsLayer     esri layer object for the wms
 * @param  {String} wmsLayerId   layers id as defined in the wms (i.e. not wmsLayer.id)
 * @return {String}              layer title as defined on the service, '' if no title defined
 */
function getWMSLayerTitle(wmsLayer, wmsLayerId) {
    // TODO move this to ogc.js module?

    // crawl esri layerInfos (which is a nested structure),
    // returns sublayer that has matching id or null if not found.
    // written as function to allow recursion
    const crawlSubLayers = (subLayerInfos, wmsLayerId) => {
        let targetEntry = null;

        // we use .some to allow the search to stop when we find something
        subLayerInfos.some(layerInfo => {
            // wms ids are stored in .name
            if (layerInfo.name === wmsLayerId) {
                // found it. save it and exit the search
                targetEntry = layerInfo;
                return true;
            } else if (layerInfo.subLayers) {
                // search children. if in children, will exit search, else will continue
                return crawlSubLayers(layerInfo.subLayers, wmsLayerId);
            } else {
                // continue search
                return false;
            }
        });

        return targetEntry;
    };

    // init search on root layerInfos, then process result
    const match = crawlSubLayers(wmsLayer.layerInfos, wmsLayerId);
    if (match && match.title) {
        return match.title;
    } else {
        return ''; // falsy!
    }
}

/**
 * @class WmsFC
 */
class WmsFC extends BasicFC {

    getSymbology () {
        if (!this._symbology) {
            const configLayerEntries =  this._parent.config.layerEntries;
            const gApi = this._parent._api;
            const legendArray = gApi.layer.ogc
                .getLegendUrls(this._parent._layer, configLayerEntries.map(le => le.id))
                .map((imageUri, idx) => {

                    const symbologyItem = {
                        name: null,
                        svgcode: null
                    };

                    // config specified name || server specified name || config id
                    const name = configLayerEntries[idx].name ||
                        getWMSLayerTitle(this._parent._layer, configLayerEntries[idx].id) ||
                        configLayerEntries[idx].id;

                    gApi.symbology.generateWMSSymbology(name, imageUri).then(data => {
                        symbologyItem.name = data.name;
                        symbologyItem.svgcode = data.svgcode;
                    });

                    return symbologyItem;
                });
            this._symbology = Promise.resolve(makeSymbologyOutput(legendArray, 'images'));
        }
        return this._symbology;
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
    set legendEntry (value) { this._legendEntry = value; } // TTODO: determine if we still link legends inside this class
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
    * Triggers when the layer loads.
    *
    * @function onLoad
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
     * Creates an options object for the physical layer
     */
    makeLayerConfig () {
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

    // TODO docs
    isQueryable () {
        return this._featClasses[this._defaultFC].queryable;
    }

    // TODO docs
    setQueryable (value) {
        this._featClasses[this._defaultFC].queryable = value;
    }

    getGeomType () {
        return this._featClasses[this._defaultFC].geomType;
    }

    // returns the proxy interface object for the root of the layer (i.e. main entry in legend, not nested child things)
    // TODO docs
    getProxy () {
        // TODO figure out control name arrays from config (specifically, disabled list)
        //      updated config schema uses term "enabled" but have a feeling it really means available
        // TODO figure out how placeholders work with all this
        // TODO does this even make sense in the baseclass anymore? Everything *should* be overriding this.
        if (!this._rootProxy) {
            this._rootProxy = new LayerInterface(this, this.initialConfig.controls);
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
        this._layerClass = layerClass;
        this._featClasses = {}; // TODO how to populate first one
        this._defaultFC = '0'; // TODO how to populate first one  TODO check if int or string
        this._apiRef = apiRef;
        this.initialConfig = config;
        this._stateListeners = [];
        this._hoverListeners = [];
        this._user = false;
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
            this._state = states.LOADED;
        } else {
            this.constructLayer(config);
            this._state = states.LOADING;
        }
    }
}

/**
 * @class AttrRecord
 */
class AttrRecord extends LayerRecord {
    // this class has functions common to layers that have attributes

    // FIXME clickTolerance is not specific to AttrRecord but rather Feature and Dynamic
    get clickTolerance () { return this.config.tolerance; }

    /**
     * Create a layer record with the appropriate geoApi layer type.  Layer config
     * should be fully merged with all layer options defined (i.e. this constructor
     * will not apply any defaults).
     * @param {Object} layerClass    the ESRI api object for the layer
     * @param {Object} esriRequest   the ESRI api object for making web requests with proxy support
     * @param {Object} apiRef        object pointing to the geoApi. allows us to call other geoApi functions.
     * @param {Object} config        layer config values
     * @param {Object} esriLayer     an optional pre-constructed layer
     * @param {Function} epsgLookup  an optional lookup function for EPSG codes (see geoService for signature)
     */
    constructor (layerClass, esriRequest, apiRef, config, esriLayer, epsgLookup) {
        super(layerClass, apiRef, config, esriLayer, epsgLookup);

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

    /**
    * Returns attribute data for this layer.
    *
    * @function getAttribs
    * @returns {Promise}         resolves with a layer attribute data object
    */
    getAttribs () {
        return this._featClasses[this._defaultFC].getAttribs();
    }

    /**
    * Returns layer-specific data for this Record
    *
    * @function getLayerData
    * @returns {Promise}         resolves with a layer data object
    */
    getLayerData () {
        return this._featClasses[this._defaultFC].getLayerData();
    }

    getFeatureName (objId, attribs) {
        return this._featClasses[this._defaultFC].getFeatureName(objId, attribs);
    }

    getSymbology () {
        return this._featClasses[this._defaultFC].getSymbology();
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

    /**
     * Create a layer record with the appropriate geoApi layer type.  Layer config
     * should be fully merged with all layer options defined (i.e. this constructor
     * will not apply any defaults).
     * @param {Object} layerClass    the ESRI api object for image server layers
     * @param {Object} apiRef        object pointing to the geoApi. allows us to call other geoApi functions.
     * @param {Object} config        layer config values
     * @param {Object} esriLayer     an optional pre-constructed layer
     * @param {Function} epsgLookup  an optional lookup function for EPSG codes (see geoService for signature)
     */
    constructor (layerClass, apiRef, config, esriLayer, epsgLookup) {
        // TODO if we have nothing to add here, delete this constructor
        super(apiRef, config, esriLayer, epsgLookup);
    }

    /**
    * Triggers when the layer loads.
    *
    * @function onLoad
    */
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

    /**
     * Create a layer record with the appropriate geoApi layer type.  Layer config
     * should be fully merged with all layer options defined (i.e. this constructor
     * will not apply any defaults).
     * @param {Object} layerClass    the ESRI api object for dynamic layers
     * @param {Object} esriRequest   the ESRI api object for making web requests with proxy support
     * @param {Object} apiRef        object pointing to the geoApi. allows us to call other geoApi functions
     * @param {Object} config        layer config values
     * @param {Object} esriLayer     an optional pre-constructed layer
     * @param {Function} epsgLookup  an optional lookup function for EPSG codes (see geoService for signature)
     */
    constructor (layerClass, esriRequest, apiRef, config, esriLayer, epsgLookup) {
        super(layerClass, esriRequest, apiRef, config, esriLayer, epsgLookup);
        this.ArcGISDynamicMapServiceLayer = layerClass;

        // TODO what is the case where we have dynamic layer already prepared
        //      and passed in? Generally this only applies to file layers (which
        //      are feature layers).

        // TODO figure out controls on config
        // TODO worry about placeholders. WORRY. how does that even work here?

        this._proxies = {};

    }

    /**
     * Return a proxy interface for a child layer
     *
     * @param {Integer} featureIdx    index of child entry (leaf or group)
     * @return {Object}               proxy interface for given child
     */
    getChildProxy (featureIdx) {
        // TODO verify we have integer coming in and not a string
        // in this case, featureIdx can also be a group index
        if (this._proxies[featureIdx.toString()]) {
            return this._proxies[featureIdx.toString()];
        } else {
            throw new Error(`attempt to get non-existing child proxy. Index ${featureIdx}`);
        }
    }

    // TODO docs
    getFeatureCount (featureIdx) {
        // point url to sub-index we want
        // TODO might change how we manage index and url
        return super.getFeatureCount(this._layer.url + '/' + featureIdx);
    }

    /**
    * Triggers when the layer loads.
    *
    * @function onLoad
    */
    onLoad () {

        super.onLoad();

        // don't worry about structured legend. the legend part is separate from
        // the layers part. we just load what we are told to. the legend module
        // will handle the structured part.

        // TODO do we need to do config defaulting here?
        //      e.g. a group may be defined in the config. if there is
        //      no specific config items for the children of the group,
        //      should we be copying the parent values and using those
        //      as initial values?

        // NOTE regarding config objects. any config part coming from a file
        //      or RCS will be pre-defaulted. I.e. we don't need to worry about
        //      a missing property or figuring out the default value.
        //      For child layers that are "revealed" after a dynamic layer loads,
        //      we use parent configs for the defaults, unless specifics are
        //      already included for the child in the config file.
        //
        //      for now, the only relevant properties to be propagated
        //      from parent to child are .state and .controls .
        //      .outfields does not make sense as chilren can have different fields.

        // subconfig lookup. initialize with the layer root (-1), then add
        // in anything provided in the initial config.
        const subConfigs = {
            '-1': {
                state: this.config.state,
                controls: this.config.controls
            }
        };

        // do child options first, then layer entries. in weird case where both are defined,
        // will give priority to the layer entries.
        // works because both child options and layer entries have identical structure
        // for properties we need in this routine.
        this.config.childOptions.concat(this.config.layerEntries).forEach(c => {
            subConfigs[c.index.toString()] = c;
        });

        // subfunction to either return a stored sub-config, or
        // derive a new subconfig from the parent config.
        // both params integers in string format.
        const fetchSubConfig = (id, parentId) => {
            if (subConfigs[id]) {
                return subConfigs[id];
            } else {
                // copy properties from parent
                const newConfig = {
                    state: Object.assign({}, subConfigs[parentId].state),
                    controls: subConfigs[parentId].controls.concat()
                };
                subConfigs[id] = newConfig;
                return newConfig;
            }
        };

        // this subfunction will recursively crawl a dynamic layerInfo structure.
        // it will generate proxy objects for all groups and leafs under the
        // input layerInfo.
        // it also collects and returns an array of leaf nodes so each group
        // can store it and have fast access to all leaves under it.
        const processLayerInfo = (layerInfo, layerProxies, parentId) => {
            const sId = layerInfo.id.toString();
            const subConfig = fetchSubConfig(sId, parentId.toString());
            if (layerInfo.subLayerIds && layerInfo.subLayerIds.length > 0) {
                // group
                // TODO probably need some placeholder magic going on here too
                // TODO do we need to apply any config state?
                // TODO figure out control lists, whats available, whats disabled.
                //      supply on second and third parameters
                const group = new LayerInterface(this, subConfig.controls);

                group.convertToDynamicGroup(this, sId);

                layerProxies[sId] = group;

                // process the kids in the group.
                // store the child leaves in the internal variable
                layerInfo.subLayerIds.forEach(slid => {
                    group._childLeafs = group._childLeafs.concat(
                        processLayerInfo(this._layer.layerInfos[slid], layerProxies, sId));
                });

                return group._childLeafs;
            } else {
                // leaf
                // TODO figure out control lists, whats available, whats disabled.
                //      supply on second and third parameters.
                //      might need to steal from parent, since auto-gen may not have explicit
                //      config settings.
                const leaf = new LayerInterface(null, subConfig.controls);
                leaf.convertToDynamicLeaf(new PlaceholderFC(this, layerInfo.name));
                layerProxies[sId] = leaf;
                return [leaf];
            }
        };

        if (this.config.layerEntries) {
            this.config.layerEntries.forEach(le => {
                processLayerInfo(this._layer.layerInfos[le.index], this._proxies, -1);
            });
        }

        // trigger attribute load and set up children bundles.
        // TODO do we need an options object, with .skip set for sub-layers we are not dealing with?
        //      would need to inspect all leafs in this._layer.layerInfos,
        //      then cross reference against incoming config.  extra code probably
        //      needed to derive auto-gen childs that are not explicitly in config.
        //      Alternate: figure all this out on constructor, as we might need placeholders????
        //                 update: we are doing this, but it gives us a list of things to keep,
        //                         not to skip.
        //      Alternate: add new option that is opposite of .skip.  Will be more of a
        //                 .only, and we won't have to derive a "skip" set from our inclusive
        //                 list that was created in the ._proxies
        //      Furthermore: skipping / being effecient might not really matter here anymore.
        //                   back in the day, loadLayerAttribs would actually load everything.
        //                   now it just sets up promises that dont trigger until someone asks for
        //                   the information.
        const attributeBundle = this._apiRef.attribs.loadLayerAttribs(this._layer);

        // idx is a string
        attributeBundle.indexes.forEach(idx => {
            // TODO need to worry about Raster Layers here.  DynamicFC is based off of
            //      attribute things.
            // TODO need to pass some type of initial state to these FCs (e.g. queryable)
            this._featClasses[idx] = new DynamicFC(this, idx, attributeBundle[idx]);

            // if we have a proxy watching this leaf, replace its placeholder with the real data
            if (this._proxies[idx]) {
                this._proxies[idx].updateSource(this._featClasses[idx]);
            }
        });

        // TODO after config defaulting for any autogen children,
        //      need to get list of visible leaves and manually set
        //      the layer doing this._layer.setVisibleLayers([visible indexes]) .
        //      possibly need to do something similar for opacity (if supported)

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

    isQueryable (childIdx) {
        return this._featClasses[childIdx].queryable;
    }

    getGeomType (childIdx) {
        return this._featClasses[childIdx].geomType;
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

    /**
    * Returns attribute data for a child layer.
    *
    * @function getAttribs
    * @param {String} childIndex  the index of the child layer
    * @returns {Promise}          resolves with a layer attribute data object
    */
    getAttribs (childIndex) {
        return this._featClasses[childIndex].getAttribs();
    }

    /**
    * Returns layer-specific data for a child layer
    *
    * @function getLayerData
    * @param {String} childIndex  the index of the child layer
    * @returns {Promise}          resolves with a layer data object
    */
    getLayerData (childIndex) {
        return this._featClasses[childIndex].getLayerData();
    }

    getFeatureName (childIndex, objId, attribs) {
        return this._featClasses[childIndex].getFeatureName(objId, attribs);
    }

    getSymbology (childIndex) {
        return this._featClasses[childIndex].getSymbology();
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

    // TODO docs
    getChildName (index) {
        // TODO revisit logic. is this the best way to do this? what are the needs of the consuming code?
        // TODO restructure so WMS can use this too?
        // will not use FC classes, as we also need group names
        return this._layer.layerInfos[index].name;
    }

}

/**
 * @class TileRecord
 */
class TileRecord extends LayerRecord {

    /**
     * Create a layer record with the appropriate geoApi layer type.  Layer config
     * should be fully merged with all layer options defined (i.e. this constructor
     * will not apply any defaults).
     * @param {Object} layerClass    the ESRI api object for tile layers
     * @param {Object} apiRef        object pointing to the geoApi. allows us to call other geoApi functions.
     * @param {Object} config        layer config values
     * @param {Object} esriLayer     an optional pre-constructed layer
     * @param {Function} epsgLookup  an optional lookup function for EPSG codes (see geoService for signature)
     */
    constructor (layerClass, apiRef, config, esriLayer, epsgLookup) {
        // TODO if we have nothing to add here, delete this constructor
        super(apiRef, config, esriLayer, epsgLookup);
    }

    /**
    * Triggers when the layer loads.
    *
    * @function onLoad
    */
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

    /**
     * Create a layer record with the appropriate geoApi layer type.  Layer config
     * should be fully merged with all layer options defined (i.e. this constructor
     * will not apply any defaults).
     * @param {Object} layerClass    the ESRI api object for wms layers
     * @param {Object} apiRef        object pointing to the geoApi. allows us to call other geoApi functions.
     * @param {Object} config        layer config values
     * @param {Object} esriLayer     an optional pre-constructed layer
     * @param {Function} epsgLookup  an optional lookup function for EPSG codes (see geoService for signature)
     */
    constructor (layerClass, apiRef, config, esriLayer, epsgLookup) {
        // TODO if we have nothing to add here, delete this constructor
        super(layerClass, apiRef, config, esriLayer, epsgLookup);
    }

    makeLayerConfig () {
        const cfg = super.makeLayerConfig();
        cfg.visibleLayers = this.config.layerEntries.map(le => le.id);
        return cfg;
    }

    /**
    * Triggers when the layer loads.
    *
    * @function onLoad
    */
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

    // TODO add flags for file based layers?

    /**
     * Create a layer record with the appropriate geoApi layer type.  Layer config
     * should be fully merged with all layer options defined (i.e. this constructor
     * will not apply any defaults).
     * @param {Object} layerClass    the ESRI api object for feature layers
     * @param {Object} esriRequest   the ESRI api object for making web requests with proxy support
     * @param {Object} apiRef        object pointing to the geoApi. allows us to call other geoApi functions.
     * @param {Object} config        layer config values
     * @param {Object} esriLayer     an optional pre-constructed layer
     * @param {Function} epsgLookup  an optional lookup function for EPSG codes (see geoService for signature)
     */
    constructor (layerClass, esriRequest, apiRef, config, esriLayer, epsgLookup) {
        // TODO if we have nothing to add here, delete this constructor
        super(layerClass, esriRequest, apiRef, config, esriLayer, epsgLookup);
    }

    // TODO ensure whoever is making layers from config fragments is also setting the feature index.
    //      remove comment once that is done

    makeLayerConfig () {
        const cfg = super.makeLayerConfig();
        cfg.mode = this.config.state.snapshot ? this._layerClass.MODE_SNAPSHOT
                                                        : this._layerClass.MODE_ONDEMAND;

        // TODO confirm this logic. old code mapped .options.snapshot.value to the button -- meaning if we were in snapshot mode,
        //      we would want the button disabled. in the refactor, the button may get it's enabled/disabled from a different source.
        this.config.state.snapshot = !this.config.state.snapshot;
        return cfg;
    }

    // returns the proxy interface object for the root of the layer (i.e. main entry in legend, not nested child things)
    // TODO docs
    getProxy () {
        // TODO figure out control name arrays from config (specifically disabled stuff)
        //      updated config schema uses term "enabled" but have a feeling it really means available
        // TODO figure out how placeholders work with all this
        if (!this._rootProxy) {
            this._rootProxy = new LayerInterface(this, this.initialConfig.controls);
            this._rootProxy.convertToFeatureLayer(this);
        }
        return this._rootProxy;
    }

    /**
    * Triggers when the layer loads.
    *
    * @function onLoad
    */
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

    // TODO determine who is setting this. if we have an internal
    //      snapshot process, it might become a read-only property
    get isSnapshot () { return this._snapshot; }
    set isSnapshot (value) { this._snapshot = value; }

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
    WmsFC, // TODO compiler temp. remove once we are referencing it
    States: states // TODO should this get exposed on the geoApi as well? currently layer module is not re-exposing it
});

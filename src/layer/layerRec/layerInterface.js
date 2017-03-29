'use strict';

const shared = require('./shared.js')();

// Controls Interface class is used to provide something to the UI that it can bind to.
// It helps the UI keep in line with the layer state.
// Due to bindings, we cannot destroy & recreate an interface when a legend item
// goes from 'Unknown Placeholder' to 'Specific Layer Type'. This means we cannot
// do object heirarchies, as to go from PlaceholderInterface to FeatureLayerInterface
// would require a new object. Instead, we have a class that exposes all possible
// methods and properties as error throwing stubs. Then we replace those functions
// with real ones once we know the flavour of interface we want.

class LayerInterface {

    /**
     * @param {Object} source                          object that provides info to the interface. usually a LayerRecord or FeatureClass
     * @param {Array} availableControls [optional=[]]  an array or controls names that are displayed inside the legendEntry
     * @param {Array} disabledControls [optional=[]]   an array or controls names that are disabled and cannot be interacted wiht by a user
     */
    constructor (source, availableControls = [], disabledControls = []) {
        // TEST STATUS basic
        this._source = source;
        this._availableControls = availableControls;
        this._disabledControls = disabledControls;
        this._isPlaceholder = true;
    }

    // shortcut function for throwing errors on unimplemented functions.
    _iAmError () {
        throw new Error('Call not supported.');
    }

    get isPlaceholder () { return this._isPlaceholder; } // returns Boolean

    // these expose ui controls available on the interface and indicate which ones are disabled
    get availableControls () { return this._availableControls; } // returns Array
    get disabledControls () { return this._disabledControls; } // returns Array
    get symbology () { this._iAmError(); } // returns Object

    // can be group or node name
    get name () { this._iAmError(); } // returns String

    // these are needed for the type flag
    get layerType () { this._iAmError(); } // returns String
    get geometryType () { this._iAmError(); } // returns String
    get featureCount () { this._iAmError(); } // returns Integer

    // layer states
    get state () { this._iAmError(); } // returns String
    get isRefreshing () { this._iAmError(); } // returns Boolean

    // these return the current values of the corresponding controls
    get visibility () { this._iAmError(); } // returns Boolean
    get opacity () { this._iAmError(); } // returns Decimal
    get boundingBox () { this._iAmError(); } // returns Boolean
    get query () { this._iAmError(); } // returns Boolean
    get snapshot () { this._iAmError(); } // returns Boolean

    // fetches attributes for use in the datatable
    get formattedAttributes () { this._iAmError(); } // returns Promise of Object

    // content for static legend entires (non-layer/non-group)
    get infoType () { this._iAmError(); } // returns ?
    get infoContent () { this._iAmError(); } // returns ?

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
        // TEST STATUS basic
        this._source = newSource;
    }

    convertToSingleLayer (layerRecord) {
        // TEST STATUS basic
        this._source = layerRecord;
        this._isPlaceholder = false;

        newProp(this, 'symbology', standardGetSymbology);
        newProp(this, 'state', standardGetState);
        newProp(this, 'isRefreshing', standardGetIsRefreshing);

        newProp(this, 'visibility', standardGetVisibility);
        newProp(this, 'opacity', standardGetOpacity);
        newProp(this, 'boundingBox', standardGetBoundingBox);
        newProp(this, 'query', standardGetQuery);

        newProp(this, 'name', standardGetName);

        newProp(this, 'geometryType', standardGetGeometryType);
        newProp(this, 'layerType', standardGetLayerType);
        newProp(this, 'featureCount', standardGetFeatureCount);

        this.setVisibility = standardSetVisibility;
        this.setOpacity = standardSetOpacity;
        this.setBoundingBox = standardSetBoundingBox;
        this.setQuery = standardSetQuery;
    }

    convertToFeatureLayer (layerRecord) {
        // TEST STATUS basic
        this.convertToSingleLayer(layerRecord);

        newProp(this, 'snapshot', featureGetSnapshot);
        newProp(this, 'formattedAttributes', standardGetFormattedAttributes);
        newProp(this, 'geometryType', featureGetGeometryType);
        newProp(this, 'featureCount', featureGetFeatureCount);

        this.setSnapshot = featureSetSnapshot;
    }

    convertToDynamicLeaf (dynamicFC) {
        // TEST STATUS basic
        this._source = dynamicFC;
        this._isPlaceholder = false;

        // TODO name property
        newProp(this, 'symbology', dynamicLeafGetSymbology);
        newProp(this, 'state', dynamicLeafGetState);
        newProp(this, 'isRefreshing', dynamicLeafGetIsRefreshing);

        newProp(this, 'name', dynamicLeafGetName);

        newProp(this, 'visibility', dynamicLeafGetVisibility);
        newProp(this, 'opacity', dynamicLeafGetOpacity);
        newProp(this, 'query', dynamicLeafGetQuery);
        newProp(this, 'formattedAttributes', dynamicLeafGetFormattedAttributes);

        newProp(this, 'geometryType', dynamicLeafGetGeometryType);
        newProp(this, 'layerType', dynamicLeafGetLayerType);
        newProp(this, 'featureCount', dynamicLeafGetFeatureCount);

        this.setVisibility = dynamicLeafSetVisibility;
        this.setOpacity = dynamicLeafSetOpacity;
        this.setQuery = dynamicLeafSetQuery;
    }

    convertToDynamicGroup (layerRecord, groupId, name = '') {
        // TEST STATUS basic
        // Note: we do not support opacity on dynamic groups
        this._source = layerRecord;
        this._groupId = groupId;
        this._isPlaceholder = false;
        this._name = name;

        // contains a list of all child leaves for fast access
        this._childLeafs = [];

        newProp(this, 'visibility', dynamicGroupGetVisibility);
        newProp(this, 'layerType', dynamicGroupGetLayerType);
        newProp(this, 'state', dynamicGroupGetState);
        newProp(this, 'isRefreshing', dynamicGroupGetIsRefreshing);
        newProp(this, 'name', dynamicGroupGetName);

        this.setVisibility = dynamicGroupSetVisibility;
    }

    convertToStatic () {
        // TEST STATUS none
        // TODO figure out what is involved here.
        this._isPlaceholder = false;
    }

    convertToLegendGroup (legendGroupRecord) {
        this._source = legendGroupRecord;
        this._isPlaceholder = false; // TODO is fake considered placeholder?

        newProp(this, 'visibility', standardGetVisibility);
        newProp(this, 'name', standardGetName);
        newProp(this, 'query', standardGetQuery);
        newProp(this, 'state', standardGetState);
        newProp(this, 'isRefreshing', groupGetIsRefreshing);
        newProp(this, 'layerType', standardGetLayerType);

        this.setVisibility = standardSetVisibility;
        this.setQuery = standardSetQuery;

    }

    convertToLegendEntry (legendEntryRecord) {
        this._source = legendEntryRecord;
        this._isPlaceholder = false; // TODO is fake considered placeholder?

        // NOTE: while we could just call this.convertToFeatureLayer(),
        //       it is risky because if something special changes for feature layer,
        //       we might not want it affecting legend entry.
        newProp(this, 'symbology', standardGetSymbology);
        newProp(this, 'state', standardGetState);
        newProp(this, 'isRefreshing', standardGetIsRefreshing);

        newProp(this, 'visibility', standardGetVisibility);
        newProp(this, 'opacity', standardGetOpacity);
        newProp(this, 'boundingBox', standardGetBoundingBox);
        newProp(this, 'query', standardGetQuery);

        newProp(this, 'name', standardGetName);

        newProp(this, 'geometryType', standardGetGeometryType);
        newProp(this, 'layerType', standardGetLayerType);

        newProp(this, 'snapshot', featureGetSnapshot);
        newProp(this, 'formattedAttributes', standardGetFormattedAttributes);
        newProp(this, 'geometryType', featureGetGeometryType);
        newProp(this, 'featureCount', featureGetFeatureCount);

        this.setVisibility = standardSetVisibility;
        this.setOpacity = standardSetOpacity;
        this.setBoundingBox = standardSetBoundingBox;
        this.setQuery = standardSetQuery;
    }

    convertToPlaceholder (placeholderFC) {
        this._source = placeholderFC;
        this._isPlaceholder = true;

        newProp(this, 'symbology', standardGetSymbology);
        newProp(this, 'name', standardGetName);
        newProp(this, 'state', standardGetState);
        newProp(this, 'isRefreshing', placeholderGetIsRefreshing);
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
    // TEST STATUS none
    Object.defineProperty(target, propName, {
        get: getter,
        enumerable: true,
        configurable: true
    });
}

// these functions are upgrades to the duds above.
// we don't use arrow notation, as we want the `this` to point at the object
// that these functions get smashed into.

function stateCalculator(inputState) {
    // returns one of Loading, Loaded, Error
    // TODO verify what DEFAULT actually is
    const states = shared.states;

    switch (inputState) {
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

function standardGetState() {
    /* jshint validthis: true */

    // TEST STATUS none
    return stateCalculator(this._source.state);
}

function dynamicLeafGetState() {
    /* jshint validthis: true */

    // TEST STATUS none
    return stateCalculator(this._source.state);
}

function dynamicGroupGetState() {
    /* jshint validthis: true */

    // TEST STATUS none
    return stateCalculator(this._source.state);
}

function standardGetIsRefreshing() {
    /* jshint validthis: true */

    // TEST STATUS none
    return this._source.state === shared.states.REFRESH || this._source.state === shared.states.LOADING;
}

function placeholderGetIsRefreshing() {
    /* jshint validthis: true */

    // TEST STATUS none
    return true;
}

function groupGetIsRefreshing() {
    /* jshint validthis: true */

    // TEST STATUS none
    return false;
}

function dynamicLeafGetIsRefreshing() {
    /* jshint validthis: true */

    // TEST STATUS none
    return this._source.state === shared.states.REFRESH || this._source.state === shared.states.LOADING;
}

function dynamicGroupGetIsRefreshing() {
    /* jshint validthis: true */

    // TEST STATUS none
    return this._source.state === shared.states.REFRESH || this._source.state === shared.states.LOADING;
}

function standardGetVisibility() {
    /* jshint validthis: true */

    // TEST STATUS none
    return this._source.visibility;
}

function dynamicLeafGetVisibility() {
    /* jshint validthis: true */

    // TEST STATUS basic
    return this._source.getVisibility();
}

function dynamicGroupGetVisibility() {
    /* jshint validthis: true */

    // TEST STATUS basic
    // check visibility of all children.
    // only return false if all children are invisible
    return this._childLeafs.some(leaf => { return leaf.visibility; });
}

function standardGetName() {
    /* jshint validthis: true */

    // TEST STATUS none
    return this._source.name;
}

function dynamicLeafGetName() {
    /* jshint validthis: true */

    // TEST STATUS none
    return this._source.name;
}

function dynamicGroupGetName() {
    /* jshint validthis: true */

    // TEST STATUS none
    // funny case here. dynamic groups source the parent record.
    // so we just hold the name within the proxy.
    return this._name;
}

function standardGetOpacity() {
    /* jshint validthis: true */

    // TEST STATUS none
    return this._source.opacity;
}

function dynamicLeafGetOpacity() {
    /* jshint validthis: true */

    // TEST STATUS none
    return this._source.opacity;
}

function standardGetLayerType() {
    /* jshint validthis: true */

    // TEST STATUS none
    // it's a promise
    return this._source.layerType;
}

function dynamicGroupGetLayerType() {
    /* jshint validthis: true */

    // TEST STATUS none
    return shared.clientLayerType.ESRI_GROUP;
}

function dynamicLeafGetLayerType() {
    /* jshint validthis: true */

    // TEST STATUS none
    return this._source.layerType;
}

function standardGetBoundingBox() {
    /* jshint validthis: true */

    // TEST STATUS none
    // dont be fooled by function/prop name, we are returning bbox visibility,
    // not the box itself
    return this._source.isBBoxVisible();
}

function standardGetQuery() {
    /* jshint validthis: true */

    // TEST STATUS none
    return this._source.isQueryable();
}

// TODO do we have group-level queryable settings?
//      e.g. click a control on dynamic root, all childs get setting?
function dynamicLeafGetQuery() {
    /* jshint validthis: true */

    // TEST STATUS none
    return this._source.queryable();
}

function standardGetFormattedAttributes() {
    /* jshint validthis: true */

    // TEST STATUS none
    return this._source.getFormattedAttributes();
}

function dynamicLeafGetFormattedAttributes() {
    /* jshint validthis: true */

    // TEST STATUS none
    // TODO code-wise this looks identical to standardGetFormattedAttributes.
    //      however in this case, ._source is a DynamicFC, not a LayerRecord.
    //      This is safer. Deleting this would avoid the duplication. Decide.
    return this._source.getFormattedAttributes();
}

function standardGetSymbology() {
    /* jshint validthis: true */

    // TEST STATUS none
    return this._source.symbology;
}

function dynamicLeafGetSymbology() {
    /* jshint validthis: true */

    // TEST STATUS none
    // TODO code-wise this looks identical to standardGetSymbology.
    //      however in this case, ._source is a DynamicFC, not a LayerRecord.
    //      This is safer. Deleting this would avoid the duplication. Decide.
    return this._source.symbology;
}

function standardGetGeometryType() {
    /* jshint validthis: true */

    // TEST STATUS none
    return undefined;
}

function featureGetGeometryType() {
    /* jshint validthis: true */

    // TEST STATUS none
    return this._source.getGeomType();
}

function dynamicLeafGetGeometryType() {
    /* jshint validthis: true */

    // TEST STATUS none
    return this._source.geomType;
}

function standardGetFeatureCount() {
    /* jshint validthis: true */

    // TEST STATUS none
    return undefined;
}

function featureGetFeatureCount() {
    /* jshint validthis: true */

    // TEST STATUS none
    return this._source.featureCount;
}

function dynamicLeafGetFeatureCount() {
    /* jshint validthis: true */

    // TEST STATUS none
    return this._source.featureCount;
}

function standardSetVisibility(value) {
    /* jshint validthis: true */

    // TEST STATUS none
    this._source.visibility = value;
}

function dynamicLeafSetVisibility(value) {
    /* jshint validthis: true */

    // TEST STATUS none
    this._source.setVisibility(value);

    // TODO see if we need to trigger any refresh of parents.
    //      it may be that the bindings automatically work.
}

function dynamicGroupSetVisibility(value) {
    /* jshint validthis: true */

    // TEST STATUS none
    // TODO be aware of cycles of updates. may need a force / dont broadcast flag.
    //      since we are only hitting leaves and skipping child-groups, should be ok.
    this._childLeafs.forEach(leaf => {
        leaf.setVisibility(value);
    });
}

function standardSetOpacity(value) {
    /* jshint validthis: true */

    // TEST STATUS none
    this._source.opacity = value;
}

function dynamicLeafSetOpacity(value) {
    /* jshint validthis: true */

    // TEST STATUS none
    this._source.opacity = value;
}

function standardSetBoundingBox(value) {
    /* jshint validthis: true */

    // TEST STATUS none
    // TODO Is it possible to have control without bbox layer?
    if (this._source.bbox) {
        this._source.bbox.visible = value;
    }
}

function standardSetQuery(value) {
    /* jshint validthis: true */

    // TEST STATUS none
    this._source.setQueryable(value);
}

function dynamicLeafSetQuery(value) {
    /* jshint validthis: true */

    // TEST STATUS none
    this._source.queryable = value;
}

function featureGetSnapshot() {
    /* jshint validthis: true */

    // TEST STATUS none
    return this._source.isSnapshot;
}

function featureSetSnapshot() {
    // TEST STATUS none
    // TODO trigger the snapshot process.  need the big picture on how this orchestrates.
    //      it involves a layer reload so possible this function is irrelevant, as the record
    //      will likely get nuked
    console.log('MOCKING THE SNAPSHOT PROCESS');
}

// TODO implement infoType / infoContent for static entry.
//      who supplies this? how does it get passed in.

module.exports = () => ({
    LayerInterface
});

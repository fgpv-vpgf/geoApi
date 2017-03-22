'use strict';

const basicFC = require('./basicFC.js')();
const layerRecord = require('./layerRecord.js')();
const shared = require('./shared.js')();

/**
 * @class TileRecord
 */
class TileRecord extends layerRecord.LayerRecord {

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
        // TEST STATUS none
        // TODO if we have nothing to add here, delete this constructor
        super(layerClass, apiRef, config, esriLayer, epsgLookup);
    }

    /**
    * Triggers when the layer loads.
    *
    * @function onLoad
    */
    onLoad () {
        // TEST STATUS none
        super.onLoad();

        // TODO consider making this a function, as it is common across less-fancy layers
        this._defaultFC = '0';
        this._featClasses['0'] = new basicFC.BasicFC(this, '0', this.config);

        this.getSymbology().then(symbolArray => {
            // remove anything from the stack, then add new symbols to the stack
            this.symbology.stack.splice(0, this.symbology.stack.length, ...symbolArray);
        });
    }

    get layerType () { return Promise.resolve(shared.clientLayerType.ESRI_TILE); }

}

module.exports = () => ({
    TileRecord
});

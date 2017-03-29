'use strict';

const layerInterface = require('./layerInterface.js')();
const shared = require('./shared.js')();
const legendBaseRecord = require('./legendBaseRecord.js')();

/**
 * @class LegendGroupRecord
 */
class LegendGroupRecord extends legendBaseRecord.LegendBaseRecord {
    // NOTE we don't inherit from LayerRecord, because we don't want all the layerish default behavior
    // Fake News.

    // this object is friends with `entryGroup` config element

    // TODO verifiy layerId is useful / needed
    // get layerId () { return this.config.id; }

    get layerType () {
        return undefined;
    }

    get state () { return shared.states.LOADED; }

    // TODO opacity? how do you summarize opacity over children?  average?? it would still look funny

    // TODO does fake news have symbols?
    //      according to schema, no

    // returns the proxy interface object for the root of the layer (i.e. main entry in legend, not nested child things)
    // TODO docs
    getProxy () {
        // TEST STATUS none
        // TODO figure out control name arrays, if they apply at all for fake groups, and where they come from

        if (!this._rootProxy) {
            this._rootProxy = new layerInterface.LayerInterface(this);
            this._rootProxy.convertToLegendGroup(this);
        }
        return this._rootProxy;
    }

    /**
     * Create a legend record to support groups not tied to a layer.
     * @param {Object} name        config object for the group
     * @param {Array} childProxies   an optional array of proxies for immediate children of the group
     *
     */
    constructor (name, childProxies) {
        // TEST STATUS none

        // TODO will we have a config coming in?  if so, make that part of the constructor, do stuff with it.
        super(childProxies);

        this.name = name;
    }
}

module.exports = () => ({
    LegendGroupRecord
});

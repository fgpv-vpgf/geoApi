'use strict';

const layerInterface = require('./layerInterface.js')();

/**
 * @class LegendGroupRecord
 */
class LegendGroupRecord {
    // NOTE we don't inherit from LayerRecord, because we don't want all the layerish default behavior
    // Fake News.

    // this object is friends with `entryGroup` config element

    // TODO verifiy layerId is useful / needed
    // get layerId () { return this.config.id; }
    get layerName () { return this._name; } // the top level layer name
    set layerName (value) { this._name = value; }

    get visibility () {
        // cumulation of visiblity of all childs
        return this._childProxies.some(p => p.visibility);
    }
    set visibility (value) {
        // set all the kids
        this._childProxies.forEach(p => { p.setVisibility(value); });
    }

    // TODO do we need a layer type?  e.g. `Fake`?

    // TODO docs
    isQueryable () {
        // TEST STATUS none
        return this._childProxies.some(p => p.query);
    }

    // TODO docs
    setQueryable (value) {
        // TEST STATUS none
        this._childProxies.forEach(p => { p.setQuery(value); });
    }

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

    // add a child proxy post-constructor
    // TODO docs
    addChildProxy (proxy) {
        // TEST STATUS none
        this._childProxies.push(proxy);
    }

    removeChildProxy (proxy) {
        // TEST STATUS none
        const idx = this._childProxies.indexOf(proxy);

        if (idx > -1) {
            this._childProxies.splice(idx, 1);
        }
    }

    /**
     * Create a legend record to support groups not tied to a layer.
     * @param {String} name          the text to show for the group
     * @param {Array} childProxies   an optional array of proxies for immediate children of the group
     *
     */
    constructor (name, childProxies) {
        // TEST STATUS none

        // TODO will we have a config coming in?  if so, make that part of the constructor, do stuff with it.

        this._name = name;
        this._childProxies = childProxies || [];
    }
}

module.exports = () => ({
    LegendGroupRecord
});

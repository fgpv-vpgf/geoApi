'use strict';

const layerInterface = require('./layerInterface.js')();
const legendGroupRecord = require('./legendGroupRecord.js')();

/**
 * @class LegendSetRecord
 */
class LegendSetRecord extends legendGroupRecord.LegendGroupRecord {
    // Fake News.

    // this object is friends with `visibilitySet` config element

    // even though the getter is identical to the one in the subclass,
    // the code checker will cry tears if it's not redeclared here.
    get visibility () {
        // cumulation of visiblity of all childs
        return this._childProxies.some(p => p.visibility);
    }
    set visibility (value) {
        if (value) {
            // if something is already visible, do nothing. if not, turn on first item
            if (!this.visibility && this._childProxies.length > 0) {
                this._childProxies[0].setVisibility(value);
            }
        } else {
            // make all children invisible
            this._childProxies.forEach(p => { p.setVisibility(value); });
        }
    }

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

}

module.exports = () => ({
    LegendSetRecord
});

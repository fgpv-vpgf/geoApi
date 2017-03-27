'use strict';

const layerInterface = require('./layerInterface.js')();
const fakeGroupRecord = require('./fakeGroupRecord.js')();

/**
 * @class FakeGroupRecord
 */
class BoundFakeGroupRecord extends fakeGroupRecord.FakeGroupRecord {
    // NOTE we don't inherit from LayerRecord, because we don't want all the layerish default behavior
    // Fake News.

    // this object is friends with `entry` config element

    // this object collects a number of layers. One layer is the master layer,
    // which means it provides layer name and symbology
    // in the legend, we do not see a list of child layers under the entry.
    // it is presented as one layer, and the controls end up changing
    // all layers in the collection. so there is no way to just adjust
    // visibility on one sub-layer, for example.

    // TODO do we need a layer type?  e.g. `Fake`?

    get layerName () {
        if (this._masterProxy) {
            return this._masterProxy.name;
        } else {
            return '';
        }
    }

    // because there are no controls for individual opacity, things should stay aligned.
    // if someone makes a config where children have different settings, too bad.
    // we will display the master layer setting for simplicity.

    get opacity () {
        // TEST STATUS none
        if (this._masterProxy) {
            return this._masterProxy.opacity;
        } else {
            return 1; // TODO what should a proper default be? example of this situation??
        }
    }
    set opacity (value) {
        // TEST STATUS none
        // TODO do we need to worry about a layers that dont support opacity being registered as children?
        this._childProxies.forEach(p => { p.setOpacity(value); });
    }

    get symbology () {
        if (this._masterProxy) {
            return this._masterProxy.symbology;
        } else {
            // TODO should we make an object with a placeholder here? e.g. {x: 'icons', stack: [makeplaceholder()]}
            return undefined;
        }
    }

    // returns the proxy interface object for the root of the layer (i.e. main entry in legend, not nested child things)
    // TODO docs
    getProxy () {
        // TEST STATUS none
        // TODO figure out control name arrays, if they apply at all for fake groups, and where they come from

        if (!this._rootProxy) {
            this._rootProxy = new layerInterface.LayerInterface(this);
            this._rootProxy.convertToBoundFakeGroup(this);
        }
        return this._rootProxy;
    }

    // for now, we assume the proxy has already been added (via constructor or addChildProxy)
    setMasterProxy (proxy) {
        this._masterProxy = proxy;
        this._name = proxy.name;
    }

    /**
     * Create a bound fake record to support layer groups with a master layer
     * @param {Object} config        config object for the group
     * @param {Array} childProxies   an optional array of proxies for immediate children of the group
     *
     */
    constructor (config, childProxies) {
        // TEST STATUS none
        super('', childProxies);

        // TODO do we need anything from the config? if not, remove from constructor parameter.
        console.log(config);

    }
}

module.exports = () => ({
    BoundFakeGroupRecord
});

'use strict';

const layerInterface = require('./layerInterface.js')();
const legendGroupRecord = require('./legendGroupRecord.js')();

/**
 * @class LegendEntryRecord
 */
class LegendEntryRecord extends legendGroupRecord.LegendGroupRecord {
    // NOTE we don't inherit from LayerRecord, because we don't want all the layerish default behavior
    // Fake News.

    // this object is friends with `entry` config element

    // this object collects a number of layers. One layer is the master layer,
    // which means it provides layer name and symbology
    // in the legend, we do not see a list of child layers under the entry.
    // it is presented as one layer, and the controls end up changing
    // all layers in the collection. so there is no way to just adjust
    // visibility on one sub-layer, for example.

    // TODO right now we are piping most of the master proxy's values out.  it is a tad
    //      redundant (e.g. real layer -> real layer proxy -> legend entry -> legend entry proxy -> client).
    //      if we had magic, we would make the proxy for legend entry to simply be the master proxy, and
    //      then override the special case properties (set visibility, set opacity).
    //      doing this at the moment is a bit risky, because if something else in the legend starts
    //      referencing the master layer and it's proxy, it will be given this modified proxy and
    //      will cause chaos and failures.  for the moment, continue with redundant and safe approach.

    // NOTE for now, we are assuming the implementer sets the master proxy before using this object.
    //      most properties / functions will error if attempts are made to use them early, as they
    //      need a master proxy. if this becomes a problem, we can add default values to return
    //      if the master proxy is not present.

    // these pretty much just pass on the master proxy values.

    // because there are no controls for individual opacity, things should stay aligned.
    // if someone makes a config where children have different settings, too bad.
    // we will display the master layer setting for simplicity.
    get opacity () { return this._masterProxy.opacity; }

    get name () { return this._masterProxy.name; }
    get symbology () { return this._masterProxy.symbology; }
    getGeomType () { return this._masterProxy.geometryType; }
    get featureCount () { return this._masterProxy.featureCount; }
    get state () { return this._masterProxy.state; }
    isBBoxVisible () { return this._masterProxy.boundingBox; }
    isSnapshot () { return this._masterProxy.snapshot; }
    getFormattedAttributes () { return this._masterProxy.formattedAttributes; }
    get infoType () { return this._masterProxy.infoType; }
    get infoContent () { return this._masterProxy.infoContent; }
    setSnapshot () { this._masterProxy.setSnapshot(); } // TODO we don't reall know the snapshot process yet.
    get bbox () { return this._masterProxy._source.bbox; } // TODO this is really ugly. consider changing layerInterface.standardSetBoundingBox

    // these are special to the legend entry record scenario.
    // note special visibility and query functions are defined in LegendGroupRecord,
    // which this class eats.

    set opacity (value) {
        // TEST STATUS none
        // TODO do we need to worry about a layers that dont support opacity being registered as children?
        this._childProxies.forEach(p => { p.setOpacity(value); });
    }

    // returns the proxy interface object for the root of the layer (i.e. main entry in legend, not nested child things)
    // TODO docs
    getProxy () {
        // TEST STATUS none
        // TODO figure out control name arrays, if they apply at all for fake groups, and where they come from

        if (!this._rootProxy) {
            this._rootProxy = new layerInterface.LayerInterface(this);
            this._rootProxy.convertToLegendEntry(this);
        }
        return this._rootProxy;
    }

    // for now, we assume the proxy has already been added (via constructor or addChildProxy)
    setMasterProxy (proxy) {
        this._masterProxy = proxy;
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
    LegendEntryRecord
});

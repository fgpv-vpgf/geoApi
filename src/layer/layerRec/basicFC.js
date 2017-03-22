'use strict';

const shared = require('./shared.js')();

/**
 * @class BasicFC
 */
class BasicFC {
    // base class for feature class object. deals with stuff specific to a feature class (or raster equivalent)

    // TEST STATUS none
    get queryable () { return this._queryable; }
    set queryable (value) { this._queryable = value; }

    get state () { return this._parent._state; }

    // TEST STATUS none
    // non-attributes have no geometry.
    // TODO decide on proper defaulting or handling of non-geometry layers.
    get geomType () { return Promise.resolve('none'); }

    /**
     * @param {Object} parent        the Record object that this Feature Class belongs to
     * @param {String} idx           the service index of this Feature Class. an integer in string format. use '0' for non-indexed sources.
     * @param {Object} config        the config object for this sublayer
     */
    constructor (parent, idx, config) {
        // TEST STATUS basic
        this._parent = parent;
        this._idx = idx;
        this.queryable = config.state.query;

        // TODO do we need to store a copy of the config? for the memories?

    }

    // returns a promise of an object with minScale and maxScale values for the feature class
    // TODO we may be able to make scale stuff non-asynch. scales are stored in dynamiclayer.layerInfos[idx]
    getScaleSet () {
        // TEST STATUS none
        // basic case - we get it from the esri layer
        const l = this._parent._layer;
        return Promise.resolve({
            minScale: l.minScale,
            maxScale: l.maxScale
        });
    }

    isOffScale (mapScale) {
        // TEST STATUS none
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
        // TEST STATUS none
        return this._parent._layer.visible;
    }

    // TODO docs
    setVisibility (val) {
        // TEST STATUS none
        // basic case - set layer visibility
        this._parent._layer.visible = val;
    }

    getSymbology () {
        // TEST STATUS none
        if (!this._symbology) {
            // get symbology from service legend.
            // this is used for non-feature based sources (tiles, image, raster).
            // wms will override with own special logic.
            const url = this._parent._layer.url;
            if (url) {
                // fetch legend from server, convert to local format, process local format
                this._symbology = this._parent._apiRef.symbology.mapServerToLocalLegend(url, this._idx)
                    .then(legendData => {
                        return shared.makeSymbologyArray(legendData.layers[0]);
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

module.exports = () => ({
    BasicFC
});

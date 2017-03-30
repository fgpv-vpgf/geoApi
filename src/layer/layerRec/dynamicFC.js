'use strict';

const attribFC = require('./attribFC.js')();

/**
 * @class DynamicFC
 */
class DynamicFC extends attribFC.AttribFC {
    // dynamic child variant for feature class object.
    // deals with stuff specific to dynamic children (i.e. virtual layer on client)

    /**
     * Create an feature class object for a feature class that is a child of a dynamic layer
     * @param {Object} parent        the Record object that this Feature Class belongs to
     * @param {String} idx           the service index of this Feature Class. an integer in string format. use '0' for non-indexed sources.
     * @param {Object} layerPackage  a layer package object from the attribute module for this feature class
     * @param {Object} config        the config object for this sublayer
     */
    constructor (parent, idx, layerPackage, config) {
        super(parent, idx, layerPackage, config);

        // store pointer to the layerinfo for this FC.
        // while most information here can also be gleaned from the layer object,
        // we cannot know the type (e.g. Feature Layer, Raster Layer), so this object
        // is required.
        // TODO revist _layerInfo and how it is used.
        this._layerInfo = parent._layer.layerInfos[idx];

        this.opacity = config.state.opacity;

        // visibility is kept stateful by the parent. keeping an internal property
        // just means we would need to keep it in synch.
        this.setVisibility(config.state.visible);
    }

    get opacity () { return this._opacity; }
    set opacity (value) {
        this._opacity = value;

        const layer = this._parent._layer;
        if (layer.supportsDynamicLayers) {
            // only attempt to set the layer if we support that kind of magic.
            // instead of being consistent, esri using value from 0 to 100 for sublayer transparency where 100 is fully transparent
            const optionsArray = [];
            const drawingOptions = new this._parent._apiRef.layer.LayerDrawingOptions();
            drawingOptions.transparency = (value - 1) * -100;
            optionsArray[this._idx] = drawingOptions;
            layer.setLayerDrawingOptions(optionsArray);
        }
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

    get layerType () {return this._layerType; }
    set layerType (value) { this._layerType = value; }

    get geomType () { return this._geometryType; }
    set geomType (value) { this._geometryType = value; }

    get featureCount () { return this._fcount; }
    set featureCount (value) { this._fcount = value; }

    setVisibility (value) {
        // update visible layers array
        const vLayers = this._parent._layer.visibleLayers;
        const intIdx = parseInt(this._idx);
        const vIdx = vLayers.indexOf(intIdx);
        if (value && vIdx === -1) {
            // was invisible, now visible
            vLayers.push(intIdx);
        } else if (!value && vIdx > -1) {
            // was visible, now invisible
            vLayers.splice(vIdx, 1);
        }
        this.visibleChanged(value);
    }

    // TODO extend this function to other FC's?  do they need it?
    getVisibility () {
        // TEST STATUS none
        // TODO would we ever need to worry about _parent._layer.visible being false while
        //      the visibleLayers array still contains valid indexes?
        return this._parent._layer.visibleLayers.indexOf(parseInt(this._idx)) > -1;
    }

}

module.exports = () => ({
    DynamicFC
});

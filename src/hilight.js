'use strict';

// contains functions to support the hilight layer.

// TODO: this module is currently split from layer.js because layer.js is already huge and doesn't need
// more functions we can't find.  When (if ever) we refactor this can probably merge with some other code.

function hilightBuilder(esriBundle) {
    /**
    * Generating a hilight graphic layer.
    * @method makeHilightLayer
    * @return {Object} an ESRI GraphicsLayer
    */
    return () => {
        const hgl = new esriBundle.GraphicsLayer({ id: 'r2_hilight', visible: true });

        // ensure highlight is top-most graphic layer
        function moveHilightToTop() {
            hgl._map.reorderLayer(hgl, hgl._map.graphicsLayerIds.length);
        }

        /**
        * Add a graphic to indicate where user clicked.
        * @method addPin
        * @param {Point} point an ESRI point object to use as the graphic location
        */
        hgl.addPin = point => {
            const pinJson = {
                symbol: {
                    color: [230, 0, 0, 153],
                    size: 12,
                    yoffset: 6,
                    type: 'esriSMS',
                    style: 'esriSMSPath',
                    outline: {
                        color: [0, 0, 0, 255],
                        width: 1,
                        type: 'esriSLS',
                        style: 'esriSLSSolid'
                    }
                }
            };

            const pin = new esriBundle.Graphic(pinJson);
            pin.setGeometry(point);

            /* jscs:disable maximumLineLength */
            pin.symbol.setPath('M16,3.5c-4.142,0-7.5,3.358-7.5,7.5c0,4.143,7.5,18.121,7.5,18.121S23.5,15.143,23.5,11C23.5,6.858,20.143,3.5,16,3.5z M16,14.584c-1.979,0-3.584-1.604-3.584-3.584S14.021,7.416,16,7.416S19.584,9.021,19.584,11S17.979,14.584,16,14.584z');
            /* jscs:enable maximumLineLength */

            hgl.add(pin);
            pin.getShape().moveToFront();
            moveHilightToTop();
        };

        /**
        * Add a graphic to the highlight layer. Remove any previous graphic.
        * @method addHilight
        * @param {Graphic} graphic an ESRI graphic
        */
        hgl.addHilight = graphic => {

            // TODO test if graphic reprojection is required? or force caller to reproject?

            if (hgl._hilightGraphic) {
                // if active hilight graphic, remove it
                hgl.remove(hgl._hilightGraphic);
            } else {
                // first application of hilight. add haze background
                const hazeJson = {
                    symbol: {
                        color: [255, 255, 255, 107],
                        type: 'esriSFS',
                        style: 'esriSFSSolid',
                        outline: {
                            type: 'esriSLS',
                            style: 'esriSLSNull'
                        }
                    }
                };
                const haze = new esriBundle.Graphic(hazeJson);
                haze.setGeometry(hgl._map.extent.expand(1.5)); // expand to avoid edges on quick pan
                hgl.add(haze);
                haze.getShape().moveToBack();
            }

            // add new hilight graphic
            // TODO possibly boost clone.symbol.color.a to max opacity?
            const clone = new esriBundle.Graphic({
                geometry: graphic.geometry,
                attributes: {} // if we want tooltips, will need to copy these from source graphic
            });
            clone.symbol = graphic.getLayer().renderer.getSymbol(graphic);
            hgl._hilightGraphic = clone;
            hgl.add(clone);
            clone.getShape().moveToFront();
            moveHilightToTop();
        };

        /**
        * Remove hilight from map
        * @method clearHilight
        */
        hgl.clearHilight = () => {
            // clear tracking vars, wipe the layer
            hgl._hilightGraphic = null;
            hgl.clear();
        };

        return hgl;
    };
}

module.exports = (esriBundle) => ({
    makeHilightLayer: hilightBuilder(esriBundle)
});

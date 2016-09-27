'use strict';
const canvg = require('canvg-origin');

/**
  * @ngdoc module
  * @name mapPrint
  * @module geoAPI
  * @description
  *
  * The `mapPrint` module provides map print and export image related functions.
  *
  * This module exports an object with the following functions
  * - `printMap`
  * - `exportMap`
  */

let localCanvas;

/**
* Generate the image from the esri print task
*
* @param {Object} esriBundle bundle of API classes
* @param {Object} geoApi geoApi to determine if we are in debug mode
* @param {Object} map esri map object
* @param {Object} options options for the print task
*                           url - for the esri geometry server
*                           format - output format
* @return {Promise} resolving when the print task created the image
*/
function generateServerImage(esriBundle, geoApi, map, options) {
    // create esri print object with url to print server
    const printTask = esriBundle.PrintTask(options.url, { async: true });
    const printParams = new esriBundle.PrintParameters();
    const printTemplate = new esriBundle.PrintTemplate();

    // each layout has an mxd with that name on the server. We can modify and add new layout (mxd)
    // we only support MAP_ONLY for now. See https://github.com/fgpv-vpgf/fgpv-vpgf/issues/1160
    printTemplate.layout = 'MAP_ONLY';

    // only use when layout is MAP_ONLY
    printTemplate.exportOptions = {
        height: map.height,
        width: map.width,
        dpi: 96
    };

    // pdf | png32 | png8 | jpg | gif | eps | svg | svgz
    printTemplate.format = options.format;
    printTemplate.showAttribution = false;

    // define whether the printed map should preserve map scale or map extent.
    // if true, the printed map will use the outScale property or default to the scale of the input map.
    // if false, the printed map will use the same extent as the input map and thus scale might change.
    // we always use true because the output image is the same size as the map (we have the same extent and
    // same scale)
    // we fit the image later because trying to fit the image with canvg when we add user added
    // layer is tricky!
    printTemplate.preserveScale = true;

    // set map and template
    printParams.map = map;
    printParams.template = printTemplate;

    return new Promise((resolve, reject) => {
        // can be use to debug print task. Gives parameters to call directly the print task from it's interface
        // http://resources.arcgis.com/en/help/rest/apiref/exportwebmap_spec.html
        // http://snipplr.com/view/72400/sample-json-representation-of-an-esri-web-map-for-export-web-map-task
        // const mapJSON = printTask._getPrintDefinition(map, printParams);
        // console.log(JSON.stringify(mapJSON));

        // need to hide large user added layer to avoid CORS error
        const userLayers = hideLayers(map);

        // TODO: catch esriJobFailed. it does not trigger the complete or the error event. Need a way to catch it!
        // execute the print task
        printTask.execute(printParams, (response) => {
            // show user added previously visible for canvg to create canvas
            showLayers(map, userLayers);

            resolve(response);
        },
            (error) => {
                reject(error);
            }
        );
    });
}

/**
* Set user added layer visibility to false to avoid CORS error
*
* @param {Object} map esri map object
* @return {Array} visLayers array of layers where visibility is true
*/
function hideLayers(map) {
    let i = 0;
    let layer;
    let visLayers = [];
    const layers = map.graphicsLayerIds;

    while (layers[i]) {
        layer = map.getLayer(layers[i]);
        if (layer.visible) {
            visLayers.push(layers[i]);
        }

        layer.setVisibility(false);
        i++;
    }

    return visLayers;
}

/**
* Set user added layer visibility to true for those whoe where visible
*
* @param {Object} map esri map object
* @param {Array} layers array of graphic layers id to set visibility to true
*/
function showLayers(map, layers) {
    let i = 0;
    while (layers[i]) {
        map.getLayer(layers[i]).setVisibility(true);
        i++;
    }
}

/**
* Create a canvas from the user added layers (svg tag)
*
* @param {Object} map esri map object
* @param {Image} mapExportImg image from esri print task
* @return {Promise} resolving when the canvas have been created
*/
function generateLocalCanvas(map, mapExportImg) {
    // create a canvas out of file layers
    const serializer = new XMLSerializer();

    // convert svg to text (use map id to select the svg container)
    const svgtext = serializer.serializeToString(document.getElementById(`esri\.Map_${map.id.split('_')[1]}_gc`));

    // scale preserve is true
    const offX = (mapExportImg.width - map.width) / 2;
    const offY = (mapExportImg.height - map.height) / 2;
    const scaleW = map.width;
    const scaleH = map.height;

    // convert svg text to canvas and stuff it into mapExportImgLocal canvas dom node
    return new Promise((resolve) => {
        // create canvas element
        let mapExportImgLocal = document.createElement('canvas');

        // parse the svg
        resolve(canvg(mapExportImgLocal, svgtext, {
            offsetX: offX, offsetY: offY,
            scaleWidth: scaleW, scaleHeight: scaleH,
            renderCallback: () => {
                localCanvas = mapExportImgLocal;
            }
        }));
    });
}

/**
* Convert an image to a canvas element
*
* @param {Image} image the image to convert (result from the esri print task)
* @return {Canvas} canvas the new canvas element
*/
function convertImageToCanvas(image) {
    // convert image to canvas
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    canvas.getContext('2d').drawImage(image, 0, 0);

    return canvas;
}

/**
* Generate the print image by combining the output from esri print task and
* svg export of the user added layers.
*
* @param {Object} esriBundle bundle of API classes
* @param {Object} geoApi geoApi to determine if we are in debug mode
* @return {Object} canvas the complete boolean value and the new canvas element if true or the error
*                           if false
*/
function printMap(esriBundle, geoApi) {

    return (map, options) => {

        return new Promise((resolve) => {

            // get the image from ther server first. We will use it size to offset the
            // canvas generated by canvg. We need this because if user select a layout
            // different then MAP_ONLY, size from the canvg output and image from the
            // server is different
            generateServerImage(esriBundle, geoApi, map, options).then((result) => {

                // create img element for print task image
                const mapExportImg = document.createElement('img');

                mapExportImg.addEventListener('load', (event) => {

                    // create canvas from user added layers
                    generateLocalCanvas(map, mapExportImg).then(() => {
                        // convert image to canvas for saving
                        let canvas = convertImageToCanvas(event.target);

                        // smash local and print service canvases
                        const tc = canvas.getContext('2d');
                        tc.drawImage(localCanvas, 0, 0);

                        canvas = tc.canvas;

                        // return canvas
                        resolve({ complete: true, canvas: canvas });
                    });
                });

                // set image source to the one generated from the print task
                mapExportImg.src = result.url;
            }).catch((error) => {
                resolve({ complete: false, error: error });
            });
        });
    };
}

// Print map related modules
module.exports = (esriBundle, geoApi) => {
    return {
        print: printMap(esriBundle, geoApi),
    };
};

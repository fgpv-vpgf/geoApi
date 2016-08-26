/* jshint jasmine: true */
'use strict';
const layerBuilder = require('../src/layer.js');

describe('Layer', () => {
    let layer;
    const mockEsri = {
        FeatureLayer: Object,
        SpatialReference: Object
    };
    const mockGapi = {
        proj: {
            getProjection: () => Promise.resolve(null),
            projectGeojson: () => { return; }
        },
        shared: { generateUUID: () => 'layer0' }
    };
    beforeEach(() => {
        layer = layerBuilder(mockEsri, mockGapi);
    });

});

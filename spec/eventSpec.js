/* jshint jasmine: true */
'use strict';

const events = require('../src/events.js');

function makeFakeLayer(x) {
    return {
        on: (e) => {
            return makeFakeEvent(e);
        },
        'target': x.target,
        'spatialReference': {'wkid': x.sr}
    };
}

function makeFakeEvent(e) {
    return {
        error: undefined,
        info: null,
        target: '1'
    }
}

describe('events wrapping', () => {
    const sampleData = {target: 'hello', sr: 4326};
    const sampleLayer = makeFakeLayer(sampleData);

    afterEach(function() {
        sampleLayer.on.calls.reset();
    });

    it('should properly convert to the right dojo name', () => {
        const myevent = events();
        spyOn(sampleLayer, 'on');
        myevent.wrapEvents(sampleLayer, {updateEnd: (x) => {
            console.log('Hi');
        }});
        expect(sampleLayer.on.calls.mostRecent().args[0]).toEqual('update-end');
        sampleLayer.on.calls.reset();
    });

    it('should trigger a layer event', () => {
        const myevent = events();
        spyOn(sampleLayer, 'on');
        myevent.wrapEvents(sampleLayer, {updateEnd: (x) => {
            expect(x.target).toEqual(x.layer);
            }
        });
        sampleLayer.on.calls.mostRecent().args[1](makeFakeEvent(sampleData));
    });

    it('should trigger a non-layer event', () => {
        const myevent = events();
        spyOn(sampleLayer, 'on');
        myevent.wrapEvents(sampleLayer, {click: (x) => {
            console.log('yeezy');
            expect(sampleLayer.on).toHaveBeenCalled();
            }
        });
        sampleLayer.on.calls.mostRecent().args[1](makeFakeEvent(sampleData));
    });
});

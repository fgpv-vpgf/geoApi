'use strict';

/**
 * @class Root
 */
class Root {
    // the thing every thing else inherits from.
    // thing in here should be applicable to both layer-ish classes (including FCs),
    // and legend-ish classes.

    constructor () {
        // TODO maybe pass in config, store it?

        this._name = '';
        this._visibleListeners = [];
    }

    // everyone needs a name
    get name () { return this._name; }
    set name (value) { this._name = value; }

    /**
     * Utility for triggering an event and giving it to the listeners
     */
    _fireEvent (handlerArray, ...eventParams) {
        // if we don't copy the array we could be looping on an array
        // that is being modified as it is being read
        handlerArray.slice(0).forEach(l => l(...eventParams));
    }

    /**
     * Wire up Visible change listener
     */
    addVisibleListener (listenerCallback) {
        this._visibleListeners.push(listenerCallback);
        return listenerCallback;
    }

    /**
     * Remove a Visible change listener
     */
    removeVisibleListener (listenerCallback) {
        const idx = this._visibleListeners.indexOf(listenerCallback);
        if (idx < 0) {
            // TODO too extreme?
            throw new Error('Attempting to remove a listener which is not registered.');
        }
        this._visibleListeners.splice(idx, 1);
    }

    // called whenever visibility changes.
    // since visibility can and will be overridden in a number of different ways,
    // it is easier to do it with a funciton than forcing implementers to work
    // with a fixed getter/setter.
    visibleChanged (newValue) {
        // currently we only care if things become visible.
        // can change the logic if we start to care about invisible states.
        if (newValue) {
            this._fireEvent(this._visibleListeners);
        }
    }

}

module.exports = () => ({
    Root
});

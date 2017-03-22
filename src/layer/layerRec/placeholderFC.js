'use strict';

class PlaceholderFC {
    // contains dummy stuff to stop placeholder states from freaking out
    // prior to a layer being loaded.

    constructor (parent, name) {
        // TEST STATUS basic
        this._parent = parent;
        this._name = name;

        // TODO random colours
        this._symbolBundle = {
            stack: [parent._apiRef.symbology.generatePlaceholderSymbology(name || '?', '#16bf27')],
            renderStyle: 'icons'
        };
    }

    // TODO probably need more stuff

    getVisibility () {
        // TEST STATUS none
        // TODO enhance to have some default value, assigned in constructor?
        // TODO can a user toggle placeholders? does state need to be updated?
        return true;
    }

    // TODO once we figure out names on LeafFC and GroupFC, might want to re-align this
    //      property name to match.  Be sure to update LayerInterface.convertToPlaceholder
    get layerName () { return this._name; }

    // TODO clean this up if we dont need it
    /*
    getSymbology () {
        // TEST STATUS none
        if (!this._symbology) {
            // TODO deal with random colours
            this._symbology = Promise.resolve(
                [this._parent._apiRef.symbology.generatePlaceholderSymbology(this._name || '?', '#16bf27')]);
        }
        return this._symbology;
    }
    */

    get symbology () {  return this._symbolBundle; }

    // TODO do we need to check if parent exists? Placeholder use-cases are not flushed out right now.
    get state () { return this._parent._state; }

}

module.exports = () => ({
    PlaceholderFC
});

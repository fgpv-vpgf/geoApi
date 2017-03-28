'use strict';
const root = require('./root.js')();

class PlaceholderFC extends root.Root {
    // contains dummy stuff to stop placeholder states from freaking out
    // prior to a layer being loaded.

    constructor (parent, name) {
        // TEST STATUS basic
        super();
        this._parent = parent;
        this.name = name;

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

    get symbology () {  return this._symbolBundle; }

    // TODO do we need to check if parent exists? Placeholder use-cases are not flushed out right now.
    get state () { return this._parent._state; }

}

module.exports = () => ({
    PlaceholderFC
});

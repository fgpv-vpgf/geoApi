'use strict';

const root = require('./root.js')();

/**
 * @class LegendBaseRecord
 */
class LegendBaseRecord extends root.Root {
    // this provides support for legendish things. right now, mainly
    // functions for child proxies, and aggregate visibility/query

    // add a child proxy post-constructor
    // TODO docs
    addChildProxy (proxy) {
        this._childProxies.push(proxy);
    }

    // TODO docs
    removeChildProxy (proxy) {
        const idx = this._childProxies.indexOf(proxy);

        if (idx > -1) {
            this._childProxies.splice(idx, 1);
        }
    }

    get visibility () {
        // cumulation of visiblity of all childs
        return this._childProxies.some(p => p.visibility);
    }
    set visibility (value) {
        // set all the kids
        this._childProxies.forEach(p => { p.setVisibility(value); });
        this.visibleChanged(value);
    }

    // TODO docs
    isQueryable () {
        // TEST STATUS none
        return this._childProxies.some(p => p.query);
    }

    // TODO docs
    setQueryable (value) {
        // TEST STATUS none
        this._childProxies.forEach(p => { p.setQuery(value); });
    }

    /**
     * Allows constructor init of proxies
     * @param {Array} childProxies   an optional array of proxies for immediate children of the group
     *
     */
    constructor (childProxies) {
        super();
        this._childProxies = childProxies || [];
    }
}

module.exports = () => ({
    LegendBaseRecord
});

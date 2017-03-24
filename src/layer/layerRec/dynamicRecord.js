'use strict';

const attribRecord = require('./attribRecord.js')();
const shared = require('./shared.js')();
const placeholderFC = require('./placeholderFC.js')();
const layerInterface = require('./layerInterface.js')();
const dynamicFC = require('./dynamicFC.js')();
const attribFC = require('./attribFC.js')();

/**
 * @class DynamicRecord
 */
class DynamicRecord extends attribRecord.AttribRecord {
    // TODO are we still using passthrough stuff?
    get _layerPassthroughBindings () {
        // TEST STATUS none
        return ['setOpacity', 'setVisibility', 'setVisibleLayers', 'setLayerDrawingOptions'];
    }
    get _layerPassthroughProperties () {
        // TEST STATUS none
        return ['visibleAtMapScale', 'visible', 'spatialReference', 'layerInfos', 'supportsDynamicLayers'];
    }

    get layerType () { return shared.clientLayerType.ESRI_DYNAMIC; }

    /**
     * Create a layer record with the appropriate geoApi layer type.  Layer config
     * should be fully merged with all layer options defined (i.e. this constructor
     * will not apply any defaults).
     * @param {Object} layerClass    the ESRI api object for dynamic layers
     * @param {Object} esriRequest   the ESRI api object for making web requests with proxy support
     * @param {Object} apiRef        object pointing to the geoApi. allows us to call other geoApi functions
     * @param {Object} config        layer config values
     * @param {Object} esriLayer     an optional pre-constructed layer
     * @param {Function} epsgLookup  an optional lookup function for EPSG codes (see geoService for signature)
     */
    constructor (layerClass, esriRequest, apiRef, config, esriLayer, epsgLookup) {
        // TEST STATUS basic
        super(layerClass, esriRequest, apiRef, config, esriLayer, epsgLookup);
        this.ArcGISDynamicMapServiceLayer = layerClass;

        // TODO what is the case where we have dynamic layer already prepared
        //      and passed in? Generally this only applies to file layers (which
        //      are feature layers).

        // TODO figure out controls on config
        // TODO worry about placeholders. WORRY. how does that even work here?

        this._proxies = {};

    }

    /**
     * Return a proxy interface for a child layer
     *
     * @param {Integer} featureIdx    index of child entry (leaf or group)
     * @return {Object}               proxy interface for given child
     */
    getChildProxy (featureIdx) {
        // TEST STATUS basic
        // TODO verify we have integer coming in and not a string
        // in this case, featureIdx can also be a group index
        if (this._proxies[featureIdx.toString()]) {
            return this._proxies[featureIdx.toString()];
        } else {
            // throw new Error(`attempt to get non-existing child proxy. Index ${featureIdx}`);

            // to handle the case of a structured legend needing a proxy for a child prior to the
            // layer loading, we treat an unknown proxy request as that case and return
            // a proxy loaded with a placeholder.
            // TODO how to pass in a name? add an optional second parameter? expose a "set name" on the proxy?
            const pfc = new placeholderFC.PlaceholderFC(this, '');
            const tProxy = new layerInterface.LayerInterface(pfc); // specificially no controls at this point.
            tProxy.convertToPlaceholder(pfc);
            this._proxies[featureIdx.toString()] = tProxy;
            return tProxy;

        }
    }

    // TODO I think we need to override getProxy to return a special Dynamic proxy.
    //      Need to figure out how visibility works (i.e. layer is invisible or just empty visibleChildren array)
    //      Might also need to manage the root children somehow (i.e. the layerEntries from the config)

    // TODO docs
    getFeatureCount (featureIdx) {
        // TEST STATUS basic
        // point url to sub-index we want
        // TODO might change how we manage index and url
        return super.getFeatureCount(this._layer.url + '/' + featureIdx);
    }

    /**
    * Triggers when the layer loads.
    *
    * @function onLoad
    */
    onLoad () {
        // TEST STATUS basic
        super.onLoad();
        const supportsDynamic = this._layer.supportsDynamicLayers;
        const controlBanlist = ['reload', 'snapshot', 'boundingBox'];
        if (!supportsDynamic) {
            controlBanlist.push('opacity');
        }

        // strip any banned controls from a controls array
        // array is modified
        const banControls = controls => {
            controlBanlist.forEach(bc => {
                const idx = controls.indexOf(bc);
                if (idx > -1) {
                    controls.splice(idx, 1);
                }
            });

            // a bit redundant. useful if we are passing in an anonymous array.
            return controls;
        };

        // don't worry about structured legend. the legend part is separate from
        // the layers part. we just load what we are told to. the legend module
        // will handle the structured part.

        // NOTE for now, the only relevant properties to be propagated
        //      from parent to child are .state and .controls .
        //      .outfields does not make sense as chilren can have different fields.
        //      We assume the objects at the layer level (index -1) are fully defaulted.
        //      All other missing items assigned from parent item.

        // subconfig lookup. initialize with the layer root (-1), then add
        // in anything provided in the initial config.
        const subConfigs = {
            '-1': {
                config: {
                    state: this.config.state,
                    controls: banControls(this.config.controls.concat())
                },
                defaulted: true
            }
        };

        this.config.layerEntries.forEach(le => {
            subConfigs[le.index.toString()] = {
                config: le,
                defaulted: false
            };
        });

        // subfunction to either return a stored sub-config, or
        // derive a new subconfig from the parent config.
        // both params integers in string format.
        const fetchSubConfig = (id, parentId) => {
            if (subConfigs[id]) {
                const subC = subConfigs[id];
                if (!subC.defaulted) {
                    // get any missing properties from parent
                    const parent = subConfigs[parentId].config;

                    // TODO verify if we need to check for controls array of .length === 0.
                    //      I am assuming an empty array a valid setting (i.e. no controls should be shown)
                    if (!subC.config.controls) {
                        // we can assume parent.controls has already been ban-scraped
                        subC.config.controls = parent.controls.concat();
                    } else {
                        // ensure we dont have any bad controls lurking
                        banControls(subC.config.controls);
                    }

                    if (!subC.config.state) {
                        // copy all
                        subC.config.state = Object.assign({}, parent.state);
                    } else {
                        // selective inheritance
                        Object.keys(parent.state).forEach(stateKey => {
                            // be aware of falsey logic here.
                            if (!subC.config.state.hasOwnProperty(stateKey)) {
                                subC.config.state[stateKey] = parent.state[stateKey];
                            }
                        });
                    }

                    if (!subC.config.hasOwnProperty('outfields')) {
                        subC.config.outfields = '*';
                    }

                    subC.defaulted = true;
                }
                return subC.config;
            } else {
                // no config at all. direct copy properties from parent
                // we can assume parent.controls has already been ban-scraped
                const newConfig = {
                    state: Object.assign({}, subConfigs[parentId].config.state),
                    controls: subConfigs[parentId].config.controls.concat(),
                    outfields: '*'
                };
                subConfigs[id] = {
                    config: newConfig,
                    defaulted: true
                };
                return newConfig;
            }
        };

        // this subfunction will recursively crawl a dynamic layerInfo structure.
        // it will generate proxy objects for all groups and leafs under the
        // input layerInfo.
        // it also collects and returns an array of leaf nodes so each group
        // can store it and have fast access to all leaves under it.
        const processLayerInfo = (layerInfo, treeArray, parentId) => {
            const sId = layerInfo.id.toString();
            const subConfig = fetchSubConfig(sId, parentId.toString());
            if (layerInfo.subLayerIds && layerInfo.subLayerIds.length > 0) {
                // group
                // TODO probably need some placeholder magic going on here too
                // TODO do we need to apply any config state?
                // TODO figure out control lists, whats available, whats disabled.
                //      supply on second and third parameters
                let group;
                if (this._proxies[sId]) {
                    // we have a pre-made proxy (structured legend)
                    // TODO might need to pass controls array into group proxy
                    group = this._proxies[sId];
                } else {
                    // set up new proxy
                    group = new layerInterface.LayerInterface(this, subConfig.controls);
                    this._proxies[sId] = group;

                }
                group.convertToDynamicGroup(this, sId, subConfig.name || layerInfo.name || '');

                const treeGroup = { id: layerInfo.id, childs: [] };
                treeArray.push(treeGroup);

                // process the kids in the group.
                // store the child leaves in the internal variable
                layerInfo.subLayerIds.forEach(slid => {
                    group._childLeafs = group._childLeafs.concat(
                        processLayerInfo(this._layer.layerInfos[slid], treeGroup.childs, sId));
                });

                return group._childLeafs;
            } else {
                // leaf
                // TODO figure out control lists, whats available, whats disabled.
                //      supply on second and third parameters.
                //      might need to steal from parent, since auto-gen may not have explicit
                //      config settings.
                // TODO since we are doing placeholder, might want to not provide controls array yet.
                let leaf;
                const pfc = new placeholderFC.PlaceholderFC(this, layerInfo.name);
                if (this._proxies[sId]) {
                    // we have a pre-made proxy (structured legend)
                    // TODO might need to pass controls array into leaf proxy
                    leaf = this._proxies[sId];
                    leaf.updateSource(pfc);
                } else {
                    // set up new proxy
                    leaf = new layerInterface.LayerInterface(null, subConfig.controls);
                    leaf.convertToPlaceholder(pfc);
                    this._proxies[sId] = leaf;
                }

                treeArray.push({ id: layerInfo.id });
                return [leaf];
            }
        };

        this._childTree = []; // public structure describing the tree
        if (this.config.layerEntries) {
            this.config.layerEntries.forEach(le => {
                if (!le.stateOnly) {
                    processLayerInfo(this._layer.layerInfos[le.index], this._childTree, -1);
                }
            });
        }

        // trigger attribute load and set up children bundles.
        // TODO do we need an options object, with .skip set for sub-layers we are not dealing with?
        //      we currently (sort-of) have the list of things included -- the keys of the
        //      subConfigs object. we would need to iterate layerInfos again and find keys
        //      not in subConfigs.
        //      Alternate: add new option that is opposite of .skip.  Will be more of a
        //                 .only, and we won't have to derive a "skip" set from our inclusive
        //                 list
        //      Furthermore: skipping / being effecient might not really matter here anymore.
        //                   back in the day, loadLayerAttribs would actually load everything.
        //                   now it just sets up promises that dont trigger until someone asks for
        //                   the information.
        const attributeBundle = this._apiRef.attribs.loadLayerAttribs(this._layer);
        const initVis = [];

        // converts server type string to client type string
        const serverLayerTypeToClientLayerType = serverType => {
            switch (serverType) {
                case 'Feature Layer':
                    return shared.clientLayerType.ESRI_FEATURE;
                case 'Raster Layer':
                    return shared.clientLayerType.ESRI_RASTER;
                default:
                    throw new Error('Unexpected layer type in serverLayerTypeToClientLayerType', serverType);
            }
        };

        // idx is a string
        attributeBundle.indexes.forEach(idx => {
            // if we don't have a defaulted sub-config, it means the attribute leaf is not present
            // in our visible tree structure.
            const subC = subConfigs[idx];
            if (subC && subC.defaulted) {
                // TODO need to worry about Raster Layers here.  DynamicFC is based off of
                //      attribute things.
                const dFC = new dynamicFC.DynamicFC(this, idx, attributeBundle[idx], subC.config);
                this._featClasses[idx] = dFC;
                if (subC.config.state.visibility) {
                    initVis.push(parseInt(idx)); // store for initial visibility
                }

                // if we have a proxy watching this leaf, replace its placeholder with the real data
                const leafProxy = this._proxies[idx];
                if (leafProxy) {
                    // TODO update controls array?

                    // trickery involving symbology.
                    // the UI is binding to the object that was set up in the leaf placeholder.
                    // so we cannot just make a new one.
                    // we need to inject the placeholder symbology object into our new DynamicFC.
                    // then we can aysnch update it with real symbols, and the UI is still
                    // pointing at the same array in memory.
                    dFC._symbolBundle = leafProxy.symbology;
                    leafProxy.convertToDynamicLeaf(dFC);
                }

                // load real symbols into our source
                dFC.loadSymbology();

                // update asynchronous values
                dFC.getLayerData().then(ld => {
                    dFC.layerType = serverLayerTypeToClientLayerType(ld.layerType);
                    if (dFC.layerType === shared.clientLayerType.ESRI_FEATURE) {
                        dFC.geomType = ld.geometryType;
                    }
                });

                this.getFeatureCount(idx).then(fc => {
                    dFC.featureCount = fc;
                });
            }
        });

        // need to do a post ban-sweep on control arrays. dynamic groups are not allowed
        // to have opacity. if we had removed above, children of groups would have also
        // lost opacity.
        // a lovely pyramid of doom.
        Object.keys(this._proxies).forEach(sId => {
            const proxy = this._proxies[sId];
            if (!proxy.isPlaceholder && proxy.layerType === shared.clientLayerType.ESRI_GROUP) {
                const poIdx = proxy.availableControls.indexOf('opacity');
                if (poIdx > -1) {
                    proxy.availableControls.splice(poIdx, 1);

                    // TODO test if we need to adjust subconfigs, or if it's all the same pointer
                    if (subConfigs[sId].config.controls.indexOf('opacity') > -1) {
                        console.log('HEEEY HEYYY WE HAVE A CONFIG OPACITY GROUP, ADD CODE TO REMOVE IT');
                    }
                }
            }
        });

        if (initVis.length === 0) {
            initVis.push(-1); // esri code for set all to invisible
        }
        this._layer.setVisibleLayers(initVis);
    }

    // override to add child index parameter
    zoomToScale (childIdx, map, lods, zoomIn, zoomGraphic = false) {
        // TEST STATUS none
        // get scale set from child, then execute zoom
        return this._featClasses[childIdx].getScaleSet().then(scaleSet => {
            return this._zoomToScaleSet(map, lods, zoomIn, scaleSet, zoomGraphic);
        });
    }

    isOffScale (childIdx, mapScale) {
        // TEST STATUS none
        return this._featClasses[childIdx].isOffScale(mapScale);
    }

    isQueryable (childIdx) {
        // TEST STATUS none
        return this._featClasses[childIdx].queryable;
    }

    // TODO if we need this back, may need to implement as getChildGeomType.
    //      appears this ovverrides the LayerRecord.getGeomType function, which returns
    //      undefined, and that is what we want on the DynamicRecord level (as dynamic layer)
    //      has no geometry.
    //      Currently, all child requests for geometry go through the proxy,
    //      so could be this child-targeting version is irrelevant.
    /*
    getGeomType (childIdx) {
        // TEST STATUS none
        return this._featClasses[childIdx].geomType;
    }
    */

    getChildTree () {
        if (this._childTree) {
            return this._childTree;
        } else {
            throw new Error('Called getChildTree before layer is loaded');
        }
    }

    /**
     * Get the best user-friendly name of a field. Uses alias if alias is defined, else uses the system attribute name.
     *
     * @param {String} attribName     the attribute name we want a nice name for
     * @param {String}  childIndex    index of the child layer whos attributes we are looking at
     * @return {Promise}              resolves to the best available user friendly attribute name
     */
    aliasedFieldName (attribName, childIndex) {
        // TEST STATUS none
        return this._featClasses[childIndex].aliasedFieldName(attribName);
    }

    /**
     * Retrieves attributes from a layer for a specified feature index
     * @param {String}  childIndex  index of the child layer to get attributes for
     * @return {Promise}            promise resolving with formatted attributes to be consumed by the datagrid and esri feature identify
     */
    getFormattedAttributes (childIndex) {
        // TEST STATUS none
        return this._featClasses[childIndex].getFormattedAttributes();
    }

    /**
     * Check to see if the attribute in question is an esriFieldTypeDate type.
     *
     * @param {String} attribName     the attribute name we want to check if it's a date or not
     * @param {String}  childIndex    index of the child layer whos attributes we are looking at
     * @return {Promise}              resolves to true or false based on the attribName type being esriFieldTypeDate
     */
    checkDateType (attribName, childIndex) {
        // TEST STATUS none
        return this._featClasses[childIndex].checkDateType(attribName);
    }

    /**
    * Returns attribute data for a child layer.
    *
    * @function getAttribs
    * @param {String} childIndex  the index of the child layer
    * @returns {Promise}          resolves with a layer attribute data object
    */
    getAttribs (childIndex) {
        // TEST STATUS none
        return this._featClasses[childIndex].getAttribs();
    }

    /**
    * Returns layer-specific data for a child layer
    *
    * @function getLayerData
    * @param {String} childIndex  the index of the child layer
    * @returns {Promise}          resolves with a layer data object
    */
    getLayerData (childIndex) {
        // TEST STATUS none
        return this._featClasses[childIndex].getLayerData();
    }

    getFeatureName (childIndex, objId, attribs) {
        // TEST STATUS none
        return this._featClasses[childIndex].getFeatureName(objId, attribs);
    }

    getSymbology (childIndex) {
        // TEST STATUS basic
        return this._featClasses[childIndex].getSymbology();
    }

    /**
    * Run a query on a dynamic layer, return the result as a promise.
    * @function identify
    * @param {Object} opts additional argumets like map object, clickEvent, etc.
    * @returns {Object} an object with identify results array and identify promise resolving when identify is complete; if an empty object is returned, it will be skipped
    */
    identify (opts) {
        // TEST STATUS none
        // TODO caller must pass in layer ids to interrogate.  geoApi wont know what is toggled in the legend.
        //      param is opts.layerIds, array of integer for every leaf to interrogate.
        // TODO add full documentation for options parameter

        // bundles results from all leaf layers
        const identifyResults = [];

        // create an results object for every leaf layer we are inspecting
        opts.layerIds.forEach(leafIndex => {

            // TODO fix these params
            // TODO legendEntry.name, legendEntry.symbology appear to be fast links to populate the left side of the results
            //      view.  perhaps it should not be in this object anymore?
            // TODO see how the client is consuming the internal pointer to layerRecord.  this may also now be
            //      directly available via the legend object.
            const identifyResult =
                new shared.IdentifyResult('legendEntry.name', 'legendEntry.symbology', 'EsriFeature', this,
                    leafIndex, 'legendEntry.master.name'); // provide name of the master group as caption

            identifyResults[leafIndex] = identifyResult;
        });

        opts.tolerance = this.clickTolerance;

        const identifyPromise = this._apiRef.layer.serverLayerIdentify(this._layer, opts)
            .then(clickResults => {
                const hitIndexes = []; // sublayers that we got results for

                // transform attributes of click results into {name,data} objects
                // one object per identified feature
                //
                // each feature will have its attributes converted into a table
                // placeholder for now until we figure out how to signal the panel that
                // we want to make a nice table
                clickResults.forEach(ele => {
                    // NOTE: the identify service returns aliased field names, so no need to look them up here.
                    //       however, this means we need to un-alias the data when doing field lookups.
                    // NOTE: ele.layerId is what we would call featureIdx
                    hitIndexes.push(ele.layerId);

                    // get metadata about this sublayer
                    this.getLayerData(ele.layerId).then(lData => {
                        const identifyResult = identifyResults[ele.layerId];

                        if (lData.supportsFeatures) {
                            const unAliasAtt = attribFC.AttribFC.unAliasAttribs(ele.feature.attributes, lData.fields);

                            // TODO traditionally, we did not pass fields into attributesToDetails as data was
                            //      already aliased from the server. now, since we are extracting field type as
                            //      well, this means things like date formatting might not be applied to
                            //      identify results. examine the impact of providing the fields parameter
                            //      to data that is already aliased.
                            identifyResult.data.push({
                                name: ele.value,
                                data: this.attributesToDetails(ele.feature.attributes),
                                oid: unAliasAtt[lData.oidField],
                                symbology: [{
                                    svgcode: this._apiRef.symbology.getGraphicIcon(unAliasAtt, lData.renderer)
                                }]
                            });
                        }
                        identifyResult.isLoading = false;
                    });
                });

                // set the rest of the entries to loading false
                identifyResults.forEach(identifyResult => {
                    if (hitIndexes.indexOf(identifyResult.requester.featureIdx) === -1) {
                        identifyResult.isLoading = false;
                    }
                });

            });

        return {
            identifyResults: identifyResults.filter(identifyResult => identifyResult), // collapse sparse array
            identifyPromise
        };
    }

    // TODO docs
    getChildName (index) {
        // TEST STATUS none
        // TODO revisit logic. is this the best way to do this? what are the needs of the consuming code?
        // TODO restructure so WMS can use this too?
        // will not use FC classes, as we also need group names
        return this._layer.layerInfos[index].name;
    }

}

module.exports = () => ({
    DynamicRecord
});

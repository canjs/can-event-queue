/**
 * @module {function} can-event-queue/type/type
 * @parent can-event-queue
 *
 * @description Mixin methods and symbols to make a type constructor function able to
 * broadcast changes in its instances.
 *
 * @signature `mixinTypeBindings( type )`
 *
 * Adds symbols and methods that make `type` work with the following [can-reflect] APIs:
 *
 * - [can-reflect/observe.onInstanceBoundChange] - Observe when instances are bound.
 * - [can-reflect/observe.onInstancePatches] - Observe patche events on all instances.
 *
 * When `mixinTypeBindings` is called on an `Person` _type_ like:
 *
 * ```js
 * var mixinTypeBindings = require("can-event-queue/type/type");
 * var mixinLegacyMapBindings = require("can-event-queue/map/legacy/legacy");
 *
 * class Person {
 *   constructor(data){
 *     this.data = data;
 *   }
 * }
 * mixinTypeBindings(Person);
 * mixinLegacyMapBindings(Person.prototype);
 *
 * var me = new Person({first: "Justin", last: "Meyer"});
 *
 * // mixinTypeBindings allows you to listen to
 * // when a person instance's bind stache changes
 * canReflect.onInstanceBoundChange(Person, function(person, isBound){
 *    console.log("isBound");
 * });
 *
 * // mixinTypeBindings allows you to listen to
 * // when a patch change happens.
 * canReflect.onInstancePatches(Person, function(person, patches){
 *    console.log(patches[0]);
 * });
 *
 * me.on("name",function(ev, newVal, oldVal){}) //-> logs: "isBound"
 *
 * me.dispatch({
 *   type: "first",
 *   patches: [{type: "set", key: "first", value: "Ramiya"}]
 * }, ["Ramiya","Justin"])
 * //-> logs: {type: "set", key: "first", value: "Ramiya"}
 * ```
 * 
 */
var canReflect = require("can-reflect");
var canSymbol = require("can-symbol");
var KeyTree = require("can-key-tree");
var queues = require("can-queues");

var metaSymbol = canSymbol.for("can.meta");

function ensureMeta(obj) {
    var meta = obj[metaSymbol];

    if (!meta) {
        meta = {};
        canReflect.setKeyValue(obj, metaSymbol, meta);
    }

    if (!meta.lifecycleHandlers) {
        meta.lifecycleHandlers = new KeyTree([Object, Array]);
    }
    if (!meta.instancePatchesHandlers) {
        meta.instancePatchesHandlers = new KeyTree([Object, Array]);
    }
    return meta;
}

module.exports = function(obj){

    return canReflect.assignSymbols(obj,{
        "can.onInstanceBoundChange": function(handler, queueName) {
    		ensureMeta(this).lifecycleHandlers.add([queueName || "mutate", handler]);
    	},
    	"can.offInstanceBoundChange": function(handler, queueName) {
    		ensureMeta(this).lifecycleHandlers.delete([queueName || "mutate", handler]);
    	},
        "can.dispatchInstanceBoundChange": function(obj, isBound){
            queues.enqueueByQueue(ensureMeta(this).lifecycleHandlers.getNode([]), this, [obj, isBound]);
        },
        "can.onInstancePatches": function(handler, queueName) {
    		ensureMeta(this).instancePatchesHandlers.add([queueName || "mutate", handler]);
    	},
    	"can.offInstancePatches": function(handler, queueName) {
    		ensureMeta(this).instancePatchesHandlers.delete([queueName || "mutate", handler]);
    	},
        // if we bound to onKeyValue(instance, "id")
        "can.dispatchInstanceOnPatches": function(obj, patches){
            queues.enqueueByQueue(ensureMeta(this).instancePatchesHandlers.getNode([]), this, [obj, patches]);
        }
    });
};

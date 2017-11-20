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

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
        // lifecycleHandlers are organized by:
        // queue name - mutate, queue, etc
        // lifecycleHandlers - the lifecycleHandlers.
        meta.lifecycleHandlers = new KeyTree([Object, Array]);
    }
    return meta;
}

module.exports = function(obj){

    return canReflect.assignSymbols(obj,{
        "can.onBoundChange": function(handler, queueName) {
    		ensureMeta(this).lifecycleHandlers.add([queueName || "mutate", handler]);
    	},
    	"can.offBoundChange": function(handler, queueName) {
    		ensureMeta(this).lifecycleHandlers.delete([queueName || "mutate", handler]);
    	},
        "can.dispatchBoundChange": function(obj, isBound){
            queues.enqueueByQueue(ensureMeta(this).lifecycleHandlers.getNode([]), this, [obj, isBound]);
        }
    });
};

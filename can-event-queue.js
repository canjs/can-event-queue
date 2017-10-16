var canDev = require("can-util/js/dev/dev");
var assign = require("can-util/js/assign/assign");
var queues = require("can-queues");
var canReflect = require("can-reflect");
var canSymbol = require("can-symbol");
var KeyTree = require("can-key-tree");

// getHandlers returns a KeyTree used for event handling.
// `handlers` will be on the `can.meta` symbol on the object.
var metaSymbol = canSymbol.for("can.meta");
function getHandlers(obj) {
    var meta = obj[metaSymbol];
    if(!meta) {
        canReflect.setKeyValue(obj, metaSymbol, meta = {});
    }
    var handlers = meta.handlers;
    if(!handlers) {
        // Handlers are organized by:
        // event name - the type of event bound to
        // binding type - "event" for things that expect an event object (legacy), "onKeyValue" for reflective bindings.
        // queue name - mutate, queue, etc
        // handlers - the handlers.
        handlers = meta.handlers = new KeyTree([Object, Object, Object, Array],{
            onFirst: function(){
                if( obj._eventSetup ) {
                    obj._eventSetup();
                }
            },
            onEmpty: function(){
                if( obj._eventTeardown ) {
                    obj._eventTeardown();
                }
            }
        });
    }
    return handlers;
}

// These are the properties we are going to add to objects
var props = {
    dispatch: function(event, args){
        //!steal-remove-start
        if (arguments.length > 2) {
			canDev.warn('Arguments to dispatch should be an array, not multiple arguments.');
			args = Array.prototype.slice.call(arguments, 1);
		}

		if (args && !Array.isArray(args)) {
			canDev.warn('Arguments to dispatch should be an array.');
			args = [ args ];
		}
		//!steal-remove-end


		// Don't send events if initalizing.
        if (!this.__inSetup) {
            if(typeof event === 'string') {
                event = {
                    type: event,
                    //!steal-remove-start
                    reasonLog: [ canReflect.getName(this), "dispatched", '"' + event + '"', "with args", JSON.stringify(args) ],
                    makeMeta: function makeMeta(handler, context, args) {
                        return {
                            log: [ canReflect.getName(handler), "called because" ].concat(args[0].reasonLog),
                        };
                    },
                    //!steal-remove-end
                };
            }
            var handlers = getHandlers(this);
            var handlersByType = handlers.getNode([event.type]);
            if(handlersByType) {
                queues.batch.start();
                if(handlersByType.onKeyValue) {
                    queues.enqueueByQueue(handlersByType.onKeyValue, this, args, event.makeMeta, event.reasonLog);
                }
                if(handlersByType.event) {

                    event.batchNum = queues.batch.number();
                    var eventAndArgs = [event].concat(args);
                    queues.enqueueByQueue(handlersByType.event, this, eventAndArgs, event.makeMeta, event.reasonLog);
                }
                queues.batch.stop();
            }
        }
    },
    addEventListener: function(key, handler, queueName) {
        getHandlers(this).add([key, "event",queueName || "mutate", handler]);
    },
    removeEventListener: function(key, handler, queueName) {
        getHandlers(this).delete([key, "event", queueName || "mutate", handler]);
    }
};
props.on = props.addEventListener;
props.off = props.removeEventListener;

// The symbols we'll add to bojects
var symbols = {
    "can.onKeyValue": function(key, handler, queueName) {
        getHandlers(this).add([key, "onKeyValue",queueName || "mutate", handler]);
    },
    "can.offKeyValue": function(key, handler, queueName) {
        getHandlers(this).delete([key, "onKeyValue", queueName || "mutate", handler]);
    }
};

// The actual eventQueue mixin function
var eventQueue = function(obj) {
    // add properties
    assign(obj, props);
    // add symbols
    canReflect.assignSymbols(obj, symbols);
    return obj;
};




// The following is for compatability with the old can-event/batch
// This can be removed in a future version.
function defineNonEnumerable(obj, prop, value) {
    Object.defineProperty(obj, prop, {
    	enumerable: false,
    	value: value
    });
}

assign(eventQueue, props);
defineNonEnumerable(eventQueue,"start", function(){
    console.warn("use can-queues.batch.start()");
    queues.batch.start();
});
defineNonEnumerable(eventQueue,"stop", function(){
    console.warn("use can-queues.batch.stop()");
    queues.batch.stop();
});
defineNonEnumerable(eventQueue,"flush", function(){
    console.warn("use can-queues.flush()");
    queues.flush();
});

defineNonEnumerable(eventQueue,"afterPreviousEvents", function(handler){
    console.warn("don't use afterPreviousEvents");
    queues.mutateQueue.enqueue(function afterPreviousEvents(){
        queues.mutateQueue.enqueue(handler);
    });
    queues.flush();
});

defineNonEnumerable(eventQueue,"after", function(handler){
    console.warn("don't use after");
    queues.mutateQueue.enqueue(handler);
    queues.flush();
});

module.exports = eventQueue;

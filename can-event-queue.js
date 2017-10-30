var canDev = require("can-util/js/dev/dev");
var assign = require("can-util/js/assign/assign");
var queues = require("can-queues");
var canReflect = require("can-reflect");
var canSymbol = require("can-symbol");
var KeyTree = require("can-key-tree");

var domEvents = require("can-util/dom/events/events");



// Ensure the "obj" passed as an argument has an object on @@can.meta
var ensureMeta = function ensureMeta(obj) {
	var metaSymbol = canSymbol.for("can.meta");
	var meta = obj[metaSymbol];

	if (!meta) {
		meta = {};
		canReflect.setKeyValue(obj, metaSymbol, meta);
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
				queues.enqueueByQueue(getLifecycleHandlers(obj).getNode([]), obj, [true]);
			},
			onEmpty: function(){
				if( obj._eventTeardown ) {
					obj._eventTeardown();
				}
				queues.enqueueByQueue(getLifecycleHandlers(obj).getNode([]), obj, [false]);
			}
		});
	}
	var lifecycleHandlers = meta.lifecycleHandlers;
	if(!lifecycleHandlers) {
		// lifecycleHandlers are organized by:
		// event name - the type of event bound to
		// binding type - "event" for things that expect an event object (legacy), "onKeyValue" for reflective bindings.
		// queue name - mutate, queue, etc
		// lifecycleHandlers - the lifecycleHandlers.
		lifecycleHandlers = meta.lifecycleHandlers = new KeyTree([Object, Array]);
	}

	return meta;
};

// getHandlers returns a KeyTree used for event handling.
// `handlers` will be on the `can.meta` symbol on the object.
function getHandlers(obj) {
	return ensureMeta(obj).handlers;
}

// getLifecycleHandlers returns a KeyTree used for handling first binding and last unbinding events
// `lifecycleHandlers` will be on the `can.meta` symbol on the object.
function getLifecycleHandlers(obj) {
	return ensureMeta(obj).lifecycleHandlers;
}

// These are the properties we are going to add to objects
var props = {
	dispatch: function(event, args) {
		//!steal-remove-start
		if (arguments.length > 4) {
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
					type: event
				};
			}

			//!steal-remove-start
			if (!event.reasonLog) {
				event.reasonLog = [ canReflect.getName(this), "dispatched", '"' + event + '"', "with" ].concat(args);
			}
			if (!event.makeMeta) {
				event.makeMeta = function makeMeta(handler) {
					return {
						log: [ canReflect.getName(handler) ]
					};
				};
			}

			var meta = ensureMeta(this);
			if (typeof meta._log === "function") {
				meta._log.call(this, event, args);
			}
			//!steal-remove-end

			var handlers = meta.handlers;
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

var onKeyValueSymbol = canSymbol.for("can.onKeyValue"),
	offKeyValueSymbol = canSymbol.for("can.offKeyValue"),
	onEventSymbol = canSymbol.for("can.onEvent"),
	offEventSymbol = canSymbol.for("can.offEvent"),
	onValueSymbol = canSymbol.for("can.onValue"),
	offValueSymbol = canSymbol.for("can.offValue");

props.on = function(eventName, handler, queue) {
	var listenWithDOM = domEvents.canAddEventListener.call(this);
	if(listenWithDOM) {
		var method = typeof handler === "string" ? "addDelegateListener" : "addEventListener";
		domEvents[method].call(this, eventName, handler, queue);
	} else {
		if("addEventListener" in this) {
			this.addEventListener(eventName, handler, queue);
		} else if(this[onKeyValueSymbol]) {
			canReflect.onKeyValue(this, eventName, handler, queue);
		} else if(this[onEventSymbol]) {
			this[onEventSymbol](eventName, handler, queue);
		} else {
			if(!eventName && this[onValueSymbol]) {
				canReflect.onValue(this, handler);
			} else {
				throw new Error("can-control: Unable to bind "+eventName);
			}
		}
	}
};
props.off = function(eventName, handler, queue) {

	var listenWithDOM = domEvents.canAddEventListener.call(this);
	if(listenWithDOM) {
		var method = typeof handler === "string" ? "removeDelegateListener" : "removeEventListener";
		domEvents[method].call(this, eventName, handler, queue);
	} else {

		if("removeEventListener" in this) {
			this.removeEventListener(eventName, handler, queue);
		} else if(this[offKeyValueSymbol]) {
			canReflect.offKeyValue(this, eventName, handler, queue);
		} else if(this[offEventSymbol]) {
			this[offEventSymbol](eventName, handler, queue);
		} else {
			if(!eventName && this[offValueSymbol]) {
				canReflect.offValue(this, handler);
			} else {
				throw new Error("can-control: Unable to unbind "+eventName);
			}

		}
	}
};

// The symbols we'll add to objects
var symbols = {
	"can.onKeyValue": function(key, handler, queueName) {
		getHandlers(this).add([key, "onKeyValue",queueName || "mutate", handler]);
	},
	"can.offKeyValue": function(key, handler, queueName) {
		getHandlers(this).delete([key, "onKeyValue", queueName || "mutate", handler]);
	},
	"can.onBoundChange": function(handler, queueName) {
		getLifecycleHandlers(this).add([queueName || "mutate", handler]);
	},
	"can.offBoundChange": function(handler, queueName) {
		getLifecycleHandlers(this).delete([queueName || "mutate", handler]);
	},
	"can.isBound": function() {
		return getHandlers(this).size() > 0;
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

var canDev = require("can-util/js/dev/dev");
var assign = require("can-util/js/assign/assign");
var queues = require("can-queues");
var canReflect = require("can-reflect");
var canSymbol = require("can-symbol");
var KeyTree = require("can-key-tree");

var domEvents = require("can-util/dom/events/events");

var metaSymbol = canSymbol.for("can.meta"),
	dispatchBoundChangeSymbol = canSymbol.for("can.dispatchInstanceBoundChange"),
	dispatchInstanceOnPatchesSymbol = canSymbol.for("can.dispatchInstanceOnPatches"),
	onKeyValueSymbol = canSymbol.for("can.onKeyValue"),
	offKeyValueSymbol = canSymbol.for("can.offKeyValue"),
	onEventSymbol = canSymbol.for("can.onEvent"),
	offEventSymbol = canSymbol.for("can.offEvent"),
	onValueSymbol = canSymbol.for("can.onValue"),
	offValueSymbol = canSymbol.for("can.offValue");

var legacyMapBindings;


// getHandlers returns a KeyTree used for event handling.
// `handlers` will be on the `can.meta` symbol on the object.
// Ensure the "obj" passed as an argument has an object on @@can.meta
var ensureMeta = function ensureMeta(obj) {
	var meta = obj[metaSymbol];

	if (!meta) {
		meta = {};
		canReflect.setKeyValue(obj, metaSymbol, meta);
	}
	if (!meta.handlers) {
		// Handlers are organized by:
		// event name - the type of event bound to
		// binding type - "event" for things that expect an event object (legacy), "onKeyValue" for reflective bindings.
		// queue name - mutate, queue, etc
		// handlers - the handlers.
		meta.handlers = new KeyTree([Object, Object, Object, Array], {
			onFirst: function() {
				if (obj._eventSetup) {
					obj._eventSetup();
				}
				if(obj.constructor[dispatchBoundChangeSymbol]) {
					obj.constructor[dispatchBoundChangeSymbol](obj, true);
				}
				//queues.enqueueByQueue(getLifecycleHandlers(obj).getNode([]), obj, [true]);
			},
			onEmpty: function() {
				if (obj._eventTeardown) {
					obj._eventTeardown();
				}
				if(obj.constructor[dispatchBoundChangeSymbol]) {
					obj.constructor[dispatchBoundChangeSymbol](obj, false);
				}
				//queues.enqueueByQueue(getLifecycleHandlers(obj).getNode([]), obj, [false]);
			}
		});
	}

	if (!meta.listenHandlers) {
		meta.listenHandlers = new KeyTree([Map, Object, Array]);
	}

	return meta;
};

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
			args = [args];
		}
		//!steal-remove-end

		// Don't send events if initalizing.
		if (!this.__inSetup) {
			if (typeof event === 'string') {
				event = {
					type: event
				};
			}

			var meta = ensureMeta(this);

			//!steal-remove-start
			if (!event.reasonLog) {
				event.reasonLog = [canReflect.getName(this), "dispatched", '"' + event.type + '"', "with"].concat(args);
			}
			if (!event.makeMeta) {
				event.makeMeta = function makeMeta(handler) {
					return {
						log: [canReflect.getName(handler)]
					};
				};
			}

			if (typeof meta._log === "function") {
				meta._log.call(this, event, args);
			}
			//!steal-remove-end
			var handlers = meta.handlers;
			var handlersByType = handlers.getNode([event.type]);
			var dispatchPatches = event.patches && this.constructor[dispatchInstanceOnPatchesSymbol];
			var batch = dispatchPatches || handlersByType;
			if ( batch ) {
				queues.batch.start();
			}
			if(handlersByType) {
				if (handlersByType.onKeyValue) {
					queues.enqueueByQueue(handlersByType.onKeyValue, this, args, event.makeMeta, event.reasonLog);
				}
				if (handlersByType.event) {
					event.batchNum = queues.batch.number();
					var eventAndArgs = [event].concat(args);
					queues.enqueueByQueue(handlersByType.event, this, eventAndArgs, event.makeMeta, event.reasonLog);
				}
			}
			if(dispatchPatches) {
				this.constructor[dispatchInstanceOnPatchesSymbol](this, event.patches);
			}
			if ( batch ) {
				queues.batch.stop();
			}
		}
	},
	addEventListener: function(key, handler, queueName) {
		ensureMeta(this).handlers.add([key, "event", queueName || "mutate", handler]);
	},
	removeEventListener: function(key, handler, queueName) {
		if(key === undefined) {
			// This isn't super fast, but this pattern isn't used much.
			// We could re-arrange the tree so it would be faster.
			var handlers = ensureMeta(this).handlers;
			var keyHandlers = handlers.getNode([]);
			Object.keys(keyHandlers).forEach(function(key){
				handlers.delete([key,"event"]);
			});
		} else if (!handler && !queueName) {
			ensureMeta(this).handlers.delete([key, "event"]);
		} else if (!handler) {
			ensureMeta(this).handlers.delete([key, "event", queueName || "mutate"]);
		} else {
			ensureMeta(this).handlers.delete([key, "event", queueName || "mutate", handler]);
		}
	},
	one: function(event, handler) {
		// Unbind the listener after it has been executed
		var one = function() {
			legacyMapBindings.off.call(this, event, one);
			return handler.apply(this, arguments);
		};

		// Bind the altered listener
		legacyMapBindings.on.call(this, event, one);
		return this;
	},
	listenTo: function (other, event, handler) {
		// Initialize event cache
		ensureMeta(this).listenHandlers.add([other, event, handler]);

		legacyMapBindings.on.call(other, event, handler);
	},
	stopListening: function (other, event, handler) {
		var listenHandlers = ensureMeta(this).listenHandlers;

		function stopHandler(other, event, handler) {
			legacyMapBindings.off.call(other, event, handler);
		}
		function stopEvent(other, event) {
			listenHandlers.get([other, event]).forEach(function(handler){
				stopHandler(other, event, handler);
			});
		}
		function stopOther(other) {
			canReflect.eachKey( listenHandlers.getNode([other]), function(handlers, event){
				stopEvent(other, event);
			});
		}

		if(other) {
			if(event) {
				if(handler) {
					stopHandler(other, event, handler);
					listenHandlers.delete([other, event, handler]);
				} else {
					stopEvent(other, event);
					listenHandlers.delete([other, event]);
				}
			} else {
				stopOther(other);
				listenHandlers.delete([other]);
			}
		} else {
			canReflect.eachKey( listenHandlers.getNode([]), function(events, other){
				stopOther(other);
			});
			listenHandlers.delete([]);
		}
		return this;
	},
	on: function(eventName, handler, queue) {
		var listenWithDOM = domEvents.canAddEventListener.call(this);
		if (listenWithDOM) {
			var method = typeof handler === "string" ? "addDelegateListener" : "addEventListener";
			domEvents[method].call(this, eventName, handler, queue);
		} else {
			if ("addEventListener" in this) {
				this.addEventListener(eventName, handler, queue);
			} else if (this[onKeyValueSymbol]) {
				canReflect.onKeyValue(this, eventName, handler, queue);
			} else if (this[onEventSymbol]) {
				this[onEventSymbol](eventName, handler, queue);
			} else {
				if (!eventName && this[onValueSymbol]) {
					canReflect.onValue(this, handler);
				} else {
					throw new Error("can-event-queue: Unable to bind " + eventName);
				}
			}
		}
	},
	off: function(eventName, handler, queue) {

		var listenWithDOM = domEvents.canAddEventListener.call(this);
		if (listenWithDOM) {
			var method = typeof handler === "string" ? "removeDelegateListener" : "removeEventListener";
			domEvents[method].call(this, eventName, handler, queue);
		} else {

			if ("removeEventListener" in this) {
				this.removeEventListener(eventName, handler, queue);
			} else if (this[offKeyValueSymbol]) {
				canReflect.offKeyValue(this, eventName, handler, queue);
			} else if (this[offEventSymbol]) {
				this[offEventSymbol](eventName, handler, queue);
			} else {
				if (!eventName && this[offValueSymbol]) {
					canReflect.offValue(this, handler);
				} else {
					throw new Error("can-event-queue: Unable to unbind " + eventName);
				}

			}
		}
	}
};
props.bind = props.addEventListener;
props.unbind = props.removeEventListener;


// The symbols we'll add to objects
var symbols = {
	"can.onKeyValue": function(key, handler, queueName) {
		ensureMeta(this).handlers.add([key, "onKeyValue", queueName || "mutate", handler]);
	},
	"can.offKeyValue": function(key, handler, queueName) {
		ensureMeta(this).handlers.delete([key, "onKeyValue", queueName || "mutate", handler]);
	},
	"can.isBound": function() {
		return ensureMeta(this).handlers.size() > 0;
	}
};

// The actual legacyMapBindings mixin function
legacyMapBindings = function(obj) {
	// add properties
	assign(obj, props);
	// add symbols
	return canReflect.assignSymbols(obj, symbols);
};


// The following is for compatability with the old can-event/batch
// This can be removed in a future version.
function defineNonEnumerable(obj, prop, value) {
	Object.defineProperty(obj, prop, {
		enumerable: false,
		value: value
	});
}

assign(legacyMapBindings, props);

defineNonEnumerable(legacyMapBindings, "start", function() {
	console.warn("use can-queues.batch.start()");
	queues.batch.start();
});
defineNonEnumerable(legacyMapBindings, "stop", function() {
	console.warn("use can-queues.batch.stop()");
	queues.batch.stop();
});
defineNonEnumerable(legacyMapBindings, "flush", function() {
	console.warn("use can-queues.flush()");
	queues.flush();
});

defineNonEnumerable(legacyMapBindings, "afterPreviousEvents", function(handler) {
	console.warn("don't use afterPreviousEvents");
	queues.mutateQueue.enqueue(function afterPreviousEvents() {
		queues.mutateQueue.enqueue(handler);
	});
	queues.flush();
});

defineNonEnumerable(legacyMapBindings, "after", function(handler) {
	console.warn("don't use after");
	queues.mutateQueue.enqueue(handler);
	queues.flush();
});

module.exports = legacyMapBindings;

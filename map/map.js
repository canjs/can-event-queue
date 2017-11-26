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

var mapBindings;


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

		meta.handlers = new KeyTree([Object, Object, Array], {
			onFirst: function() {
				if(obj.constructor[dispatchBoundChangeSymbol]) {
					obj.constructor[dispatchBoundChangeSymbol](obj, true);
				}
			},
			onEmpty: function() {
				if(obj.constructor[dispatchBoundChangeSymbol]) {
					obj.constructor[dispatchBoundChangeSymbol](obj, false);
				}
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
            queues.enqueueByQueue(handlersByType, this, args, event.makeMeta, event.reasonLog);
		}
		if(dispatchPatches) {
			this.constructor[dispatchInstanceOnPatchesSymbol](this, event.patches);
		}
		if ( batch ) {
			queues.batch.stop();
		}

	},
	addEventListener: function(key, handler, queueName) {
		this[onKeyValueSymbol](key, handler, queueName);
	},
	removeEventListener: function(key, handler, queueName) {
		this[offKeyValueSymbol](key, handler, queueName);
	},
	one: function(event, handler) {
		// Unbind the listener after it has been executed
		var one = function() {
			mapBindings.off.call(this, event, one);
			return handler.apply(this, arguments);
		};

		// Bind the altered listener
		mapBindings.on.call(this, event, one);
		return this;
	},
	listenTo: function (other, event, handler) {
		// Initialize event cache
		if(canReflect.isPrimitive(other)) {
			handler = event;
			event = other;
			other = this;
		}
		ensureMeta(this).listenHandlers.add([other, event, handler]);

		mapBindings.on.call(other, event, handler);
	},
	stopListening: function (other, event, handler) {
		if(canReflect.isPrimitive(other)) {
			handler = event;
			event = other;
			other = this;
		}
		var listenHandlers = ensureMeta(this).listenHandlers;

		function stopHandler(other, event, handler) {
			mapBindings.off.call(other, event, handler);
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
			if (this[onKeyValueSymbol]) {
				this[onKeyValueSymbol](eventName, handler, queue);
			} else if (this[onEventSymbol]) {
				this[onEventSymbol](eventName, handler, queue);
			} else if ("addEventListener" in this) {
				this.addEventListener(eventName, handler, queue);
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

			if (this[offKeyValueSymbol]) {
				this[offKeyValueSymbol](eventName, handler, queue);
			} else if (this[offEventSymbol]) {
				this[offEventSymbol](eventName, handler, queue);
			} else if ("removeEventListener" in this) {
				this.removeEventListener(eventName, handler, queue);
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


// The symbols we'll add to objects
var symbols = {
	"can.onKeyValue": function(key, handler, queueName) {
		ensureMeta(this).handlers.add([key, queueName || "mutate", handler]);
	},
	"can.offKeyValue": function(key, handler, queueName) {
		if(key === undefined) {
			// This isn't super fast, but this pattern isn't used much.
			// We could re-arrange the tree so it would be faster.
			var handlers = ensureMeta(this).handlers;
			var keyHandlers = handlers.getNode([]);
			Object.keys(keyHandlers).forEach(function(key){
				handlers.delete([key]);
			});
		} else if (!handler && !queueName) {
			ensureMeta(this).handlers.delete([key]);
		} else if (!handler) {
			ensureMeta(this).handlers.delete([key, queueName || "mutate"]);
		} else {
			ensureMeta(this).handlers.delete([key, queueName || "mutate", handler]);
		}
	},
	"can.isBound": function() {
		return ensureMeta(this).handlers.size() > 0;
	}
};

// The actual mapBindings mixin function
mapBindings = function(obj) {
	// add properties
	assign(obj, props);
	// add symbols
	return canReflect.assignSymbols(obj, symbols);
};

assign(mapBindings, props);

module.exports = mapBindings;

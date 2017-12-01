var queues = require("can-queues");
var KeyTree = require("can-key-tree");
var canReflect = require("can-reflect");
var mergeDependencyRecords = require("./merge-dependency-records");
var defineLazyValue = require("can-define-lazy-value");

var properties = {
	on: function(handler, queue) {
		this.handlers.add([queue || "mutate", handler]);
	},
	off: function(handler, queueName) {
		if (handler === undefined) {
			if (queueName === undefined) {
				this.handlers.delete([]);
			} else {
				this.handlers.delete([queueName]);
			}
		} else {
			this.handlers.delete([queueName || "mutate", handler]);
		}
	}
};

var symbols = {
	"can.onValue": properties.on,
	"can.offValue": properties.off,
	"can.dispatch": function(value, old) {
		queues.enqueueByQueue(
			this.handlers.getNode([]),
			this,
			[value, old]
			//!steal-remove-start
			/* jshint laxcomma: true */
			, null
			, [canReflect.getName(this), "changed to", value, "from", old]
			/* jshint laxcomma: false */
			//!steal-remove-end
		);
		//!steal-remove-start
		if (typeof this._log === "function") {
			this._log(old, value);
		}
		//!steal-remove-end
	},
	"can.getWhatIChange": function getWhatIChange() {
		//!steal-remove-start
		var whatIChange = {};

		var notifyHandlers = this.handlers.get(["notify"]);
		var mutateHandlers = [].concat(
			this.handlers.get(["mutate"]),
			this.handlers.get(["domUI"])
		);

		if (notifyHandlers.length) {
			notifyHandlers.forEach(function(handler) {
				var changes = canReflect.getChangesDependencyRecord(handler);

				if (changes) {
					var record = whatIChange.derive;
					if (!record) {
						record = (whatIChange.derive = {});
					}
					mergeDependencyRecords(record, changes);
				}
			});
		}

		if (mutateHandlers.length) {
			mutateHandlers.forEach(function(handler) {
				var changes = canReflect.getChangesDependencyRecord(handler);

				if (changes) {
					var record = whatIChange.mutate;
					if (!record) {
						record = (whatIChange.mutate = {});
					}
					mergeDependencyRecords(record, changes);
				}
			});
		}

		return Object.keys(whatIChange).length ? whatIChange : undefined;
		//!steal-remove-end
	}
};

function defineLazyHandlers(){
	return new KeyTree([Object, Array], {
		onFirst: this.onBound !== undefined && this.onBound.bind(this),
		onEmpty: this.onUnbound !== undefined && this.onUnbound.bind(this)
	});
}

/**
 * @module {function} can-event-queue/value/value
 * @parent can-event-queue
 *
 * @description Mixin methods and symbols to make this object or prototype object
 * behave like a single-value observable.
 */
var mixinValueEventBindings = function(obj) {
	canReflect.assign(obj, properties);
	canReflect.assignSymbols(obj, symbols);
	defineLazyValue(obj,"handlers",defineLazyHandlers, true);
	return obj;
};

// callbacks is optional
mixinValueEventBindings.addHandlers = function(obj, callbacks) {
	console.warn("can-event-queue/value: Avoid using addHandlers. Add onBound and onUnbound methods instead.");
	obj.handlers = new KeyTree([Object, Array], callbacks);
	return obj;
};

module.exports = mixinValueEventBindings;

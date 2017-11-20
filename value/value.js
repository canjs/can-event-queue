var queues = require("can-queues");
var canReflect = require("can-reflect");
var KeyTree = require("can-key-tree");
var properties = {
    on: function(handler, queue){
		this.handlers.add([queue|| "mutate", handler]);
	},
	off: function(handler, queueName){
		if(handler === undefined) {
			if(queueName === undefined) {
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
        queues.enqueueByQueue(this.handlers.getNode([]), this, [value, old]
			//!steal-remove-start
			/* jshint laxcomma: true */
			, null
			, [ canReflect.getName(this), "changed to", value, "from", old ]
			/* jshint laxcomma: false */
			//!steal-remove-end
		);
        //!steal-remove-start
		if (typeof this._log === "function") {
			this._log(old, value);
		}
		//!steal-remove-end
    }
};

var mixinValueEventBindings = function(obj){
    canReflect.assign(obj, properties);
    canReflect.assignSymbols(obj, symbols);
    return obj;
};

mixinValueEventBindings.addHandlers = function(obj){
    obj.handlers = new KeyTree([Object, Array]);
    return obj;
};

module.exports = mixinValueEventBindings;

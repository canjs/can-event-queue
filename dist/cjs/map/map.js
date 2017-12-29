/*can-event-queue@0.15.5#map/map*/
var canDev = require('can-log/dev/dev');
var queues = require('can-queues');
var canReflect = require('can-reflect');
var canSymbol = require('can-symbol');
var KeyTree = require('can-key-tree');
var domEvents = require('can-dom-events');
var isDomEventTarget = require('can-dom-events/helpers/util').isDomEventTarget;
var mergeDependencyRecords = require('../dependency-record/merge.js');
var metaSymbol = canSymbol.for('can.meta'), dispatchBoundChangeSymbol = canSymbol.for('can.dispatchInstanceBoundChange'), dispatchInstanceOnPatchesSymbol = canSymbol.for('can.dispatchInstanceOnPatches'), onKeyValueSymbol = canSymbol.for('can.onKeyValue'), offKeyValueSymbol = canSymbol.for('can.offKeyValue'), onEventSymbol = canSymbol.for('can.onEvent'), offEventSymbol = canSymbol.for('can.offEvent'), onValueSymbol = canSymbol.for('can.onValue'), offValueSymbol = canSymbol.for('can.offValue');
var legacyMapBindings;
function addHandlers(obj, meta) {
    if (!meta.handlers) {
        meta.handlers = new KeyTree([
            Object,
            Object,
            Object,
            Array
        ], {
            onFirst: function () {
                if (obj._eventSetup !== undefined) {
                    obj._eventSetup();
                }
                if (obj.constructor[dispatchBoundChangeSymbol]) {
                    obj.constructor[dispatchBoundChangeSymbol](obj, true);
                }
            },
            onEmpty: function () {
                if (obj._eventTeardown !== undefined) {
                    obj._eventTeardown();
                }
                if (obj.constructor[dispatchBoundChangeSymbol]) {
                    obj.constructor[dispatchBoundChangeSymbol](obj, false);
                }
            }
        });
    }
    if (!meta.listenHandlers) {
        meta.listenHandlers = new KeyTree([
            Map,
            Object,
            Array
        ]);
    }
}
var ensureMeta = function ensureMeta(obj) {
    var meta = obj[metaSymbol];
    if (!meta) {
        meta = {};
        canReflect.setKeyValue(obj, metaSymbol, meta);
    }
    addHandlers(obj, meta);
    return meta;
};
var props = {
    dispatch: function (event, args) {
        if (!this.__inSetup) {
            if (typeof event === 'string') {
                event = { type: event };
            }
            var meta = ensureMeta(this);
            var handlers = meta.handlers;
            var handlersByType = event.type !== undefined && handlers.getNode([event.type]);
            var dispatchConstructorPatches = event.patches && this.constructor[dispatchInstanceOnPatchesSymbol];
            var patchesNode = event.patches !== undefined && handlers.getNode([
                'can.patches',
                'onKeyValue'
            ]);
            var keysNode = event.keyChanged !== undefined && handlers.getNode([
                'can.keys',
                'onKeyValue'
            ]);
            var batch = dispatchConstructorPatches || handlersByType || patchesNode || keysNode;
            if (batch) {
                queues.batch.start();
            }
            if (handlersByType) {
                if (handlersByType.onKeyValue) {
                    queues.enqueueByQueue(handlersByType.onKeyValue, this, args, event.makeMeta, event.reasonLog);
                }
                if (handlersByType.event) {
                    event.batchNum = queues.batch.number();
                    var eventAndArgs = [event].concat(args);
                    queues.enqueueByQueue(handlersByType.event, this, eventAndArgs, event.makeMeta, event.reasonLog);
                }
            }
            if (keysNode) {
                queues.enqueueByQueue(keysNode, this, [event.keyChanged], event.makeMeta, event.reasonLog);
            }
            if (patchesNode) {
                queues.enqueueByQueue(patchesNode, this, [event.patches], event.makeMeta, event.reasonLog);
            }
            if (dispatchConstructorPatches) {
                this.constructor[dispatchInstanceOnPatchesSymbol](this, event.patches);
            }
            if (batch) {
                queues.batch.stop();
            }
        }
        return event;
    },
    addEventListener: function (key, handler, queueName) {
        ensureMeta(this).handlers.add([
            key,
            'event',
            queueName || 'mutate',
            handler
        ]);
        return this;
    },
    removeEventListener: function (key, handler, queueName) {
        if (key === undefined) {
            var handlers = ensureMeta(this).handlers;
            var keyHandlers = handlers.getNode([]);
            Object.keys(keyHandlers).forEach(function (key) {
                handlers.delete([
                    key,
                    'event'
                ]);
            });
        } else if (!handler && !queueName) {
            ensureMeta(this).handlers.delete([
                key,
                'event'
            ]);
        } else if (!handler) {
            ensureMeta(this).handlers.delete([
                key,
                'event',
                queueName || 'mutate'
            ]);
        } else {
            ensureMeta(this).handlers.delete([
                key,
                'event',
                queueName || 'mutate',
                handler
            ]);
        }
        return this;
    },
    one: function (event, handler) {
        var one = function () {
            legacyMapBindings.off.call(this, event, one);
            return handler.apply(this, arguments);
        };
        legacyMapBindings.on.call(this, event, one);
        return this;
    },
    listenTo: function (bindTarget, event, handler) {
        if (canReflect.isPrimitive(bindTarget)) {
            handler = event;
            event = bindTarget;
            bindTarget = this;
        }
        ensureMeta(this).listenHandlers.add([
            bindTarget,
            event,
            handler
        ]);
        legacyMapBindings.on.call(bindTarget, event, handler);
        return this;
    },
    stopListening: function (bindTarget, event, handler) {
        if (arguments.length && canReflect.isPrimitive(bindTarget)) {
            handler = event;
            event = bindTarget;
            bindTarget = this;
        }
        var listenHandlers = ensureMeta(this).listenHandlers;
        function stopHandler(bindTarget, event, handler) {
            legacyMapBindings.off.call(bindTarget, event, handler);
        }
        function stopEvent(bindTarget, event) {
            listenHandlers.get([
                bindTarget,
                event
            ]).forEach(function (handler) {
                stopHandler(bindTarget, event, handler);
            });
        }
        function stopBindTarget(bindTarget) {
            canReflect.eachKey(listenHandlers.getNode([bindTarget]), function (handlers, event) {
                stopEvent(bindTarget, event);
            });
        }
        if (bindTarget) {
            if (event) {
                if (handler) {
                    stopHandler(bindTarget, event, handler);
                    listenHandlers.delete([
                        bindTarget,
                        event,
                        handler
                    ]);
                } else {
                    stopEvent(bindTarget, event);
                    listenHandlers.delete([
                        bindTarget,
                        event
                    ]);
                }
            } else {
                stopBindTarget(bindTarget);
                listenHandlers.delete([bindTarget]);
            }
        } else {
            canReflect.eachKey(listenHandlers.getNode([]), function (events, bindTarget) {
                stopBindTarget(bindTarget);
            });
            listenHandlers.delete([]);
        }
        return this;
    },
    on: function (eventName, handler, queue) {
        var listenWithDOM = isDomEventTarget(this);
        if (listenWithDOM) {
            if (typeof handler === 'string') {
                domEvents.addDelegateListener(this, eventName, handler, queue);
            } else {
                domEvents.addEventListener(this, eventName, handler, queue);
            }
        } else {
            if ('addEventListener' in this) {
                this.addEventListener(eventName, handler, queue);
            } else if (this[onKeyValueSymbol]) {
                canReflect.onKeyValue(this, eventName, handler, queue);
            } else if (this[onEventSymbol]) {
                this[onEventSymbol](eventName, handler, queue);
            } else {
                if (!eventName && this[onValueSymbol]) {
                    canReflect.onValue(this, handler, queue);
                } else {
                    throw new Error('can-event-queue: Unable to bind ' + eventName);
                }
            }
        }
        return this;
    },
    off: function (eventName, handler, queue) {
        var listenWithDOM = isDomEventTarget(this);
        if (listenWithDOM) {
            if (typeof handler === 'string') {
                domEvents.removeDelegateListener(this, eventName, handler, queue);
            } else {
                domEvents.removeEventListener(this, eventName, handler, queue);
            }
        } else {
            if ('removeEventListener' in this) {
                this.removeEventListener(eventName, handler, queue);
            } else if (this[offKeyValueSymbol]) {
                canReflect.offKeyValue(this, eventName, handler, queue);
            } else if (this[offEventSymbol]) {
                this[offEventSymbol](eventName, handler, queue);
            } else {
                if (!eventName && this[offValueSymbol]) {
                    canReflect.offValue(this, handler, queue);
                } else {
                    throw new Error('can-event-queue: Unable to unbind ' + eventName);
                }
            }
        }
        return this;
    }
};
var symbols = {
    'can.onKeyValue': function (key, handler, queueName) {
        ensureMeta(this).handlers.add([
            key,
            'onKeyValue',
            queueName || 'mutate',
            handler
        ]);
    },
    'can.offKeyValue': function (key, handler, queueName) {
        ensureMeta(this).handlers.delete([
            key,
            'onKeyValue',
            queueName || 'mutate',
            handler
        ]);
    },
    'can.isBound': function () {
        return ensureMeta(this).handlers.size() > 0;
    },
    'can.getWhatIChange': function getWhatIChange(key) {
    },
    'can.onPatches': function (handler, queue) {
        var handlers = ensureMeta(this).handlers;
        handlers.add([
            'can.patches',
            'onKeyValue',
            queue || 'notify',
            handler
        ]);
    },
    'can.offPatches': function (handler, queue) {
        var handlers = ensureMeta(this).handlers;
        handlers.delete([
            'can.patches',
            'onKeyValue',
            queue || 'notify',
            handler
        ]);
    }
};
legacyMapBindings = function (obj) {
    canReflect.assignMap(obj, props);
    return canReflect.assignSymbols(obj, symbols);
};
defineNonEnumerable(legacyMapBindings, 'addHandlers', addHandlers);
props.bind = props.addEventListener;
props.unbind = props.removeEventListener;
function defineNonEnumerable(obj, prop, value) {
    Object.defineProperty(obj, prop, {
        enumerable: false,
        value: value
    });
}
canReflect.assignMap(legacyMapBindings, props);
canReflect.assignSymbols(legacyMapBindings, symbols);
defineNonEnumerable(legacyMapBindings, 'start', function () {
    console.warn('use can-queues.batch.start()');
    queues.batch.start();
});
defineNonEnumerable(legacyMapBindings, 'stop', function () {
    console.warn('use can-queues.batch.stop()');
    queues.batch.stop();
});
defineNonEnumerable(legacyMapBindings, 'flush', function () {
    console.warn('use can-queues.flush()');
    queues.flush();
});
defineNonEnumerable(legacyMapBindings, 'afterPreviousEvents', function (handler) {
    console.warn('don\'t use afterPreviousEvents');
    queues.mutateQueue.enqueue(function afterPreviousEvents() {
        queues.mutateQueue.enqueue(handler);
    });
    queues.flush();
});
defineNonEnumerable(legacyMapBindings, 'after', function (handler) {
    console.warn('don\'t use after');
    queues.mutateQueue.enqueue(handler);
    queues.flush();
});
module.exports = legacyMapBindings;
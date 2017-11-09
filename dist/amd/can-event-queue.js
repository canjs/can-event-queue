/*can-event-queue@0.8.0#can-event-queue*/
define([
    'require',
    'exports',
    'module',
    'can-util/js/dev',
    'can-util/js/assign',
    'can-queues',
    'can-reflect',
    'can-symbol',
    'can-key-tree',
    'can-util/dom/events'
], function (require, exports, module) {
    var canDev = require('can-util/js/dev');
    var assign = require('can-util/js/assign');
    var queues = require('can-queues');
    var canReflect = require('can-reflect');
    var canSymbol = require('can-symbol');
    var KeyTree = require('can-key-tree');
    var domEvents = require('can-util/dom/events');
    var metaSymbol = canSymbol.for('can.meta'), dispatchBoundChangeSymbol = canSymbol.for('can.dispatchInstanceBoundChange'), dispatchInstanceOnPatchesSymbol = canSymbol.for('can.dispatchInstanceOnPatches'), onKeyValueSymbol = canSymbol.for('can.onKeyValue'), offKeyValueSymbol = canSymbol.for('can.offKeyValue'), onEventSymbol = canSymbol.for('can.onEvent'), offEventSymbol = canSymbol.for('can.offEvent'), onValueSymbol = canSymbol.for('can.onValue'), offValueSymbol = canSymbol.for('can.offValue');
    var eventQueue;
    var ensureMeta = function ensureMeta(obj) {
        var meta = obj[metaSymbol];
        if (!meta) {
            meta = {};
            canReflect.setKeyValue(obj, metaSymbol, meta);
        }
        if (!meta.handlers) {
            meta.handlers = new KeyTree([
                Object,
                Object,
                Object,
                Array
            ], {
                onFirst: function () {
                    if (obj._eventSetup) {
                        obj._eventSetup();
                    }
                    if (obj.constructor[dispatchBoundChangeSymbol]) {
                        obj.constructor[dispatchBoundChangeSymbol](obj, true);
                    }
                },
                onEmpty: function () {
                    if (obj._eventTeardown) {
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
                var handlersByType = handlers.getNode([event.type]);
                var dispatchPatches = event.patches && this.constructor[dispatchInstanceOnPatchesSymbol];
                var batch = dispatchPatches || handlersByType;
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
                if (dispatchPatches) {
                    this.constructor[dispatchInstanceOnPatchesSymbol](this, event.patches);
                }
                if (batch) {
                    queues.batch.stop();
                }
            }
        },
        addEventListener: function (key, handler, queueName) {
            ensureMeta(this).handlers.add([
                key,
                'event',
                queueName || 'mutate',
                handler
            ]);
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
        },
        one: function (event, handler) {
            var one = function () {
                eventQueue.off.call(this, event, one);
                return handler.apply(this, arguments);
            };
            eventQueue.on.call(this, event, one);
            return this;
        },
        listenTo: function (other, event, handler) {
            ensureMeta(this).listenHandlers.add([
                other,
                event,
                handler
            ]);
            eventQueue.on.call(other, event, handler);
        },
        stopListening: function (other, event, handler) {
            var listenHandlers = ensureMeta(this).listenHandlers;
            function stopHandler(other, event, handler) {
                eventQueue.off.call(other, event, handler);
            }
            function stopEvent(other, event) {
                listenHandlers.get([
                    other,
                    event
                ]).forEach(function (handler) {
                    stopHandler(other, event, handler);
                });
            }
            function stopOther(other) {
                canReflect.eachKey(listenHandlers.getNode([other]), function (handlers, event) {
                    stopEvent(other, event);
                });
            }
            if (other) {
                if (event) {
                    if (handler) {
                        stopHandler(other, event, handler);
                        listenHandlers.delete([
                            other,
                            event,
                            handler
                        ]);
                    } else {
                        stopEvent(other, event);
                        listenHandlers.delete([
                            other,
                            event
                        ]);
                    }
                } else {
                    stopOther(other);
                    listenHandlers.delete([other]);
                }
            } else {
                canReflect.eachKey(listenHandlers.getNode([]), function (events, other) {
                    stopOther(other);
                });
                listenHandlers.delete([]);
            }
            return this;
        },
        on: function (eventName, handler, queue) {
            var listenWithDOM = domEvents.canAddEventListener.call(this);
            if (listenWithDOM) {
                var method = typeof handler === 'string' ? 'addDelegateListener' : 'addEventListener';
                domEvents[method].call(this, eventName, handler, queue);
            } else {
                if ('addEventListener' in this) {
                    this.addEventListener(eventName, handler, queue);
                } else if (this[onKeyValueSymbol]) {
                    canReflect.onKeyValue(this, eventName, handler, queue);
                } else if (this[onEventSymbol]) {
                    this[onEventSymbol](eventName, handler, queue);
                } else {
                    if (!eventName && this[onValueSymbol]) {
                        canReflect.onValue(this, handler);
                    } else {
                        throw new Error('can-event-queue: Unable to bind ' + eventName);
                    }
                }
            }
        },
        off: function (eventName, handler, queue) {
            var listenWithDOM = domEvents.canAddEventListener.call(this);
            if (listenWithDOM) {
                var method = typeof handler === 'string' ? 'removeDelegateListener' : 'removeEventListener';
                domEvents[method].call(this, eventName, handler, queue);
            } else {
                if ('removeEventListener' in this) {
                    this.removeEventListener(eventName, handler, queue);
                } else if (this[offKeyValueSymbol]) {
                    canReflect.offKeyValue(this, eventName, handler, queue);
                } else if (this[offEventSymbol]) {
                    this[offEventSymbol](eventName, handler, queue);
                } else {
                    if (!eventName && this[offValueSymbol]) {
                        canReflect.offValue(this, handler);
                    } else {
                        throw new Error('can-event-queue: Unable to unbind ' + eventName);
                    }
                }
            }
        }
    };
    props.bind = props.addEventListener;
    props.unbind = props.removeEventListener;
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
        }
    };
    eventQueue = function (obj) {
        assign(obj, props);
        return canReflect.assignSymbols(obj, symbols);
    };
    function defineNonEnumerable(obj, prop, value) {
        Object.defineProperty(obj, prop, {
            enumerable: false,
            value: value
        });
    }
    assign(eventQueue, props);
    defineNonEnumerable(eventQueue, 'start', function () {
        console.warn('use can-queues.batch.start()');
        queues.batch.start();
    });
    defineNonEnumerable(eventQueue, 'stop', function () {
        console.warn('use can-queues.batch.stop()');
        queues.batch.stop();
    });
    defineNonEnumerable(eventQueue, 'flush', function () {
        console.warn('use can-queues.flush()');
        queues.flush();
    });
    defineNonEnumerable(eventQueue, 'afterPreviousEvents', function (handler) {
        console.warn('don\'t use afterPreviousEvents');
        queues.mutateQueue.enqueue(function afterPreviousEvents() {
            queues.mutateQueue.enqueue(handler);
        });
        queues.flush();
    });
    defineNonEnumerable(eventQueue, 'after', function (handler) {
        console.warn('don\'t use after');
        queues.mutateQueue.enqueue(handler);
        queues.flush();
    });
    module.exports = eventQueue;
});
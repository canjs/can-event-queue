/*can-event-queue@0.1.1#can-event-queue*/
var canDev = require('can-util/js/dev/dev');
var assign = require('can-util/js/assign/assign');
var queues = require('can-queues');
var canReflect = require('can-reflect');
var canSymbol = require('can-symbol');
var KeyTree = require('can-key-tree');
var metaSymbol = canSymbol.for('can.meta');
function getHandlers(obj) {
    var meta = obj[metaSymbol];
    if (!meta) {
        canReflect.setKeyValue(obj, metaSymbol, meta = {});
    }
    var handlers = meta.handlers;
    if (!handlers) {
        handlers = meta.handlers = new KeyTree([
            Object,
            Object,
            Object,
            Array
        ], {
            onFirst: function () {
                if (obj._eventSetup) {
                    obj._eventSetup();
                }
            },
            onEmpty: function () {
                if (obj._eventTeardown) {
                    obj._eventTeardown();
                }
            }
        });
    }
    return handlers;
}
var props = {
    dispatch: function (event, args) {
        if (!this.__inSetup) {
            if (typeof event === 'string') {
                event = { type: event };
            }
            var handlers = getHandlers(this);
            var handlersByType = handlers.getNode([event.type]);
            if (handlersByType) {
                queues.batch.start();
                if (handlersByType.onKeyValue) {
                    queues.enqueueByQueue(handlersByType.onKeyValue, this, args, event.makeMeta, event.reasonLog);
                }
                if (handlersByType.event) {
                    event.batchNum = queues.batch.number();
                    var eventAndArgs = [event].concat(args);
                    queues.enqueueByQueue(handlersByType.event, this, eventAndArgs, event.makeMeta, event.reasonLog);
                }
                queues.batch.stop();
            }
        }
    },
    addEventListener: function (key, handler, queueName) {
        getHandlers(this).add([
            key,
            'event',
            queueName || 'mutate',
            handler
        ]);
    },
    removeEventListener: function (key, handler, queueName) {
        getHandlers(this).delete([
            key,
            'event',
            queueName || 'mutate',
            handler
        ]);
    }
};
props.on = props.addEventListener;
props.off = props.removeEventListener;
var symbols = {
    'can.onKeyValue': function (key, handler, queueName) {
        getHandlers(this).add([
            key,
            'onKeyValue',
            queueName || 'mutate',
            handler
        ]);
    },
    'can.offKeyValue': function (key, handler, queueName) {
        getHandlers(this).delete([
            key,
            'onKeyValue',
            queueName || 'mutate',
            handler
        ]);
    }
};
var eventQueue = function (obj) {
    assign(obj, props);
    canReflect.assignSymbols(obj, symbols);
    return obj;
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
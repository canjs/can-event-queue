var QUnit = require('steal-qunit');
var eventQueue = require("can-event-queue");
var queues = require("can-queues");
var domEvents = require("can-util/dom/events/events");
var canSymbol = require("can-symbol");
var canReflect = require("can-reflect");

QUnit.module('can-event-queue',{
	setup: function(){ },
	teardown: function(){ }
});

QUnit.test("basics", function(){
	var collecting;
	var secondFired = false;
	var obj = eventQueue({});

	obj.on("first", function(ev, arg1, arg2){

		QUnit.equal(arg1, 1, "first arg");
		QUnit.equal(arg2, 2, "second arg");

		QUnit.ok(!collecting, "not collecting b/c we're not in a batch yet");

		obj.dispatch("second");

		// collecting = canBatch.collecting();
		//QUnit.ok(collecting, "forced a batch");
		QUnit.equal(secondFired, false, "don't fire yet, put in next batch");

	});


	obj.on("second", function(ev){
		secondFired = true;
		QUnit.ok(ev.batchNum, "got a batch number");
	});


	queues.batch.start();
	obj.dispatch("first",[1,2]);
	queues.batch.stop();

});

test("Everything is part of a batch", function(){
	var obj = eventQueue({});

	obj.on("foo", function(ev){
		ok(ev.batchNum); // There is a batch number
	});

	obj.dispatch("foo");
});




QUnit.test("flushing works (#18)", 3, function(){
	var firstFired, secondFired, thirdFired;
	var obj = eventQueue({});

	obj.on("first", function(){
		eventQueue.flush();
		QUnit.ok(firstFired, "first fired");
		QUnit.ok(secondFired, "second fired");
		QUnit.ok(thirdFired, "third fired");
	});
	obj.on("first", function(){
		firstFired = true;
	});
	obj.on("second", function(){
		secondFired = true;
	});
	obj.on("third", function(){
		thirdFired = true;
	});
	queues.batch.start();
	obj.dispatch("first");
	obj.dispatch("second");
	obj.dispatch("third");
	queues.batch.stop();

});

// The problem with the way atm is doing it ...
// the batch is ended ... but it doesn't pick up the next item in the queue and process it.
QUnit.test("flushing a future batch (#18)", 3, function(){
	var firstFired, secondFired, thirdFired;
	var obj = eventQueue({});

	obj.on("first", function(){
		queues.batch.start();
		obj.dispatch("second");
		obj.dispatch("third");
		queues.batch.stop();

		eventQueue.flush();
		QUnit.ok(firstFired, "first fired");
		QUnit.ok(secondFired, "second fired");
		QUnit.ok(thirdFired, "third fired");
	});
	obj.on("first", function(){
		firstFired = true;
	});
	obj.on("second", function(){
		secondFired = true;
	});
	obj.on("third", function(){
		thirdFired = true;
	});
	queues.batch.start();
	obj.dispatch("first");
	queues.batch.stop();

});

if(typeof document !== "undefined") {
	QUnit.test("can listen to DOM events", 1,function(){
		var el = document.createElement("div");
		var handler = function(){
			QUnit.ok(true, "click dispatched");
		};
		eventQueue.on.call(el,"click", handler);
		domEvents.dispatch.call(el, "click");
		eventQueue.off.call(el,"click", handler);
		domEvents.dispatch.call(el, "click");
	});
}

QUnit.test("handler-less unbind", function(){
	var obj = eventQueue({});

	obj.addEventListener("first", function(){});
	obj.addEventListener("first", function(){},"notify");

	var handlers = obj[canSymbol.for("can.meta")].handlers;
	QUnit.equal(handlers.get(["first"]).length, 2, "2 first handlers");
	obj.removeEventListener("first");
	QUnit.equal(handlers.get(["first"]).length, 0, "first handlers removed");
});
QUnit.test("key-less unbind", function(){
	var obj = eventQueue({});

	obj.addEventListener("first", function(){});
	obj.addEventListener("first", function(){},"notify");
	obj.addEventListener("second", function(){});
	obj.addEventListener("second", function(){},"notify");

	canReflect.onKeyValue(obj,"first", function(){});
	canReflect.onKeyValue(obj,"first", function(){},"notify");
	canReflect.onKeyValue(obj,"second", function(){});
	canReflect.onKeyValue(obj,"second", function(){},"notify");

	var handlers = obj[canSymbol.for("can.meta")].handlers;
	QUnit.equal(handlers.get([]).length, 8, "2 first handlers");
	obj.removeEventListener();
	QUnit.equal(handlers.get([]).length, 4, "first handlers removed");
});

QUnit.test("@@can.isBound symbol", function() {
	var obj = eventQueue({});
	var handler = function() {};

	QUnit.ok(!obj[canSymbol.for("can.isBound")](), "Object is not bound initially");

	obj.on("first", handler);
	QUnit.ok(obj[canSymbol.for("can.isBound")](), "Object is bound after adding listener");

	obj.off("first", handler);
	QUnit.ok(!obj[canSymbol.for("can.isBound")](), "Object is not bound after removing listener");

	obj[canSymbol.for("can.onBoundChange")](handler);
	QUnit.ok(!obj[canSymbol.for("can.isBound")](), "Object is not bound after adding bound change listener");

});

test("Events when object is bound/unbound", function() {
	expect(2);
	var obj = eventQueue({});
	var trueCaseHit = false;
	var metaHandler = function(newVal) {
		if(!trueCaseHit) {
			QUnit.ok(newVal, "new value reflects other events bound");
			trueCaseHit = true;
		} else {
			QUnit.ok(!newVal, "new value reflects all events unbound");
		}
	};
	var handler = function() {};

	obj[canSymbol.for("can.onBoundChange")](metaHandler);

	obj.on("first", handler);
	obj.off("first", handler);

	// Sanity check.  Ensure that no more events fire after offBoundChange
	obj[canSymbol.for("can.offBoundChange")](metaHandler);
	obj.on("first", handler);
	obj.off("first", handler);
});

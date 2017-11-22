var QUnit = require('steal-qunit');
var mapEventBindings = require("./map");
var queues = require("can-queues");
var domEvents = require("can-util/dom/events/events");
var canSymbol = require("can-symbol");
var canReflect = require("can-reflect");

QUnit.module('can-event-queue/map',{
	setup: function(){ },
	teardown: function(){ }
});

QUnit.test("basics", function(){
	var collecting;
	var secondFired = false;
	var obj = mapEventBindings({});

	obj.on("first", function(arg1, arg2){

		QUnit.equal(arg1, 1, "first arg");
		QUnit.equal(arg2, 2, "second arg");

		QUnit.ok(!collecting, "not collecting b/c we're not in a batch yet");

		obj.dispatch("second");

		// collecting = canBatch.collecting();
		//QUnit.ok(collecting, "forced a batch");
		QUnit.equal(secondFired, false, "don't fire yet, put in next batch");

	});


	obj.on("second", function(){
		secondFired = true;
	});


	queues.batch.start();
	obj.dispatch("first",[1,2]);
	queues.batch.stop();

});





QUnit.test("flushing works (#18)", 3, function(){
	var firstFired, secondFired, thirdFired;
	var obj = mapEventBindings({});

	obj.on("first", function(){
		queues.flush();
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
	var obj = mapEventBindings({});

	obj.on("first", function(){
		queues.batch.start();
		obj.dispatch("second");
		obj.dispatch("third");
		queues.batch.stop();

		queues.flush();
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
		mapEventBindings.on.call(el,"click", handler);
		domEvents.dispatch.call(el, "click");
		mapEventBindings.off.call(el,"click", handler);
		domEvents.dispatch.call(el, "click");
	});
}

QUnit.test("handler-less unbind", function(){
	var obj = mapEventBindings({});

	obj.addEventListener("first", function(){});
	obj.addEventListener("first", function(){},"notify");

	var handlers = obj[canSymbol.for("can.meta")].handlers;
	QUnit.equal(handlers.get(["first"]).length, 2, "2 first handlers");
	obj.removeEventListener("first");
	QUnit.equal(handlers.get(["first"]).length, 0, "first handlers removed");
});
QUnit.test("key-less unbind", function(){
	var obj = mapEventBindings({});


	canReflect.onKeyValue(obj,"first", function(){});
	canReflect.onKeyValue(obj,"first", function(){},"notify");
	canReflect.onKeyValue(obj,"second", function(){});
	canReflect.onKeyValue(obj,"second", function(){},"notify");

	var handlers = obj[canSymbol.for("can.meta")].handlers;
	QUnit.equal(handlers.get([]).length, 4, "4 handlers");
	obj.off();
	QUnit.equal(handlers.get([]).length, 0, "first handlers removed");
});

QUnit.test("@@can.isBound symbol", function() {
	var obj = mapEventBindings({});
	var handler = function() {};

	QUnit.ok(!obj[canSymbol.for("can.isBound")](), "Object is not bound initially");

	obj.on("first", handler);
	QUnit.ok(obj[canSymbol.for("can.isBound")](), "Object is bound after adding listener");

	obj.off("first", handler);
	QUnit.ok(!obj[canSymbol.for("can.isBound")](), "Object is not bound after removing listener");
});




test('listenTo and stopListening', 9, function () {
	var parent = mapEventBindings({});
	var child1 = mapEventBindings({});
	var child2 = mapEventBindings({});
	var change1WithId = 0;

	parent.listenTo(child1, 'change', function () {
		change1WithId++;
		if (change1WithId === 1) {
			ok(true, 'child 1 handler with id called');
		} else {
			ok(false, 'child 1 handler with id should only be called once');
		}
	});

	child1.addEventListener('change', function () {
		ok(true, 'child 1 handler without id called');
	});
	var foo1WidthId = 0;
	parent.listenTo(child1, 'foo', function () {
		foo1WidthId++;
		if (foo1WidthId === 1) {
			ok(true, 'child 1 foo handler with id called');
		} else {
			ok(false, 'child 1 foo handler should not be called twice');
		}
	});
	// child2 stuff
	(function () {
		var okToCall = true;
		parent.listenTo(child2, 'change', function () {
			ok(okToCall, 'child 2 handler with id called');
			okToCall = false;
		});
	}());
	child2.addEventListener('change', function () {
		ok(true, 'child 2 handler without id called');
	});
	parent.listenTo(child2, 'foo', function () {
		ok(true, 'child 2 foo handler with id called');
	});


	mapEventBindings.dispatch.call(child1, 'change');
	mapEventBindings.dispatch.call(child1, 'foo');
	mapEventBindings.dispatch.call(child2, 'change');
	mapEventBindings.dispatch.call(child2, 'foo');

	parent.stopListening(child1);
	parent.stopListening(child2, 'change');
	mapEventBindings.dispatch.call(child1, 'change');
	mapEventBindings.dispatch.call(child1, 'foo');
	mapEventBindings.dispatch.call(child2, 'change');
	mapEventBindings.dispatch.call(child2, 'foo');
});
test('stopListening on something you\'ve never listened to ', function () {
	var parent = mapEventBindings({});
	var child = mapEventBindings({});
	parent.listenTo({
		addEventListener: function(){}
	}, 'foo');
	parent.stopListening(child, 'change');
	ok(true, 'did not error');
});

test('One will listen to an event once, then unbind', function() {
	var mixin = 0;

	// Mixin call
	var obj = mapEventBindings({});
	obj.one('mixin', function() {
		mixin++;
	});

	obj.dispatch('mixin');
	obj.dispatch('mixin');
	obj.dispatch('mixin');
	equal(mixin, 1, 'one should only fire a handler once (mixin)');

});
var QUnit = require('steal-qunit');
var eventQueue = require("./map");
var queues = require("can-queues");
var domEvents = require("can-util/dom/events/events");
var canSymbol = require("can-symbol");
var canReflect = require("can-reflect");

var onlyDevTest = steal.isEnv("production") ? QUnit.skip : QUnit.test;

QUnit.module('can-event-queue/map',{
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
});




test('listenTo and stopListening', 9, function () {
	var parent = eventQueue({});
	var child1 = eventQueue({});
	var child2 = eventQueue({});
	var change1WithId = 0;

	parent.listenTo(child1, 'change', function () {
		change1WithId++;
		if (change1WithId === 1) {
			ok(true, 'child 1 handler with id called');
		} else {
			ok(false, 'child 1 handler with id should only be called once');
		}
	});

	child1.bind('change', function () {
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
	child2.bind('change', function () {
		ok(true, 'child 2 handler without id called');
	});
	parent.listenTo(child2, 'foo', function () {
		ok(true, 'child 2 foo handler with id called');
	});


	eventQueue.dispatch.call(child1, 'change');
	eventQueue.dispatch.call(child1, 'foo');
	eventQueue.dispatch.call(child2, 'change');
	eventQueue.dispatch.call(child2, 'foo');

	parent.stopListening(child1);
	parent.stopListening(child2, 'change');
	eventQueue.dispatch.call(child1, 'change');
	eventQueue.dispatch.call(child1, 'foo');
	eventQueue.dispatch.call(child2, 'change');
	eventQueue.dispatch.call(child2, 'foo');
});
test('stopListening on something you\'ve never listened to ', function () {
	var parent = eventQueue({});
	var child = eventQueue({});
	parent.listenTo({
		addEventListener: function(){}
	}, 'foo');
	parent.stopListening(child, 'change');
	ok(true, 'did not error');
});

test('One will listen to an event once, then unbind', function() {
	var mixin = 0;

	// Mixin call
	var obj = eventQueue({});
	obj.one('mixin', function() {
		mixin++;
	});

	obj.dispatch('mixin');
	obj.dispatch('mixin');
	obj.dispatch('mixin');
	equal(mixin, 1, 'one should only fire a handler once (mixin)');

});

onlyDevTest("getWhatIChange", function(assert) {
	var observable = eventQueue({});

	var getWhatIChange = observable[canSymbol.for("can.getWhatIChange")].bind(
		observable
	);

	assert.equal(
		typeof getWhatIChange(),
		"undefined",
		"should return undefined if handlers is empty"
	);

	var getChanges = function(value) {
		return function() {
			return { valueDependencies: new Set([value]) };
		};
	};

	var mutateHandler = function mutateHandler() {};
	var domUIHandler = function domUIHandler() {};
	var notifyHandler = function notifyHandler() {};

	// faux observables to set as being changed by the handlers in the queues
	var a = function a() {};
	var b = function b() {};

	var getChangesSymbol = canSymbol.for("can.getChangesDependencyRecord");
	mutateHandler[getChangesSymbol] = getChanges(a);
	domUIHandler[getChangesSymbol] = getChanges(b);
	notifyHandler[getChangesSymbol] = getChanges(a);

	// should take into account both legacy and onKeyValue handlers
	observable.addEventListener("first", mutateHandler);
	canReflect.onKeyValue(observable, "first", domUIHandler, "domUI");
	canReflect.onKeyValue(observable, "first", notifyHandler, "notify");

	var whatIChange = getWhatIChange("first");
	assert.deepEqual(
		whatIChange.mutate,
		{ valueDependencies: new Set([a, b]) },
		"domUI and mutate queues handlers deps should be included in .mutate"
	);
	assert.deepEqual(
		whatIChange.derive,
		{ valueDependencies: new Set([a]) },
		"notify queue handlers deps should be included in .derive"
	);
});

test('One will listen to an event once, then unbind', 0, function() {
	var mixin = 0;

	// Mixin call
	var obj1 = eventQueue({}),
		obj2 = eventQueue({});

	obj1.listenTo(obj2,"foo", function(){
		QUnit.ok(false, "this handler should not be called");
	});

	obj1.stopListening();


	obj2.dispatch("foo");

});

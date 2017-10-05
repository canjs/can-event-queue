var QUnit = require('steal-qunit');
var assign = require('can-util/js/assign/assign');
var eventQueue = require("can-event-queue");
var canDev = require('can-util/js/dev/dev');


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


	eventQueue.start();
	obj.dispatch("first",[1,2]);
	eventQueue.stop();

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
	eventQueue.start();
	obj.dispatch("first");
	obj.dispatch("second");
	obj.dispatch("third");
	eventQueue.stop();

});

// The problem with the way atm is doing it ...
// the batch is ended ... but it doesn't pick up the next item in the queue and process it.
QUnit.test("flushing a future batch (#18)", 3, function(){
	var firstFired, secondFired, thirdFired;
	var obj = eventQueue({});

	obj.on("first", function(){
		eventQueue.start();
		obj.dispatch("second");
		obj.dispatch("third");
		eventQueue.stop();

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
	eventQueue.start();
	obj.dispatch("first");
	eventQueue.stop();

});

var QUnit = require('steal-qunit');
var eventQueue = require("../map/map");
var canSymbol = require("can-symbol");
var addTypeEvents = require("./type");

QUnit.module('can-event-queue/type-events',{
	setup: function(){ },
	teardown: function(){ }
});

test("Events when object is bound/unbound", function() {
	expect(1);
	var Type = function(){};
	eventQueue(Type.prototype);
	addTypeEvents( Type );

	var obj1 = new Type(),
		obj2 = new Type();

	var calls = [];
	var metaHandler = function(obj, newVal) {
		calls.push([obj, newVal]);
	};
	var handler = function() {};

	Type[canSymbol.for("can.onInstanceBoundChange")](metaHandler);

	obj1.on("first", handler);
	obj1.off("first", handler);
	obj2.on("second", handler);
	obj2.off("second", handler);

	// Sanity check.  Ensure that no more events fire after offBoundChange
	Type[canSymbol.for("can.offInstanceBoundChange")](metaHandler);
	obj1.on("first", handler);
	obj1.off("first", handler);

	QUnit.deepEqual(calls,[
		[obj1,true],
		[obj1,false],
		[obj2,true],
		[obj2,false]
	]);
});

test("can.dispatchInstanceOnPatches", function() {
	expect(1);
	var Type = function(){};
	eventQueue(Type.prototype);
	addTypeEvents( Type );
    var calls = [];
    var handler = function(obj, patches){
    	calls.push([obj, patches]);
    };
    Type[canSymbol.for("can.onInstancePatches")](handler);


    var obj1 = new Type();
    Type[canSymbol.for("can.dispatchInstanceOnPatches")](obj1, [{type: "add",    key: "b", value: 1}]);
    Type[canSymbol.for("can.offInstancePatches")](handler);

	QUnit.deepEqual(calls,[
		[obj1, [{type: "add",    key: "b", value: 1}]]
	]);
});

test("can.dispatchInstanceOnPatches with patches on event object", function() {
	expect(1);
	var Type = function(){};
	eventQueue(Type.prototype);
	addTypeEvents( Type );
    var calls = [];
    var handler = function(obj, patches){
    	calls.push([obj, patches]);
    };
    Type[canSymbol.for("can.onInstancePatches")](handler);


    var obj1 = new Type();
	obj1.dispatch({
		type: "b",
		patches: [{type: "add",    key: "b", value: 1}]
	});
    Type[canSymbol.for("can.offInstancePatches")](handler);
	obj1.dispatch({
		type: "b",
		patches: [{type: "add",    key: "b", value: 1}]
	});

	QUnit.deepEqual(calls,[
		[obj1, [{type: "add",    key: "b", value: 1}]]
	]);
});

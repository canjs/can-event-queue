var QUnit = require('steal-qunit');
var valueEventBindings = require("./value");
var canReflect = require("can-reflect");
var canSymbol = require("can-symbol");

QUnit.module('can-event-queue/value',{
	setup: function(){ },
	teardown: function(){ }
});

QUnit.test("basics", function(){
	var observable = valueEventBindings(valueEventBindings.addHandlers({}));
    var values = [];

    canReflect.onValue(observable, function(newVal, oldVal){
        values.push(["onValue",newVal, oldVal]);
    });

    observable.on(function(newVal, oldVal){
        values.push(["on",newVal, oldVal]);
    },"notify");

    observable[canSymbol.for("can.dispatch")](1,2);

    QUnit.deepEqual(values,[
        ["on",1, 2],
        ["onValue",1, 2]
    ],"dispatched worked");
});

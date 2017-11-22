var steal = require("@steal");
var QUnit = require("steal-qunit");
var valueEventBindings = require("./value");
var canReflect = require("can-reflect");
var canSymbol = require("can-symbol");

var skipProductionTest = steal.isEnv("production") ? QUnit.skip : QUnit.test;

QUnit.module("can-event-queue/value", {
	setup: function() {},
	teardown: function() {}
});

QUnit.test("basics", function() {
	var observable = valueEventBindings(valueEventBindings.addHandlers({}));
	var values = [];

	canReflect.onValue(observable, function(newVal, oldVal) {
		values.push(["onValue", newVal, oldVal]);
	});

	observable.on(function(newVal, oldVal) {
		values.push(["on", newVal, oldVal]);
	}, "notify");

	observable[canSymbol.for("can.dispatch")](1, 2);

	QUnit.deepEqual(
		values,
		[["on", 1, 2], ["onValue", 1, 2]],
		"dispatched worked"
	);
});

QUnit.test("addHandlers takes optional callbacks argument", function(assert) {
	var obj = {};
	var callbacks = {
		onFirst: function() {},
		onEmpty: function() {}
	};

	valueEventBindings.addHandlers(obj, callbacks);
	assert.equal(
		obj.handlers.callbacks,
		callbacks
	);
});

skipProductionTest("getWhatIChange", function(assert) {
	var getChangesSymbol = canSymbol.for("can.getChangesDependencyRecord");
	var observable = valueEventBindings(valueEventBindings.addHandlers({}));

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

	mutateHandler[getChangesSymbol] = getChanges(a);
	domUIHandler[getChangesSymbol] = getChanges(b);
	notifyHandler[getChangesSymbol] = getChanges(a);

	observable.handlers.add(["mutate", mutateHandler]);
	observable.handlers.add(["domUI", domUIHandler]);
	observable.handlers.add(["notify", notifyHandler]);

	var whatIChange = getWhatIChange();
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
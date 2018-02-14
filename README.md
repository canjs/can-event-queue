# can-event-queue

[![Build Status](https://travis-ci.org/canjs/can-event-queue.svg?branch=master)](https://travis-ci.org/canjs/can-event-queue)

`can-event-queue` mixes in event binding and dispatching methods that
use [can-queues](../can-queues).  This adds legacy binding methods `addEventListener`
and `removeEventListener`.  This package should not be used for new packages.


## Use

```js
import eventQueue from "can-event-queue";

const obj = eventQueue( obj );

// obj now has `.on`, `.dispatch`, `.addEventListener` methods
// as well as `can.onKeyValue` and `can.offKeyValue` symbols.


obj.on( "event", function() {
	console.log( "event fired!" );
} );

obj.dispatch( "event" );
```

Critically, event handlers can be registered to run in different queues.

```js
const obj = eventQueue( obj );

obj.on( "event", function mutateHandler() {
	console.log( "mutate" );
}, "mutate" );


obj.on( "event", function() {
	console.log( "notify" );
}, "notify" );

obj.dispatch( "event" ); // logs "notify" then "mutate" because notify comes first
```

# patch-module

[![npm version](https://badge.fury.io/js/patch-module.svg)](https://badge.fury.io/js/patch-module)
[![Build Status](https://travis-ci.org/kus/patch-module.svg?branch=master)](https://travis-ci.org/kus/patch-module)
[![Coverage Status](https://coveralls.io/repos/github/kus/patch-module/badge.svg?branch=master)](https://coveralls.io/github/kus/patch-module?branch=master)

Monkey patch npm modules.

Have you ever looked through a module you are using and wished it was written just a little bit different?

Knowing the hassle of forking a repo, changing the code, submitting a Pull Request (which may not get accepted) and then losing track of updates in the original module; I built Patch Module.   Patch Module allows you to change the source code of another module before it is `required`. It mimics node's `require` functionality, making it familiar to use whilst avoiding the use of `eval`. Patch Module will load a module from the file system, apply the patches you wish to make and then compiles the module.

Patch Module includes a couple of optional safety features too. You can define the version of the module you are patching as well as how many times the regex for the patch should match. If either of those operations don't match your settings, Patch Module will alert you letting you know that the module you are trying to patch has been updated and you should check your patch is still necessary.

# Install

```bash
$ npm install patch-module --save
```

# Usage

We will use the module [is-it-friday](https://www.npmjs.com/package/is-it-friday) as an example of a module to patch. [is-it-friday](https://www.npmjs.com/package/is-it-friday) is simply one line `module.exports = "Probably not...";`

Default [is-it-friday](https://www.npmjs.com/package/is-it-friday) behaviour:

```javascript
// file: index.js
var isItFriday = require('is-it-friday');
console.log(isItFriday); // Probably not...
```

Patching as a `require`:

```javascript
// file: index.js
var patch = require('patch-module');
var isItFriday = patch('./node_modules/is-it-friday/index.js', {
	version: '0.1.0',
	package: './node_modules/is-it-friday/package.json'
}, [
	{find: '"Probably not..."', replace: '(new Date()).getDay() === 5 ? "Yes" : "No"', expect: 1}
]);
console.log(isItFriday); // "Yes" or "No" depending if it's Friday
```

 Here we create our patched `isItFriday` module so we can require it elsewhere in our project whilst making it easy to revert to the original module later if needed:

```javascript
// file: index.js
var isItFriday = require('./patch/is-it-friday.js');
console.log(isItFriday); // "Yes" or "No" depending if it's Friday
 
// file: patch/is-it-friday.js
var patch = require('patch-module');
module.exports = patch('./node_modules/is-it-friday/index.js', {
	version: '0.1.0',
	package: './node_modules/is-it-friday/package.json'
}, [
	{find: '"Probably not..."', replace: '(new Date()).getDay() === 5 ? "Yes" : "No"', expect: 1}
]);
```

# Advanced Usage

To show an example of patching multiple files in a module we will use [jugglingdb](https://www.npmjs.com/package/jugglingdb) as an example. Let's patch the way jugglingdb handles connection errors when trying to connect to a Mongo database that is not available, by adding the ability to listen to a new `error` event and handle it instead of it `throwing` an uncatchable error.

In [jugglingdb](https://www.npmjs.com/package/jugglingdb) if a full path is specified for a `Schema` it will load that instead of looking in `node_modules` so we can point it directly to our modified `jugglingdb-mongodb` module.

```javascript
// file: index.js
var jugglingdb = require('./patch/jugglingdb.js');
var Schema = jugglingdb.Schema;
var db = new Schema(__dirname + '/patch/jugglingdb-mongodb.js', {
	url: process.env.MONGO_URL || 'mongodb://localhost:27017/test'
});
db.on('connected', function () {
	console.log('connected!');
});
db.on('disconnected', function () {
	console.log('disconnected!');
});
// This is new functionality
db.on('error', function (err) {
	console.log('error!', err.message);
});
```

We need to modify the Schema class, which is loaded from the modules `index.js`.
 
Important: If you are modifying a relative require (`require(./`) you need to replace the new path with the full path.

```javascript
// file: patch/jugglingdb.js
var patch = require('patch-module');
module.exports = patch('./node_modules/jugglingdb/index.js', {
	version: '2.0.0-rc8',
	package: './node_modules/jugglingdb/package.json'
}, [
	{find: 'var Schema = exports.Schema = require(\'./lib/schema\').Schema;', replace: 'var Schema = exports.Schema = require(\'' + __dirname + '/patch/jugglingdb-schema.js\').Schema;', expect: 1}
]);
```

Here we are modifying the [jugglingdb-mongodb](https://www.npmjs.com/package/jugglingdb-mongodb) connector module and changing the `throw` to calling the callback and passing the error on, that way we can choose how to handle it. We expect to make two replacements, so we've set `expect` to `2`.

```javascript
// file: patch/jugglingdb-mongodb.js
var patch = require('patch-module');
module.exports = patch('./node_modules/jugglingdb-mongodb/lib/mongodb.js', {
	version: '0.2.0',
	package: './node_modules/jugglingdb-mongodb/package.json'
}, [
	{find: /if \(err\) throw err;/mg, replace: 'if (err) return callback(err);', expect: 2},
]);
```

When [jugglingdb](https://www.npmjs.com/package/jugglingdb) connects to a database, it creates a `client` variable that holds the connection to the database in the connector and passes it back. However it doesn't check if the `client` variable actually has a valid connection that emits the `connected` event. So we are checking if the `client` variable has a valid connection to a database and only emitting the `connected` event then, if not we will emit a new `error` event with the error. 

```javascript
// file: patch/jugglingdb-schema.js
var patch = require('patch-module');
module.exports = patch('./node_modules/jugglingdb/lib/schema.js', {
	version: '2.0.0-rc8',
	package: './node_modules/jugglingdb/package.json'
}, [
	{find: 'adapter.initialize(this, function () {', replace: 'adapter.initialize(this, function (err) {', expect: 1},
	{find: /this\.connecting = false;\s+this\.connected = true;\s+this\.emit\('connected'\);/m, replace: `if (this.client) {
			this.connecting = false;
			this.connected = true;
			this.emit('connected');
		} else {
			this.emit('error', err);
		}`, expect: 1}
]);
```

# patch(filePath, options = {}, replacements = [])

 * The first argument `filePath` is the path to the file you want to patch.
 * The second argument can be either an [options Object](#options-object), [replacements Array](#replacements-array), [callback Function](#callback-function) or `undefined`.
 * The third argument can be a [replacements Array](#replacements-array), [callback Function](#callback-function) or `undefined`.

## options Object
 * `version` - Version that we expect from the `package` file for the module we are modifying
 * `package` - Package file to look in when `version` is defined
 * `dontReplaceRelativeRequires` - Don't automatically replace `require(./` with `require(path/to/file/you/are/changing`. The module is set to replace relative requires from a module back to the original path by default as a convenience
 * `callback` - `callback` `Function`, see [callback Function](#callback-function) below
 * `returnAsString` - Useful for debugging your modifications, will return the source as a string which you can write to a file or `console.log`

## replacements Array

An `Array` of replacement `Objects` with keys:

 * `find` - `String` or `RegExp` to look for
 * `replace` - `String` to replace what we find with
 * `expect` - _(Optional)_ Explicitly define an `Integer` for how many occurrences of `find` we expect. This helps with module updates and old patches

## callback Function

A `Function` that takes a string `function (str) { /* ...modify str... */ return str; }`, modifies it and `returns` it to be compiled. If you have a `callback` `Function` and `replacements` `Array` the `callback` `Function` modifies the source first than the `replacements` are applied.

# Tests

To run the test suite, first install the dependencies, then run `npm test`:

```bash
$ npm install
$ npm test
```

## License

[MIT](LICENSE)
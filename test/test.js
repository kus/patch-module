var should = require('should');
var patch = require('../');

describe('Functionality', function () {

	describe('Patch 3rd party module: is-it-friday', function () {

		var isItFriday = require('is-it-friday');

		it('should make an educated guess', function (done) {
			isItFriday.should.equal('Probably not...');
			done();
		});

		var isItFridayPatched = patch('./node_modules/is-it-friday/index.js', {
			version: '0.1.0',
			package: './node_modules/is-it-friday/package.json'
		}, [
			{find: '"Probably not..."', replace: '(new Date()).getDay() === 5 ? "Yes" : "No"', expect: 1}
		]);

		it('should actually know when patched and work like a require', function (done) {
			isItFridayPatched.should.equal((new Date()).getDay() === 5 ? 'Yes' : 'No');
			done();
		});

		var isItFridayPatchFile = require('./is-it-friday');

		it('should actually know when patched and from a patch file', function (done) {
			isItFridayPatched.should.equal((new Date()).getDay() === 5 ? 'Yes' : 'No');
			done();
		});

	});

	describe('Patch JSON: package.json', function () {

		var patchedPackage = patch('./package.json', [
			{find: 'Blake Kus <blakekus+github@gmail.com>', replace: 'Blake Kus <blakekus+patched@gmail.com>', expect: 1}
		]);

		it('should be able to patch JSON', function (done) {
			patchedPackage.author.should.equal('Blake Kus <blakekus+patched@gmail.com>');
			done();
		});

	});

});

describe('File path', function () {

	describe('Error handling', function () {

		it('should throw an error if not present', function (done) {
			(function(){
				patch();
			}).should.throw();
			done();
		});

		it('should throw an error if not string', function (done) {
			(function(){
				patch(1);
			}).should.throw();
			done();
		});

		it('should throw an error if file doesn\'t exist', function (done) {
			(function(){
				patch('does_not_exist.js');
			}).should.throw();
			done();
		});

		it('should strip out BOM from file', function (done) {
			patch(String.fromCodePoint(0xFEFF) + 'module.exports = "BOM";', {
				inputSource: true,
				returnAsString: true
			}, []).length.should.equal(23);
			done();
		});

	});

});

describe('Options', function () {

	describe('version', function () {

		it('should throw an error if different', function (done) {
			(function(){
				patch('./node_modules/is-it-friday/index.js', {
					version: '0.2.0',
					package: './node_modules/is-it-friday/package.json'
				}, [
					{find: '"Probably not..."', replace: '(new Date()).getDay() === 5 ? "Yes" : "No"', expect: 1}
				]);
			}).should.throw();
			done();
		});

		it('should not throw an error if the same', function (done) {
			(function(){
				patch('./node_modules/is-it-friday/index.js', {
					version: '0.1.0',
					package: './node_modules/is-it-friday/package.json'
				}, [
					{find: '"Probably not..."', replace: '(new Date()).getDay() === 5 ? "Yes" : "No"', expect: 1}
				]);
			}).should.not.throw();
			done();
		});

	});

	describe('package', function () {

		it('should throw an error if file doesn\'t exist', function (done) {
			(function(){
				patch('./node_modules/is-it-friday/index.js', {
					version: '0.1.0',
					package: './node_modules/is-it-friday/packages.json'
				}, [
					{find: '"Probably not..."', replace: '(new Date()).getDay() === 5 ? "Yes" : "No"', expect: 1}
				]);
			}).should.throw();
			done();
		});

	});

	describe('returnAsString', function () {

		it('should return as string if set', function (done) {
			(typeof patch('./node_modules/is-it-friday/index.js', {
				returnAsString: true
			}, [
				{find: '"Probably not..."', replace: '(new Date()).getDay() === 5 ? "Yes" : "No"', expect: 1}
			]) === 'string').should.equal(true);
			done();
		});

	});

	describe('inputSource', function () {

		it('should return a valid module from input source instead of file', function (done) {
			patch(`
					module.exports = 'Works!';
				`, {
				inputSource: true
			}, []).should.equal('Works!');
			done();
		});

	});

	describe('dontReplaceRelativeRequires', function () {

		it('should not replace relative paths if this option is set', function (done) {
			(patch(`
					var isItFriday = require('./is-it-friday.js');
					module.exports = isItFriday;
				`, {
				inputSource: true,
				dontReplaceRelativeRequires: true,
				returnAsString: true
			}, []).indexOf('require(\'./is-it-friday.js\')') > -1).should.equal(true);
			done();
		});

	});

	describe('extension', function () {

		it('should overwrite extension', function (done) {
			(function(){
				patch('./node_modules/is-it-friday/index.js', {
					extension: '.json'
				}, [
					{find: '"Probably not..."', replace: '(new Date()).getDay() === 5 ? "Yes" : "No"', expect: 1}
				]);
			}).should.throw();
			done();
		});

	});

});

describe('Replacements', function () {

	describe('RegExp', function () {

		it('should add global flag when checking for count', function (done) {
			patch('./node_modules/is-it-friday/index.js', {
				version: '0.1.0',
				package: './node_modules/is-it-friday/package.json'
			}, [
				{find: /\.{3}/, replace: '!', expect: 1}
			]).should.equal('Probably not!');
			done();
		});

		it('should leave global flag as is if exists when checking for count', function (done) {
			patch('./node_modules/is-it-friday/index.js', {
				version: '0.1.0',
				package: './node_modules/is-it-friday/package.json'
			}, [
				{find: /\.{3}/g, replace: '!', expect: 1}
			]).should.equal('Probably not!');
			done();
		});

	});

	describe('Expect', function () {

		it('should throw if found different amount to expect', function (done) {
			(function(){
				patch('./node_modules/is-it-friday/index.js', [
					{find: '.', replace: '!', expect: 1}
				]);
			}).should.throw();
			done();
		});

	});

});


describe('Callback', function () {

    describe('Options param', function () {

        it('should take function in options param', function (done) {
            patch('./node_modules/is-it-friday/index.js', function (str) {return 'module.exports = "Hello World!"';}).should.equal('Hello World!');
            done();
        });

    });

    describe('Replacements param', function () {

        it('should take function in replacements param', function (done) {
            patch('./node_modules/is-it-friday/index.js', {}, function (str) {return 'module.exports = "Hello World!"';}).should.equal('Hello World!');
            done();
        });

    });

});
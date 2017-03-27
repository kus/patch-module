var patch = require('../');
module.exports = patch('./node_modules/is-it-friday/index.js', {
	version: '0.1.0',
	package: './node_modules/is-it-friday/package.json'
}, [
	{find: '"Probably not..."', replace: '(new Date()).getDay() === 5 ? "Yes" : "No"', expect: 1}
]);
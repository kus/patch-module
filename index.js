"use strict";

var fs = require('fs');
var path = require('path');
var util = require('util');
var assert = require('assert').ok;
var Module = require('module');
var crypto = require('crypto');

/**
 * Monkey patch a dependency
 *
 * @static
 * @param {String} filePath - Path to file you want to patch.
 * @param {Object} [opts={}] - Options
 * @param {String} [opts.version] - Version to check for (package required if set)
 * @param {String} [opts.package] - Package file to check version from (required if version set)
 * @param {Boolean} [opts.dontReplaceRelativeRequires=false] - Try to automatically replace relative requires. Set to true to disable.
 * @param {Boolean} [opts.returnAsString=false] - Return modified source as string.
 * @param {Boolean} [opts.inputSource=false] - filePath is source instead of file path.
 * @param {Boolean} [opts.extension=undefined] - Override extension.
 * @param {Function} [opts.callback=undefined] - Function to pass the source through and return modified.
 * @param {Object[]} [replacements=[]] - Array of replacement objects with find, replace, expect (optional) keys.
 * @param {String|RegExp} replacements[].find - What to find
 * @param {String} replacements[].replace - What to replace with
 * @param {Number} [replacements[].expect] - How many matches expected to find
 * @returns {String} Returns modified module exports
 * @example
 * // file: index.js
 * var isItFriday = require('./is-it-friday.js');
 * console.log(isItFriday);
 *
 * // file: is-it-friday.js
 * var patch = require('patch-module');
 * module.exports = patch('./node_modules/is-it-friday/index.js', {
 * 	version: '0.1.0',
 * 	package: './node_modules/is-it-friday/package.json'
 * }, [
 * 	{find: '"Probably not..."', replace: '(new Date()).getDay() === 5 ? "Yes" : "No"', expect: 1}
 * ]);
 */
function patch (filePath, opts, replacements) {
	assert(filePath, 'missing path');
	assert(util.isString(filePath), 'path must be a string');
	if (Array.isArray(opts)) {
        replacements = opts;
        opts = {};
	}
	if (typeof opts === 'function') {
        opts = {
        	callback: opts
		};
	}
    if (typeof replacements === 'function') {
        opts.callback = replacements;
        replacements = [];
    }
    if (typeof opts === 'undefined') {
        opts = {};
    }
	if (typeof replacements === 'undefined') {
		replacements = [];
	}
	var targetPath;
	if (!opts.inputSource) {
		try {
			var stats = fs.statSync(filePath);
		} catch (e) {
			throw new Error(filePath + ' does not exist!');
		}
		targetPath = path.resolve(filePath);
	} else {
		targetPath = './' + crypto.createHash('md5').update(filePath).digest('hex') + '.js';
	}
	if (opts.version && opts.package) {
		var packageObj = require(opts.package);
		if (opts.version !== packageObj.version) {
			throw new Error('Expected version ' + opts.version + ' but found verison ' + packageObj.version + ' for ' + filePath + '!');
		}
	}
	if (!opts.dontReplaceRelativeRequires) {
		replacements.push({
			find: /require\('.\//g,
			replace: 'require(\'' + path.resolve(filePath, '..') + '/'
		});
	}
	var content;
	if (!opts.inputSource) {
		content = stripBOM(fs.readFileSync(targetPath, 'utf8'));
	} else {
		content = stripBOM(filePath);
	}
	if (opts.callback && typeof opts.callback === 'function') {
        content = opts.callback(content);
	}
	if (replacements.length) {
        replacements.forEach(function (obj) {
            if (obj.find && obj.replace) {
                if (obj.expect) {
                    var count;
                    if (typeof obj.find === 'string') {
                        var lastIndex = 0;
                        count = 0;
                        while ((lastIndex = content.indexOf(obj.find, lastIndex) + 1) > 0) {
                            count++;
                        }
                    } else if (obj.find instanceof RegExp) {
                        if (!obj.find.global) {
                            count = (content.match(addRegexpFlags(obj.find, 'g')) || []).length;
                        } else {
                            count = (content.match(obj.find) || []).length;
                        }
                    }
                    if (count === obj.expect) {
                        content = content.replace(obj.find, obj.replace);
                    } else {
                        throw new Error('Expected ' + obj.expect + ' but found ' + count + ' for "' + obj.find + '".');
                    }
                } else {
                    content = content.replace(obj.find, obj.replace);
                }
            }
        });
    }
	if (opts.returnAsString) {
		return content;
	} else {
		var targetModule = new Module(targetPath, module.parent);
		targetModule.filename = targetPath;
		targetModule.paths = Module._nodeModulePaths(path.dirname(targetPath));
		var extension = opts.extension || path.extname(targetPath).toLowerCase() || '.js';
		switch (extension) {
			case '.json':
				try {
					targetModule.exports = JSON.parse(content);
				} catch (err) {
					err.message = filePath + ': ' + err.message;
					throw err;
				}
			break;
			default:
				targetModule._compile(content, targetPath);
			break;
		}
		targetModule.loaded = true;
		return targetModule.exports;
	}
}

function addRegexpFlags (re, add) {
    var flags = '';
    flags += (re.global) ? 'g' : '';
    flags += (re.ignoreCase) ? 'i' : '';
    flags += (re.multiline) ? 'm' : '';
    flags += (re.sticky) ? 'y' : '';
    flags += (re.unicode) ? 'u' : '';
    add.toString().split('').forEach(function (i) {
    	if (flags.indexOf(i) === -1) {
    		flags += i;
    	}
    });
    return new RegExp(re.source, flags);
}

// @see https://github.com/joyent/node/blob/master/lib/module.js
function stripBOM (content) {
	// Remove byte order marker. This catches EF BB BF (the UTF-8 BOM)
	// because the buffer-to-string conversion in `fs.readFileSync()`
	// translates it to FEFF, the UTF-16 BOM.
	if (content.charCodeAt(0) === 0xFEFF) {
		content = content.slice(1);
	}
	return content;
}

module.exports = patch;
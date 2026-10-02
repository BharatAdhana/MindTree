'use strict';
const javascript = require('./javascript');
const adapters = Object.freeze({ javascript, typescript: javascript, tsx: javascript, python: require('./python'), java: require('./java'), go: require('./go'), rust: require('./rust') });
module.exports = { adapters };

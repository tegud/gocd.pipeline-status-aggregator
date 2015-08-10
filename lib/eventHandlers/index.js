var http = require('http');
var logger = require('../logger');

var Promise = require('bluebird');

var handlers = {
	'pipelineResult': new require('./pipelineResult')(),
	'manualReleaseComplete': new require('./manualReleaseComplete')()
};

module.exports = {
	start: function() {
		_.each(handlers, function(handler) {
			if(handler.start) {
				handler.start();
			}
		});
	},
	handle: function(eventName) {
		var handleArguments = Array.prototype.slice.call(arguments, 1);
		return new Promise(function (resolve, reject) {
			if(!handlers[eventName] || !handlers[eventName].handle) {
				return;
			}

			handlers[eventName].handle.apply(undefined, handleArguments);

			resolve();
		});
	}
}
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
		return new Promise(function (resolve, reject) {
			if(!handlers[eventName] || !handlers[eventName].handle) {
				logger.logInfo('Could not find event handler for type', { handler: eventName });
				return;
			}

			handlers[eventName].handle.apply(undefined, Array.prototype.slice.call(arguments, 1));

			resolve();
		});
	}
}
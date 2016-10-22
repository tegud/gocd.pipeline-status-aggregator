var http = require('http');
var logger = require('../logger');
var moment = require('moment');

var handlers = {
	'pipelineResult': new require('./pipelineResult')(),
	'manualReleaseComplete': new require('./manualReleaseComplete')()
};

module.exports = {
	start: () => handlers.forEach(handler => {
		if(handler.start) {
			handler.start();
		}
	}),
	handle: (eventName, ...handleArguments) => new Promise(resolve => {
		if(!handlers[eventName] || !handlers[eventName].handle) {
			return logger.logDebug(`Unhandled event: ${eventName}`);
		}

		handlers[eventName].handle.apply(undefined, handleArguments);

		resolve();
	})
}

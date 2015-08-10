var http = require('http');

var Promise = require('bluebird');

var handlers = {
	'pipelineResult': require('./pipelineResult'),
	'manualReleaseComplete': require('./manualReleaseComplete')
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
				return;
			}

			handlers[eventName].handle.apply(undefined, Array.prototype.slice.call(arguments, 1));

			resolve();
		});
	}
}
var http = require('http');

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
		if(!handlers[eventName] || !handlers[eventName].handle) {
			return;
		}

		return handlers[eventName].handle.apply(undefined, Array.prototype.slice.call(arguments, 1));
	}
}
var http = require('http');
var logger = require('../logger');
var moment = require('moment');

var Promise = require('bluebird');

var handlers = {
	'pipelineResult': new require('./pipelineResult')(),
	'manualReleaseComplete': new require('./manualReleaseComplete')(),
	'release_order_signal': function () {
		return {
			handle: function(goClient, teams, event) {
				var request =  http.request({
					host: 'logs.laterooms.com',
					port: 9200,
					path: '/releases-' + moment().format('YYYY.MM') + '/release_order_signal',
					method: 'POST'
				}, function(response) {
					var allData = '';

					response.on('data', function (chunk) {
						allData += chunk;
					});

					response.on('end', function () { });
				});

				request.write(JSON.stringify({
					"@timestamp": event['@timestamp'],
					"newSignal": event.newSignal
				}));

				request.end();
			}
		};
	}
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

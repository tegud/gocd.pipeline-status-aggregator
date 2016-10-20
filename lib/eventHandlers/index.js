var http = require('http');
var logger = require('../logger');
var moment = require('moment');

var handlers = {
	'pipelineResult': new require('./pipelineResult')(),
	'manualReleaseComplete': new require('./manualReleaseComplete')(),
	'release_order_signal': (function () {
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

				var setUntil;

				if(event["@timestamp"] && event["duration"]) {
					var durationParser = /([0-9]+) ?(.+)/i;
					var durationMatches = durationParser.exec(event["duration"]);

					var durationMap = {
						'secs': 'seconds',
						'sec': 'seconds',
						'second': 'seconds',
						'mins': 'minutes',
						'min': 'minutes',
						'minute': 'minutes',
						'hrs': 'hours',
						'hr': 'hours',
						'hour': 'hours'
					};

					if(durationMatches) {
						setUntil = moment().add(parseInt(durationMatches[1], 10), durationMap[durationMatches[2]] || durationMatches[2]);
					}
				}

				request.write(JSON.stringify({
					"@timestamp": event['@timestamp'],
					"newSignal": event.newSignal,
					"setBy": event.setBy,
			        "reason": event.reason,
					"setUntil": setUntil
				}));

				request.end();
			}
		};
	})()
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

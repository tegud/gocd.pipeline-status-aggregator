var http = require('http');
var moment = require('moment');

module.exports = function () {
	return { 
		handle: function(goClient, teams, manualCompleteEvent) {
			var request =  http.request({
				host: 'logs.elasticsearch.laterooms.io',
				port: 9200,
				path: '/releases-' + moment().format('YYYY.MM') + '/release/' + manualCompleteEvent.releaseIdentifier + '/_update',
				method: 'POST'
			}, function(response) {
				var allData = '';

				response.on('data', function (chunk) {
					allData += chunk;
				});

				response.on('end', function () { });
			});

			request.write(JSON.stringify({ 
				doc: {
				    isComplete: true,
				    completedAt: moment().format()
				}
			}));

			request.end();
		}
	};
}

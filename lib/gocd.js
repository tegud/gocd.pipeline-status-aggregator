var http = require('http');
var Promise = require('bluebird');
var _ = require('lodash');

module.exports = function(goConfig, credentials) {
	var defaultOptions = _.defaults({
		headers: { 'Authorization': 'Basic ' + new Buffer(credentials.username + ':' + credentials.password).toString('base64') }
	}, goConfig);

	return {
		getPipelineInstance: function(pipeline, instanceCounter) {
			return new Promise(function(resolve, reject) {
				var requestOptions = _.defaults({
					path: '/go/api/pipelines/' + pipeline + '/instance/' + instanceCounter
				}, defaultOptions);

				var request =  http.request(requestOptions, function(err, resp) {
					var allData = '';

					response.on('data', function (chunk) {
						allData += chunk;
					});

					response.on('end', function () {
						console.log(allData);
					});
				});

				request.end();
			});
		}
	};
};

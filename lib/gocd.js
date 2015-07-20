var http = require('http');

module.exports = function(credentials) {
	var authHeader = 'Basic ' + new Buffer(credentials.username + ':' + credentials.password).toString('base64');

	return {
		getPipelineInstance: function(pipeline, instanceCounter) {
			var header = { 'Authorization': authHeader };
			var request =  http.request({
				hostname: 'go.laterooms.com',
				port: 8153,
				path: '/go/api/pipelines/' + pipeline + '/instance/' + instanceCounter
			}, function(err, resp) {
				console.log('Request done');
			});
		}
	};
};

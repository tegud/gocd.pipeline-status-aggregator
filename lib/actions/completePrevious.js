var http = require('http');
var _ = require('lodash');
var moment = require('moment');

function completePreviousPipeline (id, startedAt, completedTime) {
	var request =  http.request({
		host: 'logs.laterooms.com',
		port: 9200,
		path: '/releases-' + moment().format('YYYY.MM') + '/release/' + id + '/_update',
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
		    completedAt: completedTime.format(),
			timeInMs: completedTime.diff(startedAt, 'ms')
		}
	}));

	request.end();
}

module.exports = function completePreviousPipelineRuns(group, pipeline, startedAt) {
	if(!startedAt) {
		startedAt = moment();
	}

	var request =  http.request({
		host: 'logs.laterooms.com',
		port: 9200,
		path: '/releases-' + moment().format('YYYY.MM') + '/_search',
		method: 'POST'
	}, function(response) {
		var allData = '';

		response.on('data', function (chunk) {
			allData += chunk;
		});

		response.on('end', function () {
			var parsedResponse = JSON.parse(allData);

			if(!parsedResponse.hits.total) {
				return;
			}

			_.each(parsedResponse.hits.hits, function(item) {
				completePreviousPipeline(item._id, moment(item._source.startedAt), moment(item._source['@timestamp']));
			});
		});
	});

	request.write(JSON.stringify({
	    "filter" : {
	        "bool": {
	            "must": [
	                { "term" : { "group.raw": group } },
	                { "term" : { "pipeline.raw": pipeline } },
	                { "range" : { "startedAt": { "lt": startedAt.format(), "gte": "now-24h" } } },
	                { "term" : { "isComplete": false } }
	            ]
	        }
	    }
	}));

	request.end();
};

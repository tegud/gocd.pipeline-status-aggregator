var http = require('http');
var moment = require('moment');
var Promise = require('bluebird');
var _ = require('lodash');

var logger = require('../logger').forModule('PipelineResult Event Handler');
var eventEmitter = require('../events');

function storeToElasticsearch(teams, pipelineEvent, pipelineApiResponse) {
	return Promise.all([
		require('./pipelineStatus')(teams, pipelineEvent, pipelineApiResponse),
		require('./stageStatus')(teams, pipelineEvent, pipelineApiResponse),
		require('./materialLink')(teams, pipelineEvent, pipelineApiResponse)
	]);
}

module.exports = function() {
	return {
		handle: function (goClient, teams, pipelineEvent) {
			var pipelineStatusUpdate = pipelineEvent.result;

			goClient
				.getPipelineInstance(pipelineStatusUpdate.pipeline.name, pipelineStatusUpdate.pipeline.counter)
				.then(storeToElasticsearch.bind(undefined, teams, pipelineEvent))
				.catch(function(err) {
					logger.logError(err);
				});

		}
	};
};

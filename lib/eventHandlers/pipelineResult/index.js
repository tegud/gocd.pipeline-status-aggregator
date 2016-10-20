const http = require('http');
const moment = require('moment');
const _ = require('lodash');

var logger = require('../../logger').forModule('PipelineResult Event Handler');

function storeToElasticsearch(teams, pipelineEvent, pipelineApiResponse) {
	return Promise.all([
		require('./pipelineStatus')(teams, pipelineEvent, pipelineApiResponse),
		require('./stageStatus')(teams, pipelineEvent, pipelineApiResponse),
		require('./materialLink')(teams, pipelineEvent, pipelineApiResponse)
	]);
}

module.exports = function() {
	return {
		handle: (goClients, teams, pipelineEvent) => {
			const goClient = goClients[pipelineEvent.origin];

			if(!goClient) {
				return logger.logInfo(`Could not find go server "${pipelineEvent.origin}"`);
			}

			const pipelineStatusUpdate = pipelineEvent.result;

			goClient
				.getPipelineInstance(pipelineStatusUpdate.pipeline.name, pipelineStatusUpdate.pipeline.counter)
				.then(storeToElasticsearch.bind(undefined, teams, pipelineEvent))
				.catch(err => logger.logError(err));

		}
	};
};

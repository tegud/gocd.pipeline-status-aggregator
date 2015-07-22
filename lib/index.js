var logger = require('./logger');
var eventEmitter = require('./events');
var amqp = require('./amqp');
var credentialsLoader = require('./config');
var GoClient = require('./gocd');
var Promise = require('bluebird');
var TeamConfiguration = require('./teamConfiguration')

logger.logInfo('Starting GOCD Pipline Status Aggregator');

function buildPipelineDocumentKey(pipelineEvent) {
	return pipelineEvent.pipeline.group + '_' + pipelineEvent.pipeline.name + '_' + pipelineEvent.pipeline.counter;
}

function storePipelineStatus(teams, pipelineResult, apiResponse) {
	return new Promise(function (resolve, reject) {
		var pipelineEvent = pipelineResult.result;

		var doucmentKey = buildPipelineDocumentKey(pipelineEvent);

		var team = teams.findTeamFromGroupOrPipeline(pipelineEvent.pipeline.group) || pipelineEvent.pipeline.group;

		var releaseStatus = {
			pipeline: pipelineEvent.pipeline.name,
			counter: pipelineEvent.pipeline.counter,
			group:  pipelineEvent.pipeline.group
		};

		logger.logInfo('Setting release status document[' + doucmentKey + ']' + JSON.stringify({
			pipeline: pipelineEvent.pipeline.name,
			counter: pipelineEvent.pipeline.counter,
			group:  pipelineEvent.pipeline.group,
			currentStage: {
				name: pipelineEvent.pipeline.stage.name,
				state: pipelineEvent.pipeline.stage.state,
				result: pipelineEvent.pipeline.stage.result
			}
		}, null, 4));

		resolve();
	});
}

function storeStageStatus(teams, pipelineEvent, apiResponse) {
	return new Promise(function (resolve, reject) {
		resolve();
	});
}

function handleMessage(goClient, teams, pipelineEvent) {
	var pipelineStatusUpdate = pipelineEvent.result;

	if(pipelineEvent.type !== 'pipelineResult') {
		return;
	}

	function storePipelineAndStageStatus(pipelineApiResponse) {
		return Promise.all([
			storePipelineStatus(teams, pipelineEvent, pipelineApiResponse),
			storeStageStatus(teams, pipelineEvent, pipelineApiResponse)
		]);
	}

	goClient
		.getPipelineInstance(pipelineStatusUpdate.pipeline.name, pipelineStatusUpdate.pipeline.counter)
		.then(storePipelineAndStageStatus)
		.catch(function(err) {
			logger.logError(err);
		});
}

new credentialsLoader().load()
	.then(function(config) {
		return new Promise(function(resolve, reject) {
			logger.logInfo('Startup Complete');

			resolve(new GoClient({
				host: 'go.laterooms.com',
				port: 8153
			}, config.credentials, new TeamConfiguration(config.teams)));
		});
	})
	.then(function(goClient, teams) {
		return amqp(handleMessage.bind(undefined, goClient, teams), logger, { 
			"host": "127.0.0.1", 
			"exchange": "river-styx", 
			"routing": "pipelineResult", 
			"queue": "pipelineResult-aggregator" 
		}).start();
	});

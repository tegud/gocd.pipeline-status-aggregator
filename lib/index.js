var Promise = require('bluebird');
var _ = require('lodash');
var moment = require('moment');
var logger = require('./logger');
var eventEmitter = require('./events');
var amqp = require('./amqp');
var credentialsLoader = require('./config');
var GoClient = require('./gocd');
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
			'@timestamp': moment().format(),
			pipeline: pipelineEvent.pipeline.name,
			counter: pipelineEvent.pipeline.counter,
			group:  pipelineEvent.pipeline.group,
			team: team
		};

		if(apiResponse && apiResponse.stages.length) {
			var currentStageIndex = _.findIndex(apiResponse.stages, function(stage) {
				return stage.name === pipelineEvent.pipeline.stage.name;
			}) + 1;
			var isComplete = currentStageIndex === apiResponse.stages.length && pipelineEvent.pipeline.stage.state !== 'Building';

			_.merge(releaseStatus, {
				totalStages: apiResponse.stages.length,
				isComplete: isComplete,
				triggeredBy: apiResponse.stages[0].approved_by,
				currentStage: {
					number: currentStageIndex,
					name: pipelineEvent.pipeline.stage.name,
					state: pipelineEvent.pipeline.stage.state,
					result: pipelineEvent.pipeline.stage.result
				}
			});

			if(apiResponse.stages[0].jobs.length) {
				var startedAt = moment(apiResponse.stages[0].jobs[0].scheduled_date);

				releaseStatus.startedAt = startedAt.format()
				
				if(isComplete) {
					var completedAt = moment(pipelineEvent.pipeline.stage["last-transition-time"]);

					releaseStatus.completedAt = completedAt.format();
					releaseStatus.timeInMs = completedAt.diff(startedAt, 'ms');
				}
			}
		}

		logger.logInfo('Setting release status document[' + doucmentKey + ']' + JSON.stringify(releaseStatus, null, 4));

		var request =  http.request({
			host: 'logs.laterooms.com',
			port: 9200,
			path: '',
			method: 'PUT'
		}, function(response) {
			var allData = '';

			response.on('data', function (chunk) {
				allData += chunk;
			});

			response.on('end', function () {
				resolve(JSON.parse(allData));
			});
		});

		request.end();

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

			var goClient = new GoClient({
				host: 'go.laterooms.com',
				port: 8153
			}, config.credentials);
			var teams = new TeamConfiguration(config.teams);

			resolve(handleMessage.bind(undefined, goClient, teams));
		});
	})
	.then(function(handleMessage) {
		return amqp(handleMessage, logger, { 
			"host": "127.0.0.1", 
			"exchange": "river-styx", 
			"routing": "pipelineResult", 
			"queue": "pipelineResult-aggregator" 
		}).start();
	});

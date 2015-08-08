var Promise = require('bluebird');
var _ = require('lodash');
var moment = require('moment');
var http = require('http');
var logger = require('./logger');
var eventEmitter = require('./events');
var amqpListener = require('./amqp');
var amqpPublisher = require('./amqpPublisher');
var credentialsLoader = require('./config');
var GoClient = require('./gocd');
var TeamConfiguration = require('./teamConfiguration')

logger.logInfo('Starting GOCD Pipline Status Aggregator');

var publisher = new amqpPublisher(logger, { 
	"host": "127.0.0.1", 
	"exchange": "river-styx"
});

function buildPipelineDocumentKey(pipelineEvent) {
	return pipelineEvent.pipeline.group + '_' + pipelineEvent.pipeline.name + '_' + pipelineEvent.pipeline.counter;
}

function emitEventForReleaseStatus(releaseStatus, apiResponse) {
	if(releaseStatus.environment !== 'live') {
		return;
	}

	publisher.publish('releaseStatus', {
		team: releaseStatus.team,
		pipeline: releaseStatus.pipeline,
		status: pipelineEvent.pipeline.stage.state,
		result: releaseStatus.currentStage.result,
		currentStageName: releaseStatus.currentStage.name,
		currentStage: releaseStatus.currentStage.number,
		totalStages: releaseStatus.totalStages,
		user: releaseStatus.triggeredBy
	});
}

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

function completePreviousPipelineRuns(group, pipeline, startedAt) {
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
}

function storePipelineStatus(teams, pipelineResult, apiResponse) {
	return new Promise(function (resolve, reject) {
		var pipelineEvent = pipelineResult.result;

		var doucmentKey = buildPipelineDocumentKey(pipelineEvent);

		var team = teams.findTeamFromGroupOrPipeline(pipelineEvent.pipeline.group) || pipelineEvent.pipeline.group;
		var environment = teams.getEnvironmentForTeam(team, pipelineEvent.pipeline.group, pipelineEvent.pipeline.name) || 'Unknown';

		var releaseStatus = {
			'@timestamp': moment().format(),
			pipeline: pipelineEvent.pipeline.name,
			counter: pipelineEvent.pipeline.counter,
			group:  pipelineEvent.pipeline.group,
			team: team,
			environment: environment
		};

		if(apiResponse && apiResponse.stages.length) {
			var currentStageIndex = _.findIndex(apiResponse.stages, function(stage) {
				return stage.name === pipelineEvent.pipeline.stage.name;
			}) + 1;

			var isComplete = currentStageIndex === apiResponse.stages.length && pipelineEvent.pipeline.stage.state === 'Passed';

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

			var startedAt;
			if(apiResponse.stages[0].jobs.length) {
				startedAt = moment(apiResponse.stages[0].jobs[0].scheduled_date);

				releaseStatus.startedAt = startedAt.format();
				
				if(isComplete) {
					var completedAt = moment(pipelineEvent.pipeline.stage["last-transition-time"]);

					if(completedAt.format('ZZ') === '+0100') {
						completedAt.subtract(1, 'h');
					}

					releaseStatus.completedAt = completedAt.format();
					releaseStatus.timeInMs = completedAt.diff(startedAt, 'ms');
				}
			}
		}

		if(isComplete) {
			completePreviousPipelineRuns(pipelineEvent.pipeline.group, pipelineEvent.pipeline.name, startedAt);
		}

		logger.logInfo('Setting release status document[' + doucmentKey + '] ' + JSON.stringify(releaseStatus, null, 4));

		var request =  http.request({
			host: 'logs.laterooms.com',
			port: 9200,
			path: '/releases-' + moment().format('YYYY.MM') + '/release/' + doucmentKey,
			method: 'PUT'
		}, function(response) { });

		request.write(JSON.stringify(releaseStatus));
		request.end();

		emitEventForReleaseStatus(releaseStatus, apiResponse);

		resolve();
	});
}

function storeStageStatus(teams, pipelineEvent, apiResponse) {
	return new Promise(function (resolve, reject) {
		resolve();
	});
}

var handlers = {
	'pipelineResult': function (goClient, teams, pipelineEvent) {
		var pipelineStatusUpdate = pipelineEvent.result;

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
	},
	'manualReleaseComplete': function(goClient, teams, manualCompleteEvent) {
		var request =  http.request({
			host: 'logs.laterooms.com',
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

function handleMessage(goClient, teams, event) {
	if(!handlers[event.type]) {
		return;
	}

	handlers[event.type](goClient, teams, event)
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
		return new amqpListener(handleMessage, logger, { 
			"host": "127.0.0.1", 
			"exchange": "river-styx", 
			"routing": "pipelineResult", 
			"queue": "pipelineResult-aggregator" 
		}).start();
	})
	.then(function() {
		return publisher.start();
	});

var http = require('http');
var moment = require('moment');
var _ = require('lodash');

var logger = require('../../logger').forModule('Pipeline Status');
var eventEmitter = require('../../core').events;

var completePreviousPipelineRuns = require('../../actions/completePrevious');

function emitEventForReleaseStatus(releaseStatus, apiResponse) {
	eventEmitter.emit('publish-message', {
		type: 'pipelineStatus',
		status: {
			team: releaseStatus.team,
			pipeline: releaseStatus.pipeline,
			environment: releaseStatus.environment,
			startedAt: releaseStatus.startedAt,
			state: releaseStatus.currentStage.state,
			result: releaseStatus.currentStage.result,
			isComplete: releaseStatus.isComplete,
			currentStageName: releaseStatus.currentStage.name,
			currentStage: releaseStatus.currentStage.number,
			totalStages: releaseStatus.totalStages,
			user: releaseStatus.triggeredBy
		}
	});
}

module.exports = function storePipelineStatus(teams, pipelineResult, apiResponse) {
	logger.logInfo(JSON.stringify(pipelineResult));
	logger.logInfo(JSON.stringify(apiResponse));

	return new Promise(function (resolve, reject) {
		var pipelineEvent = pipelineResult.result;

		function buildPipelineDocumentKey(pipelineEvent) {
			return pipelineEvent.pipeline.group + '_' + pipelineEvent.pipeline.name + '_' + pipelineEvent.pipeline.counter;
		}

		var documentKey = buildPipelineDocumentKey(pipelineEvent);

		logger.logInfo('Processing pipeline status for [' + documentKey + '] ' + JSON.stringify(releaseStatus, null, 4));

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

		logger.logInfo('Document [' + documentKey + '] should be complete: ' + isComplete);

		if(isComplete) {
			completePreviousPipelineRuns(pipelineEvent.pipeline.group, pipelineEvent.pipeline.name, startedAt);
		}

		logger.logInfo('Setting release status document[' + documentKey + '] ' + JSON.stringify(releaseStatus, null, 4));

		var request =  http.request({
			host: 'logs.elasticsearch.laterooms.io',
			port: 9200,
			path: '/releases-' + moment().format('YYYY.MM') + '/release/' + documentKey,
			method: 'PUT'
		}, function(response) {
			if(!/2[0-9]{2}/.exec(response.statusCode)) {
				return logger.logError('Error saving: [' + documentKey + '] ', { statusCode: response.statusCode });
			}

			logger.logInfo('ES document ' + documentKey + ' written successfully.')
		});

		request.write(JSON.stringify(releaseStatus));
		request.end();

		emitEventForReleaseStatus(releaseStatus, apiResponse);

		resolve();
	});
}
